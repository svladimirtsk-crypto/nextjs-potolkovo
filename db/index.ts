/**
 * N-001 · Подключение к PostgreSQL.
 *
 * Пул кэшируется в `globalThis`: на serverless модуль переинициализируется
 * при каждом холодном старте, а лимит соединений у провайдера (Neon free — 100)
 * кончается быстро. `max: 3` — осознанно мало: роут делает 2-3 коротких запроса.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

type DbGlobal = typeof globalThis & {
  __potolkovoPool?: Pool;
  __potolkovoDb?: ReturnType<typeof drizzle<typeof schema>>;
};

const globalRef = globalThis as DbGlobal;

export function getPool(connectionString: string): Pool {
  if (!globalRef.__potolkovoPool) {
    globalRef.__potolkovoPool = new Pool({
      connectionString,
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
      // Managed-провайдеры (Neon, Vercel, Amvera) требуют TLS, но отдают
      // сертификат, которого нет в доверенных у Node. Локальную БД не трогаем.
      ssl: /localhost|127\.0\.0\.1/.test(connectionString)
        ? undefined
        : { rejectUnauthorized: false },
    });

    // Без обработчика единственная сетевая ошибка простаивающего клиента
    // роняет процесс целиком.
    globalRef.__potolkovoPool.on("error", (error) => {
      console.error("[db] ошибка простаивающего клиента:", error.message);
    });
  }

  return globalRef.__potolkovoPool;
}

export function getDb(connectionString: string) {
  if (!globalRef.__potolkovoDb) {
    globalRef.__potolkovoDb = drizzle(getPool(connectionString), { schema });
  }

  return globalRef.__potolkovoDb;
}

export type Db = ReturnType<typeof getDb>;

/** Только для тестов/скриптов: закрыть пул и сбросить кэш. */
export async function closeDb(): Promise<void> {
  await globalRef.__potolkovoPool?.end();
  globalRef.__potolkovoPool = undefined;
  globalRef.__potolkovoDb = undefined;
}
