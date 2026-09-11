import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * PT-002 · Отказ вместо тихой потери заявки.
 *
 * До этого при пустом `DATABASE_URL` в проде заявка уходила в память процесса
 * и исчезала при первом рестарте — а клиент видел «Заявка №A-123 принята».
 * Предупреждение писалось в логи, которых никто не читает.
 *
 * Владелец выбрал деградацию вместо остановки сервиса: сайт остаётся в сети,
 * форма честно отказывает. Тесты фиксируют обе стороны этого выбора.
 */
const KEYS = ["DATABASE_URL"] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of KEYS) saved[key] = process.env[key];
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

async function isReady() {
  vi.resetModules();
  const { isLeadStorageReady } = await import("../lib/lead/store");
  return isLeadStorageReady();
}

describe("isLeadStorageReady", () => {
  it("прод без DATABASE_URL — не готов", async () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.DATABASE_URL;

    expect(await isReady()).toBe(false);
  });

  it("прод с DATABASE_URL — готов", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.DATABASE_URL = "postgres://user@host:5432/db";

    expect(await isReady()).toBe(true);
  });

  it("разработка без базы — готов: in-memory здесь осознанный режим", async () => {
    /**
     * Иначе локальный запуск и весь CI выглядели бы аварией, и правило
     * пришлось бы обходить — а обойдённое правило не защищает ничего.
     */
    vi.stubEnv("NODE_ENV", "development");
    delete process.env.DATABASE_URL;

    expect(await isReady()).toBe(true);
  });

  it("пустая строка в DATABASE_URL равна отсутствию адреса", async () => {
    // Переменная, заданная пустой в панели хостинга, — самый вероятный способ
    // получить «настроено, но не работает».
    vi.stubEnv("NODE_ENV", "production");
    process.env.DATABASE_URL = "";

    expect(await isReady()).toBe(false);
  });
});

describe("POST /api/lead при недоступном хранилище", () => {
  async function postLead() {
    vi.resetModules();
    const { POST } = await import("../app/api/lead/route");
    const request = new Request("http://localhost/api/lead", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        phone: "+79055219909",
        name: "Иван",
        consent: true,
        source: "test",
      }),
    });
    const response = await POST(request as never);
    return { response, body: await response.json() };
  }

  it("в проде без базы отвечает 503, а не мнимым успехом", async () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.DATABASE_URL;

    const { response, body } = await postLead();

    expect(response.status).toBe(503);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("storage_unavailable");
  });

  it("не выдаёт номер заявки, которого не существует", async () => {
    /**
     * Главный смысл задачи: раньше клиент получал leadId и уходил ждать
     * звонка. Номер без записи в базе — обещание, которое некому исполнить.
     */
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.DATABASE_URL;

    const { body } = await postLead();

    expect(body.leadId).toBeUndefined();
  });

  it("просит повторить позже — сбой хранилища обычно временный", async () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.DATABASE_URL;

    const { response } = await postLead();

    expect(response.headers.get("Retry-After")).toBeTruthy();
  });
});
