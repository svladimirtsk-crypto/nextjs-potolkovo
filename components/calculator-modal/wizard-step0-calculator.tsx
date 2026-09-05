"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { homepage } from "@/content/homepage";
import type { ServiceCalculatorPreset } from "@/content/services";
import type { SolutionScenario } from "@/lib/calculator-modal-types";
import { PriceCalculatorQuizV2 } from "@/components/calculator-modal/step0/quiz-v2/PriceCalculatorQuizV2";

import { caseHint } from "@/lib/calculator/presets";
import { DEFAULT_CALCULATOR_AREA } from "@/lib/catalog-ui-config";
import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";

import { toNumber, toText } from "@/lib/feed2-snapshot-normalize";
import { useCatalogProducts } from "@/lib/lighting/use-catalog-products";
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

/**
 * Единый реестр slug'ов услуг → сценарий решения.
 *
 * Вместо хардкодных строк, разбросанных в условной цепочке, используем
 * явную таблицу решений. При добавлении новой услуги достаточно добавить
 * запись в этот массив — сценарий подхватится автоматически.
 *
 * Синхронизирован с phase2ServiceSlugs из content/services.ts
 * и servicePageContent оттуда же.
 */
const SERVICE_SLUG_TO_SCENARIO: Array<{
  slugPrefix: string;
  scenario: SolutionScenario;
}> = [
  // Продвинутый: индивидуальные проекты, сложные конструкции
  { slugPrefix: "individualnye-proekty", scenario: "advanced" },

  // Современный: теневой, парящий, световые линии, треки
  { slugPrefix: "tenevoy-profil", scenario: "modern" },
  { slugPrefix: "paryashchie-potolki", scenario: "modern" },
  { slugPrefix: "svetovye-linii", scenario: "modern" },
  { slugPrefix: "trekovoe-osveshchenie", scenario: "modern" },
  { slugPrefix: "prodazha-trekovogo-osveshcheniya", scenario: "modern" },
  { slugPrefix: "svetoprozrachnye-potolki", scenario: "modern" },
  { slugPrefix: "skrytye-karnizy", scenario: "modern" },

  // Специальный: track-sale
  { slugPrefix: "track-sale", scenario: "modern" },
];

function resolveInitialSolutionScenario(
  source: unknown,
  preset?: ServiceCalculatorPreset
): SolutionScenario {
  const src = String(source ?? "").toLowerCase();

  // 1. Проверяем по реестру slug'ов
  for (const entry of SERVICE_SLUG_TO_SCENARIO) {
    if (src.includes(entry.slugPrefix)) return entry.scenario;
  }

  // 2. Проверяем по пресету калькулятора
  if (preset?.ceilingType === "shadow" || preset?.ceilingType === "floating") return "modern";
  if (preset?.trackType && preset.trackType !== "none") return "modern";
  if (preset?.lightLinesEnabled) return "modern";

  return "standard";
}

export function WizardStep0Calculator({ preset }: WizardStep0CalculatorProps) {
  const {
    markStep0SessionInteracted,
    options,
    lightingDraft,
    step0SessionInteracted,
    setStep0Progress,
    setIsStep0SummaryReady,
    setStep0FooterAction,
    setStep0BackAction,
  } = useCalculatorModal();

  const forcePreset = Boolean(options?.forcePreset);
  const resolvedPreset: ServiceCalculatorPreset = useMemo(
    () => ({
      ceilingType: String(preset?.ceilingType ?? "standard") as ServiceCalculatorPreset["ceilingType"],
      areaDefault: forcePreset ? Number(preset?.areaDefault ?? DEFAULT_CALCULATOR_AREA) : DEFAULT_CALCULATOR_AREA,
      corniceType: preset?.corniceType,
      trackType: preset?.trackType,
      lightsEnabled: preset?.lightsEnabled,
      lightsCount: preset?.lightsCount,
      introNote: preset?.introNote,
      lightingDefault: preset?.lightingDefault,
    }),
    [
      forcePreset,
      preset?.areaDefault,
      preset?.ceilingType,
      preset?.corniceType,
      preset?.introNote,
      preset?.lightingDefault,
      preset?.lightsCount,
      preset?.lightsEnabled,
      preset?.trackType,
    ]
  );

  const initialSolutionScenario = useMemo(
    () => resolveInitialSolutionScenario(options?.source, resolvedPreset),
    [options?.source, resolvedPreset]
  );

  const [prefillTrigger, setPrefillTrigger] = useState(0);
  const [introHidden, setIntroHidden] = useState(false);

  // T-021: источник теперь "<slug>:<placement>"; старый формат "proof-<slug>" поддерживаем
  const rawSource = String(options?.source ?? "");
  const proofSourceSlug = rawSource.endsWith(":proof")
    ? rawSource.slice(0, -":proof".length)
    : rawSource.startsWith("proof-")
      ? rawSource.replace(/^proof-/, "")
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

  // T-029: каталог приезжает отдельным чанком, а не из фида в бандле.
  const { products: catalogProductsFromIndex } = useCatalogProducts();
  const feedProducts = catalogProductsFromIndex;

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
      {(proofContext || isTrackSaleFlow) && !introHidden ? (
        <div
          className={[
            "relative mb-4 rounded-2xl border p-4 pr-10 text-sm",
            isTrackSaleFlow
              ? "border-emerald-200 bg-emerald-50 text-emerald-950"
              : "border-blue-200 bg-blue-50 text-blue-950",
          ].join(" ")}
        >
          <button
            type="button"
            onClick={() => setIntroHidden(true)}
            aria-label="Скрыть подсказку"
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 hover:bg-black/5 hover:text-slate-700"
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-4 w-4"><path d="M5 5l10 10M15 5L5 15" /></svg>
          </button>
          <p className="font-semibold">{isTrackSaleFlow ? "Освещение уже выбрано" : "Похожее решение загружено"}</p>
          <p className={isTrackSaleFlow ? "mt-1 text-emerald-900/80" : "mt-1 text-blue-900/80"}>
            {isTrackSaleFlow
              ? "Теперь добавьте параметры потолка, чтобы увидеть общий бюджет. Площадь считается отдельно, а трек, карнизы и профили — только по фактическим метрам."
              : (proofContext?.actionPreset?.introNote ?? (
                <>
                  {caseHint(String(proofContext?.title ?? ""))}. Проверьте площадь и уточните только нужные участки профилей и узлов.
                </>
              ))}
          </p>
        </div>
      ) : null}

      <PriceCalculatorQuizV2
        preset={resolvedPreset}
        initialSolutionScenario={initialSolutionScenario}
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
        onStep0ProgressChange={setStep0Progress}
        onIsStep0SummaryReadyChange={setIsStep0SummaryReady}
        onStep0FooterActionChange={setStep0FooterAction}
        onStep0BackActionChange={setStep0BackAction}
        /* T-022: подписи и переходы сводки считает сам квиз от engine.solutionScenario */
      />
    </div>
  );
}
