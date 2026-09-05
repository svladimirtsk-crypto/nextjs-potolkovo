"use client";

import { useEffect, useMemo, useState } from "react";
import { getAvailabilityLabel } from "@/content/availability";

import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";

import { toNumber, toText } from "@/lib/feed2-snapshot-normalize";
import { useCatalogProducts } from "@/lib/lighting/use-catalog-products";
import { calcTrackProfileMeters } from "@/lib/product-length-meters";

import { contacts } from "@/content/contacts";
import { fillCallbackWindow, resolveStep2Copy, type Step2Intent } from "@/lib/calculator-flow";
import { trackMessengerClick } from "@/lib/analytics";

import { ActionForm } from "@/components/home/action-form";
import { useCalculatorStore } from "@/lib/calculator/store";
import { getCalculatorSummaryLines } from "@/lib/calculator/summary-lines";
import { mergeInstallExtraIntoSnapshot } from "@/lib/calculator/snapshot-merge";
import { clearCalcDraft } from "@/lib/calculator/draft";
import { buildTelegramDeepLink } from "@/lib/lead/telegram-link";
import { useCalculatorModal } from "@/components/calculator-modal/calculator-modal-context";

import { getLightingKitLabel } from "@/lib/calculator-modal-types";
import { lightingDiscountPercent, pricing } from "@/content/pricing";

type CatalogLightingItem = {
  sku: string;
  name: string;
  qty: number;
  priceRub: number;
};

function fmt(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(Math.round(value));
}

function isPanelProduct(product: FeedCatalogProduct): boolean {
  const text = `${toText(product.name)} ${toText(product.categoryPath)}`.toLowerCase();
  return (
    text.includes("панел") ||
    text.includes("panel") ||
    text.includes("600x600") ||
    text.includes("595x595")
  );
}

function sumTrackMetersFromLightingItems(
  items: Array<{ sku: string; qty: number }>,
  byId: Map<string, FeedCatalogProduct>,
  byVendor: Map<string, string>
): number {
  let meters = 0;

  for (const item of items) {
    const sku = toText(item.sku);
    const qty = toNumber(item.qty);

    const byProduct = byId.get(sku);
    const byVendorId = byVendor.get(sku);
    const resolvedId = byProduct ? sku : toText(byVendorId ?? "");
    if (!resolvedId) continue;

    const product = byId.get(resolvedId);
    if (!product) continue;

    if (product.kind !== "TRACK_PROFILE") continue;
    meters += calcTrackProfileMeters(product, qty);
  }

  return meters;
}

function sumPointQtyFromLightingItems(
  items: Array<{ sku: string; qty: number }>,
  byId: Map<string, FeedCatalogProduct>,
  byVendor: Map<string, string>
): number {
  let qtyTotal = 0;

  for (const item of items) {
    const sku = toText(item.sku);
    const qty = toNumber(item.qty);

    const byProduct = byId.get(sku);
    const byVendorId = byVendor.get(sku);
    const resolvedId = byProduct ? sku : toText(byVendorId ?? "");
    if (!resolvedId) continue;

    const product = byId.get(resolvedId);
    if (!product) continue;

    if (product.kind === "SPOT_FIXTURE" || isPanelProduct(product)) qtyTotal += qty;
  }

  return qtyTotal;
}

