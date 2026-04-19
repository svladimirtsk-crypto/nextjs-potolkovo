// lib/lighting-formulas.ts
import type { LightingItem } from "@/lib/calculator-modal-types";

export const LIGHTING_DISCOUNT_RATE = 0.15;

export function applyLightingDiscount(totalRub: number): number {
  if (!Number.isFinite(totalRub) || totalRub <= 0) return 0;
  return Math.round(totalRub * (1 - LIGHTING_DISCOUNT_RATE));
}

export function scaleKitItemQty(
  baseQty: number,
  baseSpotsQty: number,
  targetSpotsQty: number
): number {
  if (baseQty <= 0 || baseSpotsQty <= 0 || targetSpotsQty <= 0) return 0;
  return Math.round((baseQty / baseSpotsQty) * targetSpotsQty);
}

export const POINT_FIXTURE_SKU_PATTERNS: readonly RegExp[] = [
  /^gx53/i,
  /^mr16/i,
  /^panels-loft/i,
];

export const TRACK_FIXTURE_SKU_PATTERNS: readonly RegExp[] = [
  /^colibri/i,
  /^clarus/i,
  /^art-/i,
];

function countByPatterns(items: LightingItem[], patterns: readonly RegExp[]): number {
  return items.reduce((sum, item) => {
    const matched = patterns.some((re) => re.test(item.sku));
    return matched ? sum + item.qty : sum;
  }, 0);
}

/**
 * Синхронизация работ в калькуляторе:
 * считаем только точечные светильники (Step0 lightsCount).
 * Трековые товары в reconcile не участвуют.
 */
export function calcRequiredWorksFromLighting(items?: LightingItem[] | null): {
  requiredLightsCount: number | null;
  pointFixturesCount: number;
  trackFixturesCount: number;
} {
  if (!items || items.length === 0) {
    return {
      requiredLightsCount: null,
      pointFixturesCount: 0,
      trackFixturesCount: 0,
    };
  }

  const pointFixturesCount = countByPatterns(items, POINT_FIXTURE_SKU_PATTERNS);
  const trackFixturesCount = countByPatterns(items, TRACK_FIXTURE_SKU_PATTERNS);

  if (pointFixturesCount <= 0) {
    return {
      requiredLightsCount: null,
      pointFixturesCount,
      trackFixturesCount,
    };
  }

  return {
    requiredLightsCount: pointFixturesCount,
    pointFixturesCount,
    trackFixturesCount,
  };
}

/**
 * Оставляем API для совместимости, но UI больше не должен
 * опираться на это значение для автоподбора количества трековых светильников.
 */
export function calcRecommendedTrackSpots(trackLengthMeters: number): number {
  if (!Number.isFinite(trackLengthMeters) || trackLengthMeters <= 0) return 0;
  return Math.max(1, Math.ceil(trackLengthMeters * 2));
}
