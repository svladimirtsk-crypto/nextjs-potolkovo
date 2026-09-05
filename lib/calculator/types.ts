/**
 * T-022 · Единый снапшот лида `LeadSnapshotV2`.
 *
 * Один объект, который уходит в `/api/lead` (T-027), в Telegram и в БД.
 * Собирается из состояния движка Шага 0 и корзины освещения Шага 1 —
 * без пересчёта цен: суммы приходят уже посчитанными.
 */
import type { CalculatorLeadSnapshot, CalculatorRoomBreakdown } from "@/lib/calculator/snapshot-types";
import type { LightingDiscountMode, LightingSnapshot, SolutionScenario } from "@/lib/calculator-modal-types";

export type CalculationScope = "room" | "object";

export type LeadEntryMode = "ceiling-first" | "lighting-first" | "direct";

/** Полный состав одного помещения: все длины, количества и сумма. */
export type LeadRoomSnapshot = CalculatorRoomBreakdown;

/** Блок освещения в лиде — позиции корзины и режим скидки. */
export type LightingLeadBlock = {
  mode: string;
  items: Array<{
    sku: string;
    vendorCode?: string;
    system?: string;
    kind?: string;
    unit?: string;
    auto?: boolean;
    name: string;
    qty: number;
    priceRub: number;
    totalRub: number;
  }>;
  regularTotalRub: number;
  effectiveTotalRub: number;
  discountMode: LightingDiscountMode;
  discountPercentApplied: number;
  discountAmountRub: number;
};

export type LeadTotals = {
  /** Потолок до минимального заказа. */
  ceilingRaw: number;
  /** Сработал минимальный заказ. */
  minimumApplied: boolean;
  /** Досчёт монтажа света (T-008/T-009). */
  installExtra: number;
  lightingRegular: number;
  lightingEffective: number;
  /** Процент скидки, фактически применённый к свету. */
  discountPct: number;
  /** Итог: потолок (с минимумом и монтажом) + свет со скидкой. */
  grand: number;
};

export type LeadSnapshotV2 = {
  /** Версия схемы — чтобы читать старые записи из БД. */
  version: 2;
  scenario: SolutionScenario;
  scope: CalculationScope;
  rooms: LeadRoomSnapshot[];
  lighting: LightingLeadBlock | null;
  totals: LeadTotals;
  /** "<slug>:<placement>" из контекста страницы (T-021). */
  source: string;
  entry: LeadEntryMode;
};

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Освещение из `LightingSnapshot` в компактный блок лида. */
export function buildLightingLeadBlock(
  lighting: LightingSnapshot | null | undefined
): LightingLeadBlock | null {
  if (!lighting) return null;
  const items = (lighting.items ?? []).map((item) => {
    const qty = num(item.qty);
    const priceRub = num(item.priceRub);
    return {
      sku: String(item.sku ?? ""),
      name: String(item.name ?? ""),
      qty,
      priceRub,
      totalRub: qty * priceRub,
      ...(item.vendorCode ? { vendorCode: item.vendorCode } : {}),
      ...(item.system ? { system: item.system } : {}),
      ...(item.kind ? { kind: item.kind } : {}),
      ...(item.unit ? { unit: item.unit } : {}),
      ...(item.auto ? { auto: true } : {}),
    };
  });
  if (items.length === 0 && num(lighting.totalRub) <= 0) return null;

  return {
    mode: String(lighting.mode ?? "none"),
    items,
    regularTotalRub: num(lighting.totalRub),
    effectiveTotalRub: num(lighting.discountedTotalRub) || num(lighting.totalRub),
    discountMode: (lighting.discountMode ?? "none") as LightingDiscountMode,
    discountPercentApplied: num(lighting.discountPercentApplied),
    discountAmountRub: num(lighting.discountAmountRub),
  };
}

export type BuildLeadSnapshotInput = {
  snapshot: CalculatorLeadSnapshot | null | undefined;
  /** Итог потолка с минимальным заказом и монтажом — из селектора контекста. */
  ceilingEffectiveTotal: number;
  lightingRegularTotal: number;
  lightingEffectiveTotal: number;
  source: string;
  entry?: LeadEntryMode;
};

/**
 * Собирает `LeadSnapshotV2`. Никакой арифметики по прайсу здесь нет —
 * только агрегация уже посчитанных значений (правило ТЗ: цены только в `content/pricing.ts`).
 */
export function buildLeadSnapshotV2({
  snapshot,
  ceilingEffectiveTotal,
  lightingRegularTotal,
  lightingEffectiveTotal,
  source,
  entry = "ceiling-first",
}: BuildLeadSnapshotInput): LeadSnapshotV2 {
  const rooms = snapshot?.roomBreakdown ?? [];
  const lightingBlock = buildLightingLeadBlock(snapshot?.lighting);

  const regular = lightingRegularTotal || lightingBlock?.regularTotalRub || 0;
  const effective = lightingEffectiveTotal || lightingBlock?.effectiveTotalRub || 0;
  const discountPct = num(snapshot?.lightingDiscountPercentApplied) || num(lightingBlock?.discountPercentApplied);

  return {
    version: 2,
    scenario: (snapshot?.solutionScenario ?? "standard") as SolutionScenario,
    scope: (snapshot?.calculationScope ?? "room") as CalculationScope,
    rooms,
    lighting: lightingBlock,
    totals: {
      ceilingRaw: num(snapshot?.totalRawRub) || num(snapshot?.total),
      minimumApplied: Boolean(snapshot?.minimumOrderApplied),
      installExtra: num(snapshot?.extraInstallRub),
      lightingRegular: regular,
      lightingEffective: effective,
      discountPct,
      grand: num(ceilingEffectiveTotal) + effective,
    },
    source: String(source ?? ""),
    entry,
  };
}
