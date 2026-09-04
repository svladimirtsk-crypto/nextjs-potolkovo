/**
 * T-020 · Единый прайс проекта ПОТОЛКОВО.
 *
 * ЕДИНСТВЕННЫЙ источник цен и процентов. Значения перенесены из
 * `content/homepage.ts → price.calculator` без изменений.
 * Менять цены/проценты можно только здесь.
 */
export const pricing = {
  ceiling: {
    standard: 1000,
    shadowBase: 800,
    floatingBase: 800,
    shadowProfilePerM: 950,
    floatingProfilePerM: 2500,
  },
  cornice: {
    builtIn: 4500,
    hiddenNiche: 1800,
    surface: 1000,
  },
  lightLinesPerM: 3500,
  track: {
    builtInPerM: 2500,
    surfacePerM: 1500,
  },
  spotInstall: 750,
  chandelierInstall: 1000,
  corniceLighting: {
    perM: 1500,
    psu: 1500,
  },
  minimumOrderRub: 18000,
  lightingDiscount: {
    withCeilingPct: 25,
    lightingOnlyPct: 10,
  },
  trackSpotsPerMeter: 1,
  defaults: {
    roomArea: 18,
    objectArea: 60,
  },
} as const;

export type Pricing = typeof pricing;

const nf = new Intl.NumberFormat("ru-RU");

export function formatRub(value: number): string {
  return `${nf.format(Math.round(value))} ₽`;
}

/** «от 950 ₽ / м.п.» */
export function formatFrom(value: number, unit?: "м²" | "м.п." | "шт." | "компл."): string {
  return unit ? `от ${formatRub(value)} / ${unit}` : `от ${formatRub(value)}`;
}

/** Применить минимальный заказ. */
export function applyMinimumOrder(rawRub: number): {
  raw: number;
  applied: number;
  minimumApplied: boolean;
} {
  const raw = Number.isFinite(rawRub) && rawRub > 0 ? Math.round(rawRub) : 0;
  if (raw <= 0) return { raw: 0, applied: 0, minimumApplied: false };
  const applied = Math.max(raw, pricing.minimumOrderRub);
  return { raw, applied, minimumApplied: applied > raw };
}

/** Скидка на свет, % */
export function lightingDiscountPercent(mode: "with-ceiling" | "lighting-only" | "none"): number {
  if (mode === "with-ceiling") return pricing.lightingDiscount.withCeilingPct;
  if (mode === "lighting-only") return pricing.lightingDiscount.lightingOnlyPct;
  return 0;
}

export const MINIMUM_ORDER_COPY =
  "Минимальный заказ — 18 000 ₽: в него входит выезд, замер и монтаж до 18 м².";
