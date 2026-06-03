"use client";

import { useCalculatorModal } from "./calculator-modal-context";

function fmt(n: number) {
  return new Intl.NumberFormat("ru-RU").format(Math.round(n));
}

export function PriceStrip() {
  const {
    ceilingTotal,
    lightingEffectiveTotal,
    lightingDiscountEligible,
    showCeilingInUi,
    grandTotal,
    currentStep,
    options,
  } = useCalculatorModal();

  const hasLighting = lightingEffectiveTotal > 0;

  // placeholder на шаге 0 пока ничего не выбрано
  if (!showCeilingInUi && !hasLighting) {
    if (currentStep !== 0) return null;
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
        Выберите параметры — стоимость появится здесь
      </div>
    );
  }

  // Lighting-first: показываем только свет, потолок — аккуратной подсказкой
  if (!showCeilingInUi && hasLighting) {
    const showHint = options?.entryMode === "lighting-first";
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm">
        <span className="font-medium">
          Свет: {fmt(lightingEffectiveTotal)} ₽
          {lightingDiscountEligible ? <span className="text-emerald-700"> −15%</span> : null}
        </span>

        {!lightingDiscountEligible ? (
          <span className="text-slate-500"> · скидка −15% при заказе потолка</span>
        ) : null}

        <span className="text-slate-500"> · </span>
        <span className="text-slate-700">Итого по свету: ~{fmt(grandTotal)} ₽</span>

        {showHint ? <span className="text-slate-500"> · Потолок — после шага 1</span> : null}
      </div>
    );
  }

  // Обычный режим: потолок показываем всегда
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm">
      <span className="font-medium">Потолок: {fmt(ceilingTotal)} ₽</span>

      {hasLighting ? (
        <>
          <span className="text-slate-500"> · </span>

          <span className="font-medium">
            Свет: {fmt(lightingEffectiveTotal)} ₽
            {lightingDiscountEligible ? <span className="text-emerald-700"> −15%</span> : null}
          </span>

          {!lightingDiscountEligible ? (
            <span className="text-slate-500"> · скидка −15% при заказе потолка</span>
          ) : null}

          <span className="text-slate-500"> · </span>

          <span className="font-semibold">Итого: ~{fmt(grandTotal)} ₽</span>
        </>
      ) : null}
    </div>
  );
}
