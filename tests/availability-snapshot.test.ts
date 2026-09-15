/**
 * PT-016 · Выбор источника календаря: БД → запасной файл.
 *
 * Хранилище подменяется, поэтому тесты не требуют PostgreSQL и проверяют ровно
 * правила деградации: что показывается, когда БД выключена флагом, когда её нет,
 * когда календарь ещё не заполняли и когда запрос к БД упал. Отдельно — главное
 * требование задачи: ноль будущих окон означает `label: null`, то есть блок
 * срочности на сайте скрывается, а не показывает вчерашние даты.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { availability, getAvailabilityLabel } from "@/content/availability";
import { readAvailabilitySnapshot } from "@/lib/availability/snapshot";
import type { AvailabilityState, AvailabilityStore } from "@/lib/availability/store";

const NOW = new Date("2026-09-15T09:00:00Z");
const UPDATED_AT = "2026-09-15T06:30:00.000Z";

const ENV_DB = { AVAILABILITY_DB_ENABLED: true, DATABASE_URL: "postgres://localhost/db" };
const ENV_FLAG_OFF = { AVAILABILITY_DB_ENABLED: false, DATABASE_URL: "postgres://localhost/db" };
const ENV_NO_DB = { AVAILABILITY_DB_ENABLED: true, DATABASE_URL: undefined };

function storeWith(patch: Partial<AvailabilityState> = {}): AvailabilityStore {
  const state: AvailabilityState = {
    configured: true,
    updatedAt: UPDATED_AT,
    slots: [],
    ...patch,
  };

  return {
    read: async () => state,
    replace: async () => ({ updatedAt: state.updatedAt ?? UPDATED_AT }),
  };
}

function failingStore(message: string): AvailabilityStore {
  return {
    read: async () => {
      throw new Error(message);
    },
    replace: async () => {
      throw new Error(message);
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PT-016 · снимок календаря", () => {
  it("флаг выключен — работает файл, как до задачи (аварийный откат)", async () => {
    const snapshot = await readAvailabilitySnapshot({
      env: ENV_FLAG_OFF,
      now: NOW,
      store: storeWith({ slots: [{ date: "2026-09-18", note: null }] }),
    });

    expect(snapshot.source).toBe("file");
    expect(snapshot.label).toBe(getAvailabilityLabel(NOW));
    expect(snapshot.validUntil).toBe(availability.validUntil);
  });

  it("нет DATABASE_URL — тоже файл: календарь не обязан зависеть от БД", async () => {
    const snapshot = await readAvailabilitySnapshot({ env: ENV_NO_DB, now: NOW });

    expect(snapshot.source).toBe("file");
    expect(snapshot.label).toBe(getAvailabilityLabel(NOW));
  });

  it("таблицу ни разу не заполняли — файл: иначе блок исчез бы сразу после деплоя", async () => {
    const snapshot = await readAvailabilitySnapshot({
      env: ENV_DB,
      now: NOW,
      store: storeWith({
        configured: false,
        updatedAt: null,
        slots: [{ date: "2026-09-18", note: null }],
      }),
    });

    expect(snapshot).toMatchObject({ source: "file", configured: false });
    expect(snapshot.label).toBe(getAvailabilityLabel(NOW));
  });

  it("БД заполнена — источник правды она: конкретные даты вместо «чт, сб»", async () => {
    const snapshot = await readAvailabilitySnapshot({
      env: ENV_DB,
      now: NOW,
      store: storeWith({
        slots: [
          { date: "2026-09-25", note: "после 17:00" },
          { date: "2026-09-18", note: null },
          { date: "2026-09-20", note: null },
        ],
      }),
    });

    expect(snapshot.source).toBe("db");
    expect(snapshot.configured).toBe(true);
    expect(snapshot.updatedAt).toBe(UPDATED_AT);
    expect(snapshot.label).toBe(
      `${availability.labelPrefix} пт 18.09, вс 20.09, пт 25.09 (после 17:00)`
    );
    expect(snapshot.slots.map((slot) => slot.display)).toEqual([
      "пт 18.09",
      "вс 20.09",
      "пт 25.09 (после 17:00)",
    ]);
    expect(snapshot.validUntil).toBe("2026-09-25");
  });

  it("прошедшие даты отсекаются: в снимке только будущие окна", async () => {
    const snapshot = await readAvailabilitySnapshot({
      env: ENV_DB,
      now: NOW,
      store: storeWith({
        slots: [
          { date: "2026-09-01", note: null },
          { date: "2026-09-14", note: null },
          { date: "2026-09-18", note: null },
        ],
      }),
    });

    expect(snapshot.slots.map((slot) => slot.date)).toEqual(["2026-09-18"]);
    expect(snapshot.label).toContain("пт 18.09");
  });

  it("все даты прошли — label null: блок срочности скрывается без деплоя", async () => {
    const snapshot = await readAvailabilitySnapshot({
      env: ENV_DB,
      now: NOW,
      store: storeWith({
        slots: [
          { date: "2026-09-01", note: null },
          { date: "2026-09-14", note: null },
        ],
      }),
    });

    expect(snapshot.source).toBe("db");
    expect(snapshot.label).toBeNull();
    expect(snapshot.slots).toEqual([]);
    expect(snapshot.validUntil).toBeNull();
  });

  it("владелец оставил ноль окон — то же молчание, а не запасной файл", async () => {
    const snapshot = await readAvailabilitySnapshot({
      env: ENV_DB,
      now: NOW,
      store: storeWith({ slots: [] }),
    });

    // Отличие от «таблицу не заполняли» принципиальное: configured = true,
    // значит владелец уже сказал «окон нет», и файл показывать нельзя.
    expect(snapshot).toMatchObject({ source: "db", configured: true, label: null });
  });

  it("БД недоступна — файл и предупреждение в лог, страница не падает", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const snapshot = await readAvailabilitySnapshot({
      env: ENV_DB,
      now: NOW,
      store: failingStore("connection refused"),
    });

    expect(snapshot.source).toBe("file");
    expect(snapshot.label).toBe(getAvailabilityLabel(NOW));
    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0]?.join(" "))).toContain("connection refused");
  });

  it("время формирования снимка — это переданный момент, а не «сейчас» процесса", async () => {
    const snapshot = await readAvailabilitySnapshot({ env: ENV_NO_DB, now: NOW });
    expect(snapshot.generatedAt).toBe(NOW.toISOString());
  });
});
