/**
 * N-001 · Реализация `LeadStore` поверх PostgreSQL.
 *
 * Здесь живут ровно те четыре вещи, которые ломались на in-memory хранилище
 * при холодном старте serverless: дедуп по телефону, серверный rate-limit,
 * ретраи доставки и поиск заявки по короткому коду.
 */
import { and, count, desc, eq, gt, lt, sql } from "drizzle-orm";

import { getDb, type Db } from "@/db";
import { deliveryAlerts, leadDeliveries, leads } from "@/db/schema";

import type { LeadPayload } from "./schema";
import type {
  DeliveryAlertRecord,
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
    requestId: row.requestId ?? undefined,
    payloadHash: row.payloadHash ?? undefined,
    consentVersion: row.consentVersion ?? null,
    consentAt: row.consentAt?.getTime() ?? null,
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
    lastAttemptAt: row.lastAttemptAt?.getTime(),
  };
}

type DeliveryAlertRow = typeof deliveryAlerts.$inferSelect;

function toDeliveryAlertRecord(row: DeliveryAlertRow): DeliveryAlertRecord {
  return {
    id: row.id,
    createdAt: row.createdAt.getTime(),
    trigger: row.trigger,
    streak: row.streak,
    failures: row.failures,
    channels: row.channels,
    windowMinutes: row.windowMinutes,
    message: row.message,
    deliveredVia: row.deliveredVia,
    lastError: row.lastError,
    oldestFailureAt: row.oldestFailureAt?.getTime() ?? null,
  };
}

/**
 * PT-015 · Время последней попытки: колонка nullable (фаза `expand`), поэтому
 * у старых строк берём время создания задания.
 */
const lastAttempt = sql`coalesce(${leadDeliveries.lastAttemptAt}, ${leadDeliveries.createdAt})`;

export class PgLeadStore implements LeadStore {
  private readonly db: Db;

  constructor(connectionString: string) {
    this.db = getDb(connectionString);
  }

