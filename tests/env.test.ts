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
      AVAILABILITY_TOKEN: "a",
      DATABASE_URL: "postgres://localhost/db",
      CATALOG_LIVE_FEED2_STRICT: "0",
      // PT-015: алерт включён по умолчанию, значит «полная конфигурация»
      // обязана включать и независимый канал алерта — иначе предупреждение
      // законно, а тест проверял бы неполный набор.
      DELIVERY_ALERT_WEBHOOK_URL: "https://alerts.example/hook",
    });
    expect(env.warnings).toEqual([]);
  });

  describe("PT-015 · алерт о сбоях доставки", () => {
    const FULL = {
      TELEGRAM_BOT_TOKEN: "t",
      TELEGRAM_CHAT_ID: "c",
      WEB3FORMS_ACCESS_KEY: "k",
      CRON_SECRET: "s",
      AVAILABILITY_TOKEN: "a",
      DATABASE_URL: "postgres://localhost/db",
      CATALOG_LIVE_FEED2_STRICT: "0",
    };

    it("включён по умолчанию", () => {
      expect(withEnv({ DELIVERY_ALERT_ENABLED: undefined }).DELIVERY_ALERT_ENABLED).toBe(true);
    });

    it("предупреждает, если канал алерта не задан: деградация останется незамеченной", () => {
      const env = withEnv({
        ...FULL,
        DELIVERY_ALERT_ENABLED: undefined,
        DELIVERY_ALERT_WEBHOOK_URL: undefined,
        DELIVERY_ALERT_TELEGRAM_BOT_TOKEN: undefined,
        DELIVERY_ALERT_TELEGRAM_CHAT_ID: undefined,
      });
      expect(env.warnings.some((w) => w.includes("DELIVERY_ALERT_WEBHOOK_URL"))).toBe(true);
    });

    it("второй Telegram-бот — тоже настроенный канал, предупреждения нет", () => {
      const env = withEnv({
        ...FULL,
        DELIVERY_ALERT_WEBHOOK_URL: undefined,
        DELIVERY_ALERT_TELEGRAM_BOT_TOKEN: "alert-bot",
        DELIVERY_ALERT_TELEGRAM_CHAT_ID: "-100",
      });
      expect(env.warnings).toEqual([]);
    });

    it("бот без чата каналом не считается", () => {
      const env = withEnv({
        ...FULL,
        DELIVERY_ALERT_WEBHOOK_URL: undefined,
        DELIVERY_ALERT_TELEGRAM_BOT_TOKEN: "alert-bot",
        DELIVERY_ALERT_TELEGRAM_CHAT_ID: "  ",
      });
      expect(env.warnings.some((w) => w.includes("канал алерта не задан"))).toBe(true);
    });

    it("выключенный алерт не требует канала", () => {
      const env = withEnv({ ...FULL, DELIVERY_ALERT_ENABLED: "0" });
      expect(env.warnings).toEqual([]);
    });

    it("числовые пороги: по умолчанию, мусор → дефолт, значение не ниже пола", () => {
      expect(withEnv({}).DELIVERY_ALERT_THRESHOLD).toBe(4);
      expect(withEnv({}).DELIVERY_ALERT_WINDOW_MIN).toBe(30);
      expect(withEnv({}).DELIVERY_ALERT_COOLDOWN_MIN).toBe(60);
      expect(withEnv({}).DELIVERY_ALERT_LOOKBACK).toBe(50);

      // Опечатка не должна ронять старт API: мусор приводится к дефолту.
      expect(withEnv({ DELIVERY_ALERT_THRESHOLD: "много" }).DELIVERY_ALERT_THRESHOLD).toBe(4);
      expect(withEnv({ DELIVERY_ALERT_THRESHOLD: "" }).DELIVERY_ALERT_THRESHOLD).toBe(4);
      expect(withEnv({ DELIVERY_ALERT_THRESHOLD: "7" }).DELIVERY_ALERT_THRESHOLD).toBe(7);
      // Порог 0 означал бы «алерт на каждую неудачу», поэтому пол — 1.
      expect(withEnv({ DELIVERY_ALERT_THRESHOLD: "0" }).DELIVERY_ALERT_THRESHOLD).toBe(1);
      expect(withEnv({ DELIVERY_ALERT_WINDOW_MIN: "-5" }).DELIVERY_ALERT_WINDOW_MIN).toBe(1);
    });
  });

  /**
   * PT-016 · Календарь дат замера.
   *
   * Обе переменные обязаны быть в схеме: без `AVAILABILITY_TOKEN` админка
   * отвечает 503, и даты снова можно поменять только деплоем — то есть задача
   * не решена, а молча. `check:env` дублирует это правило, и в strict-режиме
   * (main/quizv2ver1) предупреждение становится ошибкой сборки.
   */
  describe("PT-016 · календарь дат замера", () => {
    /** Та же согласованная конфигурация, что в блоке PT-015: без предупреждений. */
    const FULL = {
      TELEGRAM_BOT_TOKEN: "t",
      TELEGRAM_CHAT_ID: "c",
      WEB3FORMS_ACCESS_KEY: "k",
      CRON_SECRET: "s",
      DATABASE_URL: "postgres://localhost/db",
      CATALOG_LIVE_FEED2_STRICT: "0",
      DELIVERY_ALERT_WEBHOOK_URL: "https://alerts.example/hook",
    };

    it("чтение из БД включено по умолчанию", () => {
      expect(withEnv({ AVAILABILITY_DB_ENABLED: undefined }).AVAILABILITY_DB_ENABLED).toBe(true);
      expect(withEnv({ AVAILABILITY_DB_ENABLED: "0" }).AVAILABILITY_DB_ENABLED).toBe(false);
    });

    it("пустой пароль считается отсутствующим", () => {
      expect(withEnv({ AVAILABILITY_TOKEN: "   " }).AVAILABILITY_TOKEN).toBeUndefined();
      expect(withEnv({ AVAILABILITY_TOKEN: "secret" }).AVAILABILITY_TOKEN).toBe("secret");
    });

    it("предупреждает, если БД есть, а пароля нет: календарь снова правится только деплоем", () => {
      const env = withEnv({
        ...FULL,
        AVAILABILITY_DB_ENABLED: undefined,
        AVAILABILITY_TOKEN: undefined,
      });
      expect(env.warnings.some((w) => w.includes("AVAILABILITY_TOKEN"))).toBe(true);
    });

    it("откат флага и отсутствие БД не требуют пароля", () => {
      expect(
        withEnv({ ...FULL, AVAILABILITY_TOKEN: undefined, AVAILABILITY_DB_ENABLED: "0" }).warnings
      ).toEqual([]);
      expect(
        withEnv({ ...FULL, AVAILABILITY_TOKEN: undefined, DATABASE_URL: undefined }).warnings.some(
          (w) => w.includes("AVAILABILITY_TOKEN")
        )
      ).toBe(false);
    });
  });
});
