/**
 * PT-013 · Вид отказа: из транспортного результата — в то, что видит человек.
 *
 * До этой задачи все шесть видов отказа (`submitLead` их различает) показывались
 * одним текстом. Замер на сборке до правки, страница `/uslugi/skrytye-karnizy`:
 *
 *     422 { issues: ["phone", "name"] } → «Не получилось отправить — позвоните …»
 *     429 + Retry-After: 600            → тот же текст, «10 мин» в нём нет
 *     обрыв связи                       → тот же текст, 1 запрос, повтора нет
 *
 * Человек не мог понять, что делать: при `422` надо исправить номер, при `429` —
 * подождать указанное сервером время, при обрыве — повторить (причём заявка
 * могла уже уйти). Модуль возвращает готовый к показу разбор: какие поля
 * подсветить, какой текст показать, есть ли смысл в повторе и сколько ждать.
 *
 * Модуль чистый и изоморфный: ни React, ни DOM. `content/contacts` подключён
 * только ради телефона в запасном пути — как в `lib/lead/rescue-lead.ts`.
 */
import { contacts } from "@/content/contacts";

import {
  leadSubmitFailureReason,
  type LeadSubmitFailure,
  type LeadSubmitFailureKind,
} from "./submit-lead";

/**
 * Поля формы заявки, которые можно подсветить.
 *
 * Порядок — как в форме: первое проблемное поле получает фокус. Всё, что не
 * входит в список (`snapshot.*`, `totals.*`, `attribution.*`, `fulfilment`),
 * человек в форме не редактирует по отдельности — такие пути остаются в
 * общем тексте, а не превращаются в «подсветку» несуществующего поля.
 */
export const LEAD_FORM_FIELDS = ["name", "phone", "address", "preferredTime", "consent"] as const;

export type LeadFormField = (typeof LEAD_FORM_FIELDS)[number];

export type LeadFieldErrors = Partial<Record<LeadFormField, string>>;

/** Текст под конкретным полем. Короткий и про действие, без кодов и путей. */
const FIELD_ERROR_TEXT: Record<LeadFormField, string> = {
  name: "Сервер не принял имя — сократите его и отправьте ещё раз.",
  phone: "Сервер не принял номер. Проверьте: нужно 10 цифр после +7.",
  address: "Сервер не принял адрес — сократите его до 160 символов.",
  preferredTime: "Сервер не принял выбранное время.",
  consent: "Без согласия на обработку данных заявку не отправить.",
};

function isLeadFormField(value: string): value is LeadFormField {
  return (LEAD_FORM_FIELDS as readonly string[]).includes(value);
}

/**
 * zod-путь из ответа `422` → поле формы.
 *
 * Сервер отдаёт пути строками (`"phone"`, `"snapshot.totals.grand"`). Берётся
 * первый сегмент и отбрасывается индекс массива: `items[2].sku` относится к
 * корзине, а не к полю формы, и подсветить его нельзя.
 */
export function fieldOfIssuePath(issuePath: string): LeadFormField | null {
  const first = String(issuePath)
    .split(".")[0]
    .replace(/\[\d+\]$/, "")
    .trim();

  return isLeadFormField(first) ? first : null;
}

/** Все поля, на которые указал сервер. Дубликаты схлопываются. */
export function fieldErrorsFromIssues(issues: readonly string[]): LeadFieldErrors {
  const errors: LeadFieldErrors = {};

  for (const issue of issues) {
    const field = fieldOfIssuePath(issue);
    if (field && !errors[field]) errors[field] = FIELD_ERROR_TEXT[field];
  }

  return errors;
}

/** Поля в порядке формы — первое нужно для фокуса. */
export function invalidFieldsOf(errors: LeadFieldErrors): LeadFormField[] {
  return LEAD_FORM_FIELDS.filter((field) => Boolean(errors[field]));
}

