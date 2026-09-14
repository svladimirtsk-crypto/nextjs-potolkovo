/**
 * PT-014 · Что именно сохранить о согласии на обработку персональных данных.
 *
 * До задачи согласие существовало только как `consent: z.literal(true)` в
 * payload: в базе не было ни версии текста политики, ни момента согласия, а
 * сама «дата обновления» на `/privacy` рисовалась как `new Date()` — то есть
 * дата сборки. Любой деплой «обновлял» политику без правки текста, и привязать
 * согласие к редакции было не к чему.
 *
 * Правила, зашитые здесь:
 *
 *  1. Версия из тела запроса — не доверенные данные. В БД попадает только
 *     распознаваемая версия (`ГГГГ-ММ-ДД[.N]`) или `NULL` («неизвестно»).
 *     Подставлять вместо `NULL` текущую версию нельзя: это приписало бы
 *     человеку согласие с текстом, которого он не видел.
 *  2. Момент согласия берётся из клиента, только если он правдоподобен: часы
 *     посетителя могут спешить на годы или отставать. Вне окна — серверное время.
 *  3. Расхождение с текущей версией — факт, который надо видеть (лог), а не
 *     повод молча терять заявку. Отклонять ли такие заявки — решает флаг
 *     `LEAD_CONSENT_VERSION_REQUIRED` (правило 8 раздела 2 ТЗ).
 *
 * Модуль чистый: время передаётся аргументом, поэтому решение покрыто тестами
 * без моков часов.
 */
import { PRIVACY_POLICY_VERSION } from "@/content/legal";
import { normalizePolicyVersion } from "@/lib/privacy-policy";

/** Насколько старым может быть момент согласия, чтобы ему поверить. */
export const CONSENT_AT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Насколько в будущем может быть момент согласия (часы спешат). */
export const CONSENT_AT_MAX_FUTURE_MS = 5 * 60 * 1000;

export type ConsentRecord = {
  /** Версия политики для БД; `null` — клиент не прислал или прислал мусор. */
  consentVersion: string | null;
  /** Момент согласия, epoch ms. Всегда заполнен: есть серверное время. */
  consentAt: number;
  /** Клиент прислал распознаваемую версию. */
  versionKnown: boolean;
  /** Присланная версия совпадает с текущей редакцией политики. */
  versionCurrent: boolean;
  /** Откуда взят момент согласия. */
  consentAtSource: "client" | "server";
};

export type ConsentInput = {
  consentVersion?: unknown;
  consentAt?: unknown;
};

/**
 * Разбирает согласие из payload заявки.
 *
 * `now` — серверное время в epoch ms; передаётся в тестах.
 */
export function resolveConsentRecord(input: ConsentInput, now: number = Date.now()): ConsentRecord {
  const consentVersion = normalizePolicyVersion(input.consentVersion);

  const parsed = typeof input.consentAt === "string" ? Date.parse(input.consentAt.trim()) : NaN;
  const clientTimeUsable =
    Number.isFinite(parsed) &&
    parsed <= now + CONSENT_AT_MAX_FUTURE_MS &&
    parsed >= now - CONSENT_AT_MAX_AGE_MS;

  return {
    consentVersion,
    consentAt: clientTimeUsable ? parsed : now,
    versionKnown: consentVersion !== null,
    versionCurrent: consentVersion === PRIVACY_POLICY_VERSION,
    consentAtSource: clientTimeUsable ? "client" : "server",
  };
}

/** Текущая редакция политики — для логов и для клиента. */
export function currentPrivacyPolicyVersion(): string {
  return PRIVACY_POLICY_VERSION;
}
