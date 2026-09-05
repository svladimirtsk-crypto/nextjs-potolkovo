import { afterEach, describe, expect, it } from "vitest";
import { getEnv, resetEnvCache } from "../lib/env";

const ORIGINAL = { ...process.env };

function withEnv(patch: Record<string, string | undefined>) {
  resetEnvCache();
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return getEnv();
}

afterEach(() => {
  process.env = { ...ORIGINAL };
  resetEnvCache();
});

describe("T-062 · lib/env", () => {
  it("флаги доставки включены по умолчанию", () => {
    const env = withEnv({ LEAD_API_ENABLED: undefined, TELEGRAM_LEADS_ENABLED: undefined });
    expect(env.LEAD_API_ENABLED).toBe(true);
    expect(env.TELEGRAM_LEADS_ENABLED).toBe(true);
  });

  it("STRICT каталога по умолчанию выключен — прод не должен падать из-за чужого фида", () => {
    expect(withEnv({ CATALOG_LIVE_FEED2_STRICT: undefined }).CATALOG_LIVE_FEED2_STRICT).toBe(false);
  });

  it('понимает "0"/"false" как выключено', () => {
    expect(withEnv({ LEAD_API_ENABLED: "0" }).LEAD_API_ENABLED).toBe(false);
    expect(withEnv({ LEAD_API_ENABLED: "false" }).LEAD_API_ENABLED).toBe(false);
    expect(withEnv({ LEAD_API_ENABLED: "1" }).LEAD_API_ENABLED).toBe(true);
  });

  it("пустой секрет считается отсутствующим", () => {
    expect(withEnv({ TELEGRAM_BOT_TOKEN: "   " }).TELEGRAM_BOT_TOKEN).toBeUndefined();
    expect(withEnv({ TELEGRAM_BOT_TOKEN: "abc" }).TELEGRAM_BOT_TOKEN).toBe("abc");
  });

  it("предупреждает о неполной конфигурации доставки", () => {
    const env = withEnv({
      TELEGRAM_BOT_TOKEN: undefined,
      TELEGRAM_CHAT_ID: undefined,
      WEB3FORMS_ACCESS_KEY: undefined,
      CRON_SECRET: undefined,
      DATABASE_URL: undefined,
    });
    expect(env.warnings.some((w) => w.includes("TELEGRAM_BOT_TOKEN"))).toBe(true);
    expect(env.warnings.some((w) => w.includes("CRON_SECRET"))).toBe(true);
    expect(env.warnings.some((w) => w.includes("DATABASE_URL"))).toBe(true);
  });

  it("полная конфигурация не даёт предупреждений", () => {
    const env = withEnv({
      TELEGRAM_BOT_TOKEN: "t",
      TELEGRAM_CHAT_ID: "c",
      WEB3FORMS_ACCESS_KEY: "k",
      CRON_SECRET: "s",
      DATABASE_URL: "postgres://localhost/db",
      CATALOG_LIVE_FEED2_STRICT: "0",
    });
    expect(env.warnings).toEqual([]);
  });
});
