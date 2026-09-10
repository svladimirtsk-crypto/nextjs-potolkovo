/**
 * N-001 · Реализация `LeadStore` поверх PostgreSQL.
 *
 * Здесь живут ровно те четыре вещи, которые ломались на in-memory хранилище
 * при холодном старте serverless: дедуп по телефону, серверный rate-limit,
 * ретраи доставки и поиск заявки по короткому коду.
 */
import { and, count, desc, eq, gt, lt, sql } from "drizzle-orm";

import { getDb, type Db } from "@/db";
import { leadDeliveries, leads } from "@/db/schema";

import type { LeadPayload } from "./schema";
import type {
  DeliveryChannel,
  DeliveryRecord,
  DeliveryStatus,
  LeadRecord,
  LeadStore,
} from "./store-types";
import { generatePublicCode } from "./public-code";

/**
 * Начало окна по часам БД. Все сравнения времени должны идти через неё,
 * иначе расхождение часов приложения и БД делает дедуп/лимит недетерминированными.
 */
function windowStart(windowMs: number) {
  const seconds = Math.max(0, Math.round(windowMs / 1000));
  return sql`now() - make_interval(secs => ${seconds})`;
}

type LeadRow = typeof leads.$inferSelect;
type DeliveryRow = typeof leadDeliveries.$inferSelect;

function toLeadRecord(row: LeadRow): LeadRecord {
  return {
    id: row.id,
    publicCode: row.publicCode,
    createdAt: row.createdAt.getTime(),
    status: row.status,
    // Полный payload в БД разложен по колонкам + snapshot/totals в jsonb.
    // Собираем обратно ту же форму, что отдаёт in-memory store.
    payload: {
      leadKind: row.leadKind,
      orderIntent: row.orderIntent,
      name: row.name ?? undefined,
      phone: row.phone,
      address: row.address ?? undefined,
      preferredTime: row.preferredTime ?? undefined,
      source: row.source,
      placement: row.placement,
      pagePath: row.pagePath ?? undefined,
      serviceSlug: row.serviceSlug ?? undefined,
      attribution: row.attribution,
      snapshot: row.snapshot ?? undefined,
      totals: row.totals ?? undefined,
      grandTotal: row.grandTotal ?? undefined,
    } as LeadPayload,
    grandTotal: row.grandTotal ?? 0,
    ipHash: row.ipHash ?? undefined,
    userAgent: row.userAgent ?? undefined,
  };
}

function toDeliveryRecord(row: DeliveryRow): DeliveryRecord {
  return {
    id: row.id,
    leadId: row.leadId,
    channel: row.channel,
    status: row.status,
    attempts: row.attempts,
    lastError: row.lastError ?? undefined,
    sentAt: row.sentAt?.getTime(),
    createdAt: row.createdAt.getTime(),
  };
}

export class PgLeadStore implements LeadStore {
  private readonly db: Db;

  constructor(connectionString: string) {
    this.db = getDb(connectionString);
  }

  async createLead(
    input: Omit<LeadRecord, "id" | "createdAt" | "publicCode">
  ): Promise<LeadRecord> {
    const { payload } = input;

    // publicCode — 5 символов из 32-буквенного алфавита. Коллизия маловероятна,
    // но при ~тысячах заявок возможна, а колонка unique: ретраим несколько раз,
    // иначе клиент получил бы 500 на ровном месте.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const publicCode = generatePublicCode();

      try {
        const [row] = await this.db
          .insert(leads)
          .values({
            publicCode,
            status: input.status,
            leadKind: payload.leadKind,
            orderIntent: payload.orderIntent,
            name: payload.name ?? null,
            phone: payload.phone,
            address: payload.address ?? null,
            preferredTime: payload.preferredTime ?? null,
            source: payload.source,
            placement: payload.placement,
            pagePath: payload.pagePath ?? null,
            serviceSlug: payload.serviceSlug ?? null,
            attribution: payload.attribution ?? {},
            snapshot: payload.snapshot ?? null,
            totals: payload.totals ?? null,
            grandTotal: input.grandTotal,
            ipHash: input.ipHash ?? null,
            userAgent: input.userAgent ?? null,
          })
          .returning();

        return toLeadRecord(row);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const isCodeConflict = message.includes("public_code");
        if (!isCodeConflict || attempt === 4) throw error;
      }
    }

    throw new Error("не удалось подобрать уникальный public_code");
  }

  async findRecentByPhone(phone: string, windowMs: number): Promise<LeadRecord | null> {
    // Окно считаем часами БД (`now() - interval`), а не `Date.now()` приложения:
    // на managed-провайдерах инстанс и БД расходятся на десятки миллисекунд, и
    // смешивание двух часов давало плавающий результат дедупа.
    const [row] = await this.db
      .select()
      .from(leads)
      .where(and(eq(leads.phone, phone), gt(leads.createdAt, windowStart(windowMs))))
      .orderBy(desc(leads.createdAt))
      .limit(1);

    return row ? toLeadRecord(row) : null;
  }

  async countRecentByIpHash(ipHash: string, windowMs: number): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(leads)
      .where(and(eq(leads.ipHash, ipHash), gt(leads.createdAt, windowStart(windowMs))));

    return row?.value ?? 0;
  }

  async recordDelivery(
    leadId: number,
    channel: DeliveryChannel,
    status: DeliveryStatus,
    error?: string
  ): Promise<DeliveryRecord> {
    const [existing] = await this.db
      .select()
      .from(leadDeliveries)
      .where(and(eq(leadDeliveries.leadId, leadId), eq(leadDeliveries.channel, channel)))
      .limit(1);

    if (existing) {
      const [row] = await this.db
        .update(leadDeliveries)
        .set({
          status,
          attempts: sql`${leadDeliveries.attempts} + 1`,
          lastError: error ?? null,
          sentAt: status === "sent" ? new Date() : existing.sentAt,
        })
        .where(eq(leadDeliveries.id, existing.id))
        .returning();

      return toDeliveryRecord(row);
    }

    const [row] = await this.db
      .insert(leadDeliveries)
      .values({
        leadId,
        channel,
        status,
        attempts: 1,
        lastError: error ?? null,
        sentAt: status === "sent" ? new Date() : null,
      })
      .returning();

    return toDeliveryRecord(row);
  }

  /** Для ретраев: только неудачные и только те, где не исчерпаны попытки. */
  async listFailedDeliveries(limit: number, maxAttempts = 5): Promise<DeliveryRecord[]> {
    const rows = await this.db
      .select()
      .from(leadDeliveries)
      .where(
        and(eq(leadDeliveries.status, "failed"), lt(leadDeliveries.attempts, maxAttempts))
      )
      .orderBy(leadDeliveries.createdAt)
      .limit(limit);

    return rows.map(toDeliveryRecord);
  }

  async getLead(leadId: number): Promise<LeadRecord | null> {
    const [row] = await this.db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
    return row ? toLeadRecord(row) : null;
  }

  async getLeadByPublicCode(code: string): Promise<LeadRecord | null> {
    const [row] = await this.db
      .select()
      .from(leads)
      .where(eq(leads.publicCode, code.toUpperCase()))
      .limit(1);

    return row ? toLeadRecord(row) : null;
  }
}
