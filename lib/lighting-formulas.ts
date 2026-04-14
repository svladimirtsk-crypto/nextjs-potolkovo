export const LIGHTING_FORMULA_CONFIG = {
  /** Среднее кол-во трековых спотов на 1 м.п. трека */
  spotsPerMeterTrack: 2,
  /** Минимальное кол-во спотов на трек */
  minSpotsPerTrack: 2,
  /** Скидка на освещение при заказе потолка (доля) */
  lightingDiscount: 0.15,
} as const;

/**
 * Рассчитывает рекомендованное кол-во трековых спотов.
 * Формулу менять ТОЛЬКО здесь.
 */
export function calcRecommendedSpots(
  trackLengthMeters: number,
  trackMountType: "built-in" | "surface" | "none"
): number {
  if (trackMountType === "none" || trackLengthMeters <= 0) return 0;
  const raw = Math.round(
    trackLengthMeters * LIGHTING_FORMULA_CONFIG.spotsPerMeterTrack
  );
  return Math.max(raw, LIGHTING_FORMULA_CONFIG.minSpotsPerTrack);
}

/** Применяет скидку к сумме */
export function applyLightingDiscount(totalRub: number): number {
  return Math.round(totalRub * (1 - LIGHTING_FORMULA_CONFIG.lightingDiscount));
}
