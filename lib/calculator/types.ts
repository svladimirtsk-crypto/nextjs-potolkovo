/**
 * T-022 · Единый снапшот лида `LeadSnapshotV2`.
 *
 * Один объект, который уходит в `/api/lead` (T-027), в Telegram и в БД.
 * Собирается из состояния движка Шага 0 и корзины освещения Шага 1 —
 * без пересчёта цен: суммы приходят уже посчитанными.
 */
import type { CalculatorLeadSnapshot, CalculatorRoomBreakdown } from "@/lib/calculator/snapshot-types";
import { scenarioFromRooms } from "@/lib/calculator/room-features";
import type { LightingDiscountMode, LightingSnapshot, SolutionScenario } from "@/lib/calculator-modal-types";
import { buildLedIntakeReview, ceilingAfterLedReplacement, type LedIntakeReview } from "@/lib/lighting/led-commercial";

export type CalculationScope = "room" | "object";

export type LeadEntryMode = "ceiling-first" | "lighting-first" | "direct";

/** Полный состав одного помещения: все длины, количества и сумма. */
export type LeadRoomSnapshot = CalculatorRoomBreakdown;

/** Блок освещения в лиде — позиции корзины и режим скидки. */
export type LightingLeadBlock = {
  mode: string;
  /** Version and acceptance reported by the client, NOT supplier approval. */
  catalogVersion?: string;
  catalogReview?: LightingSnapshot["catalogReview"];
  ledPsuAssignments?: LightingSnapshot["ledPsuAssignments"];
  ledPlanning?: LightingSnapshot["ledPlanning"];
  items: Array<{
    sku: string;
    vendorCode?: string;
    offerId?: string;
    packQty?: number | null;
    moscowStock?: number | null;
    stockObservedAt?: string | null;
    /** State is overwritten by server recalculation before storage. */
    availabilityState?: "unknown" | "reported_zero" | "reported_positive" | "supplier_unavailable";
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
  /** LED-21 · Сколько включённой ставки за БП заменено явным SKU до минимума. */
  ledPsuReplacementRub?: number;
  /** LED-21 · Раздельная сверка: исходное включение, оборудование по каталогу
   * до скидки и фактическая дельта потолка после повторного минимума. */
  ledIncludedRub?: number;
  ledEquipmentExtraRub?: number;
  ledCeilingDeltaRub?: number;
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
  /** LED-22/23 · preliminary room/BOM/questions; server overwrites client claim. */
  ledReview?: LedIntakeReview;
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
      ...(item.offerId ? { offerId: item.offerId } : {}),
      ...(item.packQty != null ? { packQty: item.packQty } : {}),
      ...(item.moscowStock != null ? { moscowStock: item.moscowStock } : {}),
      ...(item.stockObservedAt ? { stockObservedAt: item.stockObservedAt } : {}),
      ...(item.system ? { system: item.system } : {}),
      ...(item.kind ? { kind: item.kind } : {}),
      ...(item.unit ? { unit: item.unit } : {}),
      ...(item.auto ? { auto: true } : {}),
    };
  });
  if (items.length === 0 && num(lighting.totalRub) <= 0 && !(lighting.ledPlanning?.length)) return null;

  return {
    mode: String(lighting.mode ?? "none"),
    ...(lighting.catalogVersion ? { catalogVersion: lighting.catalogVersion } : {}),
    ...(lighting.catalogReview ? { catalogReview: lighting.catalogReview } : {}),
    ...(lighting.ledPsuAssignments?.length ? { ledPsuAssignments: lighting.ledPsuAssignments.map((a) => ({ ...a })) } : {}),
    ...(lighting.ledPlanning?.length ? { ledPlanning: lighting.ledPlanning.map((a) => ({ ...a })) } : {}),
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
  const ledReview = buildLedIntakeReview({ rooms, lighting: lightingBlock });

  const regular = lightingRegularTotal || lightingBlock?.regularTotalRub || 0;
  const effective = lightingEffectiveTotal || lightingBlock?.effectiveTotalRub || 0;
  const discountPct = num(snapshot?.lightingDiscountPercentApplied) || num(lightingBlock?.discountPercentApplied);
  const ceilingBefore = num(snapshot?.total);
  const ceilingRawBefore = snapshot?.totalRawRub ??
    (rooms.length ? rooms.reduce((sum, room) => sum + num(room.totalRub), 0) : ceilingBefore);
  const included = ledReview?.replacedCeilingRub ?? 0;
  const adjustedCeiling = included ? ceilingAfterLedReplacement(ceilingRawBefore, included) : null;
  const ceilingDelta = adjustedCeiling ? Math.min(0, adjustedCeiling.applied - ceilingBefore) : 0;

  return {
    version: 2,
    /* UX-R2: уровня-экрана нет, но поле остаётся обязательным — описываем фактические решения комнат. */
    scenario: scenarioFromRooms(rooms, snapshot?.solutionScenario) as SolutionScenario,
    scope: (snapshot?.calculationScope ?? "room") as CalculationScope,
    rooms,
    lighting: lightingBlock,
    ...(ledReview ? { ledReview } : {}),
    totals: {
      ceilingRaw: Math.max(0, ceilingRawBefore - included),
      ...(included ? { ledPsuReplacementRub: included } : {}),
      ...(ledReview ? { ledIncludedRub: included,
        ledEquipmentExtraRub: ledReview.bom.reduce((sum, item) => sum + item.qty * item.priceRub, 0),
        ledCeilingDeltaRub: ceilingDelta } : {}),
      minimumApplied: adjustedCeiling?.minimumApplied ?? Boolean(snapshot?.minimumOrderApplied),
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
