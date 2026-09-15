/**
 * PT-016 · Доступ к календарю дат замера в PostgreSQL.
 *
 * Только сервер: модуль тянет `pg` через `@/db` и не должен попадать в
 * клиентский бандл. Клиент получает те же данные через `GET /api/availability`.
 *
 * Запись — одна транзакция «удалить все, вставить новые»: календарь маленький
 * (десятки строк), а владельцу важно, чтобы сохранение было атомарным. Иначе
 * обрыв связи на середине оставил бы сайт с половиной списка — то есть снова
 * с датами, которые никто не подтверждал.
 */
import { asc, eq } from "drizzle-orm";

import { getDb, type Db } from "@/db";
import { availabilitySettings, availabilitySlots } from "@/db/schema";

import type { AvailabilitySlot } from "./types";

/** Ид единственной строки настроек: календарь один на сайт. */
const SETTINGS_ID = 1;

export type AvailabilityState = {
  /** Заполняли ли календарь через админку хотя бы раз. */
  configured: boolean;
  /** Последнее сохранение (ISO) либо `null`, если его не было. */
  updatedAt: string | null;
  /** Все строки таблицы, включая прошедшие даты, по возрастанию. */
  slots: AvailabilitySlot[];
};

export type AvailabilityStore = {
  read(): Promise<AvailabilityState>;
  replace(slots: AvailabilitySlot[]): Promise<{ updatedAt: string }>;
};

type Executor = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

async function readState(executor: Executor): Promise<AvailabilityState> {
  const [settings] = await executor
    .select({
      updatedAt: availabilitySettings.updatedAt,
    })
    .from(availabilitySettings)
    .where(eq(availabilitySettings.id, SETTINGS_ID))
    .limit(1);

  const rows = await executor
    .select({
      slotDate: availabilitySlots.slotDate,
      note: availabilitySlots.note,
    })
    .from(availabilitySlots)
    .orderBy(asc(availabilitySlots.slotDate));

  return {
    configured: Boolean(settings),
    updatedAt: settings ? settings.updatedAt.toISOString() : null,
    slots: rows.map((row) => ({ date: row.slotDate, note: row.note })),
  };
}

async function replaceSlots(
  db: Db,
  slots: AvailabilitySlot[]
): Promise<{ updatedAt: string }> {
  const updatedAt = new Date();

  const [saved] = await db.transaction(async (executor) => {
    await executor.delete(availabilitySlots);

    if (slots.length > 0) {
      await executor
        .insert(availabilitySlots)
        .values(slots.map((slot) => ({ slotDate: slot.date, note: slot.note })));
    }

    /**
     * Одна и та же строка настроек при первом сохранении создаётся, при
     * следующих — обновляется. Именно она отличает «календарь ещё не трогали»
     * (сайт показывает запасной файл) от «владелец оставил ноль окон»
     * (сайт молчит).
     */
    return executor
      .insert(availabilitySettings)
      .values({ id: SETTINGS_ID, configuredAt: updatedAt, updatedAt })
      .onConflictDoUpdate({
        target: availabilitySettings.id,
        set: { updatedAt },
      })
      .returning({ updatedAt: availabilitySettings.updatedAt });
  });

  return { updatedAt: (saved?.updatedAt ?? updatedAt).toISOString() };
}

export function createAvailabilityStore(connectionString: string): AvailabilityStore {
  const db = getDb(connectionString);

  return {
    read: () => readState(db),
    replace: (slots) => replaceSlots(db, slots),
  };
}
