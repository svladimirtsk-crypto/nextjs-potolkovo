import {
  LIGHTING_ONLY_DISCOUNT_PERCENT,
  LIGHTING_WITH_CEILING_DISCOUNT_PERCENT,
  applyLightingOnlyDiscount,
  applyLightingWithCeilingDiscount,
  calcLightingDiscountAmount,
} from "@/lib/lighting-formulas";
import { resolveLightingDiscountMode } from "@/lib/calculator-flow";
import type {
  CalculatorEntryMode,
  LightingDiscountMode,
  LightingSnapshot,
} from "@/lib/calculator-modal-types";
import type { CalculatorLeadSnapshot } from "@/lib/calculator/snapshot-types";

/**
 * N-050 · Денежная часть калькулятора.
 *
 * Все суммы, которые видит клиент, считались десятком `useMemo` внутри
 * `calculator-modal-context.tsx`. Из-за этого цену нельзя было проверить, не
 * смонтировав провайдер, а сам контекст отвечал сразу и за состояние модалки,
 * и за деньги.
 *
 * Здесь только чистые функции: на входе черновик света и снапшот потолка, на
 * выходе — итоговые суммы. Ставки и проценты по-прежнему приходят из
 * `content/pricing.ts` через `lib/lighting-formulas`; собственных числовых
 * литералов тут нет (инвариант N-002).
 */

export function toNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** Сумма позиций света до скидки. */
export function calcLightingRegularTotal(draft: LightingSnapshot | null): number {
  if (!draft) return 0;
  if (Number.isFinite(draft.totalRub)) return toNumber(draft.totalRub);

  const items = draft.mode === "catalog" ? (draft.items ?? []) : [];
  return items.reduce((sum, it) => sum + toNumber(it.qty) * toNumber(it.priceRub), 0);
}

/** Есть ли в черновике позиции, за которые вообще можно взять деньги. */
function hasBillableLighting(draft: LightingSnapshot | null, regularTotal: number): boolean {
  return Boolean(
    draft && draft.mode !== "none" && ((draft.items?.length ?? 0) > 0 || regularTotal > 0)
  );
}

export type LightingTotalsInput = {
  lightingDraft: LightingSnapshot | null;
  /** Потолок в этой же сессии — открывает скидку −25 % вместо −10 %. */
  discountEligibleWithCeiling: boolean;
  entryMode: CalculatorEntryMode | undefined;
};

export type LightingTotals = {
  regularTotal: number;
  standaloneTotal: number;
  withCeilingTotal: number;
  effectiveTotal: number;
  discountMode: LightingDiscountMode;
  discountPercentApplied: number;
  discountAmount: number;
};

export function calcLightingTotals(input: LightingTotalsInput): LightingTotals {
  const { lightingDraft, discountEligibleWithCeiling, entryMode } = input;

  const regularTotal = calcLightingRegularTotal(lightingDraft);
  const hasLighting = hasBillableLighting(lightingDraft, regularTotal);

  const standaloneTotal =
    lightingDraft && regularTotal > 0 ? applyLightingOnlyDiscount(regularTotal) : 0;
  const withCeilingTotal =
    lightingDraft && regularTotal > 0 ? applyLightingWithCeilingDiscount(regularTotal) : 0;

  const discountMode = resolveLightingDiscountMode({
    hasLighting,
    regularTotal,
    discountEligibleWithCeiling,
    entryMode,
  });

  const effectiveTotal =
    discountMode === "with-ceiling"
      ? withCeilingTotal
      : discountMode === "lighting-only"
        ? standaloneTotal
        : regularTotal;

  const discountPercentApplied =
    discountMode === "with-ceiling"
      ? LIGHTING_WITH_CEILING_DISCOUNT_PERCENT
      : discountMode === "lighting-only"
        ? LIGHTING_ONLY_DISCOUNT_PERCENT
        : 0;

  return {
    regularTotal,
    standaloneTotal,
    withCeilingTotal,
    effectiveTotal,
    discountMode,
    discountPercentApplied,
    discountAmount: calcLightingDiscountAmount(regularTotal, effectiveTotal),
  };
}

/**
 * Во входе «сначала свет» потолка в интерфейсе ещё нет: показывать нулевую
 * строку «Потолок» до того, как клиент вообще заговорил о потолке, — значит
 * пугать пустой сметой.
 */
export function shouldShowCeiling(input: {
  entryMode: CalculatorEntryMode | undefined;
  currentStep: number;
  step0SessionInteracted: boolean;
}): boolean {
  if (input.entryMode !== "lighting-first") return true;
  return input.currentStep === 0 || input.step0SessionInteracted;
}

/**
 * Потолок с досчётом монтажа. Досчёт добавляем только после подтверждения
 * Шага 0: до этого площадь — предположение, и завышать смету нельзя.
 */
export function calcCeilingEffectiveTotal(input: {
  snapshot: CalculatorLeadSnapshot | null | undefined;
  showCeilingInUi: boolean;
  step0AreaConfirmed: boolean;
}): number {
  if (!input.showCeilingInUi) return 0;

  const total = toNumber(input.snapshot?.total);
  if (!input.step0AreaConfirmed) return total;

  // T-008: досчёт монтажа берём из явного поля, а не из устаревшего grandTotal.
  const extraInstall = toNumber(input.snapshot?.extraInstallRub);
  return total + Math.max(0, extraInstall);
}

/** Снапшот потолка пригоден к показу только с положительной площадью. */
export function isCeilingSnapshotReady(
  snapshot: CalculatorLeadSnapshot | null | undefined
): boolean {
  if (!snapshot) return false;
  const area = Number(snapshot.area);
  const total = Number(snapshot.total);
  if (!Number.isFinite(area) || area <= 0) return false;
  if (!Number.isFinite(total) || total < 0) return false;
  return true;
}

/**
 * N-050 · Потолок в заявке.
 *
 * Клиент, выбравший «Только оборудование −10 %», потолок не заказывал. Но в
 * сторе к этому моменту уже лежит комната по умолчанию (её создаёт движок при
 * монтировании), и её сумма — с поднятием до минимального заказа — попадала в
 * заявку: набор света на 2 772 ₽ превращался в счёт на 20 772 ₽.
 *
 * Признак «потолка нет» — режим скидки `lighting-only`: он выставляется именно
 * тогда, когда клиент явно отказался от потолка.
 */
export function calcLeadCeilingTotal(input: {
  snapshot: CalculatorLeadSnapshot | null | undefined;
}): number {
  const { snapshot } = input;
  if (!snapshot) return 0;

  const discountMode = snapshot.lightingDiscountMode ?? snapshot.lighting?.discountMode;
  if (discountMode === "lighting-only") return 0;

  return toNumber(snapshot.total) + Math.max(0, toNumber(snapshot.extraInstallRub));
}
