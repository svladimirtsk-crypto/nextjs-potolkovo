/**
 * PT-016 · Защищённый /api/admin/availability без реальной БД.
 *
 * Здесь проверяются доступ и разбор тела — то, что ломается тихо и сразу для
 * всех: «не настроено» должно отличаться от «неверный пароль», а кривая дата
 * не должна попадать в таблицу. Сценарии записи в PostgreSQL — в
 * `tests/availability-db.test.ts`.
 *
 * Токен сравнивается побайтово с постоянным временем (`timingSafeEqual`),
 * поэтому отдельно проверено, что значение другой длины и «почти верный» токен
 * дают 401, а не исключение и не успех.
 */
import { afterAll, afterEach, describe, expect, it } from "vitest";

import { GET, PUT } from "@/app/api/admin/availability/route";
import { closeDb } from "@/db";
import { resetEnvCache } from "@/lib/env";
import { MAX_NOTE_LENGTH } from "@/lib/availability/input";

const URL = "http://localhost:3000/api/admin/availability";
const TOKEN = "test-availability-token";
/** Заведомо недоступный адрес: до запросов к БД в этих тестах дело не доходит. */
const DEAD_DATABASE_URL = "postgres://potolkovo:potolkovo@127.0.0.1:1/none";

const ORIGINAL = { ...process.env };

function withEnv(patch: Record<string, string | undefined> = {}) {
  resetEnvCache();
  const next = {
    AVAILABILITY_TOKEN: TOKEN,
    AVAILABILITY_DB_ENABLED: "1",
    DATABASE_URL: DEAD_DATABASE_URL,
    ...patch,
  };
  for (const [key, value] of Object.entries(next)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function request(
  method: "GET" | "PUT",
  options: { token?: string | null; body?: unknown; rawBody?: string; headers?: Record<string, string> } = {}
) {
  const headers: Record<string, string> = { ...options.headers };
  if (options.token !== null) headers.authorization = `Bearer ${options.token ?? TOKEN}`;
  if (options.rawBody !== undefined) headers["content-type"] = "application/json";

  return new Request(URL, {
    method,
    headers,
    body: options.rawBody ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
  });
}

afterEach(() => {
  process.env = { ...ORIGINAL };
  resetEnvCache();
});

afterAll(async () => {
  await closeDb();
});

describe("PT-016 · доступ к админке календаря", () => {
  it("без AVAILABILITY_TOKEN — 503 «не настроено», а не 401", async () => {
    withEnv({ AVAILABILITY_TOKEN: undefined });

    const get = await GET(request("GET"));
    const put = await PUT(request("PUT", { body: { slots: [] } }));

    expect(get.status).toBe(503);
    expect((await get.json()).error).toBe("not_configured");
    expect(put.status).toBe(503);
  });

  it("пустой AVAILABILITY_TOKEN — то же самое: пустая строка не пароль", async () => {
    withEnv({ AVAILABILITY_TOKEN: "   " });

    const response = await GET(request("GET"));
    expect(response.status).toBe(503);
  });

  it("неверный, «почти верный» и отсутствующий токен — 401", async () => {
    withEnv();

    for (const token of ["wrong", `${TOKEN}1`, TOKEN.slice(0, TOKEN.length - 1), ""]) {
      const response = await GET(request("GET", { token }));
      expect(response.status, `token=${token}`).toBe(401);
    }

    const noHeader = await GET(request("GET", { token: null }));
    expect(noHeader.status).toBe(401);
  });

  it("верный токен проходит проверку доступа (и упирается уже в БД)", async () => {
    withEnv();

    const response = await GET(request("GET"));
    // 500 storage: адрес недоступен — важно, что НЕ 401/503.
    expect(response.status).toBe(500);
    expect((await response.json()).error).toBe("storage");
  });

  it("AVAILABILITY_DB_ENABLED=0 — 503 «отключено»: аварийный откат закрывает и запись", async () => {
    withEnv({ AVAILABILITY_DB_ENABLED: "0" });

    const response = await PUT(request("PUT", { body: { slots: [] } }));

    expect(response.status).toBe(503);
    expect((await response.json()).error).toBe("disabled");
  });

  it("без DATABASE_URL сохранять некуда — 503 с понятной причиной", async () => {
    withEnv({ DATABASE_URL: undefined });

    const response = await GET(request("GET"));

    expect(response.status).toBe(503);
    expect((await response.json()).error).toBe("no_database");
  });
});

describe("PT-016 · разбор тела сохранения", () => {
  it("не JSON — 400", async () => {
    withEnv();

    const response = await PUT(request("PUT", { rawBody: "даты: пятница" }));

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("bad_json");
  });

  it("прошедшая дата — 422 с текстом для человека", async () => {
    withEnv();

    const response = await PUT(request("PUT", { body: { slots: [{ date: "2020-01-01" }] } }));
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error).toBe("validation");
    expect(Array.isArray(body.issues)).toBe(true);
    expect(String(body.issues[0].message)).toContain("уже прошла");
    expect(String(body.issues[0].path)).toContain("Дата №1");
  });

  it("слишком длинная подпись окна — 422", async () => {
    withEnv();

    const response = await PUT(
      request("PUT", {
        body: {
          slots: [
            { date: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10), note: "о".repeat(MAX_NOTE_LENGTH + 1) },
          ],
        },
      })
    );

    expect(response.status).toBe(422);
  });

  it("тело больше 64 КБ — 413 до разбора JSON", async () => {
    withEnv();

    const huge = JSON.stringify({ slots: [], padding: "x".repeat(70_000) });
    const response = await PUT(request("PUT", { rawBody: huge }));

    expect(response.status).toBe(413);
    expect((await response.json()).error).toBe("too_large");
  });

  it("ответы не кэшируются: no-store на всех отказах", async () => {
    withEnv({ AVAILABILITY_TOKEN: undefined });

    const response = await GET(request("GET"));
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
