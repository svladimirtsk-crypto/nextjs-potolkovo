"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * PT-014 · Захват согласия общий с основной формой (`lib/lead/use-consent-capture`):
 * редакция политики и момент клика не должны отличаться от формы на странице.
 */
import { useConsentCapture } from "@/lib/lead/use-consent-capture";

import {
  EMPTY_OPTIONS,
  closeDialog,
  registerDialogStateSetter,
  type ConfirmDialogOptions,
  type ConfirmDialogSubmitOutcome,
  type DialogState,
} from "./confirm-dialog-store";

/**
 * PT-011 · Публичный API диалога прежний: существующие вызовы
 * (`use-rescue-lead`, `calculator-modal`, каталог) импортируют его отсюда.
 */
export {
  isConfirmDialogOpen,
  showChoiceDialog,
  showConfirmDialog,
} from "./confirm-dialog-store";
export type {
  ChoiceDialogOptions,
  ChoiceDialogResult,
  ConfirmDialogConsent,
  ConfirmDialogResult,
  ConfirmDialogSubmitOutcome,
} from "./confirm-dialog-store";

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "textarea:not([disabled])",
    'button:not([tabindex="-1"])',
  ].join(", ");
  return Array.from(container.querySelectorAll<HTMLElement>(selector));
}

export function ConfirmDialogPortal() {
  const [state, setState] = useState<DialogState>({
    open: false,
    token: 0,
    options: EMPTY_OPTIONS,
    dismissible: false,
  });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    registerDialogStateSetter(setState);
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => {
      cancelAnimationFrame(frame);
      registerDialogStateSetter(null);
    };
  }, []);

  if (!mounted || !state.open) return null;

  /**
   * PT-004: панель монтируется только на время открытия, поэтому весь её
   * внутренний статус (телефон, согласие, фаза отправки) создаётся заново и
   * не требует сбрасывающего `useEffect` — а такие эффекты запрещены стражем
   * `scripts/check-effect-setstate.mjs`.
   */
  return createPortal(
    <ConfirmDialogPanel
      key={state.token}
      options={state.options}
      dismissible={state.dismissible}
    />,
    document.body
  );
}

type Phase = "input" | "submitting" | "failed";

