"use client";

/**
 * PT-013 · Плашка отказа формы заявки.
 *
 * До этой задачи любой отказ показывался одним текстом «Не получилось
 * отправить — позвоните …», и человек не мог отличить «исправьте номер» от
 * «подождите 10 минут» и «повторите — связь оборвалась». Плашка рисуется из
 * готового разбора `describeLeadFailure` (`lib/lead/failure-view.ts`): текст,
 * список проблемных полей, обратный отсчёт `Retry-After` и кнопка повтора
 * появляются только тогда, когда они действительно применимы.
 *
 * Технические детали намеренно не показываются: ни имени канала доставки, ни
 * текста ошибки провайдера, ни zod-путей (ТЗ, PT-013).
 */
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  formatRetryCountdown,
  type LeadFailureView,
  type LeadFormField,
} from "@/lib/lead/failure-view";

/** Названия полей для человека — zod-путь показывать нельзя. */
const FIELD_LABELS: Record<LeadFormField, string> = {
  name: "Имя",
  phone: "Телефон",
  address: "Адрес",
  preferredTime: "Когда удобно",
  consent: "Согласие",
};

export function LeadFormAlert({
  view,
  onRetry,
  isPending = false,
}: {
  view: LeadFailureView;
  /** Повтор той же отправки. Без него кнопка не рисуется. */
  onRetry?: () => void;
  isPending?: boolean;
}) {
  /**
   * Обратный отсчёт `Retry-After`.
   *
   * Сервер уже отдаёт этот заголовок (rate-limit и «хранилище недоступно»), но
   * клиент его выбрасывал. Состояние здесь ровно одно — текущее время: срок
   * окончания ожидания пришёл готовым из `describeLeadFailure`, поэтому эффект
   * ничего не синхронизирует, а только тикает раз в секунду.
   */
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!view.retryAfterUntil) return;

    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [view.retryAfterUntil]);

  const remainingSec = view.retryAfterUntil
    ? Math.max(0, Math.ceil((view.retryAfterUntil - now) / 1000))
    : 0;

  return (
    <div
      className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-950"
      role="alert"
      data-testid="lead-error-alert"
    >
      <p className="whitespace-pre-line font-medium">{view.message}</p>

      {view.invalidFields.length > 0 ? (
        <ul className="mt-2 space-y-1" data-testid="lead-error-fields">
          {view.invalidFields.map((field) => (
            <li key={field}>
              <span className="font-semibold">{FIELD_LABELS[field]}:</span>{" "}
              {view.fieldErrors[field]}
            </li>
          ))}
        </ul>
      ) : null}

      {view.retryAfterSec ? (
        <p className="mt-2" data-testid="lead-retry-countdown">
          {remainingSec > 0
            ? `Повторить можно через ${formatRetryCountdown(remainingSec)}`
            : "Можно отправлять снова."}
        </p>
      ) : null}

      {view.canRetry && onRetry ? (
        <Button
          variant="secondary"
          size="sm"
          className="mt-3"
          data-testid="lead-retry-button"
          disabled={isPending}
          onClick={onRetry}
        >
          {isPending ? "Отправляю..." : "Повторить отправку"}
        </Button>
      ) : null}

      {view.outcomeUnknown ? (
        <p className="mt-2 text-xs">
          Введённые данные на месте. Повтор не создаст вторую заявку: сервер
          вернёт номер уже сохранённой.
        </p>
      ) : null}
    </div>
  );
}
