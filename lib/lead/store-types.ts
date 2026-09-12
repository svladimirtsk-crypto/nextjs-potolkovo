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
  /** PT-009: ключ идемпотентности попытки отправки. */
  requestId?: string;
  /** PT-009: sha256 канонического payload. */
  payloadHash?: string;
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
  /**
   * PT-009 · Анти-спам эвристика: та же заявка за последние `windowMs`.
   *
   * Прежний `findRecentByPhone(phone, windowMs)` возвращал ЛЮБУЮ недавнюю
   * заявку с тем же номером, независимо от состава. Из-за этого полная заявка,
   * отправленная через минуту после rescue, молча получала код короткой
   * rescue-заявки, а её состав не сохранялся нигде — то есть терялась ровно та
   * информация, ради которой человек досчитывал комплектацию.
   *
   * Дублем считается только совпадение и телефона, и отпечатка payload.
   * Содержательно другая заявка с тем же телефоном — новая запись.
   *
   * `payloadHash === null` — прежняя семантика «любая недавняя заявка с этим
   * телефоном». Нужна единственному потребителю: аварийному откату флагом
   * `LEAD_IDEMPOTENCY_ENABLED=0` (правило 8 раздела 2 ТЗ — новую логику приёма
   * заявок должно быть можно выключить без деплоя).
   */
  findRecentDuplicate(
    phone: string,
    payloadHash: string | null,
    windowMs: number
  ): Promise<LeadRecord | null>;

  /**
   * PT-009 · Заявка по клиентскому ключу идемпотентности.
   *
   * Основа повтора: тот же `requestId` с тем же `payloadHash` возвращает
   * прежний результат без побочных эффектов, с другим хешем — конфликт.
   */
  findLeadByRequestId(requestId: string): Promise<LeadRecord | null>;
  recordDelivery(
    leadId: number,
    channel: DeliveryChannel,
    status: DeliveryStatus,
    error?: string
  ): Promise<DeliveryRecord>;
  /**
   * PT-003 · Заявка и задания на доставку создаются одной транзакцией.
   *
   * Раньше лид записывался, затем шли сетевые вызовы в Telegram/Web3Forms и
   * только потом — `recordDelivery`. Остановка процесса между этими шагами
   * оставляла заявку вообще без записи о доставке: крон ретрая ищет строки со
   * статусом `failed`, а строки не существовало. Заявка молча выпадала.
   *
   * Теперь задания создаются в статусе `pending` вместе с самим лидом, до
   * любой попытки отправки. Даже если процесс умрёт сразу после ответа
   * клиенту — крон подхватит задание.
   */
  createLeadWithDeliveries(
    input: Omit<LeadRecord, "id" | "createdAt" | "publicCode">,
    channels: readonly DeliveryChannel[]
  ): Promise<LeadRecord>;

  /**
   * Задания, ожидающие отправки или уже упавшие.
   *
   * PT-003: раньше крон видел только `failed`. Теперь и `pending` — иначе
   * задание, созданное до обрыва, никто бы не забрал.
   */
  listPendingDeliveries(limit: number): Promise<DeliveryRecord[]>;

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
