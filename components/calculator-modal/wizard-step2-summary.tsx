"use client";

import {
  getCalculatorSummaryLines,
  getLightingSummaryLines,
  usePriceCalculatorBridge,
} from "@/components/home/price-calculator-context";
import { useCalculatorModal } from "./calculator-modal-context";

function fmt(n: number) {
  return new Intl.NumberFormat("ru-RU").format(n);
}

type WizardStep2SummaryProps = {
  onConfirm: () => void;
};

export function WizardStep2Summary({ onConfirm }: WizardStep2SummaryProps) {
  const { snapshot } = usePriceCalculatorBridge();
  const { lightingDraft, ceilingTotal, lightingDiscountedTotal, grandTotal } =
    useCalculatorModal();

  const calcLines    = getCalculatorSummaryLines(snapshot);
  const lightingLines = getLightingSummaryLines(
    snapshot ? { ...snapshot, lighting: lightingDraft ?? undefined } : null
  );

  const hasLighting =
    lightingDraft !== null &&
    lightingDraft.mode !== "none" &&
    (lightingDraft.items?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      {/* Hero totals */}
      <div className="rounded-2xl bg-slate-950 p-6 text-white">
        <p className="text-sm text-white/60 mb-1">Потолок (работы)</p>
        <p className="text-3xl font-bold tracking-tight">{fmt(ceilingTotal)} ₽</p>

        {hasLighting && lightingDiscountedTotal > 0 ? (
          <>
            <div className="my-4 border-t border-white/10" />
            <p className="text-sm text-white/60 mb-1">Итого с освещением</p>
            <p className="text-4xl font-bold tracking-tight">
              ~{fmt(grandTotal)} ₽
            </p>
            <p className="mt-2 text-xs text-white/50">
              Свет: {fmt(lightingDiscountedTotal)} ₽ со скидкой 15%
              {lightingDraft.totalRub != null ? (
                <> (от {fmt(lightingDraft.totalRub)} ₽)</>
              ) : null}
            </p>
          </>
        ) : null}
      </div>

      {/* Details */}
      <details className="group rounded-2xl border border-slate-200 bg-slate-50">
        <summary className="flex cursor-pointer select-none items-center justify-between px-4 py-3 text-sm font-semibold text-slate-950 list-none">
          <span>Состав расчёта</span>
          <span
            className="text-slate-400 transition-transform group-open:rotate-180"
            aria-hidden="true"
          >
            ▾
          </span>
        </summary>

        <div className="border-t border-slate-200 px-4 py-4 space-y-4">
          {calcLines.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                Потолок
              </p>
              <ul className="space-y-1.5">
                {calcLines.map((line) => (
                  <li key={line} className="text-sm text-slate-600">{line}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              Параметры не заданы — вернитесь на шаг 1
            </p>
          )}

          {hasLighting && lightingDraft.items && lightingDraft.items.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                Освещение
              </p>
              {lightingDraft.kitName ? (
                <p className="text-sm font-medium text-slate-700 mb-1">
                  {lightingDraft.kitName}
                </p>
              ) : null}
              <ul className="space-y-1.5">
                {lightingDraft.items.map((item) => (
                  <li
                    key={item.sku}
                    className="flex items-center justify-between gap-2 text-sm text-slate-600"
                  >
                    <span>{item.name} × {item.qty}</span>
                    <span className="shrink-0 text-slate-400">
                      {fmt(item.qty * item.priceRub)} ₽
                    </span>
                  </li>
                ))}
              </ul>
              {lightingDraft.totalRub != null ? (
                <p className="mt-2 text-sm font-semibold text-slate-950">
                  Свет итого: {fmt(lightingDraft.totalRub)} ₽
                  {lightingDiscountedTotal > 0 ? (
                    <span className="ml-2 text-emerald-600">
                      → {fmt(lightingDiscountedTotal)} ₽ (−15%)
                    </span>
                  ) : null}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </details>

      {/* Note */}
      <p className="text-xs text-slate-500 leading-5">
        Точная смета фиксируется после бесплатного замера. Скидка 15% на
        оборудование при заказе натяжного потолка.
      </p>

      {/* 
        P0.2: мобильная кнопка убрана отсюда — 
        теперь она в footer модалки (calculator-modal.tsx) на всех экранах.
        Оставляем onConfirm prop для совместимости.
      */}
    </div>
  );
}
