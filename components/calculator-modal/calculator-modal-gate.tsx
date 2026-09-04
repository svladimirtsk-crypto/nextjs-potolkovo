"use client";

/**
 * T-029 · Ленивое монтирование калькулятора.
 *
 * Раньше `<CalculatorModal />` рендерился на каждой странице сразу, и его чанк
 * (вместе с каталогом) грузился при загрузке страницы. Теперь чанк запрашивается
 * только после первого `openCalculator()`; после закрытия компонент остаётся
 * смонтированным, чтобы повторное открытие было мгновенным.
 */
import { Component, type ReactNode } from "react";
import dynamic from "next/dynamic";

import { contacts } from "@/content/contacts";

import { useCalculatorModal } from "./calculator-modal-context";

const CalculatorModal = dynamic(
  () => import("./calculator-modal").then((m) => m.CalculatorModal),
  { ssr: false }
);

type BoundaryProps = { children: ReactNode };
type BoundaryState = { hasError: boolean };

/**
 * Падение калькулятора не должно ломать страницу: показываем запасной путь
 * связи вместо белого экрана.
 */
class CalculatorErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { hasError: false };

  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("[calculator] не удалось отрисовать модалку", error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        role="alert"
        className="fixed inset-x-4 bottom-4 z-[130] rounded-2xl border border-rose-200 bg-white p-4 text-sm shadow-lg sm:inset-x-auto sm:right-6 sm:max-w-sm"
      >
        <p className="font-semibold text-slate-950">
          Не получилось загрузить калькулятор — напишите в Telegram
        </p>
        <p className="mt-2 flex flex-wrap items-center gap-2">
          <a href={contacts.phoneHref} className="font-semibold underline underline-offset-2">
            {contacts.phoneDisplay}
          </a>
          <span aria-hidden="true">·</span>
          <a
            href={contacts.telegramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-blue-700 underline underline-offset-2"
          >
            Написать в Telegram
          </a>
        </p>
      </div>
    );
  }
}

export function CalculatorModalGate() {
  const { hasEverOpened } = useCalculatorModal();

  if (!hasEverOpened) return null;

  return (
    <CalculatorErrorBoundary>
      <CalculatorModal />
    </CalculatorErrorBoundary>
  );
}
