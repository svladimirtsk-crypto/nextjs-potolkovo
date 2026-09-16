/**
 * N-001 · Типы хранилища заявок, вынесенные из `store.ts`.
 *
 * Отдельный модуль нужен, чтобы `db/schema.ts` мог типизировать колонки,
 * не импортируя реализацию хранилища (иначе получается цикл
 * store → db → schema → store).
 */
import type { LeadPayload } from "./schema";

/**
 * PT-020 · Срок аренды задания outbox, мс.
 *
 * Аренда защищает строку на время одной попытки отправки: конкурент её не
 * заберёт. Срок выбран с запасом к реальному времени доставки (секунды), но
 * достаточно коротким, чтобы смерть процесса не отложила ретрай надолго:
 * истёкшую аренду следующий прогон крона считает свободной.
 */
export const DELIVERY_LEASE_MS = 120_000;

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
  /** PT-014: версия политики, с которой человек согласился (`null` — неизвестна). */
  consentVersion?: string | null;
  /** PT-014: момент согласия, epoch ms (`null` — неизвестен). */
  consentAt?: number | null;
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
  /** PT-015: время последней попытки, epoch ms (`undefined` — попыток не было). */
  lastAttemptAt?: number;
  /**
   * PT-020: до какого момента задание арендовано отправителем, epoch ms
   * (`undefined` — свободно).
   */
  leaseUntil?: number;
};

/** PT-015 · Запись журнала служебных алертов о деградации доставки. */
export type DeliveryAlertRecord = {
  id: number;
  createdAt: number;
  trigger: string;
  streak: number;
  failures: number;
  channels: string;
  windowMinutes: number;
  message: string;
  /** Куда ушло уведомление; `null` — ни один канал алерта не сработал. */
  deliveredVia: string | null;
  lastError: string | null;
  oldestFailureAt: number | null;
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

  /**
   * PT-020 · Атомарно забрать задания на отправку (ТЗ, строка 124 · PT-003).
   *
   * Отличие от `listPendingDeliveries`/`listFailedDeliveries`: те просто читают
   * строки, поэтому два параллельных прогона крона забирали один и тот же набор
   * и отправляли клиенту дубль. Здесь одним `UPDATE … WHERE id IN (SELECT …
   * FOR UPDATE SKIP LOCKED)` строки помечаются арендой (`lease_until`) и
   * возвращаются: конкурент их уже не увидит.
   *
   * Аренда истекает сама, поэтому смерть процесса посреди отправки не теряет
   * задание. По итогам попытки `recordDelivery` освобождает строку.
   */
  claimDeliveries(limit: number, maxAttempts?: number): Promise<DeliveryRecord[]>;

  /**
   * PT-015 · Последние попытки доставки — от свежих к старым.
   *
   * Сортировка по `coalesce(last_attempt_at, created_at)`: алерт считает
   * серию ПОДРЯД идущих неудач, а серия живёт во времени попыток, не во
   * времени создания задания. Лимит ограничен сверху (`DELIVERY_ALERT_LOOKBACK`)
   * — вся таблица не читается.
   */
  listRecentDeliveries(limit: number): Promise<DeliveryRecord[]>;

  /** PT-015 · Последний алерт о деградации доставки — основа охлаждения. */
  findLastDeliveryAlert(): Promise<DeliveryAlertRecord | null>;

  /** PT-015 · Записать алерт в журнал (пишется и неудачная отправка). */
  recordDeliveryAlert(
    input: Omit<DeliveryAlertRecord, "id" | "createdAt">
  ): Promise<DeliveryAlertRecord>;
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
