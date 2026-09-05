// lib/lighting-formulas.ts

import { pricing } from "@/content/pricing";

// T-020: проценты берутся только из content/pricing.ts
export const LIGHTING_ONLY_DISCOUNT_PERCENT = pricing.lightingDiscount.lightingOnlyPct;
export const LIGHTING_WITH_CEILING_DISCOUNT_PERCENT = pricing.lightingDiscount.withCeilingPct;

export const LIGHTING_ONLY_DISCOUNT_RATE = LIGHTING_ONLY_DISCOUNT_PERCENT / 100;
export const LIGHTING_WITH_CEILING_DISCOUNT_RATE = LIGHTING_WITH_CEILING_DISCOUNT_PERCENT / 100;


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

