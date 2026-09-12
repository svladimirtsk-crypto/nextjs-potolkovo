/**
 * N-001 · Схема хранения заявок (Drizzle). Соответствует Приложению Б ТЗ v1
 * и заменяет прежний `db/schema.sql` — единственный источник правды теперь здесь,
 * миграции накатываются через `npx drizzle-kit push`.
 */
import {
  bigint,
  bigserial,
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
  },
  (table) => [index("lead_deliveries_status_idx").on(table.status, table.createdAt)]
);
