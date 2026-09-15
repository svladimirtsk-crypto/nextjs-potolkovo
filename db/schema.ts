/**
 * N-001 · Схема хранения заявок (Drizzle). Соответствует Приложению Б ТЗ v1
 * и заменяет прежний `db/schema.sql` — единственный источник правды теперь здесь,
 * миграции накатываются через `npx drizzle-kit push`.
 */
import {
  bigint,
  bigserial,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import type { LeadPayload } from "@/lib/lead/schema";
import type { DeliveryChannel, DeliveryStatus, LeadStatus } from "@/lib/lead/store-types";

export const leads = pgTable(
  "leads",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    /** Короткий код для Telegram-ссылок и разговора по телефону, напр. "K7F3Q". */
    publicCode: text("public_code").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    status: text("status").$type<LeadStatus>().notNull().default("new"),
    leadKind: text("lead_kind").notNull(),
    orderIntent: text("order_intent").notNull(),
    name: text("name"),
    phone: text("phone").notNull(),
    address: text("address"),
    preferredTime: text("preferred_time"),
    source: text("source").notNull(),
    placement: text("placement").notNull(),
    pagePath: text("page_path"),
    serviceSlug: text("service_slug"),
    /** utm_*, yclid, gclid, first_landing, first_referrer */
    attribution: jsonb("attribution").notNull().default({}),
    /** LeadSnapshotV2 */
    snapshot: jsonb("snapshot").$type<LeadPayload["snapshot"]>(),
    totals: jsonb("totals").$type<LeadPayload["totals"]>(),
    grandTotal: integer("grand_total"),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    /**
     * PT-009 · Ключ идемпотентности: один на попытку отправки.
     *
     * Колонка nullable, и это принципиально: в PostgreSQL unique-индекс
     * считает NULL-значения различными, поэтому уже накопленные заявки (все с
     * NULL) не мешают наложить ограничение. Миграция проходит по схеме
     * `expand → migrate → switch → contract` (раздел 3.8) без блокирующей
     * перезаписи существующих строк.
     */
    requestId: text("request_id"),
    /** PT-009 · sha256 канонического payload: отличить дубль от другой заявки. */
    payloadHash: text("payload_hash"),
    /**
     * PT-014 · Версия текста политики, с которой человек согласился.
     *
     * `NULL` у строк до PT-014 и у заявок от клиента, который версию не прислал:
     * неизвестность честнее, чем подставленная текущая версия. Колонки добавлены
     * по схеме `expand` (раздел 3.8) — nullable, без перезаписи существующих строк.
     */
    consentVersion: text("consent_version"),
    /**
     * PT-014 · Момент, когда согласие было дано (клик по чекбоксу), а не момент
     * записи строки. Сервер принимает время клиента только в правдоподобном
     * окне, иначе пишет своё — часы посетителя могут спешить на годы.
     */
    consentAt: timestamp("consent_at", { withTimezone: true }),
  },
  (table) => [
    index("leads_created_at_idx").on(table.createdAt.desc()),
    index("leads_phone_created_idx").on(table.phone, table.createdAt.desc()),
    // Серверный rate-limit считает заявки с одного IP за окно.
    index("leads_ip_created_idx").on(table.ipHash, table.createdAt.desc()),
    /**
     * PT-009 · Повтор того же requestId не должен создавать вторую заявку даже
     * при одновременной вставке двумя параллельными запросами: гонку ловит
     * ограничение, а не проверка «сначала прочитали, потом вставили».
     */
    uniqueIndex("leads_request_id_key").on(table.requestId),
    // PT-009: дедуп ищет недавнюю заявку с тем же телефоном И тем же содержимым.
    index("leads_phone_hash_created_idx").on(
      table.phone,
      table.payloadHash,
      table.createdAt.desc()
    ),
  ]
);

export const leadDeliveries = pgTable(
  "lead_deliveries",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    leadId: bigint("lead_id", { mode: "number" })
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    channel: text("channel").$type<DeliveryChannel>().notNull(),
    status: text("status").$type<DeliveryStatus>().notNull(),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /**
     * PT-015 · Время последней попытки доставки.
     *
     * `recordDelivery` обновляет строку на месте, поэтому `created_at` остаётся
     * временем создания задания: ретрай задания двухдневной давности без этой
     * колонки не попал бы ни в одно «свежее» окно, и затянувшийся сбой каналов
     * выглядел бы как тишина. Nullable — фаза `expand` (раздел 3.8): у
     * существующих строк значение заполнится первой же попыткой, а до тех пор
     * читается `created_at`.
     */
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
  },
  (table) => [index("lead_deliveries_status_idx").on(table.status, table.createdAt)]
);

