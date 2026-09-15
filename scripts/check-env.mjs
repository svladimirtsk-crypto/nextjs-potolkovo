/**
 * T-062 · Проверка окружения.
 *
 * Два независимых контроля:
 *  1) `lib/env.ts` разбирает текущий `process.env` — падаем на явно кривых
 *     значениях (например, NODE_ENV вне списка);
 *  2) `.env.example` не должен разъезжаться со схемой: любая переменная из
 *     схемы обязана быть документирована, а в примере не должно остаться
 *     переменных от удалённых фич (как AMVERA_* от AI-советчика).
 *
 * Предупреждения (нет Telegram-токена, нет БД) печатаются, но не роняют:
 * локальная разработка без секретов — нормальный сценарий. С `--strict`
 * (или RELEASE=1) предупреждения становятся ошибками.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const strict = process.argv.includes("--strict") || process.env.RELEASE === "1";

/** Серверные переменные схемы `lib/env.ts` (NODE_ENV задаёт рантайм). */
const SCHEMA_KEYS = [
  "LEAD_API_ENABLED",
  "LEAD_IDEMPOTENCY_ENABLED",
  "LEAD_SERVER_RECALC_ENABLED",
  "LEAD_CONSENT_VERSION_REQUIRED",
  "TELEGRAM_LEADS_ENABLED",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHAT_ID",
  "WEB3FORMS_ACCESS_KEY",
  "DELIVERY_ALERT_ENABLED",
  "DELIVERY_ALERT_THRESHOLD",
  "DELIVERY_ALERT_WINDOW_MIN",
  "DELIVERY_ALERT_COOLDOWN_MIN",
  "DELIVERY_ALERT_LOOKBACK",
  "DELIVERY_ALERT_WEBHOOK_URL",
  "DELIVERY_ALERT_TELEGRAM_BOT_TOKEN",
  "DELIVERY_ALERT_TELEGRAM_CHAT_ID",
  "CRON_SECRET",
  "AVAILABILITY_DB_ENABLED",
  "AVAILABILITY_TOKEN",
  "DATABASE_URL",
  "TEST_DATABASE_URL",
  "CATALOG_LIVE_FEED2_ENABLED",
  "CATALOG_LIVE_FEED2_STRICT",
];

/** Публичные переменные, которые тоже обязаны быть в примере. */
const PUBLIC_KEYS = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_CALC_QUIZ_V2",
  "NEXT_PUBLIC_LEAD_RESCUE_ENABLED",
];

async function main() {
  const errors = [];
  const warnings = [];

  // 1. Предупреждения о неполной конфигурации.
  //
  // Схему из `lib/env.ts` голый Node импортировать не может (TypeScript),
  // а тянуть загрузчик ради одного скрипта не стоит — правила продублированы
  // здесь, а их совпадение со схемой закреплено тестом `tests/env.test.ts`.
  const value = (key) => (process.env[key] ?? "").trim();
  const flag = (key, fallback) => {
    const raw = value(key);
    if (raw === "") return fallback;
    return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
  };

  if (flag("TELEGRAM_LEADS_ENABLED", true) && !(value("TELEGRAM_BOT_TOKEN") && value("TELEGRAM_CHAT_ID"))) {
    warnings.push("TELEGRAM_LEADS_ENABLED=1, но TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID не заданы.");
  }
  if (!value("WEB3FORMS_ACCESS_KEY") && !value("TELEGRAM_BOT_TOKEN")) {
    warnings.push("Не настроен ни один канал доставки заявок.");
  }
  if (
    flag("DELIVERY_ALERT_ENABLED", true) &&
    !value("DELIVERY_ALERT_WEBHOOK_URL") &&
    !(value("DELIVERY_ALERT_TELEGRAM_BOT_TOKEN") && value("DELIVERY_ALERT_TELEGRAM_CHAT_ID"))
  ) {
    warnings.push("DELIVERY_ALERT_ENABLED=1, но канал алерта не задан — сбой доставки останется незамеченным.");
  }
  if (!value("CRON_SECRET")) warnings.push("CRON_SECRET не задан — /api/lead/retry вернёт 401.");
  // PT-016: без пароля админка календаря отвечает 503, и даты замера снова
  // можно поменять только деплоем — то есть задача не решена. Предупреждаем
  // только когда БД есть: без DATABASE_URL календарь в принципе из файла.
  if (flag("AVAILABILITY_DB_ENABLED", true) && value("DATABASE_URL") && !value("AVAILABILITY_TOKEN")) {
    warnings.push("AVAILABILITY_TOKEN не задан — /api/admin/availability вернёт 503.");
  }
  if (!value("DATABASE_URL")) warnings.push("DATABASE_URL не задан — лиды хранятся в памяти.");

  // 2. .env.example синхронен схеме.
  const example = await readFile(path.join(ROOT, ".env.example"), "utf8");
  const documented = new Set(
    example
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => line.split("=")[0].trim())
  );

  const expected = [...SCHEMA_KEYS, ...PUBLIC_KEYS];
  for (const key of expected) {
    if (!documented.has(key)) errors.push(`.env.example: не документирована ${key}`);
  }
  for (const key of documented) {
    if (!expected.includes(key)) {
      errors.push(`.env.example: лишняя переменная ${key} (нет в схеме lib/env.ts)`);
    }
  }

  for (const warning of warnings) console.warn(`⚠ ${warning}`);

  if (errors.length > 0) {
    console.error("[env] ошибки:");
    for (const e of errors) console.error(`  ✖ ${e}`);
    process.exit(1);
  }

  if (strict && warnings.length > 0) {
    console.error("[env] предупреждения запрещены в strict-режиме");
    process.exit(1);
  }

  console.log(`[env] ok — ${expected.length} переменных документированы`);
}

await main();
