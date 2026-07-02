import type {
  CatalogViewMode,
  LightingDiscountMode,
  SolutionScenario,
  WizardStep,
} from "@/lib/calculator-modal-types";

export type CalculatorEntryMode = "default" | "lighting-first";

export const STEP0_CONFIRM_LABELS = {
  area: "Подтвердить площадь →",
  ceiling: "Подтвердить тип →",
  shadowProfile: "Подтвердить профиль →",
  floatingProfile: "Подтвердить профиль →",
  lightLines: "Подтвердить линии →",
  cornice: "Подтвердить карниз →",
  track: "Подтвердить трек →",
  chandeliers: "Подтвердить люстры →",
  lights: "Подтвердить точки →",
} as const;

export type Step0ConfirmStepId = keyof typeof STEP0_CONFIRM_LABELS;

export function resolveStep0ConfirmLabel(step: Step0ConfirmStepId): string {
  return STEP0_CONFIRM_LABELS[step];
}

export type Step0SummaryAction = {
  label: string;
  destination: WizardStep;
};

export type Step0SummaryActions = {
  primary: Step0SummaryAction;
  secondary: Step0SummaryAction | null;
};

export type ResolveStep0SummaryActionsInput = {
  scenario: SolutionScenario | undefined;
  hasLighting: boolean;
};

/**
 * Единая таблица решений для финального экрана Step 0.
 *
 * Важно: наличие уже выбранного света НЕ должно автоматически отправлять
 * пользователя обратно в Step 1 для standard/advanced. На сводке основной
 * CTA остаётся бизнес-целевым, а проверка света — вторичным действием.
 */
export function resolveStep0SummaryActions({
  scenario,
  hasLighting,
}: ResolveStep0SummaryActionsInput): Step0SummaryActions {
  switch (scenario) {
    case "modern":
      return {
        primary: {
          // «−25%» в label: лид сразу видит, что переход к подбору света в
          // каталоге даёт скидку при заказе потолка, а не «услугу установки».
          label: hasLighting ? "Проверить освещение →" : "Подобрать свет −25% →",
          destination: 1,
        },
        secondary: hasLighting
          ? { label: "К итогу →", destination: 2 }
          : null,
      };

    case "advanced":
      return {
        primary: { label: "Связаться и обсудить →", destination: 2 },
        secondary: {
          // «Подобрать свет −25%» вместо «Подобрать свет»: кнопка ведёт в каталог
          // освещения, где к заказу потолка действует скидка. Лид должен понимать,
          // что это подбор/покупка со скидкой, а не услуга «установка света».
          label: hasLighting ? "Проверить свет →" : "Подобрать свет −25% →",
          destination: 1,
        },
      };

    case "standard":
    default:
      return {
        primary: { label: "К итогу →", destination: 2 },
        secondary: {
          // Раньше было «Добавить свет →» — звучало как «добавить установку
          // освещения». Новый label честно говорит: переход к подбору света
          // в каталоге со скидкой −25% при заказе потолка.
          label: hasLighting ? "Проверить свет →" : "Подобрать свет −25% →",
          destination: 1,
        },
      };
  }
}

export type ResolveLightingDiscountModeInput = {
  hasLighting: boolean;
  regularTotal: number;
  discountEligibleWithCeiling: boolean;
  entryMode: CalculatorEntryMode | undefined;
};

/** Единая таблица решений для режима скидки на освещение. */
export function resolveLightingDiscountMode({
  hasLighting,
  regularTotal,
  discountEligibleWithCeiling,
  entryMode,
}: ResolveLightingDiscountModeInput): LightingDiscountMode {
  if (!hasLighting || regularTotal <= 0) return "none";
  if (discountEligibleWithCeiling) return "with-ceiling";
  if (entryMode === "lighting-first") return "lighting-only";
  return "none";
}

export type ResolveInitialModalOptionsInput = {
  entryMode: CalculatorEntryMode | undefined;
  initialStep: WizardStep | undefined;
  initialLightingTab: "recommendations" | "catalog" | undefined;
  initialLightingView: CatalogViewMode | undefined;
};

export function resolveInitialWizardStep({
  entryMode,
  initialStep,
}: Pick<ResolveInitialModalOptionsInput, "entryMode" | "initialStep">): WizardStep {
  return initialStep ?? (entryMode === "lighting-first" ? 1 : 0);
}

export function resolveInitialLightingTab({
  entryMode,
  initialLightingTab,
}: Pick<ResolveInitialModalOptionsInput, "entryMode" | "initialLightingTab">) {
  return initialLightingTab ?? (entryMode === "lighting-first" ? "catalog" : undefined);
}

export function resolveInitialLightingView({
  entryMode,
  initialLightingView,
}: Pick<ResolveInitialModalOptionsInput, "entryMode" | "initialLightingView">): CatalogViewMode | undefined {
  return initialLightingView ?? (entryMode === "lighting-first" ? "browse" : undefined);
}
