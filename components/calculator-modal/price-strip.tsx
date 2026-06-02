"use client";

import { applyLightingDiscount } from "@/lib/lighting-formulas";
import { useCalculatorModal } from "./calculator-modal-context";

function fmt(n: number) {
  return new Intl.NumberFormat("ru-RU").format(Math.round(n));
}

export function PriceStrip() {
  const {
    ceilingTotal,
    lightingDiscountedTotal,
    lightingDraft,
    step0AreaConfirmed,
    currentStep,
    step0SessionInteracted,
    options,
    grandTotal,
  } = useCalculatorModal();

  const showCeiling = currentStep === 0 || step0SessionInteracted;

  const items = lightingDraft?.mode === "catalog" ? (lightingDraft.items ?? []) : [];
  const lightingRegular = items.reduce((sum, it) => sum + Number(it.qty ?? 0) * Number(it.priceRub ?? 0), 0);
  const lightingDiscounted = applyLightingDiscount(lightingRegular);

  const discountEligible = step0AreaConfirmed;
  const lightingEffective = discountEligible ? lightingDiscounted : lightingRegular;

  const ceilingPartFromContext = showCeiling ? Math.max(0, grandTotal - (lightingDiscountedTotal ?? 0)) : 0;
  const displayTotal = showCeiling ? ceilingPartFromContext + lightingEffective : lightingEffective;

  if (ceilingTotal === 0 && lightingEffective === 0) {
    if (currentStep !== 0) return null;
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
        Выберите параметры — стоимость появится здесь
      </div>
    );
  }

  // lighting-first: потолок скрываем до интеракции Step0
  if (!showCeiling && lightingEffective > 0) {
    const showHint = options?.entryMode === "lighting-first";

    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm">
        <span className="font-medium">
          Свет: {fmt(lightingEffective)} ₽
          {discountEligible ? <span className="text-emerald-700"> −15%</span> : null}
        </span>

        {!discountEligible ? <span className="text-slate-500"> · скидка −15% при заказе потолка</span> : null}

        <span className="text-slate-500"> · </span>
        <span className="text-slate-700">Итого по свету: ~{fmt(displayTotal)} ₽</span>

        {showHint ? <span className="text-slate-500"> · Потолок — после шага 1</span> : null}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm">
      <span className="font-medium">Потолок: {fmt(ceilingTotal)} ₽</span>

      {lightingEffective > 0 ? (
        <>
          <span className="text-slate-500"> · </span>
          <span className="font-medium">
            Свет: {fmt(lightingEffective)} ₽
            {discountEligible ? <span className="text-emerald-700"> −15%</span> : null}
          </span>

          {!discountEligible ? <span className="text-slate-500"> · скидка −15% при заказе потолка</span> : null}

          <span className="text-slate-500"> · </span>
          <span className="font-semibold">Итого: ~{fmt(displayTotal)} ₽</span>
        </>
      ) : null}
    </div>
  );
}