  /**
   * Вставка лида. Принимает исполнителя запроса, поэтому работает и сама по
   * себе, и внутри транзакции (PT-003) — без второй копии кода.
   */
  private async insertLead(
    executor: Db | Parameters<Parameters<Db["transaction"]>[0]>[0],
    input: Omit<LeadRecord, "id" | "createdAt" | "publicCode">
  ): Promise<LeadRecord> {
    const { payload } = input;

    // publicCode — 5 символов из 32-буквенного алфавита. Коллизия маловероятна,
    // но при ~тысячах заявок возможна, а колонка unique: ретраим несколько раз,
    // иначе клиент получил бы 500 на ровном месте.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const publicCode = generatePublicCode();

      try {
        const [row] = await executor
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
            requestId: input.requestId ?? null,
            payloadHash: input.payloadHash ?? null,
            consentVersion: input.consentVersion ?? null,
            consentAt: input.consentAt ? new Date(input.consentAt) : null,
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

  async createLead(
    input: Omit<LeadRecord, "id" | "createdAt" | "publicCode">
  ): Promise<LeadRecord> {
    return this.insertLead(this.db, input);
  }


  /**
   * PT-003 · Лид и задания на доставку — одной транзакцией.
   *
   * Ключевое отличие от `createLead`: если вставка заданий упадёт, откатится
   * и сам лид. Половинчатого состояния «заявка есть, доставлять её некому»
   * больше не существует.
   *
   * Задания создаются в статусе `pending` ДО первой попытки отправки. Именно
   * это чинит исходную дыру: раньше при обрыве процесса между записью лида и
   * `recordDelivery` строки не появлялось вовсе, и крон, который ищет
   * `failed`, такую заявку не видел никогда.
   */
  async createLeadWithDeliveries(
    input: Omit<LeadRecord, "id" | "createdAt" | "publicCode">,
    channels: readonly DeliveryChannel[]
  ): Promise<LeadRecord> {
    return this.db.transaction(async (tx) => {
      const lead = await this.insertLead(tx, input);

      if (channels.length > 0) {
        await tx.insert(leadDeliveries).values(
          channels.map((channel) => ({
            leadId: lead.id,
            channel,
            status: "pending" as DeliveryStatus,
            attempts: 0,
          }))
        );
      }

      return lead;
    });
  }

  /**
   * Задания, которые ещё никто не отправил.
   *
   * Отдаются вместе с упавшими (`listFailedDeliveries`), потому что для крона
   * это один и тот же вопрос: что осталось доставить.
   */
  async listPendingDeliveries(limit: number): Promise<DeliveryRecord[]> {
    const rows = await this.db
      .select()
      .from(leadDeliveries)
      .where(eq(leadDeliveries.status, "pending"))
      .orderBy(leadDeliveries.createdAt)
      .limit(limit);

    return rows.map(toDeliveryRecord);
  }

  async findRecentDuplicate(
    phone: string,
    payloadHash: string | null,
    windowMs: number
  ): Promise<LeadRecord | null> {
    // Окно считаем часами БД (`now() - interval`), а не `Date.now()` приложения:
    // на managed-провайдерах инстанс и БД расходятся на десятки миллисекунд, и
    // смешивание двух часов давало плавающий результат дедупа.
    //
    // PT-009: к телефону добавлен отпечаток payload. Прежний поиск по одному
    // телефону возвращал любую недавнюю заявку с этим номером, поэтому полная
    // заявка, отправленная после rescue, молча получала код короткой
    // rescue-заявки, а её состав не сохранялся нигде.
    const conditions = [eq(leads.phone, phone), gt(leads.createdAt, windowStart(windowMs))];
    // `payloadHash === null` — аварийный откат флагом: сравниваем только телефон.
    if (payloadHash !== null) conditions.push(eq(leads.payloadHash, payloadHash));

    const [row] = await this.db
      .select()
      .from(leads)
      .where(and(...conditions))
      .orderBy(desc(leads.createdAt))
      .limit(1);

    return row ? toLeadRecord(row) : null;
  }

  /**
   * PT-009: заявка по клиентскому ключу идемпотентности.
   *
   * `request_id` покрыт unique-индексом, поэтому здесь достаточно точечного
   * поиска — гонку двух параллельных вставок ловит само ограничение, а не этот
   * запрос.
   */
  async findLeadByRequestId(requestId: string): Promise<LeadRecord | null> {
    const [row] = await this.db
      .select()
      .from(leads)
      .where(eq(leads.requestId, requestId))
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
          lastAttemptAt: new Date(),
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
        lastAttemptAt: new Date(),
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

  /**
   * PT-015 · Последние попытки доставки, от свежих к старым.
   *
   * Сортировка — по времени последней попытки, а не по `created_at`: серию
   * «N подряд неудач» нужно читать в порядке реальных попыток, иначе ретрай
   * старого задания встанет в хвост и серия окажется разорванной там, где
   * сбоя нет.
   */
  async listRecentDeliveries(limit: number): Promise<DeliveryRecord[]> {
    const rows = await this.db
      .select()
      .from(leadDeliveries)
      .orderBy(desc(lastAttempt), desc(leadDeliveries.id))
      .limit(Math.max(0, limit));

    return rows.map(toDeliveryRecord);
  }

  async findLastDeliveryAlert(): Promise<DeliveryAlertRecord | null> {
    const [row] = await this.db
      .select()
      .from(deliveryAlerts)
      .orderBy(desc(deliveryAlerts.createdAt), desc(deliveryAlerts.id))
      .limit(1);

    return row ? toDeliveryAlertRecord(row) : null;
  }

  async recordDeliveryAlert(
    input: Omit<DeliveryAlertRecord, "id" | "createdAt">
  ): Promise<DeliveryAlertRecord> {
    const [row] = await this.db
      .insert(deliveryAlerts)
      .values({
        trigger: input.trigger,
        streak: input.streak,
        failures: input.failures,
        channels: input.channels,
        windowMinutes: input.windowMinutes,
        message: input.message,
        deliveredVia: input.deliveredVia,
        lastError: input.lastError,
        oldestFailureAt: input.oldestFailureAt ? new Date(input.oldestFailureAt) : null,
      })
      .returning();

    return toDeliveryAlertRecord(row);
  }
}
