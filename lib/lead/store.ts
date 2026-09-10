/**
 * N-001 · Хранилище заявок: выбор реализации.
 *
 * При заданном `DATABASE_URL` — PostgreSQL (`PgLeadStore`), иначе in-memory.
 * In-memory осознанно оставлен: он нужен для локальной разработки и тестов,
 * но на serverless теряет заявки при каждом холодном старте, поэтому
 * предупреждаем один раз на процесс.
 */
import { getEnv } from "@/lib/env";

import { generatePublicCode } from "./public-code";
import { PgLeadStore } from "./store-pg";
import type {
  DeliveryChannel,
  DeliveryRecord,
  DeliveryStatus,
  LeadRecord,
  LeadStore,
} from "./store-types";

export { generatePublicCode };
export type {
  DeliveryChannel,
  DeliveryRecord,
  DeliveryStatus,
  LeadRecord,
  LeadStatus,
  LeadStore,
} from "./store-types";

export class InMemoryLeadStore implements LeadStore {
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
    // Строгое `>`, как в SQL-версии (`created_at > now() - interval`):
    // при нестрогом сравнении заявка, созданная в ту же миллисекунду, что и
    // граница окна, считалась свежей — и две реализации расходились.
    const threshold = Date.now() - windowMs;
    for (let i = this.leads.length - 1; i >= 0; i -= 1) {
      const lead = this.leads[i];
      if (lead.createdAt <= threshold) break;
      if (lead.payload.phone === phone) return lead;
    }
    return null;
  }

  async countRecentByIpHash(ipHash: string, windowMs: number): Promise<number> {
    const threshold = Date.now() - windowMs;
    return this.leads.filter((lead) => lead.ipHash === ipHash && lead.createdAt > threshold)
      .length;
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

  async listFailedDeliveries(limit: number, maxAttempts = 5): Promise<DeliveryRecord[]> {
    return this.deliveries
      .filter((d) => d.status === "failed" && d.attempts < maxAttempts)
      .slice(0, limit);
  }

  async getLead(leadId: number): Promise<LeadRecord | null> {
    return this.leads.find((l) => l.id === leadId) ?? null;
  }

  async getLeadByPublicCode(code: string): Promise<LeadRecord | null> {
    const normalized = code.toUpperCase();
    return this.leads.find((l) => l.publicCode === normalized) ?? null;
  }
}

let store: LeadStore | null = null;
let warned = false;

export function getLeadStore(): LeadStore {
  if (store) return store;

  const { DATABASE_URL } = getEnv();

  if (DATABASE_URL) {
    store = new PgLeadStore(DATABASE_URL);
    return store;
  }

  if (!warned) {
    warned = true;
    console.warn(
      "[lead] DATABASE_URL не задан — заявки хранятся в памяти процесса и теряются " +
        "при рестарте (на serverless — при каждом холодном старте). " +
        "Дедуп, серверный rate-limit, ретраи и поиск по коду заявки работать не будут."
    );
  }

  store = new InMemoryLeadStore();
  return store;
}

/** Только для тестов: сбросить состояние хранилища. */
export function resetLeadStoreForTests(): void {
  store = new InMemoryLeadStore();
  warned = true;
}

/** Только для тестов: подставить произвольную реализацию. */
export function setLeadStoreForTests(custom: LeadStore): void {
  store = custom;
  warned = true;
}
