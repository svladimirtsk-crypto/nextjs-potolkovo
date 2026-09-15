/**
 * PT-016 · Календарь дат замера на настоящем PostgreSQL.
 *
 * Юнит-тесты проверяют правила на подменённом хранилище; здесь — то, что без
 * БД не проверить: применение схемы (`availability_slots`, `availability_settings`),
 * атомарная замена списка, отличие «календарь не заполняли» от «владелец оставил
 * ноль окон» и сброс кэша процесса после сохранения (без него владелец видел бы
 * старые даты ещё полминуты и решил бы, что правка не сработала).
 *
 * Пропускается без `TEST_DATABASE_URL`. Наружу не уходит ни одного запроса:
 * календарь не связан с Telegram/Web3Forms, правило 7 раздела 2 ТЗ не затронуто.
 */
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { GET as publicGet } from "@/app/api/availability/route";
import { GET as adminGet, PUT as adminPut } from "@/app/api/admin/availability/route";
import { closeDb, getDb } from "@/db";
import { availabilitySettings, availabilitySlots } from "@/db/schema";
import { addDaysIso, moscowTodayIso } from "@/lib/availability/format";
import {
  invalidateAvailabilitySnapshotCache,
  readAvailabilitySnapshot,
} from "@/lib/availability/snapshot";
import { createAvailabilityStore } from "@/lib/availability/store";
import { resetEnvCache } from "@/lib/env";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const TOKEN = "db-test-availability-token";

/** Даты относительно настоящего «сегодня» в Москве: тест не должен устаревать. */
function inDays(days: number): string {
  return addDaysIso(moscowTodayIso(), days);
}