export type LeadFailureView = {
  kind: LeadSubmitFailureKind;
  /** Общий текст в плашке ошибки: что случилось и что делать. */
  message: string;
  /** Подсветка конкретных полей (пусто, если сервер не назвал полей). */
  fieldErrors: LeadFieldErrors;
  invalidFields: LeadFormField[];
  /** `Retry-After` от сервера в секундах. */
  retryAfterSec: number | null;
  /**
   * Когда ждать перестанем: `Date.now() + retryAfterSec` на момент отказа.
   *
   * Момент фиксируется здесь, а не в компоненте: плашка ошибки не
   * размонтируется между попытками, и отсчёт, начатый от времени рендера,
   * показал бы срок короче, чем просил сервер.
   */
  retryAfterUntil: number | null;
  /** Повтор той же отправки имеет смысл (данные и лимит ни при чём). */
  canRetry: boolean;
  /**
   * Исход неизвестен: запрос мог дойти до сервера и заявка могла сохраниться.
   * Только `timeout` и `network`. Врать «не отправлено» здесь нельзя — поэтому
   * повтор уходит с тем же `requestId` (PT-009), и сервер отвечает кодом уже
   * созданной заявки вместо второй записи.
   */
  outcomeUnknown: boolean;
};

/** Отказ, после которого повтор той же отправки имеет смысл. */
export function isRetriableKind(kind: LeadSubmitFailureKind): boolean {
  return kind === "network" || kind === "timeout" || kind === "server";
}

/**
 * Собирает вид отказа.
 *
 * Серверный `message` показывается только там, где он написан для человека:
 * `422` без полей формы (отказ серверного пересчёта — «позиция недоступна к
 * заказу») и `409` (ключ идемпотентности с другим содержимым). В остальных
 * случаях текст формируется здесь: сообщение сервера может содержать
 * технические детали, а их раскрывать нельзя (ТЗ, PT-013).
 */
export function describeLeadFailure(
  failure: LeadSubmitFailure,
  now: number = Date.now()
): LeadFailureView {
  const fieldErrors = fieldErrorsFromIssues(failure.issues);
  const invalidFields = invalidFieldsOf(fieldErrors);
  const serverMessage = failure.serverMessage?.trim() || null;
  const outcomeUnknown = failure.kind === "network" || failure.kind === "timeout";
  const phoneCta = `Позвоните ${contacts.phoneDisplay} — заявку примут по телефону.`;

  let message: string;

  switch (failure.kind) {
    case "validation":
      if (invalidFields.length > 0) {
        message = "Сервер не принял данные. Исправьте отмеченные поля и отправьте ещё раз.";
      } else if (serverMessage) {
        message = serverMessage;
      } else {
        message = leadSubmitFailureReason(failure);
      }
      break;

    case "ratelimit":
      // `leadSubmitFailureReason` уже превращает `Retry-After` в минуты.
      message = leadSubmitFailureReason(failure);
      break;

    case "unavailable":
      message = `Приём заявок временно недоступен. ${phoneCta}`;
      break;

    case "network":
    case "timeout":
      /**
       * Честно про неизвестность: заявка могла уйти. Отсюда и повтор с тем же
       * `requestId`, и формулировка без «не отправлено».
       */
      message = `Ответ сервера не получен — заявка могла не уйти. Повторите отправку или звоните: ${contacts.phoneDisplay}.`;
      break;

    default:
      message =
        failure.status === 409 && serverMessage
          ? serverMessage
          : `Сервер не смог принять заявку. Повторите отправку. ${phoneCta}`;
      break;
  }

  return {
    kind: failure.kind,
    message,
    fieldErrors,
    invalidFields,
    retryAfterSec: failure.retryAfterSec,
    retryAfterUntil:
      failure.retryAfterSec && failure.retryAfterSec > 0
        ? now + failure.retryAfterSec * 1000
        : null,
    canRetry: isRetriableKind(failure.kind),
    outcomeUnknown,
  };
}

/**
 * `Retry-After` в `мм:сс` — для обратного отсчёта в плашке.
 *
 * Отрицательное и нечисловое значение невозможны: `submitLead` такой заголовок
 * уже отбросил (`retryAfterSec: null`), но защита оставлена — функция публичная.
 */
export function formatRetryCountdown(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

/**
 * PT-013 · Отказ клиентской проверки — тот же вид, что и серверный.
 *
 * Форма проверяет имя, телефон и согласие до отправки. Раньше эти сообщения
 * рисовались отдельной веткой, из-за чего в компоненте жило два разных
 * представления одной плашки. Здесь они сходятся в один тип: рендер один,
 * а источник (клиент или сервер) виден по `canRetry` и `retryAfterSec`.
 */
export function describeClientValidation(
  fieldErrors: LeadFieldErrors,
  message: string
): LeadFailureView {
  return {
    kind: "validation",
    message,
    fieldErrors,
    invalidFields: invalidFieldsOf(fieldErrors),
    retryAfterSec: null,
    retryAfterUntil: null,
    canRetry: false,
    outcomeUnknown: false,
  };
}
