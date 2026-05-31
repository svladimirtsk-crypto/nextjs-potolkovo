"use client";

import { useCalculatorModal } from "./calculator-modal-context";

function fmt(n: number) {
  return new Intl.NumberFormat("ru-RU").format(Math.round(n));
}

export function PriceStrip() {
  const {
    ceilingTotal,
    lightingDiscountedTotal,
    currentStep,
    step0SessionInteracted,
    options,
  } = useCalculatorModal();

  const showCeiling = currentStep === 0 || step0SessionInteracted;
  const displayCeiling = showCeiling ? ceilingTotal : 0;
  const hasLighting = lightingDiscountedTotal > 0;

  // Если потолок скрыт (lighting-first и Step0 не трогали), то "итого" показываем только по свету,
  // чтобы не давить потолком/не показывать старые значения из snapshot.
  const displayTotal = showCeiling ? displayCeiling + lightingDiscountedTotal : lightingDiscountedTotal;

  // P0.3: placeholder на шаге 0 пока ничего не выбрано
  if (displayCeiling === 0 && !hasLighting) {
    if (currentStep !== 0) return null;

    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
        Выберите параметры — стоимость появится здесь
      </div>
    );
  }

  // Lighting-first: показываем только свет, потолок — аккуратной подсказкой
  if (!showCeiling && hasLighting) {
    const showHint = options?.entryMode === "lighting-first";

    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm">
        <span className="font-medium">
          Свет: {fmt(lightingDiscountedTotal)} ₽ <span className="text-emerald-700">−15%</span>
        </span>

        <span className="text-slate-500"> · </span>

        <span className="text-slate-700">Итого по свету: ~{fmt(displayTotal)} ₽</span>

        {showHint ? (
          <span className="text-slate-500"> · Потолок — после выбора параметров на шаге 1</span>
        ) : null}
      </div>
    );
  }

  // Обычный режим: показываем потолок (и свет, если есть)
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm">
      <span className="font-medium">Потолок: {fmt(displayCeiling)} ₽</span>

      {hasLighting ? (
        <>
          <span className="text-slate-500"> · </span>
          <span className="font-medium">
            Свет: {fmt(lightingDiscountedTotal)} ₽ <span className="text-emerald-700">−15%</span>
          </span>
          <span className="text-slate-500"> · </span>
          <span className="font-semibold">Итого: ~{fmt(displayTotal)} ₽</span>
        </>
      ) : null}
    </div>
  );
}
