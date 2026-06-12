"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { ServiceCalculatorPreset } from "@/content/services";
import { PriceCalculatorClient } from "@/components/home/price-calculator-client";

import { DEFAULT_CALCULATOR_AREA } from "@/lib/catalog-ui-config";
import type { FeedCatalogParam, FeedCatalogProduct } from "@/lib/eks-feed2-catalog";

import snapshotData from "@/data/eks-feed2-snapshot.json";
import { applyVendorOverrides } from "@/lib/vendor-code-overrides";
import { calcTrackProfileMeters } from "@/lib/product-length-meters";

import { useCalculatorModal } from "./calculator-modal-context";

function toText(value: unknown): string {
  return String(value ?? "").trim();
}
function toNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
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

  const vendorCode = toText((p as any).vendorCode);
  const offerId = toText((p as any).offerId);
  const name = toText((p as any).name);
  if (!name || (!vendorCode && !offerId)) return null;

  const productIdRaw = toText((p as any).productId);
  const productId = productIdRaw || `feed2-${vendorCode || offerId || name}`;

  const images = Array.isArray((p as any).images)
    ? ((p as any).images as unknown[]).map((item) => toText(item)).filter(Boolean)
    : [];

  return {
    productId: toText(productId),
    vendorCode,
    offerId,
    name,
    url: toText((p as any).url),
    categoryId: toText((p as any).categoryId),
    categoryPath: toText((p as any).categoryPath),
    images,
    coverImage: toText((p as any).coverImage) || images[0] || "",
    priceRub: toNumber((p as any).priceRub),
    available: Boolean((p as any).available ?? true),
    params: toParams((p as any).params),
    keyAttributes: toParams((p as any).keyAttributes),
    system: (toText((p as any).system) || "UNKNOWN") as FeedCatalogProduct["system"],
    kind: (toText((p as any).kind) || "OTHER") as FeedCatalogProduct["kind"],
    unit: (toText((p as any).unit) === "m" ? "m" : "pcs") as FeedCatalogProduct["unit"],
    lengthMeters: toNumberOrNull((p as any).lengthMeters),
    pieceLengthMeters: toNumberOrNull((p as any).pieceLengthMeters),
  };
}

function isPanelProduct(product: FeedCatalogProduct): boolean {
  const text = `${toText(product.name)} ${toText(product.categoryPath)}`.toLowerCase();
  return text.includes("панел") || text.includes("panel") || text.includes("600x600") || text.includes("595x595");
}

type PreferredTrackType = "built-in" | "surface" | null;

type WizardStep0CalculatorProps = {
  preset?: ServiceCalculatorPreset;
};

