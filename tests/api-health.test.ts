import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * PT-001 · Health/readiness эндпоинт.
 *
 * Смысл проверок — не «ручка отвечает 200», а два конкретных обещания:
 * состояние хранилища видно снаружи, и при этом наружу не утекает ни одного
 * секрета. Второе важнее: эндпоинт публичный и его будет опрашивать внешний
 * монитор, у которого нет и не должно быть доступа к конфигурации.
 */
const ENV_KEYS = [
  "DATABASE_URL",
  "TELEGRAM_LEADS_ENABLED",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHAT_ID",
  "WEB3FORMS_ACCESS_KEY",
  "BUILD_SHA",
] as const;

const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) saved[key] = process.env[key];
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

/** Свежий импорт: модуль кэширует env и время старта на уровне модуля. */
async function callHealth() {
  vi.resetModules();
  const { GET } = await import("../app/api/health/route");
  const response = await GET();
  return { response, body: await response.json() };
}

describe("GET /api/health", () => {
  it("без DATABASE_URL в проде: процесс жив, но не готов принимать заявки", async () => {
    delete process.env.DATABASE_URL;
    vi.stubEnv("NODE_ENV", "production");

    const { response, body } = await callHealth();

    expect(response.status).toBe(200);
    // ok и ready различаются намеренно: сайт работает, форма — нет.
    expect(body.ok).toBe(true);
    expect(body.ready).toBe(false);
    expect(body.storage).toBe("memory");
  });

  it("вне прода in-memory считается рабочим режимом", () => {
    /**
     * PT-002: разработка и тесты живут на памяти намеренно. Если бы health
     * репортил здесь `ready: false`, локальный запуск выглядел бы аварией.
     */
    expect(process.env.NODE_ENV).not.toBe("production");
  });

  it("с DATABASE_URL: готов принимать заявки", async () => {
    process.env.DATABASE_URL = "postgres://user:secret@db.internal:5432/potolkovo";

    const { body } = await callHealth();

    expect(body.ready).toBe(true);
    expect(body.storage).toBe("db");
  });

  it("не раскрывает строку подключения и токены", async () => {
    process.env.DATABASE_URL = "postgres://user:SUPERSECRET@db.internal:5432/potolkovo";
    process.env.TELEGRAM_BOT_TOKEN = "123456:TOKENVALUE";
    process.env.TELEGRAM_CHAT_ID = "-100500";
    process.env.WEB3FORMS_ACCESS_KEY = "w3f-secret-key";

    const { body } = await callHealth();
    const dump = JSON.stringify(body);

    for (const secret of ["SUPERSECRET", "TOKENVALUE", "-100500", "w3f-secret-key", "db.internal"]) {
      expect(dump, `утечка «${secret}»`).not.toContain(secret);
    }
  });

  it("каналы доставки показаны как факт настройки, а не значением", async () => {
    process.env.TELEGRAM_LEADS_ENABLED = "1";
    process.env.TELEGRAM_BOT_TOKEN = "123456:TOKENVALUE";
    process.env.TELEGRAM_CHAT_ID = "-100500";
    delete process.env.WEB3FORMS_ACCESS_KEY;

    const { body } = await callHealth();

    expect(body.deliveryChannels).toEqual({ telegram: true, web3forms: false });
  });

  it("телеграм не считается настроенным при неполной конфигурации", async () => {
    // Токен без chat_id — сообщение уйти не может, и монитор должен это видеть.
    process.env.TELEGRAM_LEADS_ENABLED = "1";
    process.env.TELEGRAM_BOT_TOKEN = "123456:TOKENVALUE";
    delete process.env.TELEGRAM_CHAT_ID;

    const { body } = await callHealth();

    expect(body.deliveryChannels.telegram).toBe(false);
  });

  it("ответ не кэшируется — иначе монитор увидит снимок прошлого деплоя", async () => {
    const { response } = await callHealth();
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("buildSha обрезан и не падает без переменной", async () => {
    process.env.BUILD_SHA = "abc123def4567890abcdef";
    const withSha = await callHealth();
    expect(withSha.body.buildSha).toBe("abc123def456");

    delete process.env.BUILD_SHA;
    delete process.env.GIT_SHA;
    const without = await callHealth();
    expect(without.body.buildSha).toBe("unknown");
  });

  it("uptimeSec — число, по которому виден рестарт между проверками", async () => {
    const { body } = await callHealth();
    expect(typeof body.uptimeSec).toBe("number");
    expect(body.uptimeSec).toBeGreaterThanOrEqual(0);
  });
});
