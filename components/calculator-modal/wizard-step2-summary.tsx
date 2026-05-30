"use client";

import { useMemo } from "react";

import snapshotData from "@/data/eks-feed2-snapshot.json";
import type { FeedCatalogParam, FeedCatalogProduct } from "@/lib/eks-feed2-catalog";
import {
  getCalculatorSummaryLines,
  usePriceCalculatorBridge,
} from "@/components/home/price-calculator-context";
import { ProductImage } from "@/components/feed2/ProductImage";
import { useCalculatorModal } from "./calculator-modal-context";
import { isSnapshotValid } from "@/lib/calculator-snapshot-guard";
import { calcRequiredWorksFromLighting, applyLightingDiscount } from "@/lib/lighting-formulas";
import type { WizardStep } from "@/lib/calculator-modal-types";
import { REMOVED_COLIBRI_VENDOR_CODES } from "@/lib/catalog-ui-config";

function fmt(n: number) {
  return new Intl.NumberFormat("ru-RU").format(Math.round(n));
}

type WizardStep2SummaryProps = {
  onConfirm: () => void;
};

type ExtendedOptions = {
  entryMode?: "lighting-first" | string;
};

function toText(value: unknown): string {
  return String(value ?? "").trim();
}

function toNumberOrNull(value: unknown): number | null {
  const num = Number(value ?? NaN);
  return Number.isFinite(num) ? num : null;
}

