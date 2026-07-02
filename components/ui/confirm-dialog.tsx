"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type ConfirmDialogOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "info";
};

type ConfirmResolver = (value: boolean) => void;

let activeResolver: ConfirmResolver | null = null;
let activeOptions: ConfirmDialogOptions | null = null;
let setDialogState: ((state: DialogState) => void) | null = null;

type DialogState = {
  open: boolean;
  options: ConfirmDialogOptions;
};

/**
 * Встроенная альтернатива window.confirm для калькулятора.
 *
 * Заменяет нативный confirm, который блокирует поток, не стилизуется
 * и выглядит чужеродно. Использует React-портал для рендера поверх
 * всех слоёв модалки.
 *
 * Использование:
 *   const confirmed = await showConfirmDialog({
 *     title: "Закрыть калькулятор?",
 *     message: "Ваш расчёт не сохранится.",
 *   });
 */
export function showConfirmDialog(options: ConfirmDialogOptions): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    activeResolver = resolve;
    activeOptions = options;
    setDialogState?.({ open: true, options });
  });
}

function closeDialog(result: boolean) {
  setDialogState?.({ open: false, options: activeOptions ?? { title: "", message: "" } });
  activeResolver?.(result);
  activeResolver = null;
  activeOptions = null;
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    'button:not([tabindex="-1"])',
  ].join(", ");
  return Array.from(container.querySelectorAll<HTMLElement>(selector));
}

export function ConfirmDialogPortal() {
  const [state, setState] = useState<DialogState>({ open: false, options: { title: "", message: "" } });
  const [mounted, setMounted] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDialogState = setState;
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => {
      cancelAnimationFrame(frame);
      setDialogState = null;
    };
  }, []);

  useEffect(() => {
    if (!state.open || !dialogRef.current) return;

    const frame = requestAnimationFrame(() => {
      if (!dialogRef.current) return;
      const focusable = getFocusableElements(dialogRef.current);
      if (focusable.length > 0) focusable[0].focus();
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeDialog(false);
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
  }, [state.open]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) closeDialog(false);
    },
    []
  );

  if (!mounted) return null;

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

  const colors = variantColors[state.options.variant ?? "info"];

  return (
    <>
      {state.open ? createPortal(
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
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl animate-fade-slide-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg ${colors.iconBg}`}
              >
                {colors.icon}
              </span>
              <div className="min-w-0 flex-1">
                <h3
                  id="confirm-dialog-title"
                  className="text-base font-semibold text-slate-950"
                >
                  {state.options.title}
                </h3>
                <p
                  id="confirm-dialog-message"
                  className="mt-2 text-sm leading-6 text-slate-600"
                >
                  {state.options.message}
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => closeDialog(false)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              >
                {state.options.cancelLabel ?? "Отмена"}
              </button>
              <button
                type="button"
                onClick={() => closeDialog(true)}
                className={`h-10 rounded-xl px-4 text-sm font-semibold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${colors.confirmBg}`}
              >
                {state.options.confirmLabel ?? "Подтвердить"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      ) : null}
    </>
  );
}
