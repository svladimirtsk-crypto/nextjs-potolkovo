import snapshotData from "@/data/eks-feed2-snapshot.json";
import { normalizeFeedCatalogProducts, toText } from "@/lib/feed2-snapshot-normalize";
import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";
import { inferPieceLengthMeters } from "@/lib/product-length-meters";

export type HomeCalculatorConfig = {
  areaMin: number;
  areaMax: number;
  areaStep: number;
  areaDefault: number;
  perimeterHintMinMultiplier: number;
  perimeterHintMaxMultiplier: number;
  specialMeters: { min: number; max: number; step: number };
  corniceMeters: { min: number; max: number; step: number; default: number };
  lightLineMeters: { min: number; max: number; step: number; default: number };
  trackMeters: { min: number; max: number; step: number; default: number };
  baseDescription: string;
  ceilingTypes: Array<{
    slug: "standard" | "shadow" | "floating";
    label: string;
    baseRatePerSqm: number;
    extraLabel: string | null;
    extraRatePerMeter: number;
  }>;
  cornices: Array<{
    slug: "none" | "built-in" | "hidden-niche" | "surface";
    label: string;
    ratePerMeter: number;
  }>;
  lightLines: {
    label: string;
    ratePerMeter: number;
  };
  tracks: Array<{
    slug: "none" | "built-in" | "surface";
    label: string;
    ratePerMeter: number;
  }>;
  lights: {
    label: string;
    ratePerUnit: number;
    countMin: number;
    countMax: number;
    countStep: number;
    countDefault: number;
  };
  corniceLighting: {
    label: string;
    ratePerMeter: number;
    powerSupplyLabel: string;
    powerSupplyRate: number;
    powerSupplyDefault: number;
  };
};

export type ProofPricingInput = {
  area: number;
  ceilingType: "standard" | "shadow" | "floating";
  shadowMeters?: number;
  floatingMeters?: number;
  lightLineMeters?: number;
  corniceType?: "none" | "built-in" | "hidden-niche" | "surface";
  corniceMeters?: number;
  trackInstallType?: "none" | "built-in" | "surface";
  trackInstallMeters?: number;
  lightsInstallQty?: number;
  lightingTrackProfileSystem?: "COLIBRI_220" | "CLARUS_48" | "TRACK_220";
  lightingTrackProfileMeters?: number;
  lightingFixtures?: Array<{
    vendorCode: string;
    qty: number;
  }>;
  customCharges?: Array<{
    label: string;
    amountRub: number;
  }>;
};

export type ProofBudgetLine = {
  label: string;
  amountRub: number;
};

export type ProofBudgetBreakdown = {
  ceilingWorksRub: number;
  lightingRawRub: number;
  lightingDiscountPercent: number;
  lightingDiscountedRub: number;
  customCharges: ProofBudgetLine[];
  totalRub: number;
};

const catalogProducts: FeedCatalogProduct[] = normalizeFeedCatalogProducts(
  (snapshotData as { products?: unknown[] }).products ?? []
);

function formatPriceLabel(value: number) {
  return `≈ ${Math.round(value).toLocaleString("ru-RU")} ₽`;
}

function getCatalogProductByVendorCode(vendorCode: string) {
  return catalogProducts.find((product) => toText(product.vendorCode) === vendorCode) ?? null;
}

function inferTrackProfileLengthMeters(product: FeedCatalogProduct) {
  const inferred = inferPieceLengthMeters(product);
  if (inferred && inferred >= 0.5) return inferred;

  const rawName = toText(product.name);
  const firstDimensionMatch = rawName.match(/(\d{3,4})\s*[x*×]/i);
  if (firstDimensionMatch) {
    const millimeters = Number(firstDimensionMatch[1]);
    if (Number.isFinite(millimeters) && millimeters > 0) {
      return millimeters / 1000;
    }
  }

  return inferred ?? null;
}

function getProfileProductsBySystem(system: "COLIBRI_220" | "CLARUS_48" | "TRACK_220") {
  return catalogProducts
    .filter((product) => product.kind === "TRACK_PROFILE" && product.system === system && product.priceRub > 0)
    .map((product) => ({
      product,
      lengthMeters: inferTrackProfileLengthMeters(product),
    }))
    .filter(
      (item): item is { product: FeedCatalogProduct; lengthMeters: number } =>
        Boolean(item.lengthMeters && item.lengthMeters > 0)
    )
    .sort((a, b) => a.lengthMeters - b.lengthMeters || a.product.priceRub - b.product.priceRub);
}

