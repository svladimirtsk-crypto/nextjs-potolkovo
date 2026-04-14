"use client";

import { useCalculatorModal } from "./calculator-modal-context";

function fmt(n: number) {
  return new Intl.NumberFormat("ru-RU").format(n);
}

export function PriceStrip() {
  const { ceilingTotal, lightingDiscountedTotal, grandTotal } =
    useCalculatorModal();

  if (ceilingTotal === 0) return null;

  return (
    <div className="flex items-center gap-3 border-y border-slate-100 bg-slate-50 px-5 py-2.5 text-sm shrink-0 flex-wrap">
      <span className="text-slate-600">
        Потолок:{" "}
        <span className="font-semibold text-slate-950">
          {fmt(ceilingTotal)} ₽
        </span>
      </span>

      {lightingDiscountedTotal > 0 ? (
        <>
          <span className="text-slate-300 hidden sm:inline">·</span>
          <span className="text-slate-600">
            Свет:{" "}
            <span className="font-semibold text-slate-950">
              {fmt(lightingDiscountedTotal)} ₽
            </span>{" "}
            <span className="text-xs text-emerald-600">−15%</span>
          </span>
          <span className="text-slate-300 hidden sm:inline">·</span>
          <span className="font-semibold text-slate-950">
            Итого: ~{fmt(grandTotal)} ₽
          </span>
        </>
      ) : null}
    </div>
  );
}