function toParams(input: unknown): FeedCatalogParam[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      const x = item as { label?: unknown; value?: unknown };
      return {
        label: toText(x?.label),
        value: toText(x?.value),
      };
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
    priceRub: Number(p.priceRub ?? 0),
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
    ? `Монтаж точечных светильников скорректирован: ${currentLightsCount} -> ${requiredLightsCount} шт. (${fmt(requiredLightsCount * (snapshot?.lightsRatePerUnit ?? 750))} ₽)`
    : null;

  const productsByKey = useMemo(() => {
    const map = new Map<string, FeedCatalogProduct>();
    const rawProducts = (snapshotData as { products?: unknown[] })?.products ?? [];
    for (const raw of rawProducts) {
      const product = normalizeProduct(raw);
      if (!product) continue;

      const productId = toText(product.productId);
      const vendorCode = toText(product.vendorCode);
      if (productId) map.set(productId, product);
      if (vendorCode) map.set(vendorCode, product);
    }
    return map;
  }, []);

  const miniCartItemsRaw = useMemo(() => {
    const items = lightingDraft?.items ?? [];
    return items.map((item) => {
      const sku = toText(item.sku);
      const product = productsByKey.get(sku);
      const qty = Number(item.qty ?? 0);
      const priceRub = Number(item.priceRub ?? 0);
      const subtotal = qty * priceRub;
      return {
        sku,
        product,
        name: toText(item.name),
        qty,
        priceRub,
        subtotal,
      };
    });
  }, [lightingDraft?.items, productsByKey]);

  const miniCartItems = useMemo(() => {
    return miniCartItemsRaw.filter((item) => {
      const byVendor = toText(item.product?.vendorCode);
      if (REMOVED_COLIBRI_VENDOR_CODES.has(byVendor)) return false;
      if (REMOVED_COLIBRI_VENDOR_CODES.has(toText(item.sku))) return false;
      return true;
    });
  }, [miniCartItemsRaw]);

  const removedItemsCount = miniCartItemsRaw.length - miniCartItems.length;

  const miniCartTotals = useMemo(() => {
    const regular = miniCartItems.reduce((sum, item) => sum + item.subtotal, 0);
    const discounted = applyLightingDiscount(regular);
    const benefit = Math.max(0, regular - discounted);
    return { regular, discounted, benefit };
  }, [miniCartItems]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-slate-950 p-6 text-white">
        <p className="mb-1 text-sm text-white/60">Потолок (работы)</p>
        {hasCeilingInputs ? (
          <p className="text-3xl font-bold tracking-tight">{fmt(ceilingForDisplay)} ₽</p>
        ) : (
          <p className="text-sm text-white/90">Потолок: укажите площадь и тип, затем посчитаем</p>
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

      {hasLighting && miniCartItems.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <p className="text-sm font-semibold text-slate-950">
              Вы выбрали ({miniCartItems.length} поз.)
            </p>
            <button
              type="button"
              onClick={() => {
                setStep1CatalogView("selected");
                goToStep(1 as WizardStep);
              }}
              className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Редактировать
            </button>
          </div>

          {removedItemsCount > 0 ? (
            <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
              {removedItemsCount} поз. удалено из ассортимента и не включено в итог.
            </div>
          ) : null}

          <div className="space-y-2 p-3">
            {miniCartItems.map((item) => {
              const attrs = (item.product?.keyAttributes ?? item.product?.params ?? []).slice(0, 3);
              return (
                <div key={item.sku} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="grid grid-cols-[96px_1fr] gap-3">
                    <ProductImage
                      src={item.product?.coverImage}
                      alt={item.name}
                      containerClassName="h-24 w-24 overflow-hidden rounded-xl border border-slate-200 bg-white p-2"
                      className="h-full w-full object-contain"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">SKU: {item.sku}</p>
                      <p className="mt-1 text-xs text-slate-600">
                        {attrs.length > 0
                          ? attrs
                              .map((attr) => `${toText(attr.label)}: ${toText(attr.value)}`)
                              .join(" • ")
                          : "Атрибуты недоступны"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Qty: {item.qty} • {fmt(item.priceRub)} ₽ / шт
                      </p>
                      <p className="text-xs font-semibold text-slate-900">
                        Сумма: {fmt(item.subtotal)} ₽
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        if (!lightingDraft?.items) return;

                        const nextItems = lightingDraft.items.filter((x) => toText(x.sku) !== item.sku);
                        if (nextItems.length === 0) {
                          setLightingDraft({ mode: "none", userCustomizedLighting: false });
                          return;
                        }

                        const nextTotal = nextItems.reduce((sum, x) => {
                          const qty = Number(x.qty ?? 0);
                          const price = Number(x.priceRub ?? 0);
                          return sum + qty * price;
                        }, 0);

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
                      className="rounded-xl border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            <p>Итого без скидки: {fmt(miniCartTotals.regular)} ₽</p>
            <p className="font-semibold text-emerald-700">
              Итого со скидкой: {fmt(miniCartTotals.discounted)} ₽
            </p>
            <p className="text-emerald-600">Выгода: {fmt(miniCartTotals.benefit)} ₽</p>
          </div>
        </div>
      ) : null}

      {reconcileNote ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
          <p className="text-sm font-semibold text-blue-900">Параметры монтажа обновятся автоматически</p>
          <p className="mt-1 text-sm leading-5 text-blue-800">{reconcileNote}</p>
          <p className="mt-1.5 text-xs text-blue-700">Точное количество уточним на замере.</p>
        </div>
      ) : null}

      {!hasCeilingInputs ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
          <p className="text-sm font-semibold text-slate-950">По потолку пока нет параметров</p>
          <p className="mt-1 text-sm text-slate-600">
            Укажите площадь и тип потолка на первом шаге, добавим работы к итогу.
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

      {calcLines.length > 0 ? (
        <details className="group rounded-2xl border border-slate-200 bg-slate-50">
          <summary className="flex cursor-pointer list-none select-none items-center justify-between px-4 py-3 text-sm font-semibold text-slate-900">
            <span>Детали расчета потолка</span>
            <span className="text-slate-400 transition-transform group-open:rotate-180">▾</span>
          </summary>
          <div className="border-t border-slate-200 px-4 py-3">
            <ul className="space-y-1">
              {calcLines.map((line) => (
                <li key={line} className="text-sm text-slate-700">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </details>
      ) : null}
    </div>
  );
}
