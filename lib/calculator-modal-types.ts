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

  /**
   * snapshot.total (потолок, как посчитал Step0)
   * В lighting-first может быть не показан в UI (см. showCeilingInUi), но в snapshot он может существовать.
   */
  ceilingTotal: number;

  /** Свет без скидки (по корзине/lightingDraft). */
  lightingRegularTotal: number;

  /** Свет со скидкой (-15%), независимо от eligibility (число “если бы применили”). */
  lightingDiscountedTotal: number;

  /**
   * Свет, который показываем как “к оплате сейчас”:
   * - если скидка разрешена (lightingDiscountEligible) -> discounted
   * - иначе -> regular
   */
  lightingEffectiveTotal: number;

  /**
   * Скидка на свет: “разрешена”, когда пользователь подтвердил потолок и перешёл 0 -> 1.
   * Важно: это НЕ равно step0AreaConfirmed (строгость монтажа).
   */
  lightingDiscountEligible: boolean;

  /**
   * Нужно ли показывать потолок в UI:
   * - в default: всегда true
   * - в lighting-first: только после взаимодействия со Step0 или на самом Step0
   */
  showCeilingInUi: boolean;

  /**
   * Единая итоговая цифра для UI = (потолок, если showCeilingInUi) + (lightingEffectiveTotal)
   * При step0AreaConfirmed потолочная часть берёт snapshot.grandTotal (если она >= snapshot.total).
   */
  grandTotal: number;

  step0SessionInteracted: boolean;
  markStep0SessionInteracted: () => void;

  /**
   * СТРОГОЕ правило: досчёт монтажа в Step3 делаем только если Step0 был подтверждён
   * (в протоколе — пользователь реально перешёл с Step0 на Step1).
   */
  step0AreaConfirmed: boolean;

  step1CatalogView: CatalogViewMode | null;
  setStep1CatalogView: (view: CatalogViewMode | null) => void;
};

export function getKitDisplayName(lighting: LightingSnapshot | null | undefined): string | null {
  if (!lighting) return null;
  if (lighting.mode !== "kit") return null;

  if (lighting.kitBaseName) {
    const qty = lighting.scaledSpotsQty;
    return qty != null ? `${lighting.kitBaseName} · ${qty} шт.` : lighting.kitBaseName;
  }

  return lighting.kitName ?? null;
}