function getTrackProfileGoodsCost(
  system: "COLIBRI_220" | "CLARUS_48" | "TRACK_220",
  targetMeters: number
) {
  if (targetMeters <= 0) return 0;

  const variants = getProfileProductsBySystem(system);
  if (!variants.length) return 0;

  let bestCost = Number.POSITIVE_INFINITY;
  let bestMeters = Number.POSITIVE_INFINITY;

  const target = Math.ceil(targetMeters);
  const maxQty = Math.max(6, target + 2);

  const search = (index: number, totalMeters: number, totalCost: number) => {
    if (totalMeters >= targetMeters) {
      if (totalCost < bestCost || (totalCost === bestCost && totalMeters < bestMeters)) {
        bestCost = totalCost;
        bestMeters = totalMeters;
      }
      return;
    }

    if (index >= variants.length) return;

    const current = variants[index];
    for (let qty = 0; qty <= maxQty; qty += 1) {
      const nextMeters = totalMeters + current.lengthMeters * qty;
      const nextCost = totalCost + current.product.priceRub * qty;
      if (nextCost > bestCost) continue;
      search(index + 1, nextMeters, nextCost);
    }
  };

  search(0, 0, 0);

  return Number.isFinite(bestCost) ? Math.round(bestCost) : 0;
}

export function buildProofBudgetBreakdown(
  config: HomeCalculatorConfig,
  input: ProofPricingInput
): ProofBudgetBreakdown {
  const ceiling = config.ceilingTypes.find((item) => item.slug === input.ceilingType) ?? config.ceilingTypes[0];

  const baseRub = Math.round(input.area * ceiling.baseRatePerSqm);
  const shadowRub = Math.round((input.shadowMeters ?? 0) * (config.ceilingTypes.find((item) => item.slug === "shadow")?.extraRatePerMeter ?? 0));
  const floatingRub = Math.round((input.floatingMeters ?? 0) * (config.ceilingTypes.find((item) => item.slug === "floating")?.extraRatePerMeter ?? 0));
  const lightLinesRub = Math.round((input.lightLineMeters ?? 0) * config.lightLines.ratePerMeter);
  const corniceRate = config.cornices.find((item) => item.slug === (input.corniceType ?? "none"))?.ratePerMeter ?? 0;
  const corniceRub = Math.round((input.corniceMeters ?? 0) * corniceRate);
  const trackInstallRate = config.tracks.find((item) => item.slug === (input.trackInstallType ?? "none"))?.ratePerMeter ?? 0;
  const trackInstallRub = Math.round((input.trackInstallMeters ?? 0) * trackInstallRate);
  const lightsInstallRub = Math.round((input.lightsInstallQty ?? 0) * config.lights.ratePerUnit);

  const ceilingWorksRub =
    baseRub + shadowRub + floatingRub + lightLinesRub + corniceRub + trackInstallRub + lightsInstallRub;

  const trackProfileGoodsRub =
    input.lightingTrackProfileSystem && input.lightingTrackProfileMeters
      ? getTrackProfileGoodsCost(input.lightingTrackProfileSystem, input.lightingTrackProfileMeters)
      : 0;

  const fixturesRub = (input.lightingFixtures ?? []).reduce((sum, fixture) => {
    const product = getCatalogProductByVendorCode(fixture.vendorCode);
    if (!product) return sum;
    return sum + product.priceRub * fixture.qty;
  }, 0);

  const lightingRawRub = Math.round(trackProfileGoodsRub + fixturesRub);
  const lightingDiscountedRub = Math.round(lightingRawRub * 0.75);
  const customCharges = input.customCharges ?? [];
  const customChargesRub = customCharges.reduce((sum, item) => sum + Math.round(item.amountRub), 0);

  return {
    ceilingWorksRub,
    lightingRawRub,
    lightingDiscountPercent: 25,
    lightingDiscountedRub,
    customCharges: customCharges.map((item) => ({
      label: item.label,
      amountRub: Math.round(item.amountRub),
    })),
    totalRub: Math.round(ceilingWorksRub + lightingDiscountedRub + customChargesRub),
  };
}

export function toProofPriceLabel(budget: ProofBudgetBreakdown) {
  return formatPriceLabel(budget.totalRub);
}