function ConfirmDialogPanel({
  options,
  dismissible,
}: {
  options: ConfirmDialogOptions;
  dismissible: boolean;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const retryButtonRef = useRef<HTMLButtonElement>(null);

  const [phone, setPhone] = useState("");
  // PT-014: факт согласия, момент клика и редакция политики — одним хуком.
  const consentCapture = useConsentCapture();
  const [phase, setPhase] = useState<Phase>("input");
  const [failureMessage, setFailureMessage] = useState("");

  const hasPhoneField = Boolean(options.phoneField);
  const consent = options.phoneField?.consent;
  const submit = options.submit;

  const phoneFilled = phone.trim().length >= 6;
  const consentSatisfied = !consent || consentCapture.given;
  const canSubmit = !hasPhoneField || (phoneFilled && consentSatisfied);

  // Первый фокус — в диалог; дальше работает ловушка Tab.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const focusable = dialogRef.current ? getFocusableElements(dialogRef.current) : [];
      if (focusable.length > 0) focusable[0].focus();
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        // PT-004: во время запроса Escape не закрывает диалог. Исход отправки
        // ещё неизвестен, и закрыть окно сейчас — значит оставить человека в
        // неведении, ушла заявка или нет.
        if (submit && phase === "submitting") return;
        // PT-011: закрытие — отдельный исход, а не «нет».
        closeDialog("dismiss");
        return;
      }

      if (e.key !== "Tab" || !dialogRef.current) return;

      const focusable = getFocusableElements(dialogRef.current);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [phase, submit]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target !== e.currentTarget) return;
      if (submit && phase === "submitting") return;
      closeDialog("dismiss");
    },
    [phase, submit]
  );

  /** PT-004: одна и та же ветка для первой отправки и для повтора после ошибки. */
  const runSubmit = useCallback(
    async (value: string) => {
      if (!submit) {
        closeDialog("confirm", hasPhoneField ? value : undefined);
        return;
      }

      setPhase("submitting");
      setFailureMessage("");

      let outcome: ConfirmDialogSubmitOutcome;
      try {
        outcome = await submit.run(value, {
          given: consentCapture.given,
          at: consentCapture.at,
        });
      } catch {
        // Обработчик не должен бросать исключений (`submitLead` их глотает),
        // но если бросил — честнее показать отказ, чем зависнуть в «Отправляю…».
        outcome = { ok: false, message: "Не удалось отправить заявку. Попробуйте ещё раз." };
      }

      if (outcome.ok) {
        closeDialog("confirm", hasPhoneField ? value : undefined);
        return;
      }

      setFailureMessage(outcome.message);
      setPhase("failed");
      requestAnimationFrame(() => retryButtonRef.current?.focus());
    },
    /**
     * PT-014 · `consentCapture` в зависимостях обязателен: без него замыкание
     * держит состояние согласия первого рендера, и диалог отправляет
     * `consentGiven: false` при отмеченном чекбоксе.
     */
    [hasPhoneField, submit, consentCapture]
  );

  const handleConfirmClick = useCallback(() => {
    if (submit && phase === "submitting") return;

    if (hasPhoneField) {
      const value = phone.trim();
      if (!canSubmit) return;
      void runSubmit(value);
      return;
    }

    void runSubmit("");
  }, [canSubmit, hasPhoneField, phase, phone, runSubmit, submit]);

  const handleCancelClick = useCallback(() => {
    if (submit && phase === "submitting") return;
    closeDialog("cancel");
  }, [phase, submit]);

  /** PT-011: крестик — то же закрытие, что Escape и клик по подложке. */
  const handleDismissClick = useCallback(() => {
    if (submit && phase === "submitting") return;
    closeDialog("dismiss");
  }, [phase, submit]);

  const variantColors = {
    danger: {
      confirmBg: "bg-rose-600 hover:bg-rose-700",
      iconBg: "bg-rose-100 text-rose-600",
      icon: "⚠",
    },
    warning: {
      confirmBg: "bg-amber-600 hover:bg-amber-700",
      iconBg: "bg-amber-100 text-amber-600",
      icon: "⚠",
    },
    info: {
      confirmBg: "bg-slate-950 hover:bg-slate-800",
      iconBg: "bg-slate-100 text-slate-600",
      icon: "✕",
    },
  };

  const colors = variantColors[options.variant ?? "info"];
  const isSubmitting = phase === "submitting";

  const confirmLabel = isSubmitting
    ? (options.submit?.pendingLabel ?? "Отправляю…")
    : phase === "failed"
      ? (options.submit?.retryLabel ?? "Повторить")
      : (options.confirmLabel ?? "Подтвердить");

  const cancelLabel =
    phase === "failed"
      ? (options.submit?.dismissLabel ?? "Закрыть без отправки")
      : (options.cancelLabel ?? "Отмена");

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={handleOverlayClick}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        aria-busy={isSubmitting || undefined}
        className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl animate-fade-slide-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg ${colors.iconBg}`}
          >
            {colors.icon}
          </span>
          <div className="min-w-0 flex-1">
            <h3 id="confirm-dialog-title" className="text-base font-semibold text-slate-950">
              {options.title}
            </h3>
            <p id="confirm-dialog-message" className="mt-2 text-sm leading-6 text-slate-600">
              {options.message}
            </p>

            {options.phoneField ? (
              <div className="mt-4">
                <label
                  htmlFor="confirm-dialog-phone"
                  className="text-sm font-medium text-slate-700"
                >
                  {options.phoneField.label}
                </label>
                <input
                  id="confirm-dialog-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  disabled={isSubmitting}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={options.phoneField.placeholder ?? "+7 900 000-00-00"}
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-60"
                />
                {options.phoneField.hint ? (
                  <p className="mt-2 text-xs text-slate-500">{options.phoneField.hint}</p>
                ) : null}

                {consent ? (
                  <label className="mt-3 flex items-start gap-2.5 text-xs leading-5 text-slate-600">
                    <input
                      type="checkbox"
                      data-testid="rescue-consent"
                      checked={consentCapture.given}
                      disabled={isSubmitting}
                      onChange={(e) => consentCapture.onChange(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-slate-950"
                    />
                    <span>
                      {consent.prefix}
                      <Link
                        href={consent.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline decoration-slate-300 underline-offset-2 hover:text-slate-950"
                      >
                        {consent.linkLabel}
                      </Link>
                      {consent.suffix}
                    </span>
                  </label>
                ) : null}
              </div>
            ) : null}

            {/*
              PT-004: причина отказа видна в самом диалоге. `role="alert"` —
              чтобы скринридер прочитал её сразу, не дожидаясь фокуса (S15).
            */}
            {phase === "failed" && failureMessage ? (
              <p
                role="alert"
                data-testid="confirm-dialog-error"
                className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-950"
              >
                {failureMessage}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            data-testid="confirm-dialog-cancel"
            disabled={isSubmitting}
            onClick={handleCancelClick}
            className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            ref={retryButtonRef}
            type="button"
            data-testid="confirm-dialog-submit"
            disabled={isSubmitting || !canSubmit}
            onClick={handleConfirmClick}
            className={`h-10 rounded-xl px-4 text-sm font-semibold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${colors.confirmBg}`}
          >
            {confirmLabel}
          </button>
        </div>

        {/*
          PT-011 · Крестик — видимый способ закрыть диалог выбора.

          В DOM он стоит последним, чтобы первый фокус при открытии доставался
          кнопке действия, а не «закрыть»; позиция задаётся абсолютно. На
          мобильном это единственный явный способ уйти: Escape там нет.
        */}
        {dismissible ? (
          <button
            type="button"
            data-testid="confirm-dialog-close"
            aria-label="Закрыть"
            disabled={isSubmitting}
            onClick={handleDismissClick}
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-lg leading-none text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span aria-hidden="true">✕</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
