/**
 * PT-013 · Повтор отправки после обрыва связи — с тем же `requestId`.
 *
 * Требование ТЗ: «сетевая ошибка/timeout — повтор с тем же `requestId` без
 * потери введённых данных». Замер на сборке до правки: при имитации обрыва
 * связи форма делала ровно один запрос и показывала общий текст «Не получилось
 * отправить — позвоните …». При этом `timeout` — единственный отказ, после
 * которого исход неизвестен: запрос мог дойти до сервера, и заявка могла быть
 * сохранена. Человек этого не знает и звонит, а заявка уже в базе.
 *
 * Повтор здесь безопасен именно потому, что ключ тот же (PT-009): если первая
 * попытка всё-таки дошла, сервер вернёт `200` с кодом уже созданной заявки
 * (`idempotentReplay`), а не вторую запись. Ключ не меняется и потому, что
 * payload тот же: `acquireRequestId` возвращает прежний ключ, пока отпечаток
 * содержимого совпадает.
 *
 * Повторяются только `timeout` и `network`. Отказ сервера данными (`422`)
 * повторять бессмысленно — он повторится, а `429` с `Retry-After` повторять
 * вредно: лимит только вырастет.
 */
import {
  submitLead,
  type LeadSubmitResult,
  type SubmitLeadOptions,
} from "./submit-lead";

/** Пауза перед повтором: дать сети шанс вернуться, не заставляя ждать долго. */
export const LEAD_RETRY_DELAY_MS = 700;

/** Сколько попыток всего. Две — исходная и один повтор. */
export const LEAD_MAX_ATTEMPTS = 2;

export type LeadSubmitRetryOptions = SubmitLeadOptions & {
  /** Всего попыток (≥1). Больше двух не нужно: дальше человек ждёт зря. */
  maxAttempts?: number;
  /** Пауза между попытками, мс. В тестах — 0. */
  retryDelayMs?: number;
};

export type LeadSubmitWithRetry = {
  result: LeadSubmitResult;
  /** Сколько запросов реально ушло (1 — если отказ не повторялся). */
  attempts: number;
  /** Был ли автоматический повтор. Нужно аналитике и тексту отказа. */
  retried: boolean;
};

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Отказ, после которого автоматический повтор имеет смысл. */
export function shouldRetryAfter(result: LeadSubmitResult): boolean {
  return !result.ok && (result.kind === "timeout" || result.kind === "network");
}

/**
 * Отправка с одним автоматическим повтором при обрыве связи или таймауте.
 *
 * Введённые данные не теряются: функция не трогает payload и не очищает форму —
 * она возвращает результат, а решение о показе принимает форма.
 */
export async function submitLeadWithRetry(
  payload: unknown,
  options: LeadSubmitRetryOptions = {}
): Promise<LeadSubmitWithRetry> {
  const maxAttempts = Math.max(1, Math.round(options.maxAttempts ?? LEAD_MAX_ATTEMPTS));
  const retryDelayMs = options.retryDelayMs ?? LEAD_RETRY_DELAY_MS;

  let attempts = 0;
  let result: LeadSubmitResult = {
    ok: false,
    kind: "network",
    status: null,
    issues: [],
    retryAfterSec: null,
    serverMessage: null,
  };

  while (attempts < maxAttempts) {
    attempts += 1;
    result = await submitLead(payload, options);

    if (!shouldRetryAfter(result) || attempts >= maxAttempts) break;
    await sleep(retryDelayMs);
  }

  return { result, attempts, retried: attempts > 1 };
}
