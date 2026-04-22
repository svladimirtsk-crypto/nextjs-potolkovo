"use client";

import {
  getCalculatorSummaryLines,
  usePriceCalculatorBridge,
} from "@/components/home/price-calculator-context";
import { useCalculatorModal } from "./calculator-modal-context";
import { isSnapshotValid } from "@/lib/calculator-snapshot-guard";
import { calcRequiredWorksFromLighting, applyLightingDiscount } from "@/lib/lighting-formulas";
import type { WizardStep } from "@/lib/calculator-modal-types";
import { getKitDisplayName } from "@/lib/calculator-modal-types";

function fmt(n: number) {
  return new Intl.NumberFormat("ru-RU").format(Math.round(n));
}

type WizardStep2SummaryProps = {
  onConfirm: () => void;
};

type ExtendedOptions = {
  entryMode?: "lighting-first" | string;
};

export function WizardStep2Summary({ onConfirm: _onConfirm }: WizardStep2SummaryProps) {
  const { snapshot } = usePriceCalculatorBridge();
  const {
    lightingDraft,
    ceilingTotal,
    lightingDiscountedTotal,
    goToStep,
    options,
    step0SessionInteracted,
    setLightingDraft,
    setStep1CatalogView,
  } = useCalculatorModal();

  const extendedOptions = options as (typeof options & ExtendedOptions) | null;
  const isLightingFirst = extendedOptions?.entryMode === "lighting-first";
  const hasCeilingInputs = Boolean(step0SessionInteracted) && isSnapshotValid(snapshot);

  const calcLines = hasCeilingInputs ? getCalculatorSummaryLines(snapshot) : [];

  const hasLighting =
    lightingDraft !== null &&
    lightingDraft.mode !== "none" &&
    (lightingDraft.items?.length ?? 0) > 0;

  const lightingDiscountedForStep2 =
    Number.isFinite(lightingDraft?.discountedTotalRub)
      ? Number(lightingDraft?.discountedTotalRub ?? 0)
      : Number.isFinite(lightingDraft?.totalRub)
      ? applyLightingDiscount(Number(lightingDraft?.totalRub ?? 0))
      : Number(lightingDiscountedTotal ?? 0);

  const ceilingForDisplay = hasCeilingInputs ? ceilingTotal : 0;
  const grandForDisplay = ceilingForDisplay + lightingDiscountedForStep2;

  const { requiredLightsCount } = calcRequiredWorksFromLighting(lightingDraft?.items);
  const currentLightsCount = snapshot?.lightsCount ?? 0;
  const willReconcileLights =
    hasCeilingInputs &&
    hasLighting &&
    requiredLightsCount !== null &&
    requiredLightsCount !== currentLightsCount;

  const reconcileNote = willReconcileLights
    ? `Монтаж точечных светильников скорректирован: ${currentLightsCount} → ${requiredLightsCount} шт. (${fmt(requiredLightsCount * (snapshot?.lightsRatePerUnit ?? 750))} ₽)`
    : null;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-slate-950 p-6 text-white">
        <p className="mb-1 text-sm text-white/60">Потолок (работы)</p>
        {hasCeilingInputs ? (
          <p className="text-3xl font-bold tracking-tight">{fmt(ceilingForDisplay)} ₽</p>
        ) : (
          <p className="text-sm text-white/90">
            Потолок: укажите площадь/тип - посчитаем
          </p>
        )}

        {hasLighting && lightingDiscountedForStep2 > 0 ? (
          <>
            <div className="my-4 border-t border-white/10" />
            <p className="mb-1 text-sm text-white/60">Итого с освещением</p>
            <p className="text-4xl font-bold tracking-tight">~{fmt(grandForDisplay)} ₽</p>
            <p className="mt-2 text-xs text-white/50">
              Свет: {fmt(lightingDiscountedForStep2)} ₽ со скидкой 15%
              {lightingDraft?.totalRub != null ? <> (от {fmt(lightingDraft.totalRub)} ₽)</> : null}
            </p>
          </>
        ) : null}

        {!hasCeilingInputs && isLightingFirst ? (
          <p className="mt-3 text-xs text-white/60">
            Сначала выберите параметры потолка на шаге 1, чтобы добавить стоимость монтажа.
          </p>
        ) : null}
      </div>

      {hasLighting && lightingDraft?.items?.length ? (
        <details className="group rounded-2xl border border-slate-200 bg-white">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-slate-950">
            <span>Вы выбрали ({lightingDraft.items.length} поз.)</span>
            <span className="text-slate-400 transition-transform group-open:rotate-180">▾</span>
          </summary>
          <div className="space-y-2 border-t border-slate-200 p-3">
            {lightingDraft.items.map((item) => (
              <div key={item.sku} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">{item.name}</p>
                    <p className="text-xs text-slate-500">
                      {item.qty} × {fmt(item.priceRub)} ₽ = {fmt(item.qty * item.priceRub)} ₽
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!lightingDraft?.items) return;
                      const nextItems = lightingDraft.items.filter((x) => x.sku !== item.sku);
                      if (nextItems.length === 0) {
                        setLightingDraft({ mode: "none", userCustomizedLighting: false });
                        return;
                      }
                      const nextTotal = nextItems.reduce((sum, x) => sum + x.qty * x.priceRub, 0);
                      const nextDiscounted = applyLightingDiscount(nextTotal);
                      setLightingDraft({
                        ...lightingDraft,
                        mode: "catalog",
                        items: nextItems,
                        totalRub: nextTotal,
                        discountedTotalRub: nextDiscounted,
                        userCustomizedLighting: true,
                      });
                    }}
                    className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:border-slate-500"
                  >
                    Удалить
                  </button>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => {
                setStep1CatalogView("selected");
                goToStep(1 as WizardStep);
              }}
              className="w-full rounded-xl border border-slate-950 bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Редактировать
            </button>
          </div>
        </details>
      ) : null}

      {reconcileNote ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
          <p className="text-sm font-semibold text-blue-900">
            Параметры монтажа обновятся автоматически
          </p>
          <p className="mt-1 text-sm leading-5 text-blue-800">{reconcileNote}</p>
          <p className="mt-1.5 text-xs text-blue-700">
            Точное количество уточним на замере - эта цифра войдет в предварительный расчет.
          </p>
        </div>
      ) : null}

      {!hasCeilingInputs ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
          <p className="text-sm font-semibold text-slate-950">
            По потолку пока нет параметров
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Укажите площадь и тип потолка на первом шаге - добавим работы к итогу.
          </p>
          <button
            type="button"
            onClick={() => goToStep(0 as WizardStep)}
            className="mt-3 rounded-2xl bg-slate-950 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
          >
            Указать параметры потолка
          </button>
        </div>
      ) : null}

      <details className="group rounded-2xl border border-slate-200 bg-slate-50">
        <summary className="flex cursor-pointer list-none select-none items-center justify-between px-4 py-3 text-sm font-semibold text-slate-950">
          <span>Состав расчета</span>
          <span
            className="text-slate-400 transition-transform group-open:rotate-180"
            aria-hidden="true"
          >
            ▾
          </span>
        </summary>

        <div className="space-y-4 border-t border-slate-200 px-4 py-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Потолок
            </p>
            {hasCeilingInputs ? (
              <ul className="space-y-1.5">
                {calcLines.map((line) => (
                  <li key={line} className="text-sm text-slate-600">
                    {line}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-600">
                Потолок: укажите площадь/тип - посчитаем
              </p>
            )}
            {reconcileNote ? (
              <p className="mt-2 text-xs text-blue-600">
                Монтаж точечных светильников будет скорректирован при подтверждении
              </p>
            ) : null}
          </div>

          {hasLighting ? (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Освещение
              </p>
              {(() => {
                const displayName = getKitDisplayName(lightingDraft);
                return displayName ? (
                  <p className="mb-1 text-sm font-medium text-slate-700">{displayName}</p>
                ) : null;
              })()}
              {lightingDraft?.totalRub != null ? (
                <p className="text-sm font-semibold text-slate-950">
                  Свет итого: {fmt(lightingDraft.totalRub)} ₽
                  {lightingDiscountedForStep2 > 0 ? (
                    <span className="ml-2 text-emerald-600">
                      → {fmt(lightingDiscountedForStep2)} ₽ (-15%)
                    </span>
                  ) : null}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </details>

      <p className="text-xs leading-5 text-slate-500">
        Это ориентировочный расчет. Точную стоимость определим на бесплатном замере.
        {hasLighting ? " Скидка 15% на оборудование сохраняется при заказе потолка." : null}
      </p>
    </div>
  );
}
