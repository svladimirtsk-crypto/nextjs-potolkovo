// lib/lighting-formulas.ts

import type { LightingItem } from "@/lib/calculator-modal-types";

// ─── Конфигурация ─────────────────────────────────────────────────────────────

export const LIGHTING_FORMULA_CONFIG = {
  /** Среднее кол-во трековых спотов на 1 м.п. трека */
  spotsPerMeterTrack: 2,
  /** Минимальное кол-во спотов если трек есть */
  minSpotsPerTrack: 2,
  /** Скидка на освещение при заказе потолка */
  lightingDiscount: 0.15,
} as const;

// ─── Базовые формулы ──────────────────────────────────────────────────────────

/**
 * Рассчитывает рекомендованное кол-во трековых спотов.
 */
export function calcRecommendedTrackSpots(
  trackLengthMeters: number,
  trackMountType: "built-in" | "surface" | "none"
): number {
  if (trackMountType === "none" || trackLengthMeters <= 0) return 0;
  const raw = Math.round(
    trackLengthMeters * LIGHTING_FORMULA_CONFIG.spotsPerMeterTrack
  );
  return Math.max(raw, LIGHTING_FORMULA_CONFIG.minSpotsPerTrack);
}

/**
 * Применяет скидку к сумме освещения.
 */
export function applyLightingDiscount(totalRub: number): number {
  return Math.round(
    totalRub * (1 - LIGHTING_FORMULA_CONFIG.lightingDiscount)
  );
}

/**
 * Пересчитывает qty для конкретного sku в items кита
 * под фактическое количество спотов.
 */
export function scaleKitItemQty(
  defaultQty: number,
  defaultSpotsQty: number,
  targetSpotsQty: number
): number {
  if (defaultSpotsQty <= 0 || targetSpotsQty <= 0) return defaultQty;
  return Math.max(
    1,
    Math.round((defaultQty / defaultSpotsQty) * targetSpotsQty)
  );
}

// ─── Reconcile ────────────────────────────────────────────────────────────────

/**
 * SKU, которые являются светильниками (корпуса / головы / споты).
 * Лампы (*-lamp-*), модули (*-module-*), профили (*-profile-*)
 * и блоки питания (*-psu-*) НЕ считаются — они не требуют
 * отдельного монтажного слота в Step 0.
 */
const FIXTURE_SKU_PATTERNS: RegExp[] = [
  // GX53 корпуса
  /^gx53-optima/,
  /^gx53-terra/,
  /^gx53-zoom-/,
  /^gx53-art-/,
  /^gx53-optimalight/,
  // MR16 корпуса
  /^mr16-moon-/,
  /^mr16-skill-/,
  /^mr16-zoom-/,
  // COLIBRI трековые споты (220V)
  /^colibri-london/,
  /^colibri-rio/,
  // CLARUS трековые споты (48V)
  /^clarus-spot/,
  /^clarus-nord/,
  // ART трековые споты (220V)
  /^art-start/,
  /^art-monolit/,
];

function isFixtureSku(sku: string): boolean {
  return FIXTURE_SKU_PATTERNS.some((pattern) => pattern.test(sku));
}

export type ReconcileResult = {
  /**
   * Требуемое кол-во светильников для монтажа.
   * null — если в товарах нет светильников (не нужно трогать Step 0).
   */
  requiredLightsCount: number | null;
};

/**
 * По списку выбранных товаров вычисляет, сколько
 * светильников нужно прописать в работы (Step 0).
 */
export function calcRequiredWorksFromLighting(
  items: readonly LightingItem[] | null | undefined
): ReconcileResult {
  if (!items || items.length === 0) {
    return { requiredLightsCount: null };
  }

  const count = items
    .filter((item) => isFixtureSku(item.sku))
    .reduce((sum, item) => sum + item.qty, 0);

  return {
    requiredLightsCount: count > 0 ? count : null,
  };
}
