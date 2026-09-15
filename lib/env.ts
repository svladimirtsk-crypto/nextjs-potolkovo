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

/**
 * Целое не меньше `min`; пусто или мусор → значение по умолчанию.
 *
 * Мусор не роняет старт намеренно: `DELIVERY_ALERT_THRESHOLD=много` не должно
 * означать «API не поднимется». Неверное значение приводится к безопасному
 * умолчанию, а расхождение видно в логе.
 */
const intFlag = (defaultValue: number, min = 1) =>
  z
    .string()
    .optional()
    .transform((value) => {
      const trimmed = value?.trim() ?? "";
      if (trimmed === "") return defaultValue;
      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed)) return defaultValue;
      return Math.max(min, Math.round(parsed));
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
  /**
   * PT-009 · Идемпотентность по `requestId` и дедуп по телефону **и составу**.
   *
   * Правило 8 раздела 2 ТЗ: новая логика приёма заявок включается отдельным
   * флагом, чтобы её можно было откатить без деплоя. `0` возвращает поведение
   * до PT-009: повтор `requestId` не проверяется, дублем считается любая
   * недавняя заявка с тем же телефоном.
   *
   * Дефолт `1` осознанный. Выключенный флаг — это не «нейтральное состояние»,
   * а воспроизведённый дефект: полная заявка, отправленная после rescue,
   * снова будет молча получать код короткой rescue-заявки, а её состав не
   * сохранится нигде. Держать такое по умолчанию значит оставить потерю данных
   * включённой до ручного действия владельца.
   */
  LEAD_IDEMPOTENCY_ENABLED: boolFlag(true),

  /**
   * PT-010 · Серверный пересчёт цены заявки.
   *
   * Правило 8 раздела 2 ТЗ: изменение денежного пути идёт под флагом
   * аварийного отката. `0` возвращает поведение до задачи — в БД и в письмо
   * мастеру попадает сумма, присланная браузером (`snapshot.totals.grand`),
   * неизвестные SKU и дробные количества штучного товара принимаются как есть.
   *
   * Дефолт `1`: выключенный флаг означал бы «сервер снова доверяет цене из
   * запроса», то есть сознательно оставленную дыру в деньгах. Откат нужен на
   * случай, если пересчёт начнёт расходиться с клиентом из-за прайса и заявки
   * придётся принимать без проверки, а не терять.
   */
  LEAD_SERVER_RECALC_ENABLED: boolFlag(true),

  /**
   * PT-014 · Требовать от клиента текущую версию политики.
   *
   * Правило 8 раздела 2 ТЗ: проверка способна отклонять заявки (`422`), поэтому
   * включается отдельно и по умолчанию выключена. Пока флаг `0`, расхождение
   * версий пишется в лог и в БД как есть — заявка принимается. Поднимать до `1`
   * стоит, когда новая сборка разошлась клиентам и в логах нет волны
   * `consent_version_stale`: иначе заявки начнут терять посетители со старой
   * вкладкой, открытой до деплоя.
   */
  LEAD_CONSENT_VERSION_REQUIRED: boolFlag(false),

  TELEGRAM_BOT_TOKEN: optionalSecret,
  TELEGRAM_CHAT_ID: optionalSecret,
  WEB3FORMS_ACCESS_KEY: optionalSecret,

  /**
   * PT-015 · Алерт при систематических сбоях доставки.
   *
   * Заявки после PT-002/PT-003 сохраняются в БД даже тогда, когда оба канала
   * доставки лежат, и пользователь видит «Заявка №K7F3Q сохранена». Формально
   * всё хорошо — но мастер не узнает о заявке, пока сам не заглянет в базу.
   * Алерт закрывает ровно эту дыру: N подряд неудачных попыток в ОБА канала —
   * служебное уведомление по каналу, который от Telegram/Web3Forms не зависит.
   *
   * Дефолт `1` осознанный: без настроенного канала алерта проверка просто
   * ничего не отправляет (и говорит об этом предупреждением), а деградация
   * доставки продолжает оставаться невидимой. Правило 8 раздела 2 ТЗ при этом
   * соблюдено — `0` выключает всю логику одним значением переменной, без деплоя.
   */
  DELIVERY_ALERT_ENABLED: boolFlag(true),
  /** Сколько неудачных попыток ПОДРЯД считается систематическим сбоем. */
  DELIVERY_ALERT_THRESHOLD: intFlag(4),
  /** Окно наблюдения в минутах: старше — уже не «сейчас сломалось». */
  DELIVERY_ALERT_WINDOW_MIN: intFlag(30),
  /** Охлаждение в минутах: как часто можно слать повторный алерт. */
  DELIVERY_ALERT_COOLDOWN_MIN: intFlag(60),
  /** Сколько последних попыток доставки читать из БД на одну проверку. */
  DELIVERY_ALERT_LOOKBACK: intFlag(50),
  /**
   * Каналы алерта. Оба необязательны, но хотя бы один нужен: уведомление
   * принципиально НЕ должно идти через Telegram-бот заявок или Web3Forms —
   * иначе оно умрёт вместе с тем, о чём сообщает.
   *
   * `DELIVERY_ALERT_WEBHOOK_URL` — любой HTTP-приёмник JSON (Slack/Discord/
   * ntfy/Apprise/своя ручка). Второй Telegram-бот или отдельный чат — вариант
   * из формулировки ТЗ.
   */
  DELIVERY_ALERT_WEBHOOK_URL: optionalSecret,
  DELIVERY_ALERT_TELEGRAM_BOT_TOKEN: optionalSecret,
  DELIVERY_ALERT_TELEGRAM_CHAT_ID: optionalSecret,

  /** Bearer для POST /api/lead/retry. */
  CRON_SECRET: optionalSecret,

  /**
   * PT-016 · Календарь свободных дат замера.
   *
   * До задачи даты лежали в `content/availability.ts`: чтобы поменять их,
   * нужен коммит, сборка и деплой, а между деплоями сайт показывал «чт, сб»,
   * которые давно заняты. Теперь даты пишутся в таблицу `availability_slots`
   * через `PUT /api/admin/availability` и страницу `/admin/availability`.
   *
   * `AVAILABILITY_DB_ENABLED=0` — аварийный откат (правило 8 раздела 2 ТЗ):
   * календарь снова читается только из файла, админ-API отвечает 503.
   * Дефолт `1` осознанный: при пустой таблице источник всё равно файл
   * (строки настроек нет), то есть поведение сайта не меняется до первого
   * сохранения владельца.
   */
  AVAILABILITY_DB_ENABLED: boolFlag(true),
  /**
   * Пароль админки календаря. Отдельный от `CRON_SECRET`: крон и календарь
   * меняют разные вещи, и утечка одного не должна открывать другое.
   * Без него `/api/admin/availability` отвечает 503 («не настроено»).
   */
  AVAILABILITY_TOKEN: optionalSecret,

  /** Строка подключения к БД лидов; без неё используется in-memory store. */
  DATABASE_URL: optionalSecret,

  /** Отдельная БД для интеграционных тестов; в проде не используется. */
  TEST_DATABASE_URL: optionalSecret,

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

  if (
    env.DELIVERY_ALERT_ENABLED &&
    !env.DELIVERY_ALERT_WEBHOOK_URL &&
    !(env.DELIVERY_ALERT_TELEGRAM_BOT_TOKEN && env.DELIVERY_ALERT_TELEGRAM_CHAT_ID)
  ) {
    warnings.push(
      "DELIVERY_ALERT_ENABLED=1, но канал алерта не задан (DELIVERY_ALERT_WEBHOOK_URL " +
        "или DELIVERY_ALERT_TELEGRAM_BOT_TOKEN/CHAT_ID) — сбой обоих каналов доставки " +
        "останется незамеченным."
    );
  }

  if (!env.CRON_SECRET) {
    warnings.push("CRON_SECRET не задан — POST /api/lead/retry будет отвечать 503.");
  }

  if (env.AVAILABILITY_DB_ENABLED && env.DATABASE_URL && !env.AVAILABILITY_TOKEN) {
    warnings.push(
      "AVAILABILITY_TOKEN не задан — /api/admin/availability отвечает 503, " +
        "даты замера нельзя обновить без деплоя."
    );
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
