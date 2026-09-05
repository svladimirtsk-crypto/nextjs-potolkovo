/**
 * N-001 · Типы хранилища заявок, вынесенные из `store.ts`.
 *
 * Отдельный модуль нужен, чтобы `db/schema.ts` мог типизировать колонки,
 * не импортируя реализацию хранилища (иначе получается цикл
 * store → db → schema → store).
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
  /** Поиск по короткому коду — менеджер ищет заявку, названную клиентом. */
  getLeadByPublicCode(code: string): Promise<LeadRecord | null>;
  /**
   * Серверный rate-limit: сколько заявок с этого IP за окно.
   * In-memory реализация считает по своей памяти, Pg — по БД (переживает
   * холодный старт serverless, ради чего задача и делается).
   */
  countRecentByIpHash(ipHash: string, windowMs: number): Promise<number>;
}
