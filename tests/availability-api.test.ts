/**
 * PT-016 · Публичный GET /api/availability.
 *
 * Проверяется контракт, на который рассчитывает клиентский хук
 * `useAvailabilityLabel`: при любой проблеме с БД роут отдаёт запасной
 * календарь из `content/availability.ts`, а не 500 и не пустой ответ. Иначе
 * блок «почему сейчас» пропадал бы у всех посетителей из-за одного
 * недоступного соединения с базой.
 *
 * Реальная БД здесь не поднимается: её сценарии — в `tests/availability-db.test.ts`.
 */
import { afterAll, afterEach, describe, expect, it } from "vitest";

import { GET } from "@/app/api/availability/route";
import { availability, getAvailabilityLabel } from "@/content/availability";
import { closeDb } from "@/db";
import { resetEnvCache } from "@/lib/env";

const ORIGINAL = { ...process.env };

/** Заведомо недоступный адрес: порт 1 закрыт, отказ мгновенный. */
const DEAD_DATABASE_URL = "postgres://potolkovo:potolkovo@127.0.0.1:1/none";

function withEnv(patch: Record<string, string | undefined>) {
  resetEnvCache();
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

afterEach(() => {
  process.env = { ...ORIGINAL };
  resetEnvCache();
});

afterAll(async () => {
  // Пул создаётся лениво, но после проверки «БД недоступна» он существует —
  // закрываем, чтобы vitest не ждал простаивающих соединений.
  await closeDb();
});

describe("PT-016 · GET /api/availability", () => {
  it("отдаёт запасной календарь, когда чтение из БД выключено флагом", async () => {
    withEnv({ AVAILABILITY_DB_ENABLED: "0", DATABASE_URL: DEAD_DATABASE_URL });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      source: "file",
      configured: false,
      label: getAvailabilityLabel(),
      validUntil: availability.validUntil,
      slots: [],
    });
  });

  it("без DATABASE_URL — тоже запасной календарь", async () => {
    withEnv({ AVAILABILITY_DB_ENABLED: "1", DATABASE_URL: undefined });

    const body = await (await GET()).json();

    expect(body.ok).toBe(true);
    expect(body.source).toBe("file");
    expect(body.label).toBe(getAvailabilityLabel());
  });

  it("недоступная БД не роняет роут: 200 и запасная строка", async () => {
    withEnv({ AVAILABILITY_DB_ENABLED: "1", DATABASE_URL: DEAD_DATABASE_URL });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.source).toBe("file");
  });

  it("ответ короткий по кэшу: владелец ждёт новые даты в течение полуминуты", async () => {
    withEnv({ AVAILABILITY_DB_ENABLED: "0", DATABASE_URL: undefined });

    const response = await GET();
    const cacheControl = response.headers.get("cache-control") ?? "";

    expect(cacheControl).toContain("s-maxage=30");
    expect(cacheControl).toContain("max-age=0");
  });
});
