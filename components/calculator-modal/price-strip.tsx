"use client";

import { useEffect, useRef, useState } from "react";
import { useCalculatorModal } from "./calculator-modal-context";

function fmt(n: number) {
  return new Intl.NumberFormat("ru-RU").format(Math.round(n));
}

function DiscountPrice({
  regular,
  discounted,
  percent,
}: {
  regular: number;
  discounted: number;
  percent: number;
}) {
  const benefit = Math.max(0, regular - discounted);
  return (
    <>
      <span className="line-through text-slate-400">{fmt(regular)} ₽</span>{" "}
      <span>{fmt(discounted)} ₽</span>{" "}
      <span className="text-emerald-700">−{percent}% (−{fmt(benefit)} ₽)</span>
    </>
  );
}

export function PriceStrip() {
  const {
    ceilingTotal,
    lightingEffectiveTotal,
    lightingRegularTotal,
    lightingStandaloneTotal,
    lightingWithCeilingTotal,
    lightingDiscountMode,
    showCeilingInUi,
    grandTotal,
    currentStep,
    options,
  } = useCalculatorModal();

  const hasLighting = lightingRegularTotal > 0;

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

  const lightingPrice =
    lightingDiscountMode === "with-ceiling" ? (
      <DiscountPrice regular={lightingRegularTotal} discounted={lightingWithCeilingTotal} percent={25} />
    ) : lightingDiscountMode === "lighting-only" ? (
      <DiscountPrice regular={lightingRegularTotal} discounted={lightingStandaloneTotal} percent={10} />
    ) : (
      <>{fmt(lightingEffectiveTotal)} ₽</>
    );

  const withCeilingHint =
    hasLighting && lightingDiscountMode !== "with-ceiling" && lightingWithCeilingTotal > 0 ? (
      <span className="text-slate-500">
        {" "}· с потолком{" "}
        <DiscountPrice regular={lightingRegularTotal} discounted={lightingWithCeilingTotal} percent={25} />
      </span>
    ) : null;

  // Lighting-first: показываем только свет, потолок — аккуратной подсказкой
  if (!showCeilingInUi && hasLighting) {
    const showHint = options?.entryMode === "lighting-first";
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm">
        <span className="font-medium">Свет: {lightingPrice}</span>
        {withCeilingHint}

        <span className="text-slate-500"> · </span>
        <span className="text-slate-700">Итого по свету: ~{fmt(grandTotal)} ₽</span>

        {showHint ? <span className="text-slate-500"> · Потолок — можно добавить на следующем шаге</span> : null}
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
          <span className="font-medium">Свет: {lightingPrice}</span>
          {withCeilingHint}
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