export function WizardStep2Summary() {
  const {
    goToStep,
    setStep1CatalogView,
    closeCalculator,
    step0AreaConfirmed,
    step0SessionInteracted,
    options,
    lightingDraft,
    showCeilingInUi,
    lightingEffectiveTotal,
    lightingDiscountedTotal,
    lightingDiscountMode,
    lightingDiscountEligible,
    lightingRegularTotal,
    lightingWithCeilingTotal,
    ceilingTotal,
    grandTotal,
    showResult,
    setShowResult,
    markLeadSubmitted,
  } = useCalculatorModal();

  const resolvedShowCeilingInUi =
    options?.entryMode !== "lighting-first" || step0SessionInteracted || showCeilingInUi;
  const resolvedLightingEffectiveTotal = toNumber(lightingEffectiveTotal || lightingDiscountedTotal);
  const resolvedLightingRegularTotal = toNumber(lightingRegularTotal || resolvedLightingEffectiveTotal);
  const resolvedLightingWithCeilingTotal = toNumber(
    lightingWithCeilingTotal || lightingDiscountedTotal
  );
  const resolvedCeilingTotal = toNumber(ceilingTotal);
  const resolvedGrandTotal =
    toNumber(grandTotal) ||
    (resolvedShowCeilingInUi ? resolvedCeilingTotal : 0) + resolvedLightingEffectiveTotal;

  const lightingAppliedPercent = lightingDiscountPercent(lightingDiscountMode ?? "none");
  const orderIntent: Step2Intent =
    lightingDiscountMode === "with-ceiling"
      ? "lighting_with_ceiling"
      : lightingDiscountMode === "lighting-only"
        ? "lighting_only"
        : "ceiling_only";
  // T-028: весь копирайт Шага 2 — из одной таблицы (раздел 6.3 ТЗ).
  const step2Copy = resolveStep2Copy(orderIntent);

  // T-028: номер заявки и окно перезвона приходят из ответа /api/lead.
  const [leadPublicCode, setLeadPublicCode] = useState<string | null>(null);
  const [callbackWindow, setCallbackWindow] = useState("в ближайшее время");
  const availabilityLabel = useMemo(() => getAvailabilityLabel(), []);
  const lightingAppliedBenefit = Math.max(
    0,
    resolvedLightingRegularTotal - resolvedLightingEffectiveTotal
  );
  const lightingPotentialBenefit = Math.max(
    0,
    resolvedLightingRegularTotal - resolvedLightingWithCeilingTotal
  );
  // T-023: showResult и факт отправки живут в контексте модалки

  const { snapshot, setSnapshot } = useCalculatorStore();
  const lighting = snapshot?.lighting ?? lightingDraft ?? null;
  const roomBreakdown = snapshot?.roomBreakdown ?? [];
  const hasRoomBreakdown = roomBreakdown.length > 0;

  const ceilingSummaryLines = useMemo(() => getCalculatorSummaryLines(snapshot), [snapshot]);

  const kitDisplayName = useMemo(() => getLightingKitLabel(lighting), [lighting]);

  const lightingItems: CatalogLightingItem[] = useMemo(() => {
    const items = lighting?.mode === "catalog" ? (lighting.items ?? []) : [];
    return items.map((item) => ({
      sku: toText(item.sku),
      name: toText(item.name),
      qty: toNumber(item.qty),
      priceRub: toNumber(item.priceRub),
    }));
  }, [lighting]);

  // T-029: каталог приезжает отдельным чанком, а не из фида в бандле.
  const { products: catalogProductsFromIndex } = useCatalogProducts();
  const catalogProducts = catalogProductsFromIndex;

  const byId = useMemo(() => {
    const map = new Map<string, FeedCatalogProduct>();
    for (const p of catalogProducts) map.set(toText(p.productId), p);
    return map;
  }, [catalogProducts]);

  const byVendor = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of catalogProducts) {
      const v = toText(p.vendorCode);
      const id = toText(p.productId);
      if (v && id) map.set(v, id);
    }
    return map;
  }, [catalogProducts]);

  const selectedTrackMeters = useMemo(() => {
    return sumTrackMetersFromLightingItems(
      lightingItems.map((i) => ({ sku: i.sku, qty: i.qty })),
      byId,
      byVendor
    );
  }, [byId, byVendor, lightingItems]);

  const selectedPointQty = useMemo(() => {
    return sumPointQtyFromLightingItems(
      lightingItems.map((i) => ({ sku: i.sku, qty: i.qty })),
      byId,
      byVendor
    );
  }, [byId, byVendor, lightingItems]);

  const trackMountType = (snapshot?.derivedInputs?.trackMountType ?? "none") as
    | "built-in"
    | "surface"
    | "none";

  const effectiveTrackMountType = useMemo(() => {
    if (trackMountType && trackMountType !== "none") return trackMountType;

    // Detect from cart items
    const hasBuiltInProfile = lightingItems.some((item) => {
      const pId = byVendor.get(item.sku) ?? item.sku;
      const p = byId.get(pId);
      return p?.system === "COLIBRI_220" || p?.system === "CLARUS_48";
    });
    if (hasBuiltInProfile) return "built-in";

    const hasSurfaceProfile = lightingItems.some((item) => {
      const pId = byVendor.get(item.sku) ?? item.sku;
      const p = byId.get(pId);
      return p?.system === "TRACK_220";
    });
    if (hasSurfaceProfile) return "surface";

    return "none";
  }, [trackMountType, lightingItems, byId, byVendor]);

  const canReconcileInstall = step0AreaConfirmed;

  const resolvedTrackRate =
    effectiveTrackMountType === "surface" ? pricing.track.surfacePerM : pricing.track.builtInPerM;

  const spotInstallRate = pricing.spotInstall;

  // T-009: сравниваем натуральные величины (метры/точки), а не суммы — без удвоения
  const includedTrackMeters = toNumber(snapshot?.derivedInputs?.trackLengthMeters);
  const includedSpotQty = toNumber(snapshot?.derivedInputs?.pointSpotsQty);

  const desiredTrackInstallMeters = selectedTrackMeters > 0 ? selectedTrackMeters : 0;
  const desiredSpotInstallQty = selectedPointQty > 0 ? selectedPointQty : 0;

  const extraTrackMeters = Math.max(0, desiredTrackInstallMeters - includedTrackMeters);
  const extraSpotQty = Math.max(0, desiredSpotInstallQty - includedSpotQty);

  const extraTrackInstall = extraTrackMeters * resolvedTrackRate;
  const extraSpotInstall = extraSpotQty * spotInstallRate;

  const extraInstallTotal = extraTrackInstall + extraSpotInstall;

  const extraInstallLines = useMemo(() => {
    const out: string[] = [];
    if (extraSpotQty > 0) out.push(`Монтаж ещё ${extraSpotQty} точек · ${fmt(extraSpotInstall)} ₽`);
    if (extraTrackMeters > 0) out.push(`Монтаж ещё ${extraTrackMeters} м трека · ${fmt(extraTrackInstall)} ₽`);
    return out;
  }, [extraSpotQty, extraSpotInstall, extraTrackMeters, extraTrackInstall]);

  // T-008/T-009 · N-050: условие «ничего не изменилось» живёт в чистой
  // mergeInstallExtraIntoSnapshot, здесь остаётся только мост к стору.
  useEffect(() => {
    if (!canReconcileInstall) return;

    setSnapshot((prev) =>
      mergeInstallExtraIntoSnapshot(prev, {
        extraInstallTotal,
        extraInstallLines,
      })
    );
  }, [canReconcileInstall, extraInstallTotal, extraInstallLines, setSnapshot]);

  const handleEditLighting = () => {
    setStep1CatalogView("selected");
    goToStep(1);
  };

  const handleGoToCeiling = () => goToStep(0);

  return (
    <div key="step2" className="animate-fade-slide-in space-y-4">
      {/* Grand total — hero number */}
      <div className="rounded-2xl bg-slate-950 p-6 text-center text-white shadow-xl">
        <p className="text-sm text-white/70">Ориентировочный итог</p>
        <p className="mt-2 text-4xl font-bold tracking-tight">~{fmt(resolvedGrandTotal)} ₽</p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-xs text-white/60">
          {resolvedShowCeilingInUi ? <span>Потолок и работы {fmt(resolvedCeilingTotal)} ₽</span> : null}
          {resolvedShowCeilingInUi && (includedSpotQty > 0 || includedTrackMeters > 0) ? (
            <span>
              Монтаж света: {includedSpotQty} точек, {includedTrackMeters} м трека — уже в потолке
            </span>
          ) : null}
          {extraInstallLines.map((line) => (
            <span key={line}>+ {line}</span>
          ))}
          {resolvedShowCeilingInUi && resolvedLightingEffectiveTotal > 0 ? <span>+</span> : null}
          {resolvedLightingEffectiveTotal > 0 ? (
            <span>
              Свет{" "}
              {lightingDiscountEligible && lightingAppliedBenefit > 0 ? (
                <>
                  <span className="line-through text-white/35">{fmt(resolvedLightingRegularTotal)} ₽</span>{" "}
                  <span>{fmt(resolvedLightingEffectiveTotal)} ₽</span>{" "}
                  <span className="text-emerald-400">−{lightingAppliedPercent}% (−{fmt(lightingAppliedBenefit)} ₽)</span>
                </>
              ) : (
                <>{fmt(resolvedLightingEffectiveTotal)} ₽</>
              )}
            </span>
          ) : null}
        </div>
        {lightingDiscountMode !== "with-ceiling" && resolvedLightingEffectiveTotal > 0 && resolvedLightingWithCeilingTotal > 0 ? (
          <p className="mt-2 text-xs text-white/50">
            С потолком: <span className="line-through text-white/35">{fmt(resolvedLightingRegularTotal)} ₽</span>{" "}
            {fmt(resolvedLightingWithCeilingTotal)} ₽ −25% (−{fmt(lightingPotentialBenefit)} ₽)
          </p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm sm:hidden">
        <div className="flex items-center justify-between gap-3">
          <span className="text-slate-500">Потолок</span>
          <span className="font-semibold text-slate-950">{resolvedShowCeilingInUi ? `${fmt(resolvedCeilingTotal)} ₽` : "—"}</span>
        </div>
        {resolvedLightingEffectiveTotal > 0 ? (
          <>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-slate-500">Свет</span>
              <span className="font-semibold text-slate-950">{fmt(resolvedLightingEffectiveTotal)} ₽</span>
            </div>
            {lightingAppliedBenefit > 0 ? (
              <div className="mt-2 flex items-center justify-between gap-3 text-emerald-700">
                <span>Скидка на свет</span>
                <span className="font-semibold">−{fmt(lightingAppliedBenefit)} ₽</span>
              </div>
            ) : null}
          </>
        ) : null}
        <div className="mt-3 border-t border-slate-200 pt-3 flex items-center justify-between gap-3">
          <span className="font-semibold text-slate-950">Итого</span>
          <span className="text-lg font-bold text-slate-950">~{fmt(resolvedGrandTotal)} ₽</span>
        </div>
      </div>

      {hasRoomBreakdown ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-950">Помещения в расчёте</p>
              <p className="mt-1 text-sm text-slate-600">
                Сейчас итог собран из {roomBreakdown.length} {roomBreakdown.length === 1 ? "помещения" : roomBreakdown.length < 5 ? "помещений" : "помещений"}.
              </p>
            </div>
            <button
              type="button"
              onClick={handleGoToCeiling}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Изменить комнаты
            </button>
          </div>
          {/* T-022: дублирующий «Общий ориентир» убран — итог показан выше один раз */}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {roomBreakdown.map((room, index) => (
              <div key={`${room.id}-${index}`} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-950">{index + 1}. {room.label}</p>
                  <span className="text-sm font-semibold text-slate-950">{fmt(room.totalRub)} ₽</span>
                </div>
                <p className="mt-2 text-xs text-slate-500">{room.area} м² · {room.ceilingTypeLabel}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-600">
                  {room.shadowLength ? <span className="rounded-full bg-white px-2 py-1 ring-1 ring-slate-200">Теневой {room.shadowLength} м.п.</span> : null}
                  {room.floatingLength ? <span className="rounded-full bg-white px-2 py-1 ring-1 ring-slate-200">Парящий {room.floatingLength} м.п.</span> : null}
                  {room.lightLinesLength ? <span className="rounded-full bg-white px-2 py-1 ring-1 ring-slate-200">Линии {room.lightLinesLength} м.п.</span> : null}
                  {room.corniceLength && room.corniceLabel ? <span className="rounded-full bg-white px-2 py-1 ring-1 ring-slate-200">{room.corniceLabel} {room.corniceLength} м.п.</span> : null}
                  {room.corniceLightingLength ? <span className="rounded-full bg-white px-2 py-1 ring-1 ring-slate-200">Подсветка {room.corniceLightingLength} м.п.</span> : null}
                  {room.trackLength && room.trackLabel ? <span className="rounded-full bg-white px-2 py-1 ring-1 ring-slate-200">{room.trackLabel} {room.trackLength} м.п.</span> : null}
                  {room.lightsCount ? <span className="rounded-full bg-white px-2 py-1 ring-1 ring-slate-200">Точки {room.lightsCount} шт.</span> : null}
                  {room.chandeliersCount ? <span className="rounded-full bg-white px-2 py-1 ring-1 ring-slate-200">Люстры {room.chandeliersCount} шт.</span> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Edit buttons row */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleGoToCeiling}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Изменить потолок
        </button>
        <button
          type="button"
          onClick={handleEditLighting}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Изменить свет
        </button>
      </div>

      {/* Detailed breakdown — only if user wants it */}
      <details className="rounded-2xl border border-slate-200 bg-white">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-950">
          Состав расчёта
        </summary>
        <div className="border-t border-slate-200 px-4 py-3 text-sm text-slate-700 space-y-2">
          {resolvedShowCeilingInUi ? (
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="mb-2 font-semibold text-slate-950">Расчёт потолка</p>
              <ul className="space-y-1 text-slate-700">
                {ceilingSummaryLines.map((line, idx) => (
                  <li key={`ceiling-${idx}`} className="leading-5">{line}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="flex justify-between">
              <span>Потолок</span>
              <span className="text-slate-500">— (не рассчитан)</span>
            </div>
          )}

          {lightingItems.length > 0 && resolvedLightingEffectiveTotal > 0 ? (
            <div className="pt-2">
              <p className="font-semibold text-slate-950">
                Освещение{kitDisplayName ? ` — ${kitDisplayName}` : ""}
              </p>
              <ul className="mt-1 space-y-0.5 text-slate-600">
                {lightingItems.map((item) => (
                  <li key={`${item.sku}-${item.name}`} className="flex justify-between">
                    <span>{toText(item.name)} × {toNumber(item.qty)}</span>
                    <span>{fmt(toNumber(item.priceRub) * toNumber(item.qty))} ₽</span>
                  </li>
                ))}
              </ul>
              {lightingAppliedPercent > 0 ? (
                <p className="mt-1 text-xs text-emerald-700 font-medium">
                  Скидка на свет учтена: {fmt(resolvedLightingRegularTotal)} ₽ −{lightingAppliedPercent}% (−{fmt(lightingAppliedBenefit)} ₽)
                </p>
              ) : null}
              {lightingDiscountMode !== "with-ceiling" && resolvedLightingWithCeilingTotal > 0 ? (
                <p className="mt-1 text-xs text-slate-500">
                  С потолком: {fmt(resolvedLightingRegularTotal)} ₽ −25% (−{fmt(lightingPotentialBenefit)} ₽) = {fmt(resolvedLightingWithCeilingTotal)} ₽
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="border-t border-slate-200 pt-2">
            <div className="flex justify-between font-semibold text-slate-950">
              <span>Итого</span>
              <span>~{fmt(resolvedGrandTotal)} ₽</span>
            </div>
          </div>
        </div>
      </details>

      {/* Discount hint */}
      {lightingDiscountMode !== "with-ceiling" && resolvedLightingEffectiveTotal > 0 ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
          <p className="font-semibold">Свет дешевле с натяжным потолком</p>
          <p className="mt-1 text-blue-900/80">
            При заказе потолка скидка на свет будет −25%: {fmt(resolvedLightingWithCeilingTotal)} ₽ вместо {fmt(resolvedLightingRegularTotal)} ₽.
          </p>
          <button
            type="button"
            onClick={handleGoToCeiling}
            className="mt-2 rounded-xl bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800"
          >
            Рассчитать потолок →
          </button>
        </div>
      ) : null}

      {/* What's included */}
      <div className="flex flex-wrap gap-2">
        {step2Copy.chips.map((item) => (
          <span
            key={item}
            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700"
          >
            ✓ {item}
          </span>
        ))}
      </div>

      {/* What happens next */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-950">Что происходит дальше</p>
        {/* T-047: ближайшие окна замера — из ручного календаря content/availability.ts */}
        {availabilityLabel ? (
          <p className="mt-1 text-xs text-slate-600">{availabilityLabel}</p>
        ) : null}
        <div className="mt-3 space-y-2">
          {fillCallbackWindow(step2Copy.nextSteps, callbackWindow).map((step, idx) => (
            <div key={step} className="flex items-start gap-2.5 text-sm text-slate-600">
              <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-slate-950 text-xs font-semibold text-white flex items-center justify-center">
                {idx + 1}
              </span>
              <span>{step}</span>
            </div>
          ))}
        </div>
      </div>

      {showResult ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center" aria-live="polite">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white text-2xl font-bold">
            ✓
          </div>
          <p className="text-lg font-semibold text-emerald-950">
            {leadPublicCode ? `Заявка №${leadPublicCode} принята` : "Спасибо!"}
          </p>
          <p className="mt-1 text-sm text-emerald-800">Перезвоню {callbackWindow}.</p>
          <p className="mt-2 text-sm text-emerald-900">
            <a href={contacts.phoneHref} className="font-semibold underline underline-offset-2">
              {contacts.phoneDisplay}
            </a>{" "}
            ·{" "}
            <a
              href={contacts.telegramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline underline-offset-2"
            >
              Написать в Telegram
            </a>
          </p>
          <button
            type="button"
            onClick={closeCalculator}
            className="mt-4 rounded-xl bg-emerald-700 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            Хорошо, жду
          </button>
        </div>
      ) : (
        <>
          {/* Form */}
          <div id="modal-action-form" className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-base font-semibold text-slate-950">{step2Copy.formTitle}</p>
            <p className="mt-2 text-sm text-slate-600">{step2Copy.formSubtitle}</p>
            <div className="mt-4">
              <ActionForm
                source={String(options?.source ?? "modal")}
                placement="modal"
                intent={orderIntent}
                compactCalculationSummary
                onSuccess={(result) => {
                  setLeadPublicCode(result.leadId);
                  if (result.callbackWindow) setCallbackWindow(result.callbackWindow);
                  markLeadSubmitted();
                  setShowResult(true);
                  clearCalcDraft();
                }}
              />
            </div>
          </div>

          {/* T-026: мессенджеры ПОСЛЕ формы, с готовым текстом расчёта (Приложение Г).
              TODO(владелец): WhatsApp вернём, когда подтвердится рабочий аккаунт. */}
          <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
            <span className="text-slate-500">Не хотите звонка? Напишите в Telegram</span>
            <a
              href={buildTelegramDeepLink({
                rooms: roomBreakdown,
                totalArea: toNumber(snapshot?.area),
                lightingTotalRub: resolvedLightingEffectiveTotal,
                grandTotalRub: resolvedGrandTotal,
              })}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                try {
                  trackMessengerClick({
                    messenger: "telegram",
                    placement: "modal_summary",
                    source: String(options?.source ?? ""),
                    orderIntent,
                    grandTotal: resolvedGrandTotal,
                  });
                } catch (e) {
                  console.error(e);
                }
              }}
              className="flex min-h-11 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 font-medium text-blue-600 transition-colors hover:bg-blue-100"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
              Telegram с расчётом
            </a>
          </div>
        </>
      )}
    </div>
  );
}
