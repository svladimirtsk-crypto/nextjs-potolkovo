/**
 * PT-016 · Снимок календаря: БД → запасной файл.
 *
 * Порядок источников ровно такой, чтобы деплой задачи не мог сломать сайт:
 *
 * 1. `AVAILABILITY_DB_ENABLED=0` или нет `DATABASE_URL` — как до задачи,
 *    работает `content/availability.ts` (правило 8 раздела 2 ТЗ: откат одной
 *    переменной окружения, без деплоя).
 * 2. Таблицу ни разу не заполняли через админку — тоже файл: иначе блок
 *    «свободные даты» исчез бы сразу после накатывания схемы, до первого
 *    захода владельца в `/admin/availability`.
 * 3. БД заполнена — источник правды она. Нуль будущих окон означает
 *    «свободных дат нет», и блок скрывается честно, а не показывает файл.
 * 4. БД недоступна/ошибка запроса — файл и предупреждение в лог. Календарь
 *    не тот повод, ради которого страница должна падать.
 */
import { availability, getAvailabilityLabel } from "@/content/availability";
import { getEnv, type Env } from "@/lib/env";

import { buildAvailabilityLabel, toSlotView, upcomingSlots } from "./format";
import { createAvailabilityStore, type AvailabilityState, type AvailabilityStore } from "./store";
import type { AvailabilitySnapshot } from "./types";

/**
 * Сколько секунд жить снимку в памяти процесса.
 *
 * Публичный API дёргают три компонента на странице, а календарь меняется
 * несколько раз в месяц. Полминуты — это ~2 запроса к БД в минуту при любом
 * трафике и заметная владельцу задержка не более полуминуты.
 */
export const SNAPSHOT_CACHE_MS = 30_000;

type AvailabilityEnv = Pick<Env, "AVAILABILITY_DB_ENABLED" | "DATABASE_URL">;

export type SnapshotDeps = {
  env?: AvailabilityEnv;
  now?: Date;
  /** Подмена хранилища в тестах; с ней кэш процесса не используется. */
  store?: AvailabilityStore;
};

function fileSnapshot(now: Date): AvailabilitySnapshot {
  return {
    label: getAvailabilityLabel(now),
    // В запасном файле конкретные даты не хранятся — только дни недели.
    slots: [],
    source: "file",
    configured: false,
    validUntil: availability.validUntil,
    updatedAt: null,
    generatedAt: now.toISOString(),
  };
}

function dbSnapshot(state: AvailabilityState, now: Date): AvailabilitySnapshot {
  const upcoming = upcomingSlots(state.slots, now);

  return {
    label: buildAvailabilityLabel(upcoming, { now }),
    slots: upcoming.map(toSlotView),
    source: "db",
    configured: true,
    validUntil: upcoming.length > 0 ? upcoming[upcoming.length - 1].date : null,
    updatedAt: state.updatedAt,
    generatedAt: now.toISOString(),
  };
}

/**
 * Причина ошибки одной строкой.
 *
 * Drizzle заворачивает сбой драйвера в `DrizzleQueryError`, у которого
 * `message` — это текст запроса, а настоящее объяснение («connection refused»,
 * «relation "availability_slots" does not exist») лежит в `cause`. В логе нужен
 * именно второй: по тексту запроса причину падения БД не понять.
 */
export function describeAvailabilityError(error: unknown): string {
  const cause = error instanceof Error ? (error as { cause?: unknown }).cause : undefined;
  if (cause instanceof Error) return cause.message;
  if (error instanceof Error) return error.message;
  return String(error);
}

let stateCache: { at: number; state: AvailabilityState } | null = null;

/** Сбросить кэш процесса. Вызывается после успешного сохранения в админке. */
export function invalidateAvailabilitySnapshotCache(): void {
  stateCache = null;
}

async function loadState(
  connectionString: string,
  store?: AvailabilityStore
): Promise<AvailabilityState> {
  if (store) return store.read();

  const at = Date.now();
  if (stateCache && at - stateCache.at < SNAPSHOT_CACHE_MS) return stateCache.state;

  const state = await createAvailabilityStore(connectionString).read();
  stateCache = { at, state };
  return state;
}

/** Снимок календаря для публичного API и серверных компонентов. */
export async function readAvailabilitySnapshot(
  deps: SnapshotDeps = {}
): Promise<AvailabilitySnapshot> {
  const now = deps.now ?? new Date();
  const env = deps.env ?? (getEnv() as AvailabilityEnv);

  if (!env.AVAILABILITY_DB_ENABLED || !env.DATABASE_URL) return fileSnapshot(now);

  try {
    const state = await loadState(env.DATABASE_URL, deps.store);
    // Календарь ещё не вели через админку — остаёмся на файле (см. пункт 2 выше).
    if (!state.configured) return fileSnapshot(now);
    return dbSnapshot(state, now);
  } catch (error) {
    console.warn(
      "[availability] календарь из БД не прочитался — показываю запасной:",
      describeAvailabilityError(error)
    );
    return fileSnapshot(now);
  }
}
