// lib/calculator-modal-types.ts

import type { ServiceCalculatorPreset } from "@/content/services";

export type LightingMode = "kit" | "catalog" | "none";

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
  /**
   * Базовое имя кита без количества (например "Старт COLIBRI 220V").
   * Итоговое отображаемое имя строится как `${kitBaseName} · ${scaledSpotsQty} шт.`
   */
  kitBaseName?: string;
  /**
   * Фактическое кол-во спотов после масштабирования.
   * Используется для формирования отображаемого имени.
   */
  scaledSpotsQty?: number;
  /**
   * @deprecated Используй kitBaseName + scaledSpotsQty.
   * Оставлено для обратной совместимости со старыми snapshot.
   * Удалить после полной миграции.
   */
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
};
// lib/calculator-modal-types.ts — добавить в конец файла

/**
 * Возвращает отображаемое имя кита с актуальным количеством спотов.
 * Если snapshot создан старым кодом (kitName без kitBaseName) — возвращает kitName как есть.
 */
export function getKitDisplayName(lighting: LightingSnapshot): string | null {
  if (lighting.mode !== "kit") return null;

  // Новый формат: kitBaseName + scaledSpotsQty
  if (lighting.kitBaseName) {
    const qty = lighting.scaledSpotsQty;
    return qty != null
      ? `${lighting.kitBaseName} · ${qty} шт.`
      : lighting.kitBaseName;
  }

  // Старый формат (обратная совместимость)
  return lighting.kitName ?? null;
}
