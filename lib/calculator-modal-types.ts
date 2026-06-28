import type { ServiceCalculatorPreset } from "@/content/services";

export type LightingMode = "kit" | "catalog" | "none";
export type CatalogViewMode = "selected" | "browse";
export type LightingDiscountMode = "none" | "lighting-only" | "with-ceiling";
export type SolutionScenario = "standard" | "modern" | "advanced";

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
  /** Effective discounted total for the current order mode. */
  discountedTotalRub?: number;
  standaloneDiscountedTotalRub?: number;
  withCeilingDiscountedTotalRub?: number;
  discountMode?: LightingDiscountMode;
  discountPercentApplied?: number;
  discountAmountRub?: number;

  userCustomizedLighting: boolean;
  derivedInputsSnapshot?: DerivedInputs;
};

export type WizardStep = 0 | 1 | 2;

export type CalculatorFooterAction = {
  label: string;
  disabled?: boolean;
  onClick: () => void;
};

export type CalculatorFooterBackAction = {
  visible: boolean;
  onClick?: () => void;
};

export type Step1FooterAction = {
  label: string;
  disabled?: boolean;
  onClick: () => void;
};

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

  /** snapshot.total (потолок, как посчитал Step0)
   *  В lighting-first может быть не показан в UI (см. showCeilingInUi), но в snapshot он может существовать. */
  ceilingTotal: number;

  /** Свет без скидки (по корзине/lightingDraft). */
  lightingRegularTotal: number;

  /** Свет со скидкой с потолком (−25%), независимо от eligibility (число “если бы применили”). */
  lightingDiscountedTotal: number;

  /** Свет со скидкой −10% для покупки только освещения. */
  lightingStandaloneTotal: number;

  /** Свет со скидкой −25% при заказе потолка. */
  lightingWithCeilingTotal: number;

  /** Свет, который показываем как “к оплате сейчас” */
  lightingEffectiveTotal: number;

  lightingDiscountMode: LightingDiscountMode;
  lightingDiscountPercentApplied: number;
  lightingDiscountAmount: number;

  /** Скидка на свет: “разрешена”, когда пользователь подтвердил потолок и перешёл 0 -> 1. */
  lightingDiscountEligible: boolean;

  /** Нужно ли показывать потолок в UI */
  showCeilingInUi: boolean;

  /** Единая итоговая цифра для UI */
  grandTotal: number;

  step0SessionInteracted: boolean;
  markStep0SessionInteracted: () => void;

  /** СТРОГОЕ правило: досчёт монтажа в Step3 делаем только если Step0 был подтверждён (0->1). */
  step0AreaConfirmed: boolean;

  /** Квиз-флоу: прогресс Step 0 (X из Y шагов). null если compactSections=false или модалка не на Step 0. */
  step0Progress: { done: number; total: number } | null;
  setStep0Progress: (progress: { done: number; total: number } | null) => void;

  /** Квиз-флоу: достигнута ли сводка (все шаги подтверждены). Используется для смены title и dots-индикатора. */
  isStep0SummaryReady: boolean;
  setIsStep0SummaryReady: (ready: boolean) => void;

  step1CatalogView: CatalogViewMode | null;
  setStep1CatalogView: (view: CatalogViewMode | null) => void;

  step0FooterAction: CalculatorFooterAction | null;
  setStep0FooterAction: (action: CalculatorFooterAction | null) => void;

  step0BackAction: CalculatorFooterBackAction;
  setStep0BackAction: (action: CalculatorFooterBackAction) => void;

  step1FooterAction: Step1FooterAction | null;
  setStep1FooterAction: (action: Step1FooterAction | null) => void;
};

export function getKitDisplayName(
  lighting: LightingSnapshot | null | undefined
): string | null {
  if (!lighting) return null;

  // ВАЖНО: kits сейчас приходят как mode:"catalog", но с kitBaseName.
  // Поэтому kitBaseName — это наш "источник истины" для отображения имени комплекта.
  if (lighting.kitBaseName) {
    const qty = lighting.scaledSpotsQty;
    return qty != null ? `${lighting.kitBaseName} · ${qty} шт.` : lighting.kitBaseName;
  }

  if (lighting.mode === "kit") return lighting.kitName ?? null;
  return null;
}
