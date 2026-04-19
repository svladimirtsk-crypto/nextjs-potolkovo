// components/calculator-modal/wizard-step2-summary.tsx
"use client";

import {
  getCalculatorSummaryLines,
  usePriceCalculatorBridge,
} from "@/components/home/price-calculator-context";
import { useCalculatorModal } from "./calculator-modal-context";
import { isSnapshotValid } from "@/lib/calculator-snapshot-guard";
import { calcRequiredWorksFromLighting } from "@/lib/lighting-formulas";
import type { WizardStep } from "@/lib/calculator-modal-types";
import { getKitDisplayName } from "@/lib/calculator-modal-types";
import { COLIBRI_PROFILES, CLARUS_PROFILES } from "@/lib/lighting-kits";

function fmt(n: number) {
  return new Intl.NumberFormat("ru-RU").format(n);
}

const ALL_PROFILES = [...COLIBRI_PROFILES, ...CLARUS_PROFILES];

function getProfileLengthLabel(sku: string): string | null {
  const entry = ALL_PROFILES.find((p) => p.sku === sku);
  return entry ? `${entry.lengthMm} мм` : null;
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

  const calcLines = getCalculatorSummaryLines(snapshot);

  const hasLighting =
    lightingDraft !== null &&
    lightingDraft.mode !== "none" &&
    (lightingDraft.items?.length ?? 0) > 0;

  const { requiredLightsCount } = calcRequiredWorksFromLighting(lightingDraft?.items);
  const currentLightsCount = snapshot?.lightsCount ?? 0;
  const willReconcileLights =
    hasLighting &&
    requiredLightsCount !== null &&
    requiredLightsCount !== currentLightsCount;

  const reconcileNote = willReconcileLights
    ? `Монтаж точечных светильников скорректирован: ${currentLightsCount} → ${requiredLightsCount} шт. (${fmt(requiredLightsCount * (snapshot?.lightsRatePerUnit ?? 750))} ₽)`
    : null;

  if (!isSnapshotValid(snapshot)) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
        <div className="text-4xl" aria-hidden="true">
          📐
        </div>
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
      <div className="rounded-2xl bg-slate-950 p-6 text-white">
        <p className="text-sm text-white/60 mb-1">Потолок (работы)</p>
        <p className="text-3xl font-bold tracking-tight">{fmt(ceilingTotal)} ₽</p>

        {hasLighting && lightingDiscountedTotal > 0 ? (
          <>
            <div className="my-4 border-t border-white/10" />
            <p className="text-sm text-white/60 mb-1">Итого с освещением</p>
            <p className="text-4xl font-bold tracking-tight">~{fmt(grandTotal)} ₽</p>
            <p className="mt-2 text-xs text-white/50">
              Свет: {fmt(lightingDiscountedTotal)} ₽ со скидкой 15%
              {lightingDraft.totalRub != null ? <> (от {fmt(lightingDraft.totalRub)} ₽)</> : null}
            </p>
          </>
        ) : null}
      </div>

      {reconcileNote ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
          <p className="text-sm font-semibold text-blue-900">
            Параметры монтажа обновятся автоматически
          </p>
          <p className="mt-1 text-sm text-blue-800 leading-5">{reconcileNote}</p>
          <p className="mt-1.5 text-xs text-blue-700">
            Точное количество уточним на замере — эта цифра войдёт в предварительный расчёт.
          </p>
        </div>
      ) : null}

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
            {reconcileNote ? (
              <p className="mt-2 text-xs text-blue-600">
                ↑ Монтаж точечных светильников будет скорректирован при подтверждении
              </p>
            ) : null}
          </div>

          {hasLighting && lightingDraft.items && lightingDraft.items.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                Освещение (товары)
              </p>
              {(() => {
                const displayName = getKitDisplayName(lightingDraft);
                return displayName ? (
                  <p className="text-sm font-medium text-slate-700 mb-1">{displayName}</p>
                ) : null;
              })()}
              <ul className="space-y-1.5">
                {lightingDraft.items.map((item) => {
                  const lengthLabel = getProfileLengthLabel(item.sku);
                  const showLen = !!lengthLabel && !item.name.includes(lengthLabel);

                  return (
                    <li
                      key={item.sku}
                      className="flex items-start justify-between gap-2 text-sm text-slate-600"
                    >
                      <span className="min-w-0">
                        {item.name}
                        {showLen ? (
                          <span className="ml-1 text-xs text-slate-400">({lengthLabel})</span>
                        ) : null}{" "}
                        &times; {item.qty}
                      </span>
                      <span className="shrink-0 text-slate-400">
                        {fmt(item.qty * item.priceRub)} ₽
                      </span>
                    </li>
                  );
                })}
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

      <p className="text-xs text-slate-500 leading-5">
        Это ориентировочный расчёт. Точную стоимость определим на бесплатном замере.
        {hasLighting ? " Скидка 15% на оборудование сохраняется при заказе потолка." : null}
      </p>
    </div>
  );
}
