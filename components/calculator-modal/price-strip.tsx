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

  if (!showCeilingInUi && !hasLighting) {
    if (currentStep !== 0) return null;
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm max-sm:px-3 max-sm:py-2 max-sm:text-xs">
        Выберите параметры — стоимость появится здесь
      </div>
    );
  }

  const lightingPercent = lightingDiscountMode === "with-ceiling" ? 25 : lightingDiscountMode === "lighting-only" ? 10 : 0;
  const lightingDiscounted = lightingDiscountMode === "with-ceiling"
    ? lightingWithCeilingTotal
    : lightingDiscountMode === "lighting-only"
      ? lightingStandaloneTotal
      : lightingEffectiveTotal;

  const lightingPrice = lightingPercent > 0 && lightingRegularTotal > lightingDiscounted ? (
    <DiscountPrice regular={lightingRegularTotal} discounted={lightingDiscounted} percent={lightingPercent} />
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

  const mobileSubtitle = (() => {
    if (!showCeilingInUi && hasLighting) {
      if (lightingDiscountMode === "lighting-only") {
        return `Свет −10%: ${fmt(lightingEffectiveTotal)} ₽`;
      }
      return `Свет: ${fmt(lightingEffectiveTotal)} ₽`;
    }

    if (hasLighting) {
      const benefit = Math.max(0, lightingRegularTotal - lightingEffectiveTotal);
      return `Потолок ${fmt(ceilingTotal)} ₽ · свет ${fmt(lightingEffectiveTotal)} ₽${benefit > 0 ? ` · выгода ${fmt(benefit)} ₽` : ""}`;
    }

    return `Потолок ${fmt(ceilingTotal)} ₽`;
  })();

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm max-sm:px-3 max-sm:py-2">
      <div className="sm:hidden">
        <p key={animKey} className="text-sm font-bold text-slate-950 animate-pulse-once">
          Итого: ~{fmt(grandTotal)} ₽
        </p>
        <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">
          {mobileSubtitle}
        </p>
      </div>

      <div className="hidden sm:block">
        {!showCeilingInUi && hasLighting ? (
          <>
            <span className="font-medium">Свет: {lightingPrice}</span>
            {withCeilingHint}
            <span className="text-slate-500"> · </span>
            <span className="text-slate-700">Итого по свету: ~{fmt(grandTotal)} ₽</span>
            {options?.entryMode === "lighting-first" ? <span className="text-slate-500"> · Потолок — можно добавить на следующем шаге</span> : null}
          </>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}