export function WizardStep0Calculator({ preset }: WizardStep0CalculatorProps) {
  const { markStep0SessionInteracted, options, lightingDraft, step0SessionInteracted, goToStep } =
    useCalculatorModal();

  const forcePreset = Boolean(options?.forcePreset);
  const resolvedPreset: ServiceCalculatorPreset = {
    ceilingType: String(preset?.ceilingType ?? "standard") as ServiceCalculatorPreset["ceilingType"],
    areaDefault: forcePreset ? Number(preset?.areaDefault ?? DEFAULT_CALCULATOR_AREA) : DEFAULT_CALCULATOR_AREA,
    corniceType: preset?.corniceType,
    trackType: preset?.trackType,
    lightsEnabled: preset?.lightsEnabled,
    lightsCount: preset?.lightsCount,
    introNote: preset?.introNote,
    lightingDefault: preset?.lightingDefault,
  };

  const [prefillTrigger, setPrefillTrigger] = useState(0);

  const optionsKeyRef = useRef<string | null>(null);
  const autoPrefilledRef = useRef(false);
  useEffect(() => {
    const key = JSON.stringify({
      entryMode: options?.entryMode ?? null,
      source: options?.source ?? null,
      preset: options?.preset ?? null,
      forcePreset: options?.forcePreset ?? null,
      initialStep: options?.initialStep ?? null,
    });
    if (optionsKeyRef.current !== key) {
      optionsKeyRef.current = key;
      autoPrefilledRef.current = false;
    }
  }, [options]);

  const feedProducts = useMemo(() => {
    const rawProducts = (snapshotData as { products?: unknown[] })?.products ?? [];
    return rawProducts
      .map((x) => normalizeProduct(x))
      .filter((x): x is FeedCatalogProduct => Boolean(x))
      .map((p) => applyVendorOverrides(p));
  }, []);

  const byProductId = useMemo(() => {
    const map = new Map<string, FeedCatalogProduct>();
    for (const p of feedProducts) map.set(toText(p.productId), p);
    return map;
  }, [feedProducts]);

  const byVendorCode = useMemo(() => {
    const map = new Map<string, FeedCatalogProduct>();
    for (const p of feedProducts) {
      const v = toText(p.vendorCode);
      if (v) map.set(v, p);
    }
    return map;
  }, [feedProducts]);

  const lightingItems = lightingDraft?.mode === "catalog" ? (lightingDraft.items ?? []) : [];

  const prefillMetrics = useMemo(() => {
    let trackProfileMeters = 0;
    let pointSpotsQty = 0;

    let metersArt = 0;
    let metersClarus = 0;
    let metersColibri = 0;

    for (const item of lightingItems) {
      const sku = toText(item.sku);
      const qty = toNumber(item.qty);

      const product = byProductId.get(sku) ?? byVendorCode.get(sku);
      if (!product) continue;

      if (product.kind === "TRACK_PROFILE") {
        const meters = calcTrackProfileMeters(product, qty);
        trackProfileMeters += meters;

        if (product.system === "TRACK_220") metersArt += meters;
        if (product.system === "CLARUS_48") metersClarus += meters;
        if (product.system === "COLIBRI_220") metersColibri += meters;
      }

      if (product.kind === "SPOT_FIXTURE" || isPanelProduct(product)) {
        pointSpotsQty += qty;
      }
    }

    const hasAny = trackProfileMeters > 0 || pointSpotsQty > 0;

    const hasArt = metersArt > 0;
    const hasBuiltIn = metersClarus > 0 || metersColibri > 0;

    const preferredTrackType: PreferredTrackType =
      hasArt && !hasBuiltIn ? "surface" : !hasArt && hasBuiltIn ? "built-in" : null;

    return {
      trackProfileMeters,
      pointSpotsQty,
      preferredTrackType,
      hasAny,
    };
  }, [byProductId, byVendorCode, lightingItems]);

  useEffect(() => {
    if (autoPrefilledRef.current) return;
    if (step0SessionInteracted) return;
    if (!prefillMetrics.hasAny) return;

    autoPrefilledRef.current = true;
    setPrefillTrigger((x) => x + 1);
  }, [prefillMetrics.hasAny, step0SessionInteracted]);

  return (
    <div
      onPointerDown={markStep0SessionInteracted}
      onKeyDown={markStep0SessionInteracted}
      onChange={markStep0SessionInteracted}
    >
      {prefillMetrics.hasAny ? (
        <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
          <p className="font-semibold">Синхронизация со светом</p>
          <p className="mt-1 text-blue-900/80">
            В каталоге уже выбрано: профиль трека ~
            <span className="font-semibold"> {prefillMetrics.trackProfileMeters.toFixed(1)} м</span>, точечные{" "}
            <span className="font-semibold">{Math.round(prefillMetrics.pointSpotsQty)} шт.</span>
          </p>

          <button
            type="button"
            onClick={() => setPrefillTrigger((x) => x + 1)}
            className="mt-3 rounded-xl bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800"
          >
            Обновить по выбранному свету →
          </button>
        </div>
      ) : null}

      <PriceCalculatorClient
        preset={resolvedPreset}
        compactSections
        showMobileStickyBar={false}
        prefillFromLighting={
          prefillMetrics.hasAny
            ? {
                trackProfileMeters: prefillMetrics.trackProfileMeters,
                pointSpotsQty: prefillMetrics.pointSpotsQty,
                preferredTrackType: prefillMetrics.preferredTrackType,
              }
            : null
        }
        prefillFromLightingTrigger={prefillTrigger}
        // P0.1: Dark card CTA button navigates to Step 3 (form)
        onPrimaryCtaClick={() => goToStep(2)}
      />
    </div>
  );
}
