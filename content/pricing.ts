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
    /** N-002: якорь светопрозрачных потолков (раньше был литералом в services.ts). */
    translucentPerSqm: 4000,
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

/**
 * N-002 · Ценовой якорь страницы услуги — единственный источник «от N ₽».
 *
 * До этого hero и секция цены хранили строковые литералы в `content/services.ts`
 * и разошлись с прайсом: у скрытых карнизов стояло «от 2 000 ₽/м.п.» при
 * фактических 1 000/1 800/4 500, а у световых линий — «/ линия» в hero и
 * «/ метр» в блоке цены. Теперь обе строки считаются отсюда.
 */
export type ServicePriceUnit = "м²" | "м.п." | "линия";

export type ServicePriceAnchor = {
  /** null — цена не выводится числом («по проекту», «по расчёту комплекта»). */
  value: number | null;
  unit: ServicePriceUnit | null;
  /** Готовая строка для UI и JSON-LD. */
  label: string;
  /** Уточнение под якорем, если у услуги несколько вариантов исполнения. */
  note?: string;
};

const SERVICE_PRICE_ANCHORS: Record<string, ServicePriceAnchor> = {
  "tenevoy-profil": {
    value: pricing.ceiling.shadowProfilePerM,
    unit: "м.п.",
    label: formatFrom(pricing.ceiling.shadowProfilePerM, "м.п."),
  },
  "paryashchie-potolki": {
    value: pricing.ceiling.floatingProfilePerM,
    unit: "м.п.",
    label: formatFrom(pricing.ceiling.floatingProfilePerM, "м.п."),
  },
  "svetovye-linii": {
    value: pricing.lightLinesPerM,
    unit: "м.п.",
    label: formatFrom(pricing.lightLinesPerM, "м.п."),
  },
  "trekovoe-osveshchenie": {
    value: pricing.track.builtInPerM,
    unit: "м.п.",
    label: formatFrom(pricing.track.builtInPerM, "м.п."),
    note: `накладной трек — ${formatFrom(pricing.track.surfacePerM, "м.п.")}`,
  },
  "skrytye-karnizy": {
    value: pricing.cornice.surface,
    unit: "м.п.",
    label: formatFrom(pricing.cornice.surface, "м.п."),
    note: `ниша — ${formatFrom(pricing.cornice.hiddenNiche, "м.п.")}, встроенный — ${formatFrom(
      pricing.cornice.builtIn,
      "м.п."
    )}`,
  },
  "prostye-potolki": {
    value: pricing.ceiling.standard,
    unit: "м²",
    label: formatFrom(pricing.ceiling.standard, "м²"),
  },
  "svetoprozrachnye-potolki": {
    value: pricing.ceiling.translucentPerSqm,
    unit: "м²",
    label: formatFrom(pricing.ceiling.translucentPerSqm, "м²"),
  },
  "individualnye-proekty": {
    value: null,
    unit: null,
    label: "по проекту",
  },
  // Цена собирается из комплектов (T-014), единого якоря нет.
  "prodazha-trekovogo-osveshcheniya": {
    value: null,
    unit: null,
    label: "по расчёту комплекта",
  },
};

export function servicePriceAnchor(slug: string): ServicePriceAnchor {
  return SERVICE_PRICE_ANCHORS[slug] ?? { value: null, unit: null, label: "по расчёту" };
}
