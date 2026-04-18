// components/calculator-modal/wizard-step2-summary.tsx
"use client";

import {
  getCalculatorSummaryLines,
  getLightingSummaryLines,
  usePriceCalculatorBridge,
} from "@/components/home/price-calculator-context";
import { useCalculatorModal } from "./calculator-modal-context";
import { isSnapshotValid } from "@/lib/calculator-snapshot-guard";
import { calcRequiredWorksFromLighting } from "@/lib/lighting-formulas"; // ← NEW
import type { WizardStep } from "@/lib/calculator-modal-types";

function fmt(n: number) {
  return new Intl.NumberFormat("ru-RU").format(n);
}

type WizardStep2SummaryProps = {
  onConfirm: () => void;
};

export function WizardStep2Summary({ onConfirm }: WizardStep2SummaryProps) {
  const { snapshot } = usePriceCalculatorBridge();
  const {
    lightingDraft,
    ceilingTotal,
    lightingDiscountedTotal,
    grandTotal,
    goToStep,
  } = useCalculatorModal();

  const calcLines     = getCalculatorSummaryLines(snapshot);
  const lightingLines = getLightingSummaryLines(
    snapshot ? { ...snapshot, lighting: lightingDraft ?? undefined } : null
  );

  const hasLighting =
    lightingDraft !== null &&
    lightingDraft.mode !== "none" &&
    (lightingDraft.items?.length ?? 0) > 0;

  // ← NEW: проверяем нужна ли синхронизация
  const { requiredLightsCount } = calcRequiredWorksFromLighting(lightingDraft?.items);
  const willBeReconciled =
    hasLighting &&
    requiredLightsCount !== null &&
    requiredLightsCount !== (snapshot?.lightsCount ?? 0);

  if (!isSnapshotValid(snapshot)) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
        <div className="text-4xl" aria-hidden="true">📐</div>
        <p className="text-base font-semibold text-slate-950">
          Сначала укажите параметры потолка
        </p>
        <p className="text-sm text-slate-500 max-w-xs">
          Выберите площадь и тип потолка на первом шаге — расчёт появится здесь автоматически.
        </p>
        <button
          type="button"
          onClick={() => goToStep(0 as WizardStep)}
          className="mt-2 flex h-12 px-6 rounded-2xl bg-slate-950 text-white text-sm font-semibold hover:bg-slate-800 transition-colors items-center"
          style={{ minHeight: 48 }}
        >
          Указать параметры →
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero totals */}
      <div className="rounded-2xl bg-slate-950 p-6 text-white">
        <p className="text-sm text-white/60 mb-1">Потолок (работы)</p>
        <p className="text-3xl font-bold tracking-tight">
          {fmt(ceilingTotal)} ₽
        </p>

        {hasLighting && lightingDiscountedTotal > 0 ? (
          <>
            <div className="my-4 border-t border-white/10" />
            <p className="text-sm text-white/60 mb-1">Итого с освещением</p>
            <p className="text-4xl font-bold tracking-tight">
              ~{fmt(grandTotal)} ₽
            </p>
            <p className="mt-2 text-xs text-white/50">
              Свет: {fmt(lightingDiscountedTotal)} ₽ со скидкой 15%
              {lightingDraft.totalRub != null ? (
                <> (от {fmt(lightingDraft.totalRub)} ₽)</>
              ) : null}
            </p>
          </>
        ) : null}
      </div>

      {/* ← NEW: Reconcile banner */}
      {willBeReconciled ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">
            ✓ Параметры работ обновлены
          </p>
          <p className="mt-1 text-sm text-amber-800">
            На основе выбранного оборудования автоматически обновлены параметры монтажа.
            Все согласовано.
          </p>
        </div>
      ) : null}

      {/* Details */}
      <details className="group rounded-2xl border border-slate-200 bg-slate-50">
        <summary className="flex cursor-pointer select-none items-center justify-between px-4 py-3 text-sm font-semibold text-slate-950 list-none">
          <span>Состав расчёта</span>
          <span
            className="text-slate-400 transition-transform group-open:rotate-180"
            aria-hidden="true"
          >
            ▾
          </span>
        </summary>

        <div className="border-t border-slate-200 px-4 py-4 space-y-4">
          {/* Ceiling lines */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
              Потолок
            </p>
            <ul className="space-y-1.5">
              {calcLines.map((line) => (
                <li key={line} className="text-sm text-slate-600">
                  {line}
                </li>
              ))}
            </ul>
          </div>

          {hasLighting && lightingDraft.items && lightingDraft.items.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                Освещение
              </p>
              {lightingDraft.kitName ? (
                <p className="text-sm font-medium text-slate-700 mb-1">
                  {lightingDraft.kitName}
                </p>
              ) : null}
              <ul className="space-y-1.5">
                {lightingDraft.items.map((item) => (
                  <li
                    key={item.sku}
                    className="flex items-center justify-between gap-2 text-sm text-slate-600"
                  >
                    <span>
                      {item.name} × {item.qty}
                    </span>
                    <span className="shrink-0 text-slate-400">
                      {fmt(item.qty * item.priceRub)} ₽
                    </span>
                  </li>
                ))}
              </ul>
              {lightingDraft.totalRub != null ? (
                <p className="mt-2 text-sm font-semibold text-slate-950">
                  Свет итого: {fmt(lightingDraft.totalRub)} ₽
                  {lightingDiscountedTotal > 0 ? (
                    <span className="ml-2 text-emerald-600">
                      → {fmt(lightingDiscountedTotal)} ₽ (−15%)
                    </span>
                  ) : null}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </details>

      {/* Note */}
      <p className="text-xs text-slate-500 leading-5">
        Это ориентировочный расчёт. Точную стоимость определим на бесплатном
        замере — приеду, посмотрю помещение и дам конкретные цифры.
        {hasLighting
          ? " Скидка 15% на оборудование сохраняется при заказе потолка."
          : null}
      </p>
    </div>
  );
}
