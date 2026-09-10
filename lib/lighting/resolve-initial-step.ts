/**
 * T-010 · Пересчёт стартового экрана Шага 1.
 * Чистая функция — единственное место, где решается, с чего начинать подбор света.
 */
export type WizardStep =
  | "system"
  | "trackProfile"
  | "trackFixtures"
  | "points"
  | "lamps"
  // T-043: экраны включаются ответами Шага 0, идут после точечных.
  | "chandeliers"
  | "corniceLighting"
  | "done"
  | "none";

export type ResolveInitialStepInput = {
  requiredTrackMeters: number;
  requiredPointQty: number;
  cart: {
    hasTrackProfile: boolean;
    hasTrackFixture: boolean;
    hasPoints: boolean;
    hasMissingLamps: boolean;
    isEmpty: boolean;
  };
};

export function resolveInitialLightingStep({
  requiredTrackMeters,
  requiredPointQty,
  cart,
}: ResolveInitialStepInput): WizardStep {
  const meters = Number.isFinite(requiredTrackMeters) ? Math.max(0, requiredTrackMeters) : 0;
  const points = Number.isFinite(requiredPointQty) ? Math.max(0, requiredPointQty) : 0;

  if (!cart.isEmpty) {
    if (cart.hasMissingLamps) return "lamps";
    if (points > 0 && !cart.hasPoints) return "points";
    if (cart.hasTrackProfile && !cart.hasTrackFixture) return "trackFixtures";
    return "done";
  }

  // Корзина пуста — идём от данных Шага 0
  if (meters > 0) return cart.hasTrackProfile ? "trackProfile" : "system";
  if (points > 0) return "points";
  return "none";
}
