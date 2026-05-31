"use client";

import { useEffect, useMemo } from "react";

import snapshotData from "@/data/eks-feed2-snapshot.json";
import type { FeedCatalogParam, FeedCatalogProduct } from "@/lib/eks-feed2-catalog";

import { homepage } from "@/content/homepage";

import { applyLightingDiscount } from "@/lib/lighting-formulas";
import { useCalculatorModal } from "@/components/calculator-modal/calculator-modal-context";
import { usePriceCalculatorBridge } from "@/components/home/price-calculator-context";

import { isSnapshotValid } from "@/lib/price-calculator-logic"; // если нет этого файла/экспорта, см. примечание ниже
import { applyVendorOverrides } from "@/lib/vendor-code-overrides";

function toText(value: unknown): string {
  return String(value ?? "").trim();
}

function toNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function fmt(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(Math.round(value));
}

function toNumberOrNull(value: unknown): number | null {
  const n = Number(value ?? NaN);
  return Number.isFinite(n) ? n : null;
}

function toParams(input: unknown): FeedCatalogParam[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      const x = item as { label?: unknown; value?: unknown };
      return { label: toText(x?.label), value: toText(x?.value) };
    })
    .filter((item) => item.label.length > 0 && item.value.length > 0);
}

function normalizeProduct(raw: unknown): FeedCatalogProduct | null {
  const p = raw as Record<string, unknown>;

  const vendorCode = toText(p.vendorCode);
  const offerId = toText(p.offerId);
  const name = toText(p.name);

  if (!name || (!vendorCode && !offerId)) return null;

  const productIdRaw = toText(p.productId);
  const productId = productIdRaw || `feed2-${vendorCode || offerId || name}`;

  const images = Array.isArray(p.images)
    ? p.images.map((item) => toText(item)).filter(Boolean)
    : [];

  return {
    productId: toText(productId),
    vendorCode,
    offerId,
    name,
    url: toText(p.url),
    categoryId: toText(p.categoryId),
    categoryPath: toText(p.categoryPath),
    images,
    coverImage: toText(p.coverImage) || images[0] || "",
    priceRub: toNumber(p.priceRub),
    available: Boolean(p.available ?? true),
    params: toParams(p.params),
    keyAttributes: toParams(p.keyAttributes),
    system: (toText(p.system) || "UNKNOWN") as FeedCatalogProduct["system"],
    kind: (toText(p.kind) || "OTHER") as FeedCatalogProduct["kind"],
    unit: (toText(p.unit) === "m" ? "m" : "pcs") as FeedCatalogProduct["unit"],
    lengthMeters: toNumberOrNull(p.lengthMeters),
    pieceLengthMeters: toNumberOrNull(p.pieceLengthMeters),
  };
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

    if (product.unit === "m") meters += qty;
    else if (typeof product.pieceLengthMeters === "number") meters += qty * product.pieceLengthMeters;
    else if (typeof product.lengthMeters === "number") meters += qty * product.lengthMeters;
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

    // точечные = SPOT_FIXTURE + панели
    if (product.kind === "SPOT_FIXTURE" || isPanelProduct(product)) {
      qtyTotal += qty;
    }
  }

  return qtyTotal;
}

