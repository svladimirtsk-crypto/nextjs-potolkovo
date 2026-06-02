"use client";

import { useMemo, useState } from "react";

import type { ServiceCalculatorPreset } from "@/content/services";
import { PriceCalculatorClient } from "@/components/home/price-calculator-client";

import { DEFAULT_CALCULATOR_AREA } from "@/lib/catalog-ui-config";
import type { FeedCatalogParam, FeedCatalogProduct } from "@/lib/eks-feed2-catalog";

import snapshotData from "@/data/eks-feed2-snapshot.json";
import { applyVendorOverrides } from "@/lib/vendor-code-overrides";

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

function parseMetersFromValue(raw: string): number | null {
  const s = toText(raw).toLowerCase().replace(/\s+/g, " ");

  const mm = s.match(/(\d+(?:[.,]\d+)?)\s*(мм|mm)\b/);
  if (mm) {
    const v = Number(mm[1].replace(",", "."));
    if (Number.isFinite(v) && v > 0) return v / 1000;
  }

  const cm = s.match(/(\d+(?:[.,]\d+)?)\s*(см|cm)\b/);
  if (cm) {
    const v = Number(cm[1].replace(",", "."));
    if (Number.isFinite(v) && v > 0) return v / 100;
  }

  const m = s.match(/(\d+(?:[.,]\d+)?)\s*(м|m)\b/);
  if (m) {
    const v = Number(m[1].replace(",", "."));
    if (Number.isFinite(v) && v > 0) return v;
  }

  return null;
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

function tryGetTrackProfilePieceMeters(product: FeedCatalogProduct): number | null {
  if (typeof product.pieceLengthMeters === "number" && product.pieceLengthMeters > 0) return product.pieceLengthMeters;
  if (typeof product.lengthMeters === "number" && product.lengthMeters > 0) return product.lengthMeters;

  const attrs = [...(product.keyAttributes ?? []), ...(product.params ?? [])];
  for (const a of attrs) {
    const label = toText(a.label).toLowerCase();
    if (!label) continue;
    const looksLikeLength = label.includes("длина") || label.includes("length") || label.includes("размер");
    if (!looksLikeLength) continue;

    const v = parseMetersFromValue(toText(a.value));
    if (v && v > 0) return v;
  }

  const fromName = parseMetersFromValue(toText(product.name));
  if (fromName && fromName > 0) return fromName;

  return null;
}

type WizardStep0CalculatorProps = {
  preset?: ServiceCalculatorPreset;
};

export function WizardStep0Calculator({ preset }: WizardStep0CalculatorProps) {
  const { markStep0SessionInteracted, options, lightingDraft } = useCalculatorModal();

  const forcePreset = Boolean(options?.forcePreset);
  const resolvedPreset: ServiceCalculatorPreset = {
    ceilingType: String(preset?.ceilingType ?? "standard") as ServiceCalculatorPreset["ceilingType"],

    // ТЗ: первый запуск в модалке = 10 м² (если не forcePreset)
    areaDefault: forcePreset ? Number(preset?.areaDefault ?? DEFAULT_CALCULATOR_AREA) : DEFAULT_CALCULATOR_AREA,

    corniceType: preset?.corniceType,
    trackType: preset?.trackType,
    lightsEnabled: preset?.lightsEnabled,
    lightsCount: preset?.lightsCount,
    introNote: preset?.introNote,
    lightingDefault: preset?.lightingDefault,
  };

  const [prefillTrigger, setPrefillTrigger] = useState(0);

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

    for (const item of lightingItems) {
      const sku = toText(item.sku);
      const qty = toNumber(item.qty);

      const product = byProductId.get(sku) ?? byVendorCode.get(sku);
      if (!product) continue;

      // TRACK: только по профилю (погонные метры)
      if (product.kind === "TRACK_PROFILE") {
        if (product.unit === "m") trackProfileMeters += qty;
        else {
          const piece = tryGetTrackProfilePieceMeters(product);
          if (piece && piece > 0) trackProfileMeters += qty * piece;
        }
      }

      // POINT: SPOT_FIXTURE + PANELS
      if (product.kind === "SPOT_FIXTURE" || isPanelProduct(product)) {
        pointSpotsQty += qty;
      }
    }

    return {
      trackProfileMeters,
      pointSpotsQty,
      hasAny: trackProfileMeters > 0 || pointSpotsQty > 0,
    };
  }, [byProductId, byVendorCode, lightingItems]);

  return (
    <div
      onPointerDown={markStep0SessionInteracted}
      onKeyDown={markStep0SessionInteracted}
      onChange={markStep0SessionInteracted}
    >
      {prefillMetrics.hasAny ? (
        <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
          <p className="font-semibold">Подставить из выбранного освещения</p>
          <p className="mt-1 text-blue-900/80">
            В каталоге уже выбрано: профиль трека ~
            <span className="font-semibold"> {prefillMetrics.trackProfileMeters.toFixed(1)} м</span>, точечные{" "}
            <span className="font-semibold">{Math.round(prefillMetrics.pointSpotsQty)} шт.</span>
          </p>
          <p className="mt-1 text-xs text-blue-900/70">
            Мы подставим эти значения в расчёт потолка. Тип трека (встроенный/накладной) можно будет поменять.
          </p>

          <button
            type="button"
            onClick={() => setPrefillTrigger((x) => x + 1)}
            className="mt-3 rounded-xl bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800"
          >
            Подставить по выбранному свету →
          </button>
        </div>
      ) : null}

      <PriceCalculatorClient
        preset={resolvedPreset}
        compactSections
        // новый API, см. патч ниже
        prefillFromLighting={
          prefillMetrics.hasAny
            ? {
                trackProfileMeters: prefillMetrics.trackProfileMeters,
                pointSpotsQty: prefillMetrics.pointSpotsQty,
              }
            : null
        }
        prefillFromLightingTrigger={prefillTrigger}
      />
    </div>
  );
}
