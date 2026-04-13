"use client";

import {
  usePriceCalculatorBridge,
  getCalculatorSummaryLines,
} from "@/components/home/price-calculator-context";
import { useCalculatorModal } from "./calculator-modal-context";

function fmt(n: number) {
  return new Intl.NumberFormat("ru-RU").format(n);
}

type WizardStep2SummaryProps = {
  onConfirm: () => void;
};

export function WizardStep2Summary({ onConfirm }: WizardStep2SummaryProps) {
  const { snapshot } = usePriceCalculatorBridge();
  const { lightingDraft, goToStep } = useCalculatorModal();

  const calcLines = getCalculatorSummaryLines(snapshot);

  return (
    <div className="space-y-6">
      {calcLines.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-slate-950 mb-3">
            Потолок
          </h3>
          <ul className="space-y-1.5">
            {calcLines.map((line) => (
              <li key={line} className="text-sm text-slate-600">
                {line}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div>
          <h3 className="text-sm font-semibold text-slate-950 mb-2">
            Потолок
          </h3>
          <p className="text-sm text-slate-500">
            Параметры не заданы — вернитесь на шаг 1
          </p>
        </div>
      )}

      {lightingDraft && lightingDraft.mode !== "none" ? (
        <div className="border-t border-slate-200 pt-4">
          <h3 className="text-sm font-semibold text-slate-950 mb-3">
            Освещение
          </h3>
          {lightingDraft.mode === "kit" ? (
            <div>
              <p className="text-sm text-slate-900 font-medium">
                Комплект: {lightingDraft.kitName}
              </p>
              {lightingDraft.items && lightingDraft.items.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {lightingDraft.items.map((item) => (
                    <li key={item.sku} className="text-sm text-slate-600">
                      {item.name} × {item.qty} — {fmt(item.priceRub)} ₽/шт.
                    </li>
                  ))}
                </ul>
              ) : null}
              {lightingDraft.totalRub != null ? (
                <p className="mt-2 text-sm font-bold text-slate-950">
                  {fmt(lightingDraft.totalRub)} ₽
                </p>
              ) : null}
            </div>
          ) : null}
          {lightingDraft.mode === "custom" ? (
            <p className="text-sm text-slate-600">
              Пожелание: {lightingDraft.customNote || "не указано"}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="border-t border-slate-200 pt-4">
        <p className="text-xs text-slate-500">
          Точная смета фиксируется после бесплатного замера. Скидка 15% на
          освещение при заказе потолка.
        </p>
      </div>
    </div>
  );
}
