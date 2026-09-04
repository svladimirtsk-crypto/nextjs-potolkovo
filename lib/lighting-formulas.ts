// lib/lighting-formulas.ts
import type { LightingItem } from "@/lib/calculator-modal-types";

import { pricing } from "@/content/pricing";

// T-020: проценты берутся только из content/pricing.ts
export const LIGHTING_ONLY_DISCOUNT_PERCENT = pricing.lightingDiscount.lightingOnlyPct;
export const LIGHTING_WITH_CEILING_DISCOUNT_PERCENT = pricing.lightingDiscount.withCeilingPct;

export const LIGHTING_ONLY_DISCOUNT_RATE = LIGHTING_ONLY_DISCOUNT_PERCENT / 100;
export const LIGHTING_WITH_CEILING_DISCOUNT_RATE = LIGHTING_WITH_CEILING_DISCOUNT_PERCENT / 100;

// Backward-compatible alias: the main ceiling scenario now uses −25%.
export const LIGHTING_DISCOUNT_RATE = LIGHTING_WITH_CEILING_DISCOUNT_RATE;

export function applyLightingDiscount(totalRub: number, discountRate = LIGHTING_WITH_CEILING_DISCOUNT_RATE): number {
  if (!Number.isFinite(totalRub) || totalRub <= 0) return 0;
  const safeRate = Number.isFinite(discountRate) ? Math.min(1, Math.max(0, discountRate)) : 0;
  return Math.round(totalRub * (1 - safeRate));
}

export function applyLightingOnlyDiscount(totalRub: number): number {
  return applyLightingDiscount(totalRub, LIGHTING_ONLY_DISCOUNT_RATE);
}

export function applyLightingWithCeilingDiscount(totalRub: number): number {
  return applyLightingDiscount(totalRub, LIGHTING_WITH_CEILING_DISCOUNT_RATE);
}

export function calcLightingDiscountAmount(totalRub: number, discountedRub: number): number {
  const total = Number(totalRub ?? 0);
  const discounted = Number(discountedRub ?? 0);
  if (!Number.isFinite(total) || !Number.isFinite(discounted)) return 0;
  return Math.max(0, Math.round(total - discounted));
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
  void _trackMountType;

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
