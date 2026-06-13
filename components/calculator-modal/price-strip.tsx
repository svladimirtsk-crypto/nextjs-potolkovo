"use client";

import { useEffect, useRef, useState } from "react";
import { useCalculatorModal } from "./calculator-modal-context";

function fmt(n: number) {
  return new Intl.NumberFormat("ru-RU").format(Math.round(n));
}

function LightingDiscountPrice({
  regular,
  discounted,
  benefit,
}: {
  regular: number;
  discounted: number;
  benefit: number;
}) {
  return (
    <>
      <span className="line-through text-slate-400">{fmt(regular)} ₽</span>{" "}
      <span>{fmt(discounted)} ₽</span>{" "}
      <span className="text-emerald-700">−15% (−{fmt(benefit)} ₽)</span>
    </>
  );
}

export function PriceStrip() {
  const {
    ceilingTotal,
    lightingEffectiveTotal,
    lightingRegularTotal,
    lightingDiscountedTotal,
    lightingDiscountEligible,
    showCeilingInUi,
    grandTotal,
    currentStep,
    options,
  } = useCalculatorModal();

  const hasLighting = lightingEffectiveTotal > 0;
  const appliedLightingBenefit = Math.max(0, lightingRegularTotal - lightingEffectiveTotal);
  const potentialLightingBenefit = Math.max(0, lightingRegularTotal - lightingDiscountedTotal);

  // P2.17: Price change animation key
  const prevTotalRef = useRef(grandTotal);
  const [animKey, setAnimKey] = useState(0);
  useEffect(() => {
    if (grandTotal !== prevTotalRef.current) {
      prevTotalRef.current = grandTotal;
      setAnimKey((k) => k + 1);
    }
  }, [grandTotal]);

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
          Свет:{" "}
          {lightingDiscountEligible && appliedLightingBenefit > 0 ? (
            <LightingDiscountPrice
              regular={lightingRegularTotal}
              discounted={lightingEffectiveTotal}
              benefit={appliedLightingBenefit}
            />
          ) : (
            <>{fmt(lightingEffectiveTotal)} ₽</>
          )}
        </span>

        {!lightingDiscountEligible && potentialLightingBenefit > 0 ? (
          <span className="text-slate-500">
            {" "}· с потолком{" "}
            <LightingDiscountPrice
              regular={lightingRegularTotal}
              discounted={lightingDiscountedTotal}
              benefit={potentialLightingBenefit}
            />
          </span>
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
            Свет:{" "}
            {lightingDiscountEligible && appliedLightingBenefit > 0 ? (
              <LightingDiscountPrice
                regular={lightingRegularTotal}
                discounted={lightingEffectiveTotal}
                benefit={appliedLightingBenefit}
              />
            ) : (
              <>{fmt(lightingEffectiveTotal)} ₽</>
            )}
          </span>

          {!lightingDiscountEligible && potentialLightingBenefit > 0 ? (
            <span className="text-slate-500">
              {" "}· с потолком{" "}
              <LightingDiscountPrice
                regular={lightingRegularTotal}
                discounted={lightingDiscountedTotal}
                benefit={potentialLightingBenefit}
              />
            </span>
          ) : null}

          <span className="text-slate-500"> · </span>

          <span key={animKey} className="font-semibold inline-block animate-pulse-once">
            Итого: ~{fmt(grandTotal)} ₽
          </span>
        </>
      ) : (
        <span key={animKey} className="font-semibold inline-block animate-pulse-once">
          {" "}
          · Итого: ~{fmt(grandTotal)} ₽
        </span>
      )}
    </div>
  );
}
