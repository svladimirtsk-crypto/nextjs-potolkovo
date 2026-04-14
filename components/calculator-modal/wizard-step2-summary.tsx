"use client";

import {
  usePriceCalculatorBridge,
  getCalculatorSummaryLines,
} from "@/components/home/price-calculator-context";
import { useCalculatorModal } from "./calculator-modal-context";

function fmt(n: number) {
  return new Intl.NumberFormat("ru-RU").format(n);
}

export function WizardStep2Summary() {
  const { snapshot } = usePriceCalculatorBridge();
  const { lightingDraft, ceilingTotal, lightingDiscountedTotal, grandTotal } =
    useCalculatorModal();

  const calcLines = getCalculatorSummaryLines(snapshot);

  return (
    <div className="space-y-5">
      {/* Hero totals */}
      <div className="rounded-2xl bg-slate-950 text-white p-5">
        <p className="text-sm text-white/60">Потолок</p>
        <p className="text-3xl font-bold">{fmt(ceilingTotal)} ₽</p>

        {lightingDiscountedTotal > 0 && lightingDraft ? (
          <>
            <p className="mt-3 text-sm text-white/60">Итого с освещением</p>
            <p className="text-4xl font-bold">{fmt(grandTotal)} ₽</p>
            <p className="text-xs text-white/50 mt-1">
              Свет: {fmt(lightingDiscountedTotal)} ₽ (−15% от{" "}
              {fmt(lightingDraft.totalRub ?? 0)} ₽)
            </p>
          </>
        ) : null}
      </div>

      {/* Accordion details */}
      <details className="group">
        <summary className="cursor-pointer text-sm font-medium text-slate-700 hover:text-slate-950 list-none flex items-center gap-2">
          <span className="group-open:rotate-90 transition-transform">▶</span>
          Состав расчёта
        </summary>

        <div className="mt-3 pl-4 border-l-2 border-slate-200 space-y-4">
          {calcLines.length > 0 ? (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Потолок
              </p>
              <ul className="space-y-1">
                {calcLines.map((line) => (
                  <li key={line} className="text-sm text-slate-600">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {lightingDraft && lightingDraft.mode !== "none" && lightingDraft.items && lightingDraft.items.length > 0 ? (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Освещение ({lightingDraft.mode === "kit" ? lightingDraft.kitName : "Каталог"})
              </p>
              <ul className="space-y-1">
                {lightingDraft.items.map((item) => (
                  <li key={item.sku} className="text-sm text-slate-600 flex justify-between gap-2">
                    <span>{item.name} × {item.qty}</span>
                    <span className="text-slate-400">{fmt(item.qty * item.priceRub)} ₽</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </details>

      <p className="text-xs text-slate-500">
        Точная смета фиксируется после бесплатного замера. Скидка 15% на освещение при заказе потолка.
      </p>
    </div>
  );
}