/**
 * PT-015 · Журнал служебных алертов о деградации доставки.
 *
 * Таблица нужна не для красоты: по ней работает охлаждение (не чаще раза в
 * `DELIVERY_ALERT_COOLDOWN_MIN`), и она же — единственный след того, что алерт
 * вообще пробовал отправляться. Без записи каждый прогон крона отправлял бы новое
 * уведомление, а владелец получил бы шторм вместо сигнала.
 *
 * Намеренно БЕЗ персональных данных: в `message` не попадает ни телефон, ни
 * имя, ни состав заказа — только счётчики, каналы и обрезанный текст ошибки.
 * Алерт уходит на внешний сервис (вебхук/второй бот), который не является
 * частью контура обработки персональных данных сайта.
 */
export const deliveryAlerts = pgTable(
  "delivery_alerts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** Что запустило проверку: `lead` (отправка заявки) или `retry-cron`. */
    trigger: text("trigger").notNull(),
    /** Подряд идущих неудачных попыток на момент срабатывания. */
    streak: integer("streak").notNull(),
    /** Сколько упавших заданий попало в окно наблюдения. */
    failures: integer("failures").notNull(),
    /** Какие каналы лежали: `telegram+web3forms`. */
    channels: text("channels").notNull(),
    /** Размер окна наблюдения в минутах — для разбора инцидента задним числом. */
    windowMinutes: integer("window_minutes").notNull(),
    /** Текст уведомления (без персональных данных). */
    message: text("message").notNull(),
    /** Куда реально ушло: `webhook`, `telegram-alert`, `null` — никуда. */
    deliveredVia: text("delivered_via"),
    /** Ошибка канала алерта, если уведомление не ушло. */
    lastError: text("last_error"),
    /** Когда упала самая старая попытка в серии — начало инцидента. */
    oldestFailureAt: timestamp("oldest_failure_at", { withTimezone: true }),
  },
  (table) => [index("delivery_alerts_created_at_idx").on(table.createdAt)]
);

/**
 * PT-016 · Календарь свободных дат замера (B-F108, T-322).
 *
 * До задачи даты жили в `content/availability.ts`: чтобы поменять их, нужен
 * коммит и деплой, а между деплоями сайт показывал «чт, сб», которые давно
 * заняты. Здесь — конкретные даты, которые владелец правит с телефона через
 * `PUT /api/admin/availability` за 20 секунд, без сборки.
 *
 * Одна строка = одна дата. `note` — необязательная подпись окна («утро»,
 * «после 17:00»): два окна в один день master не даёт, поэтому отдельной
 * колонки времени нет, а уточнение остаётся текстом.
 *
 * Просроченные даты НЕ удаляются автоматически и не скрываются в БД: их
 * отсекает чтение (`lib/availability/format.ts`) по московскому дню. Строки
 * остаются как история того, что было предложено клиентам.
 */
export const availabilitySlots = pgTable(
  "availability_slots",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    /** Дата замера `YYYY-MM-DD` в Europe/Moscow. `mode: "string"` — без сюрпризов часовых поясов у `Date`. */
    slotDate: date("slot_date", { mode: "string" }).notNull().unique(),
    /** Подпись окна; `null` — показываем только дату. */
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("availability_slots_date_idx").on(table.slotDate)]
);

/**
 * PT-016 · Состояние календаря: одна строка (`id = 1`).
 *
 * Нужна, чтобы отличить «таблицу ещё ни разу не заполняли» от «владелец
 * намеренно оставил ноль свободных окон». В первом случае сайт показывает
 * запасной календарь из `content/availability.ts` (иначе блок исчез бы сразу
 * после деплоя, до первого захода в админку), во втором — молчит: обещать
 * окна, которых нет, хуже, чем не обещать ничего.
 */
export const availabilitySettings = pgTable("availability_settings", {
  id: integer("id").primaryKey().default(1),
  /** Когда календарь впервые заполнили через админку. */
  configuredAt: timestamp("configured_at", { withTimezone: true }).notNull().defaultNow(),
  /** Последнее изменение — показывается владельцу и в публичном API. */
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
