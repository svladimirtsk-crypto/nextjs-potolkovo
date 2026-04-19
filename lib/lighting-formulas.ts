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

/**
 * Совместимость со старым API.
 * UI в Step1 не должен использовать это для автоподбора трековых голов.
 */
export function calcRecommendedTrackSpots(
  trackLengthMeters: number,
  _trackMountType?: "built-in" | "surface" | "none"
): number {
  if (!Number.isFinite(trackLengthMeters) || trackLengthMeters <= 0) return 0;
  return Math.max(1, Math.ceil(trackLengthMeters * 2));
}

function isAccessorySku(sku: string): boolean {
  const s = sku.toLowerCase();
  return (
    s.includes("-lamp-") ||
    s.includes("-module-") ||
    s.includes("-profile-") ||
    s.includes("-psu-")
  );
}

/**
 * Только точечные КОРПУСА/панели как монтажные работы.
 * Лампы/модули/профили/БП исключены через isAccessorySku.
 */
export function isPointFixtureSku(sku: string): boolean {
  const s = sku.toLowerCase();
  if (isAccessorySku(s)) return false;

  return (
    s.startsWith("gx53-") ||
    s.startsWith("mr16-") ||
    s.startsWith("panels-loft")
  );
}

/**
 * Трековые головы (не используются в reconcile).
 */
export function isTrackFixtureSku(sku: string): boolean {
  const s = sku.toLowerCase();
  if (isAccessorySku(s)) return false;

  return s.startsWith("colibri-") || s.startsWith("clarus-") || s.startsWith("art-");
}

/**
 * Внешний API сохранён.
 * requiredLightsCount считается только по точечным корпусам/панелям.
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

  const pointFixturesCount = items.reduce((sum, item) => {
    return isPointFixtureSku(item.sku) ? sum + item.qty : sum;
  }, 0);

  const trackFixturesCount = items.reduce((sum, item) => {
    return isTrackFixtureSku(item.sku) ? sum + item.qty : sum;
  }, 0);

  return {
    requiredLightsCount: pointFixturesCount > 0 ? pointFixturesCount : null,
    pointFixturesCount,
    trackFixturesCount,
  };
}
