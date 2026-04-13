import type { ServiceCalculatorPreset } from "@/content/services";

export type LightingMode = "kit" | "custom" | "none";

export type LightingSnapshot = {
  mode: LightingMode;
  kitId?: string;
  kitName?: string;
  items?: Array<{ sku: string; name: string; qty: number; priceRub: number }>;
  totalRub?: number;
  customNote?: string;
};

export type WizardStep = 0 | 1 | 2;

export type OpenCalculatorOptions = {
  preset?: ServiceCalculatorPreset;
  forcePreset?: boolean;
  initialStep?: WizardStep;
  initialLighting?: LightingSnapshot;
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
};
