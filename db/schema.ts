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
  },
  (table) => [
    index("leads_created_at_idx").on(table.createdAt.desc()),
    index("leads_phone_created_idx").on(table.phone, table.createdAt.desc()),
    // Серверный rate-limit считает заявки с одного IP за окно.
    index("leads_ip_created_idx").on(table.ipHash, table.createdAt.desc()),
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
