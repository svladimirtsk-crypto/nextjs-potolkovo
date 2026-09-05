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
  // Динамический ориентир: показываем цену потолка сразу, как только движок
  // её посчитал (ceilingTotal > 0), не дожидаясь «инженерного подтверждения»
  // Step0. Подтверждение (step0AreaConfirmed) по-прежнему управляет только
  // досчётом монтажа (grandTotal в snapshot) — механика не меняется.
  const hasCeilingEstimate = showCeilingInUi && ceilingTotal > 0;
  const showCeilingPrice = hasCeilingEstimate;
  const displayGrandTotal = hasCeilingEstimate ? grandTotal : lightingEffectiveTotal;

  // P2.17: Pulse animation key
  const prevTotalRef = useRef(displayGrandTotal);
  const [animKey, setAnimKey] = useState(0);
  useEffect(() => {
    if (displayGrandTotal === prevTotalRef.current) return;

    prevTotalRef.current = displayGrandTotal;
    const frame = requestAnimationFrame(() => setAnimKey((k) => k + 1));
    return () => cancelAnimationFrame(frame);
  }, [displayGrandTotal]);

  if (!showCeilingPrice && !hasLighting) {
    // До первого расчёта (экран выбора сценария): нейтральная строка вместо
    // требования «подтвердите площадь» — цена появится сама, как только
    // движок посчитает первую конфигурацию.
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm max-sm:px-3 max-sm:py-2 max-sm:text-xs">
        Цена считается автоматически по мере выбора параметров
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
    if (!showCeilingPrice && hasLighting) {
      if (currentStep === 0) return `Свет сохранён: ${fmt(lightingEffectiveTotal)} ₽ · потолок уточняем`;
      if (lightingDiscountMode === "lighting-only") return `Свет −10%: ${fmt(lightingEffectiveTotal)} ₽`;
      return `Свет: ${fmt(lightingEffectiveTotal)} ₽`;
    }

    if (hasLighting) {
      const benefit = Math.max(0, lightingRegularTotal - lightingEffectiveTotal);
      return `Потолок ${fmt(ceilingTotal)} ₽ · свет ${fmt(lightingEffectiveTotal)} ₽${benefit > 0 ? ` · выгода ${fmt(benefit)} ₽` : ""}`;
    }

    return `Потолок ${fmt(ceilingTotal)} ₽`;
  })();

  return (
    /*
     * T-064: сумма пересчитывается от действий в другой части экрана, поэтому
     * полоса объявлена live-регионом — иначе незрячий пользователь меняет
     * параметр и не узнаёт, что итог изменился. `polite`, чтобы не перебивать.
     */
    <div
      aria-live="polite"
      aria-atomic="true"
      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm max-sm:px-3 max-sm:py-2"
    >
      <div className="sm:hidden">
        {!hasCeilingEstimate && hasLighting ? (
          <>
            <p key={animKey} className="text-sm font-bold text-slate-950 animate-pulse-once">
              Свет сохранён: {fmt(lightingEffectiveTotal)} ₽
            </p>
            <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">
              потолок уточняем
            </p>
          </>
        ) : (
          <>
            <p key={animKey} className="text-sm font-bold text-slate-950 animate-pulse-once">
              {displayGrandTotal > 0 ? `Итого: ~${fmt(displayGrandTotal)} ₽` : "Цена появится по мере выбора параметров"}
            </p>
            <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">
              {mobileSubtitle}
            </p>
          </>
        )}
      </div>

      <div className="hidden sm:block">
        {!showCeilingPrice && hasLighting ? (
          <>
            <span className="font-medium">Свет: {lightingPrice}</span>
            {withCeilingHint}
            <span className="text-slate-500"> · Потолок рассчитаем на этом шаге</span>
          </>
        ) : !showCeilingPrice ? (
          <span className="text-slate-700">Цена считается автоматически по мере выбора параметров</span>
        ) : !showCeilingInUi && hasLighting ? (
          <>
            <span className="font-medium">Свет: {lightingPrice}</span>
            {withCeilingHint}
            <span className="text-slate-500"> · </span>
            <span className="text-slate-700">Итого по свету: ~{fmt(displayGrandTotal)} ₽</span>
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
                  Итого: ~{fmt(displayGrandTotal)} ₽
                </span>
              </>
            ) : (
              <span key={animKey} className="font-semibold inline-block animate-pulse-once">
                {" "}
                · Итого: ~{fmt(displayGrandTotal)} ₽
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
