/**
 * T-027 · Хранилище заявок.
 *
 * Схема БД — `db/schema.sql` (Приложение Б). ORM в проект пока не добавлена
 * (ограничение по зависимостям в ТЗ), поэтому здесь описан интерфейс хранилища
 * и работающая in-memory реализация: она держит заявки в памяти процесса,
 * обслуживает дедуп и ретраи доставки. Когда появится драйвер БД, достаточно
 * реализовать `LeadStore` поверх SQL из `db/schema.sql` — вызывающий код не меняется.
 */
import type { LeadPayload } from "./schema";

export type LeadStatus = "new" | "draft" | "rescue" | "contacted" | "closed";
export type DeliveryChannel = "telegram" | "web3forms";
export type DeliveryStatus = "pending" | "sent" | "failed";

export type LeadRecord = {
  id: number;
  publicCode: string;
  createdAt: number;
  status: LeadStatus;
  payload: LeadPayload;
  grandTotal: number;
  ipHash?: string;
  userAgent?: string;
};

export type DeliveryRecord = {
  id: number;
  leadId: number;
  channel: DeliveryChannel;
  status: DeliveryStatus;
  attempts: number;
  lastError?: string;
  sentAt?: number;
  createdAt: number;
};

export interface LeadStore {
  createLead(input: Omit<LeadRecord, "id" | "createdAt" | "publicCode">): Promise<LeadRecord>;
  /** Дедуп: тот же телефон за последние `windowMs`. */
  findRecentByPhone(phone: string, windowMs: number): Promise<LeadRecord | null>;
  recordDelivery(
    leadId: number,
    channel: DeliveryChannel,
    status: DeliveryStatus,
    error?: string
  ): Promise<DeliveryRecord>;
  listFailedDeliveries(limit: number): Promise<DeliveryRecord[]>;
  getLead(leadId: number): Promise<LeadRecord | null>;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Короткий человекочитаемый код заявки, напр. `K7F3Q`. */
export function generatePublicCode(): string {
  let code = "";
  for (let i = 0; i < 5; i += 1) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

class InMemoryLeadStore implements LeadStore {
  private leads: LeadRecord[] = [];
  private deliveries: DeliveryRecord[] = [];
  private leadSeq = 1;
  private deliverySeq = 1;

  async createLead(
    input: Omit<LeadRecord, "id" | "createdAt" | "publicCode">
  ): Promise<LeadRecord> {
    const record: LeadRecord = {
      ...input,
      id: this.leadSeq++,
      publicCode: generatePublicCode(),
      createdAt: Date.now(),
    };
    this.leads.push(record);
    // память процесса не должна расти бесконечно
    if (this.leads.length > 500) this.leads = this.leads.slice(-500);
    return record;
  }

  async findRecentByPhone(phone: string, windowMs: number): Promise<LeadRecord | null> {
    const threshold = Date.now() - windowMs;
    for (let i = this.leads.length - 1; i >= 0; i -= 1) {
      const lead = this.leads[i];
      if (lead.createdAt < threshold) break;
      if (lead.payload.phone === phone) return lead;
    }
    return null;
  }

  async recordDelivery(
    leadId: number,
    channel: DeliveryChannel,
    status: DeliveryStatus,
    error?: string
  ): Promise<DeliveryRecord> {
    const existing = this.deliveries.find((d) => d.leadId === leadId && d.channel === channel);
    if (existing) {
      existing.status = status;
      existing.attempts += 1;
      existing.lastError = error;
      if (status === "sent") existing.sentAt = Date.now();
      return existing;
    }
    const record: DeliveryRecord = {
      id: this.deliverySeq++,
      leadId,
      channel,
      status,
      attempts: 1,
      lastError: error,
      sentAt: status === "sent" ? Date.now() : undefined,
      createdAt: Date.now(),
    };
    this.deliveries.push(record);
    return record;
  }

  async listFailedDeliveries(limit: number): Promise<DeliveryRecord[]> {
    return this.deliveries.filter((d) => d.status === "failed").slice(0, limit);
  }

  async getLead(leadId: number): Promise<LeadRecord | null> {
    return this.leads.find((l) => l.id === leadId) ?? null;
  }
}

let store: LeadStore | null = null;

export function getLeadStore(): LeadStore {
  if (!store) store = new InMemoryLeadStore();
  return store;
}

/** Только для тестов: сбросить состояние хранилища. */
export function resetLeadStoreForTests(): void {
  store = new InMemoryLeadStore();
}
