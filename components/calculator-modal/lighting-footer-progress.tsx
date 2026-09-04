"use client";

import { useMemo } from "react";

import type { FeedCatalogParam, FeedCatalogProduct } from "@/lib/eks-feed2-catalog";
import { buildProductsIndex, detectSocket, getRequiredLampSocket } from "@/lib/feed2-products";
import { type LampSocket } from "@/lib/catalog-ui-config";
import { useCatalogProducts } from "@/lib/lighting/use-catalog-products";
import { calcTrackProfileMeters } from "@/lib/product-length-meters";
import { usePriceCalculatorBridge } from "@/components/home/price-calculator-context";
import { selectRequirementsFromBreakdown } from "@/lib/calculator/selectors";
import { useCalculatorModal } from "./calculator-modal-context";

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

function fmtM(value: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(value);
}

function toNumOrNull(value: unknown): number | null {
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


function isPanelProduct(product: FeedCatalogProduct): boolean {
  const text = `${toText(product.name)} ${toText(product.categoryPath)}`.toLowerCase();
  return text.includes("панел") || text.includes("panel") || text.includes("600x600") || text.includes("595x595");
}

type Metric = {
  id: string;
  label: string;
  current: number;
  required: number;
  unit: "м" | "шт.";
};

function MiniBar({ current, required, unit }: { current: number; required: number; unit: "м" | "шт." }) {
  if (required <= 0) return null;

  const done = current >= required;
  const pct = Math.min(100, Math.round((current / required) * 100));

  return (
    <div className="min-w-0">
      <div className="mb-0.5 flex items-center justify-between gap-2 text-[10px] text-slate-500">
        <span className={done ? "font-semibold text-emerald-700" : "text-slate-500"}>
          {unit === "м" ? fmtM(current) : fmt(current)}/{unit === "м" ? fmtM(required) : fmt(required)} {unit}
        </span>
      </div>
      <div className="h-1 rounded-full bg-slate-200">
        <div
          className={done ? "h-1 rounded-full bg-emerald-600" : "h-1 rounded-full bg-slate-950"}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function LightingFooterProgress() {
  const { currentStep, lightingDraft, showCeilingInUi } = useCalculatorModal();
  const { snapshot } = usePriceCalculatorBridge();

  // T-029: каталог приезжает отдельным чанком, а не из фида в бандле.
  const { products: catalogProductsFromIndex } = useCatalogProducts();
  const products = catalogProductsFromIndex;

  const productsById = useMemo(() => buildProductsIndex(products), [products]);

  const productIdByVendorCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const product of products) {
      const vendorCode = toText(product.vendorCode);
      const productId = toText(product.productId);
      if (vendorCode && productId) map.set(vendorCode, productId);
    }
    return map;
  }, [products]);

  const cartEntries = useMemo(() => {
    const items = lightingDraft?.mode === "catalog" ? (lightingDraft.items ?? []) : [];

    return items
      .map((item) => {
        const sku = toText(item.sku);
        const byProduct = productsById.get(sku);
        const byVendor = productIdByVendorCode.get(sku);
        const productId = byProduct ? sku : toText(byVendor ?? "");
        const product = productId ? productsById.get(productId) : null;
        if (!product) return null;
        return { productId, product, qty: toNumber(item.qty) };
      })
      .filter((entry): entry is { productId: string; product: FeedCatalogProduct; qty: number } => Boolean(entry));
  }, [lightingDraft, productIdByVendorCode, productsById]);

  const selectedTrackMeters = useMemo(() => {
    return cartEntries.reduce((sum, entry) => {
      return entry.product.kind === "TRACK_PROFILE" ? sum + calcTrackProfileMeters(entry.product, entry.qty) : sum;
    }, 0);
  }, [cartEntries]);

  const selectedPointQty = useMemo(() => {
    return cartEntries.reduce((sum, entry) => {
      return entry.product.kind === "SPOT_FIXTURE" || isPanelProduct(entry.product) ? sum + entry.qty : sum;
    }, 0);
  }, [cartEntries]);

  const selectedTrackFixtureQty = useMemo(() => {
    return cartEntries.reduce((sum, entry) => {
      return entry.product.kind === "TRACK_FIXTURE" ? sum + entry.qty : sum;
    }, 0);
  }, [cartEntries]);

  const lampRequiredBySocket = useMemo(() => {
    const result: Record<LampSocket, number> = { GX53: 0, MR16: 0, GU10: 0 };
    for (const entry of cartEntries) {
      if (entry.product.kind === "LAMP") continue;
      const socket = getRequiredLampSocket(entry.product);
      if (socket) result[socket] += entry.qty;
    }
    return result;
  }, [cartEntries]);

  const lampCurrentBySocket = useMemo(() => {
    const result: Record<LampSocket, number> = { GX53: 0, MR16: 0, GU10: 0 };
    for (const entry of cartEntries) {
      if (entry.product.kind !== "LAMP") continue;
      const socket = detectSocket(entry.product);
      if (socket) result[socket] += entry.qty;
    }
    return result;
  }, [cartEntries]);

  // T-030: требования — из общего селектора, а не из россыпи derivedInputs.
  const requirements = useMemo(
    () => selectRequirementsFromBreakdown(snapshot?.roomBreakdown),
    [snapshot?.roomBreakdown]
  );

  const requiredTrackMeters = showCeilingInUi ? requirements.trackMeters : 0;
  // Трековые светильники — ориентир-диапазон; в прогрессе показываем нижнюю границу.
  const requiredTrackFixtureQty = requiredTrackMeters > 0 ? requirements.trackFixtures.min : 0;
  const requiredPointQty = showCeilingInUi ? requirements.points : 0;
  const requiredLampQty = (Object.keys(lampRequiredBySocket) as LampSocket[]).reduce(
    (sum, socket) => sum + lampRequiredBySocket[socket],
    0
  );
  const currentLampQty = (Object.keys(lampCurrentBySocket) as LampSocket[]).reduce(
    (sum, socket) => sum + (lampRequiredBySocket[socket] > 0 ? lampCurrentBySocket[socket] : 0),
    0
  );

  const metrics: Metric[] = [
    { id: "track", label: "Профиль", current: selectedTrackMeters, required: requiredTrackMeters, unit: "м" },
    { id: "track-fixtures", label: "Трековые", current: selectedTrackFixtureQty, required: requiredTrackFixtureQty, unit: "шт." },
    { id: "points", label: "Точки", current: selectedPointQty, required: requiredPointQty, unit: "шт." },
    { id: "lamps", label: "Лампы", current: currentLampQty, required: requiredLampQty, unit: "шт." },
  ];

  const visibleMetrics = metrics.filter((metric) => metric.required > 0);
  const missingMetric =
    visibleMetrics.find((metric) => metric.id !== "track-fixtures" && metric.current < metric.required) ??
    visibleMetrics.find((metric) => metric.id === "track-fixtures" && metric.current < metric.required);
  const selectedCount = cartEntries.filter((entry) => entry.qty > 0).length;

  if (currentStep !== 1) return null;
  if (visibleMetrics.length === 0 && selectedCount === 0) return null;

  return (
    <div className="mb-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="mb-1 flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Прогресс подбора</p>
        {selectedCount > 0 ? (
          <p className="text-[11px] font-semibold text-slate-600">Выбрано: {selectedCount} поз.</p>
        ) : null}
      </div>

      {visibleMetrics.length > 0 ? (
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(visibleMetrics.length, 4)}, minmax(0, 1fr))` }}>
          {visibleMetrics.map((metric) => (
            <div key={metric.id} className="min-w-0">
              <p className="mb-0.5 truncate text-[10px] font-medium text-slate-500">{metric.label}</p>
              <MiniBar current={metric.current} required={metric.required} unit={metric.unit} />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-600">Позиции добавлены вручную — можно перейти к итогу.</p>
      )}

      {missingMetric ? (
        <p className="mt-2 text-[11px] font-medium text-slate-600">
          {missingMetric.id === "track-fixtures" ? "Ориентир: " : "Нужно добавить: "}
          {missingMetric.label.toLowerCase()} {missingMetric.unit === "м" ? fmtM(Math.max(0, missingMetric.required - missingMetric.current)) : fmt(Math.max(0, missingMetric.required - missingMetric.current))} {missingMetric.unit}
        </p>
      ) : null}
    </div>
  );
}