function bearerRequest(method: "GET" | "PUT", body?: unknown): Request {
  return new Request("http://localhost:3000/api/admin/availability", {
    method,
    headers: {
      authorization: `Bearer ${TOKEN}`,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe.skipIf(!TEST_DATABASE_URL)("PT-016 · календарь в PostgreSQL", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(async () => {
    process.env = { ...ORIGINAL_ENV };
    process.env.DATABASE_URL = TEST_DATABASE_URL as string;
    process.env.AVAILABILITY_DB_ENABLED = "1";
    process.env.AVAILABILITY_TOKEN = TOKEN;
    resetEnvCache();
    invalidateAvailabilitySnapshotCache();

    const db = getDb(TEST_DATABASE_URL as string);
    await db.delete(availabilitySlots);
    await db.delete(availabilitySettings);
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    resetEnvCache();
    invalidateAvailabilitySnapshotCache();
  });

  afterAll(async () => {
    await closeDb();
  });

  it("пустая таблица — сайт на запасном файле: деплой задачи не гасит блок", async () => {
    const snapshot = await readAvailabilitySnapshot();

    expect(snapshot).toMatchObject({ source: "file", configured: false });
    expect(snapshot.label).not.toBeNull();
  });

  it("сохранение дат переключает сайт на БД", async () => {
    const store = createAvailabilityStore(TEST_DATABASE_URL as string);
    const { updatedAt } = await store.replace([
      { date: inDays(3), note: "утро" },
      { date: inDays(5), note: null },
    ]);

    const state = await store.read();
    expect(state.configured).toBe(true);
    expect(state.updatedAt).toBe(updatedAt);
    expect(state.slots.map((slot) => slot.date)).toEqual([inDays(3), inDays(5)]);
    expect(state.slots[0].note).toBe("утро");

    const snapshot = await readAvailabilitySnapshot();
    expect(snapshot.source).toBe("db");
    expect(snapshot.label).toContain(inDays(3).slice(8, 10));
    expect(snapshot.label).toContain("(утро)");
    expect(snapshot.validUntil).toBe(inDays(5));
  });

  it("замена целиком: прежние даты не остаются в таблице", async () => {
    const store = createAvailabilityStore(TEST_DATABASE_URL as string);
    await store.replace([{ date: inDays(1), note: null }, { date: inDays(2), note: null }]);
    await store.replace([{ date: inDays(9), note: "вечер" }]);

    const state = await store.read();
    expect(state.slots).toEqual([{ date: inDays(9), note: "вечер" }]);

    const db = getDb(TEST_DATABASE_URL as string);
    const rows = await db.select().from(availabilitySlots);
    expect(rows.length).toBe(1);
  });

  it("строка настроек одна: повторное сохранение не плодит дубли", async () => {
    const store = createAvailabilityStore(TEST_DATABASE_URL as string);
    await store.replace([{ date: inDays(1), note: null }]);
    await store.replace([{ date: inDays(2), note: null }]);

    const db = getDb(TEST_DATABASE_URL as string);
    const rows = await db.select().from(availabilitySettings);
    expect(rows.length).toBe(1);
  });

  it("ноль окон после сохранения — блок скрывается, а не показывает файл", async () => {
    const store = createAvailabilityStore(TEST_DATABASE_URL as string);
    await store.replace([{ date: inDays(1), note: null }]);
    await store.replace([]);

    const snapshot = await readAvailabilitySnapshot();
    expect(snapshot).toMatchObject({ source: "db", configured: true, label: null, slots: [] });

    const body = await (await publicGet()).json();
    expect(body).toMatchObject({ ok: true, source: "db", label: null });
  });

  it("просроченные даты в БД не попадают ни в строку, ни в список", async () => {
    const db = getDb(TEST_DATABASE_URL as string);
    const store = createAvailabilityStore(TEST_DATABASE_URL as string);
    await store.replace([{ date: inDays(4), note: null }]);

    // Прошедшую дату владелец ввести не может (422), но она остаётся в таблице
    // как история — ровно этот случай и должен отсекаться чтением.
    await db.insert(availabilitySlots).values({ slotDate: inDays(-2), note: "было" });
    invalidateAvailabilitySnapshotCache();

    const snapshot = await readAvailabilitySnapshot();
    expect(snapshot.slots.map((slot) => slot.date)).toEqual([inDays(4)]);
    expect(snapshot.label).not.toContain(inDays(-2).slice(8, 10));

    const body = await (await adminGet(bearerRequest("GET"))).json();
    expect(body.slots.map((slot: { date: string }) => slot.date)).toEqual([inDays(4)]);
    expect(body.expired.map((slot: { date: string }) => slot.date)).toEqual([inDays(-2)]);
  });

  it("PUT через админ-API пишет в БД и сразу виден в публичном ответе", async () => {
    const put = await adminPut(
      bearerRequest("PUT", {
        slots: [
          { date: inDays(6), note: "после 17:00" },
          { date: inDays(2) },
        ],
      })
    );
    const saved = await put.json();

    expect(put.status).toBe(200);
    expect(saved).toMatchObject({ ok: true, count: 2 });
    expect(saved.slots.map((slot: { date: string }) => slot.date)).toEqual([inDays(2), inDays(6)]);

    // Кэш снимка сброшен внутри PUT — иначе владелец увидел бы старые даты.
    const body = await (await publicGet()).json();
    expect(body.source).toBe("db");
    expect(body.label).toContain("(после 17:00)");
    expect(body.updatedAt).toBe(saved.updatedAt);
  });

  it("PUT с прошедшей датой не трогает таблицу", async () => {
    const store = createAvailabilityStore(TEST_DATABASE_URL as string);
    await store.replace([{ date: inDays(3), note: null }]);
    invalidateAvailabilitySnapshotCache();

    const response = await adminPut(
      bearerRequest("PUT", { slots: [{ date: inDays(-1) }, { date: inDays(7) }] })
    );
    expect(response.status).toBe(422);

    const state = await store.read();
    expect(state.slots.map((slot) => slot.date)).toEqual([inDays(3)]);
  });

  it("две строки на одну дату невозможны: уникальность на уровне схемы", async () => {
    const db = getDb(TEST_DATABASE_URL as string);
    await db.insert(availabilitySlots).values({ slotDate: inDays(3), note: null });

    // Drizzle заворачивает ошибку драйвера в `DrizzleQueryError`, поэтому
    // текст нарушения уникальности смотрим в `cause`.
    const error = await db
      .insert(availabilitySlots)
      .values({ slotDate: inDays(3), note: "утро" })
      .then(
        () => null,
        (thrown: unknown) => thrown as { cause?: { message?: string }; message?: string }
      );

    expect(error).not.toBeNull();
    expect(String(error?.cause?.message ?? error?.message)).toMatch(/duplicate key/i);
  });

  it("GET админки без сохранений сообщает, что источник — файл", async () => {
    const body = await (await adminGet(bearerRequest("GET"))).json();

    expect(body).toMatchObject({ ok: true, configured: false, updatedAt: null });
    expect(body.slots).toEqual([]);
    expect(body.today).toBe(moscowTodayIso());
  });
});
