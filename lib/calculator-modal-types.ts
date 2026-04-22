import type { ServiceCalculatorPreset } from "@/content/services";

export type LightingMode = "kit" | "catalog" | "none";
export type CatalogViewMode = "selected" | "browse";

export type LightingItem = {
  sku: string;
  name: string;
  qty: number;
  priceRub: number;
};

export type DerivedInputs = {
  pointSpotsQty: number;
  trackMountType: "built-in" | "surface" | "none";
  trackLengthMeters: number;
  recommendedTrackSpotsQty: number;
};

export type LightingSnapshot = {
  mode: LightingMode;
  kitId?: string;
  kitBaseName?: string;
  scaledSpotsQty?: number;
  kitName?: string;
  items?: LightingItem[];
  totalRub?: number;
  discountedTotalRub?: number;
  userCustomizedLighting: boolean;
  derivedInputsSnapshot?: DerivedInputs;
};

export type WizardStep = 0 | 1 | 2;

export type OpenCalculatorOptions = {
  preset?: ServiceCalculatorPreset;
  forcePreset?: boolean;
  initialStep?: WizardStep;
  initialLighting?: LightingSnapshot;
  initialLightingTab?: "recommendations" | "catalog";
  initialLightingView?: CatalogViewMode;
  entryMode?: "default" | "lighting-first";
  source?: string;
};

export type CalculatorModalContextValue = {
  isOpen: boolean;
  currentStep: WizardStep;
  options: OpenCalculatorOptions | null;
  openCalculator: (options?: OpenCalculatorOptions) => void;
  closeCalculator: () => void;
  goToStep: (step: WizardStep) => void;
  lightingDraft: LightingSnapshot | null;
  setLightingDraft: (draft: LightingSnapshot | null) => void;
  ceilingTotal: number;
  lightingDiscountedTotal: number;
  grandTotal: number;
  step0SessionInteracted: boolean;
  markStep0SessionInteracted: () => void;
  step1CatalogView: CatalogViewMode | null;
  setStep1CatalogView: (view: CatalogViewMode | null) => void;
};

export function getKitDisplayName(
  lighting: LightingSnapshot | null | undefined
): string | null {
  if (!lighting) return null;
  if (lighting.mode !== "kit") return null;

  if (lighting.kitBaseName) {
    const qty = lighting.scaledSpotsQty;
    return qty != null ? `${lighting.kitBaseName} · ${qty} шт.` : lighting.kitBaseName;
  }

  return lighting.kitName ?? null;
}