export function WizardStep2Summary() {
  const {
    goToStep,
    setStep1CatalogView,
    closeCalculator,
    step0SessionInteracted,
  } = useCalculatorModal();

  const { snapshot, setSnapshot } = usePriceCalculatorBridge();

  const lighting = snapshot?.lighting;
  const lightingItems = lighting?.mode === "catalog" ? (lighting.items ?? []) : [];

  const catalogProducts = useMemo(() => {
    const rawProducts = (snapshotData as { products?: unknown[] })?.products ?? [];
    return rawProducts
      .map((x) => normalizeProduct(x))
      .filter((x): x is FeedCatalogProduct => Boolean(x))
      .map((p) => applyVendorOverrides(p));
  }, []);

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

  const ceilingTotal = toNumber(snapshot?.total);
  const lightingTotalRub = toNumber(snapshot?.lighting?.totalRub);
  const lightingDiscountedRub = toNumber(
    snapshot?.lighting?.discountedTotalRub ?? applyLightingDiscount(lightingTotalRub)
  );

  const derivedPointFromStep0 = toNumber(snapshot?.derivedInputs?.pointSpotsQty);
  const derivedTrackFromStep0 = toNumber(snapshot?.derivedInputs?.trackLengthMeters);
  const trackMountType = snapshot?.derivedInputs?.trackMountType ?? "none";

  const canReconcileInstall = useMemo(() => {
    // критерий “лид реально был на Step0”: step0SessionInteracted + snapshot валиден
    return Boolean(step0SessionInteracted) && isSnapshotValid(snapshot);
  }, [snapshot, step0SessionInteracted]);

  const trackRates = homepage.price.calculator.tracks;
  const builtInRate = trackRates.find((t) => t.slug === "built-in")?.ratePerMeter ?? 0;
  const surfaceRate = trackRates.find((t) => t.slug === "surface")?.ratePerMeter ?? 0;

  const resolvedTrackRate =
    trackMountType === "surface" ? surfaceRate : builtInRate;

  const spotInstallRate = homepage.price.calculator.lights.ratePerUnit;

  const includedTrackInstall = toNumber(snapshot?.trackTotal);
  const includedSpotInstall = toNumber(snapshot?.lightsTotal);

  const desiredTrackInstallMeters = selectedTrackMeters > 0 ? selectedTrackMeters : derivedTrackFromStep0;
  const desiredSpotInstallQty = selectedPointQty > 0 ? selectedPointQty : derivedPointFromStep0;

  const desiredTrackInstallCost = desiredTrackInstallMeters > 0 ? desiredTrackInstallMeters * resolvedTrackRate : 0;
  const desiredSpotInstallCost = desiredSpotInstallQty > 0 ? desiredSpotInstallQty * spotInstallRate : 0;

  // добавляем только вверх (досчёт), не уменьшаем
  const extraTrackInstall = selectedTrackMeters > 0 ? Math.max(0, desiredTrackInstallCost - includedTrackInstall) : 0;
  const extraSpotInstall = selectedPointQty > 0 ? Math.max(0, desiredSpotInstallCost - includedSpotInstall) : 0;
  const extraInstallTotal = extraTrackInstall + extraSpotInstall;

  useEffect(() => {
    if (!canReconcileInstall) return;

    // фиксируем “досчёт” в snapshot.grandTotal, чтобы было единое место правды (Step2)
    setSnapshot((prev) => {
      if (!prev) return prev;

      const base = toNumber(prev.total);
      const nextGrand = base + extraInstallTotal;

      // если ничего не добавляем — всё равно очищаем старое значение grandTotal, чтобы не было “залипания”
      return {
        ...prev,
        grandTotal: nextGrand,
      };
    });
  }, [canReconcileInstall, extraInstallTotal, setSnapshot]);

  const grandTotal = useMemo(() => {
    const base = ceilingTotal;
    if (!canReconcileInstall) return base + lightingDiscountedRub;
    return base + extraInstallTotal + lightingDiscountedRub;
  }, [canReconcileInstall, ceilingTotal, extraInstallTotal, lightingDiscountedRub]);

  const showReminderMissingSelectedButSpecified =
    canReconcileInstall &&
    ((derivedPointFromStep0 > 0 && selectedPointQty === 0) ||
      (derivedTrackFromStep0 > 0 && selectedTrackMeters === 0));

  const showReminderSelectedButNotSpecified =
    canReconcileInstall &&
    ((selectedPointQty > 0 && derivedPointFromStep0 === 0) ||
      (selectedTrackMeters > 0 && derivedTrackFromStep0 === 0));

  const handleEditLighting = () => {
    setStep1CatalogView("selected");
    goToStep(1);
  };

  const handleGoToCeiling = () => {
    goToStep(0);
  };

  const handleAction = () => {
    closeCalculator();
    // мягко скроллим к форме
    setTimeout(() => {
      const el = document.getElementById("action");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  return (
    <div className="space-y-4">
      {/* Totals */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-600">Итог расчёта</p>

        <div className="mt-2 space-y-1 text-sm">
          {canReconcileInstall ? (
            <>
              <p className="text-slate-700">
                Потолок: <span className="font-semibold text-slate-950">{fmt(ceilingTotal)} ₽</span>
              </p>

              {extraInstallTotal > 0 ? (
                <p className="text-slate-700">
                  Монтаж по свету (досчёт):{" "}
                  <span className="font-semibold text-slate-950">{fmt(extraInstallTotal)} ₽</span>
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-slate-700">
              Потолок: <span className="font-semibold text-slate-950">{fmt(ceilingTotal)} ₽</span>{" "}
              <span className="text-xs text-slate-500">(монтаж по свету посчитаем после шага 1)</span>
            </p>
          )}

          <p className="text-emerald-700">
            Свет (со скидкой −15%):{" "}
            <span className="font-semibold">{fmt(lightingDiscountedRub)} ₽</span>
          </p>

          <p className="mt-2 text-base font-semibold text-slate-950">
            Итого: ~{fmt(grandTotal)} ₽
          </p>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          Монтаж светильников на треке не считается — считается только монтаж погонных метров трека. Монтаж точечных считается отдельно.
        </p>
      </div>

      {/* Gentle reminders */}
      {!canReconcileInstall && (selectedPointQty > 0 || selectedTrackMeters > 0) ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">Похоже, вы уже выбрали освещение.</p>
          <p className="mt-1 text-amber-900/80">
            Чтобы корректно посчитать монтаж трека (по метрам) и установку точечных, подтвердите параметры потолка на шаге 1.
          </p>
          <button
            type="button"
            onClick={handleGoToCeiling}
            className="mt-3 rounded-xl bg-amber-700 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-800"
          >
            Перейти к параметрам потолка
          </button>
        </div>
      ) : null}

      {showReminderMissingSelectedButSpecified ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
          <p className="font-semibold">Небольшая проверка</p>
          <p className="mt-1 text-blue-900/80">
            В расчёте потолка указаны треки/точечные, но в каталоге вы их пока не выбрали. Можно продолжить без суеты — или добавить сейчас.
          </p>
          <button
            type="button"
            onClick={handleEditLighting}
            className="mt-3 rounded-xl bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800"
          >
            Перейти к выбору освещения
          </button>
        </div>
      ) : null}

      {showReminderSelectedButNotSpecified ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
          <p className="font-semibold">Подсказка</p>
          <p className="mt-1 text-slate-600">
            Вы выбрали треки/точечные в каталоге. Если на шаге 1 они не были указаны — мы досчитаем монтаж на этом шаге (только если шаг 1 был пройден).
          </p>
        </div>
      ) : null}

      {/* Mini-cart */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-950">
            Вы выбрали ({lightingItems.length} поз.)
          </p>

          <button
            type="button"
            onClick={handleEditLighting}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50"
          >
            Редактировать
          </button>
        </div>

        {lightingItems.length > 0 ? (
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {lightingItems.slice(0, 8).map((item) => (
              <li key={`${item.sku}-${item.name}`} className="flex items-start justify-between gap-3">
                <span className="min-w-0 break-words">{item.name}</span>
                <span className="shrink-0 text-slate-500">× {item.qty}</span>
              </li>
            ))}
            {lightingItems.length > 8 ? (
              <li className="text-xs text-slate-500">…и ещё {lightingItems.length - 8} поз.</li>
            ) : null}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate-600">Освещение не выбрано — можно продолжить.</p>
        )}
      </div>

      {/* Action */}
      <button
        type="button"
        onClick={handleAction}
        className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
      >
        Записаться на бесплатный замер →
      </button>
    </div>
  );
}
