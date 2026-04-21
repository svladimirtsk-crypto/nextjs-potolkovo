// components/calculator-modal/price-strip.tsx
"use client";

import { useMemo } from "react";

import { useCalculatorModal } from "./calculator-modal-context";
import { usePriceCalculatorBridge } from "@/components/home/price-calculator-context";

function fmt(n: number) {
  return new Intl.NumberFormat("ru-RU").format(Math.round(n));
}

type ExtendedOptions = {
  entryMode?: "lighting-first" | string;
};

export function PriceStrip() {
  const { ceilingTotal, lightingDiscountedTotal, currentStep, options } =
    useCalculatorModal();
  const { snapshot } = usePriceCalculatorBridge();

  const extendedOptions = options as (typeof options & ExtendedOptions) | null;
  const isLightingFirst = extendedOptions?.entryMode === "lighting-first";
  const step0Interacted = Boolean(snapshot?.hasInteracted);

  const hideCeilingPrice = isLightingFirst && !step0Interacted;
  const visibleCeilingTotal = hideCeilingPrice ? 0 : ceilingTotal;

  const visibleGrandTotal = useMemo(() => {
    return visibleCeilingTotal + lightingDiscountedTotal;
  }, [visibleCeilingTotal, lightingDiscountedTotal]);

  // Базовый placeholder для шага 0, если потолок еще не рассчитан и света нет.
  if (visibleCeilingTotal === 0 && lightingDiscountedTotal <= 0) {
    if (currentStep !== 0) return null;
    return (
      <div className="flex shrink-0 items-center border-y border-slate-100 bg-slate-50 px-5 py-2.5 text-sm text-slate-400">
        Выберите параметры — стоимость появится здесь
      </div>
    );
  }

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-y border-slate-100 bg-slate-50 px-5 py-2.5 text-sm">
      <span className="text-slate-600">
        Потолок:{" "}
        {hideCeilingPrice ? (
          <span className="font-medium text-slate-500">
            Укажите параметры потолка — добавим стоимость монтажа
          </span>
        ) : (
          <span className="font-semibold text-slate-950">{fmt(visibleCeilingTotal)} ₽</span>
        )}
      </span>

      {lightingDiscountedTotal > 0 ? (
        <>
          <span className="hidden text-slate-300 sm:inline" aria-hidden="true">
            ·
          </span>
          <span className="text-slate-600">
            Свет:{" "}
            <span className="font-semibold text-slate-950">
              {fmt(lightingDiscountedTotal)} ₽
            </span>{" "}
            <span className="text-xs font-medium text-emerald-600">−15%</span>
          </span>
          <span className="hidden text-slate-300 sm:inline" aria-hidden="true">
            ·
          </span>
          <span className="font-semibold text-slate-950">
            Итого: ~{fmt(visibleGrandTotal)} ₽
          </span>
        </>
      ) : null}
    </div>
  );
}
