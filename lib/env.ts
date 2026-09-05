import { z } from "zod";

/**
 * T-062 · Единая точка чтения серверного окружения.
 *
 * Раньше `process.env.X` читался прямо по месту, поэтому опечатка в имени
 * переменной или пустой токен обнаруживались только в момент отправки заявки —
 * в проде, молча. Здесь всё описано схемой и валидируется один раз.
 *
 * Строгость намеренно мягкая: сайт должен подниматься и без Telegram/БД
 * (заявка уйдёт запасным каналом), поэтому секреты опциональны, а
 * несогласованные комбинации выводятся в `env.warnings` — их печатает
 * `npm run check:env` и лог старта API.
 *
 * Только для сервера: модуль не должен импортироваться в клиентские компоненты.
 */

/** "1"/"true"/"yes" → true; пусто → значение по умолчанию. */
const boolFlag = (defaultValue: boolean) =>
  z
    .string()
    .optional()
    .transform((value) => {
      if (value === undefined || value.trim() === "") return defaultValue;
      return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
    });

/** Пустая строка эквивалентна отсутствию — иначе `""` считался бы валидным ключом. */
const optionalSecret = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim() ?? "";
    return trimmed.length > 0 ? trimmed : undefined;
  });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  /** Доставка заявок. */
  LEAD_API_ENABLED: boolFlag(true),
  TELEGRAM_LEADS_ENABLED: boolFlag(true),
  TELEGRAM_BOT_TOKEN: optionalSecret,
  TELEGRAM_CHAT_ID: optionalSecret,
  WEB3FORMS_ACCESS_KEY: optionalSecret,

  /** Bearer для POST /api/lead/retry. */
  CRON_SECRET: optionalSecret,

  /** Строка подключения к БД лидов; без неё используется in-memory store. */
  DATABASE_URL: optionalSecret,

  /**
   * Источник каталога. STRICT по умолчанию 0: в проде падать из-за чужого
   * фида нельзя — откатываемся на снапшот.
   */
  CATALOG_LIVE_FEED2_ENABLED: boolFlag(true),
  CATALOG_LIVE_FEED2_STRICT: boolFlag(false),
});

export type Env = z.infer<typeof envSchema> & { warnings: string[] };

function collectWarnings(env: z.infer<typeof envSchema>): string[] {
  const warnings: string[] = [];

  if (env.TELEGRAM_LEADS_ENABLED && !(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID)) {
    warnings.push(
      "TELEGRAM_LEADS_ENABLED=1, но TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID не заданы — заявки в Telegram не уйдут."
    );
  }

  if (!env.WEB3FORMS_ACCESS_KEY && !env.TELEGRAM_BOT_TOKEN) {
    warnings.push(
      "Не настроен ни один канал доставки заявок (WEB3FORMS_ACCESS_KEY / TELEGRAM_BOT_TOKEN)."
    );
  }

  if (!env.CRON_SECRET) {
    warnings.push("CRON_SECRET не задан — POST /api/lead/retry будет отвечать 503.");
  }

  if (!env.DATABASE_URL) {
    warnings.push("DATABASE_URL не задан — лиды хранятся в памяти и теряются при рестарте.");
  }

  if (env.CATALOG_LIVE_FEED2_STRICT && env.NODE_ENV === "production") {
    warnings.push(
      "CATALOG_LIVE_FEED2_STRICT=1 в production — при невалидном живом фиде каталог отдаст ошибку вместо снапшота."
    );
  }

  return warnings;
}

let cached: Env | null = null;

/** Разобранное и провалидированное окружение (результат кэшируется). */
export function getEnv(): Env {
  if (cached) return cached;

  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  • ${issue.path.join(".") || "(корень)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Некорректное окружение:\n${details}`);
  }

  cached = { ...parsed.data, warnings: collectWarnings(parsed.data) };
  return cached;
}

/** Сбросить кэш — нужно только в тестах, которые подменяют process.env. */
export function resetEnvCache(): void {
  cached = null;
}
