"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { homepage } from "@/content/homepage";
import type { ServiceCalculatorPreset } from "@/content/services";
import { PriceCalculatorClient } from "@/components/home/price-calculator-client";

import { DEFAULT_CALCULATOR_AREA } from "@/lib/catalog-ui-config";
import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";

import snapshotData from "@/data/eks-feed2-snapshot.json";
import { normalizeFeedCatalogProducts, toNumber, toText } from "@/lib/feed2-snapshot-normalize";
import { applyVendorOverrides } from "@/lib/vendor-code-overrides";
import { calcTrackProfileMeters } from "@/lib/product-length-meters";

import { useCalculatorModal } from "./calculator-modal-context";

function isPanelProduct(product: FeedCatalogProduct): boolean {
  const text = `${toText(product.name)} ${toText(product.categoryPath)}`.toLowerCase();
  return text.includes("панел") || text.includes("panel") || text.includes("600x600") || text.includes("595x595");
}

type PreferredTrackType = "built-in" | "surface" | null;

type ProofContextItem = {
  slug: string;
  title: string;
  actionPreset?: ServiceCalculatorPreset;
};

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

  const proofSourceSlug = options?.source?.startsWith("proof-")
    ? options.source.replace(/^proof-/, "")
    : null;
  const proofContext: ProofContextItem | null = proofSourceSlug
    ? ((homepage.proof.items.find((proofItem) => proofItem.slug === proofSourceSlug) as ProofContextItem | undefined) ?? null)
    : null;
  const isTrackSaleFlow = String(options?.source ?? "").startsWith("track-sale");

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
    return normalizeFeedCatalogProducts(rawProducts).map((product) => applyVendorOverrides(product));
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

  const prefillMetrics = useMemo(() => {
    const lightingItems = lightingDraft?.mode === "catalog" ? (lightingDraft.items ?? []) : [];

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
  }, [byProductId, byVendorCode, lightingDraft]);

  useEffect(() => {
    if (autoPrefilledRef.current) return;
    if (step0SessionInteracted) return;
    if (!prefillMetrics.hasAny) return;

    autoPrefilledRef.current = true;
    const frame = requestAnimationFrame(() => setPrefillTrigger((x) => x + 1));
    return () => cancelAnimationFrame(frame);
  }, [prefillMetrics.hasAny, step0SessionInteracted]);

  return (
    <div
      onClickCapture={markStep0SessionInteracted}
      onKeyDownCapture={markStep0SessionInteracted}
      onChangeCapture={markStep0SessionInteracted}
    >
      {proofContext ? (
        <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
          <p className="font-semibold">Похожее решение загружено</p>
          <p className="mt-1 text-blue-900/80">
            {proofContext.actionPreset?.introNote ?? (
              <>
                Мы подставили стартовые параметры по кейсу <span className="font-semibold">«{proofContext.title}»</span>.
                Проверьте площадь и скорректируйте только те участки, где реально нужен профиль, трек, карниз или линии.
              </>
            )}
          </p>
          <div className="mt-3 grid gap-2 text-xs text-blue-900/80 sm:grid-cols-3">
            <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-blue-100">1. Проверьте площадь</div>
            <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-blue-100">2. Уточните метры профилей и узлов</div>
            <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-blue-100">3. Дальше можно уточнить свет и итог</div>
          </div>
        </div>
      ) : null}

      {isTrackSaleFlow ? (
        <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
          <p className="font-semibold">Освещение уже выбрано</p>
          <p className="mt-1 text-emerald-900/80">
            Теперь добавьте параметры потолка, чтобы увидеть общий бюджет. Площадь считается отдельно, а трек, карнизы и профили — только по фактическим метрам.
          </p>
        </div>
      ) : null}

      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
        <p className="font-semibold text-slate-950">Как считать правильно</p>
        <ul className="mt-2 space-y-1.5 text-slate-600">
          <li>• Площадь — это всё помещение или весь объект.</li>
          <li>• Теневой и парящий профиль указывайте только на нужных участках в метрах.</li>
          <li>• Обычный, теневой и парящий можно сочетать в одном объекте.</li>
        </ul>
      </div>

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
        onPrimaryCtaClick={() => goToStep(1)}
      />
    </div>
  );
}
