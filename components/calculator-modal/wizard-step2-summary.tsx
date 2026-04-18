// components/calculator-modal/wizard-step2-summary.tsx
"use client";

import {
  getCalculatorSummaryLines,
  getLightingSummaryLines,
  usePriceCalculatorBridge,
} from "@/components/home/price-calculator-context";
import { useCalculatorModal } from "./calculator-modal-context";
import { isSnapshotValid } from "@/lib/calculator-snapshot-guard";
import { calcRequiredWorksFromLighting } from "@/lib/lighting-formulas";
import type { WizardStep } from "@/lib/calculator-modal-types";
import { getKitDisplayName } from "@/lib/calculator-modal-types";
import {
  COLIBRI_PROFILES,
  CLARUS_PROFILES,
  calcProfilesForTrackMeters,
  calcProfilesTotalRub,
  formatProfilePieces,
  type ProfilePiece,
} from "@/lib/lighting-kits";

function fmt(n: number) {
  return new Intl.NumberFormat("ru-RU").format(n);
}

// ─── Утилита: подобрать профили под длину трека из snapshot ──────────────────

type TrackProfileHint = {
  pieces: ProfilePiece[];
  totalRub: number;
  description: string;
  isColibri: boolean;
};

function getTrackProfileHint(
  trackLengthMeters: number | null,
  kitId: string | undefined
): TrackProfileHint | null {
  if (!trackLengthMeters || trackLengthMeters <= 0) return null;

  // Определяем систему по kitId
  const isClarus = kitId?.includes("clarus");
  const profiles = isClarus ? CLARUS_PROFILES : COLIBRI_PROFILES;
  const pieces = calcProfilesForTrackMeters(trackLengthMeters, profiles);
  if (pieces.length === 0) return null;

  const totalRub = calcProfilesTotalRub(pieces);
  const description = formatProfilePieces(pieces);

  return { pieces, totalRub, description, isColibri: !isClarus };
}

// ─── Props ────────────────────────────────────────────────────────────────────

type WizardStep2SummaryProps = {
  onConfirm: () => void;
};

// ─── Component ───────────────────────────────────────────────────────────────

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

  // ─── Reconcile preview ─────────────────────────────────────────────────────
  const { requiredLightsCount } = calcRequiredWorksFromLighting(
    lightingDraft?.items
  );
  const currentLightsCount = snapshot?.lightsCount ?? 0;
  const willReconcileLights =
    hasLighting &&
    requiredLightsCount !== null &&
    requiredLightsCount !== currentLightsCount;

  const reconcileNote = willReconcileLights
    ? `Монтаж светильников автоматически скорректирован: ${currentLightsCount} → ${requiredLightsCount} шт. (${fmt(requiredLightsCount * (snapshot?.lightsRatePerUnit ?? 750))} ₽)`
    : null;

  // ─── Profile hint для трекового освещения ──────────────────────────────────
  // trackLength из snapshot — в метрах (из Step 0 калькулятора)
  const trackLengthMeters = snapshot?.trackLength ?? null;
  const trackProfileHint = getTrackProfileHint(
    trackLengthMeters,
    lightingDraft?.kitId
  );

  // ─────────────────────────────────────────────────────────────────────────

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

      {/* Reconcile banner */}
      {reconcileNote ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
          <p className="text-sm font-semibold text-blue-900">
            Параметры монтажа обновятся автоматически
          </p>
          <p className="mt-1 text-sm text-blue-800 leading-5">
            {reconcileNote}
          </p>
          <p className="mt-1.5 text-xs text-blue-700">
            Точное количество уточним на замере — эта цифра войдёт в предварительный расчёт.
          </p>
        </div>
      ) : null}

      {/* Profile length hint */}
      {trackProfileHint && hasLighting ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-900">
            Набор профилей для вашего трека
          </p>
          <p className="mt-1 text-sm text-amber-800 leading-5">
            Длина трека {fmt(Math.round((trackLengthMeters ?? 0) * 1000))} мм →{" "}
            <span className="font-medium">{trackProfileHint.description}</span>
          </p>
          <ul className="mt-2 space-y-1">
            {trackProfileHint.pieces.map((piece) => (
              <li key={piece.sku} className="text-xs text-amber-700 flex justify-between">
                <span>
                  {piece.qty} × профиль {piece.lengthMm} мм
                </span>
                <span className="font-medium">
                  {fmt(piece.qty * piece.priceRub)} ₽
                </span>
              </li>
            ))}
            <li className="text-xs font-semibold text-amber-900 flex justify-between border-t border-amber-200 pt-1 mt-1">
              <span>Профили итого (до скидки)</span>
              <span>{fmt(trackProfileHint.totalRub)} ₽</span>
            </li>
          </ul>
          <p className="mt-2 text-xs text-amber-600">
            Точный набор уточняется на замере — зависит от реальной трассировки трека.
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
          {/* Потолок */}
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
                ↑ Монтаж светильников будет скорректирован при подтверждении
              </p>
            ) : null}
          </div>

          {/* Освещение */}
          {hasLighting && lightingDraft.items && lightingDraft.items.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                Освещение (товары)
              </p>
              {(() => {
                const displayName = getKitDisplayName(lightingDraft);
                return displayName ? (
                  <p className="text-sm font-medium text-slate-700 mb-1">
                    {displayName}
                  </p>
                ) : null;
              })()}
              <ul className="space-y-1.5">
                {lightingDraft.items.map((item) => {
                  // Определяем длину профиля для отображения
                  const isProfile =
                    item.sku.includes("profile") && item.sku !== "colibri-profile-220v" && item.sku !== "clarus-profile-48v";
                  const allProfiles = [...COLIBRI_PROFILES, ...CLARUS_PROFILES];
                  const profileEntry = isProfile
                    ? allProfiles.find((p) => p.sku === item.sku)
                    : null;

                  return (
                    <li
                      key={item.sku}
                      className="flex items-start justify-between gap-2 text-sm text-slate-600"
                    >
                      <span className="min-w-0">
                        {item.name}
                        {profileEntry ? (
                          <span className="ml-1 text-xs text-slate-400 font-medium">
                            ({profileEntry.lengthMm} мм)
                          </span>
                        ) : null}
                        {" "}&times; {item.qty}
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

          {/* Profile hint внутри деталей */}
          {trackProfileHint && hasLighting ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                Подбор профилей по длине трека
              </p>
              <p className="text-xs text-slate-500">
                {trackProfileHint.description}
              </p>
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
