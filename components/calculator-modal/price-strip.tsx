"use client";

import { useEffect, useRef, useState } from "react";

import { pricing } from "@/content/pricing";
import { selectStripState } from "@/lib/calculator/selectors";
import { useCalculatorStore } from "@/lib/calculator/store";

import { useCalculatorModal } from "./calculator-modal-context";

/** Рубли без дробей; ₽ отделяем неразрывным пробелом, чтобы не отрывался. */
function fmtRub(n: number): string {
  return `${new Intl.NumberFormat("ru-RU").format(Math.round(n))}\u00a0₽`;
}

/**
 * N-012 · Ценовая полоса калькулятора.
 *
 * Раньше компонент сам разбирал шесть флагов контекста и рисовал четыре
 * варианта строки для desktop и три для mobile — отсюда дубль
 * «Потолок 18 000 · Итого 18 000» при равенстве сумм. Теперь состояние
 * считает `selectStripState`, а здесь остаётся только отрисовка одной строки,
 * одинаковой для обеих раскладок.
 */
export function PriceStrip() {
  const {
    ceilingTotal,
    lightingEffectiveTotal,
    lightingRegularTotal,
    lightingDiscountMode,
    showCeilingInUi,
    step0Progress,
    step0SessionInteracted,
  } = useCalculatorModal();

  const { snapshot } = useCalculatorStore();

  const lightingDiscountPct =
    lightingDiscountMode === "with-ceiling"
      ? pricing.lightingDiscount.withCeilingPct
      : lightingDiscountMode === "lighting-only"
        ? pricing.lightingDiscount.lightingOnlyPct
        : 0;

  /**
   * Пока человек не ответил ни на один вопрос, потолок в сторе — это дефолтная
   * комната, а не его выбор. Показывать её сумму нельзя: цифра выглядит как
   * ответ на незаданный вопрос.
   */
  const ceilingKnown = showCeilingInUi && step0SessionInteracted;

  const state = selectStripState({
    ceilingRub: ceilingTotal,
    ceilingKnown,
    lightingEffectiveRub: lightingEffectiveTotal,
    lightingRegularRub: lightingRegularTotal,
    lightingDiscountPct,
    // Досчёт монтажа уже включён в grandTotal контекста; отдельной строкой
    // показываем его только когда движок посчитал его явно.
    extraInstallRub: 0,
    minimumApplied: Boolean(snapshot?.minimumOrderApplied),
    questionsTotal: step0Progress?.total ?? 6,
  });

  const totalRub = state.kind === "idle" ? 0 : state.totalRub;

  // Анимируем только смену числа, а не весь блок.
  const prevTotalRef = useRef(totalRub);
  const [animKey, setAnimKey] = useState(0);
  useEffect(() => {
    if (totalRub === prevTotalRef.current) return;

    prevTotalRef.current = totalRub;
    const frame = requestAnimationFrame(() => setAnimKey((k) => k + 1));
    return () => cancelAnimationFrame(frame);
  }, [totalRub]);

  const [hintOpen, setHintOpen] = useState(false);

  return (
    /*
     * T-064: сумма пересчитывается от действий в другой части экрана, поэтому
     * полоса объявлена live-регионом — иначе незрячий пользователь меняет
     * параметр и не узнаёт, что итог изменился. `polite`, чтобы не перебивать.
     */
    <div
      aria-live="polite"
      aria-atomic="true"
      data-strip-state={state.kind}
      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm max-sm:px-3 max-sm:py-2"
    >
      {state.kind === "idle" ? (
        <p className="text-slate-700 max-sm:text-xs">{state.text}</p>
      ) : (
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span key={animKey} className="font-semibold text-slate-950 animate-pulse-once">
            ~{fmtRub(totalRub)}
          </span>

          {state.kind === "estimating" ? (
            <>
              {state.minimumApplied ? (
                <span className="text-slate-500 max-sm:text-xs">· минимальный заказ</span>
              ) : null}
              {state.hint ? (
                <>
                  <button
                    type="button"
                    aria-expanded={hintOpen}
                    onClick={() => setHintOpen((open) => !open)}
                    className="text-xs text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-800"
                  >
                    что входит
                  </button>
                  {hintOpen ? (
                    <p className="w-full text-xs leading-5 text-slate-600">{state.hint}</p>
                  ) : null}
                </>
              ) : null}
            </>
          ) : (
            <span className="text-slate-500 max-sm:text-xs">
              ·{" "}
              {state.parts.map((part, index) => (
                <span key={part.id}>
                  {index > 0 ? " + " : ""}
                  {part.label} {fmtRub(part.rub)}
                  {part.id === "lighting" && state.lightingDiscountPct > 0
                    ? ` (−${state.lightingDiscountPct}\u00a0%)`
                    : ""}
                </span>
              ))}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
