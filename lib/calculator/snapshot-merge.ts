import type { LightingDiscountMode, LightingSnapshot } from "@/lib/calculator-modal-types";
import type { CalculatorLeadSnapshot } from "@/lib/calculator/snapshot-types";

/**
 * N-050 · Слияние производных блоков в снапшот заявки.
 *
 * Оба слияния — освещение и досчёт монтажа — раньше жили внутри
 * `useEffect(() => setSnapshot(prev => …))`. Это запрещённая ТЗ v2 (п. 0.7)
 * синхронизация состояния через эффект: снапшот получал данные с задержкой в
 * один кадр, а условие «ничего не изменилось» было размазано по телу эффекта.
 *
 * Здесь обе операции описаны как чистые функции вида
 * `(prev, input) => next | prev`. Возврат ровно того же объекта означает
 * «изменений нет» — React пропускает такой `setState`, и лишнего рендера не
 * происходит. Логику теперь можно проверить тестами без монтирования дерева.
 */

export type LightingMergeInput = {
  lightingDraft: LightingSnapshot | null | undefined;
  regularTotal: number;
  effectiveTotal: number;
  standaloneTotal: number;
  withCeilingTotal: number;
  discountMode: LightingDiscountMode;
  discountPercentApplied: number;
  discountAmount: number;
  /** Источник лида, если снапшот создаётся с нуля (вход «сначала свет»). */
  source: string;
  /** Заготовка пустого снапшота — её создаёт вызывающая сторона. */
  createEmpty: () => CalculatorLeadSnapshot;
};

/** Есть ли в черновике реальные позиции освещения. */
export function hasLightingItems(draft: LightingSnapshot | null | undefined): boolean {
  return Boolean(draft && draft.mode !== "none" && (draft.items?.length ?? 0) > 0);
}

export function mergeLightingIntoSnapshot(
  prev: CalculatorLeadSnapshot | null,
  input: LightingMergeInput
): CalculatorLeadSnapshot | null {
  const hasLighting = hasLightingItems(input.lightingDraft);

  // Ни потолка, ни света — создавать снапшот не из чего.
  if (!prev && !hasLighting) return prev;

  const base = prev ?? input.createEmpty();

  const lighting =
    hasLighting && input.lightingDraft
      ? {
          ...input.lightingDraft,
          totalRub: input.regularTotal,
          discountedTotalRub: input.effectiveTotal,
          standaloneDiscountedTotalRub: input.standaloneTotal,
          withCeilingDiscountedTotalRub: input.withCeilingTotal,
          discountMode: input.discountMode,
          discountPercentApplied: input.discountPercentApplied,
          discountAmountRub: input.discountAmount,
        }
      : undefined;

  return {
    ...base,
    leadSource: base.leadSource ?? input.source,
    lighting,
    lightingDiscountApplied: input.discountMode !== "none",
    lightingDiscountPercentApplied: input.discountPercentApplied,
    lightingDiscountMode: input.discountMode,
    lightingDiscountAmountRub: input.discountAmount,
  };
}

export type InstallMergeInput = {
  extraInstallTotal: number;
  extraInstallLines: string[];
};

/**
 * T-008/T-009 · Досчёт монтажа света поверх снапшота потолка.
 *
 * Возвращает `prev` без изменений, если сумма совпадает с точностью до
 * полурубля и набор строк тот же: иначе эффект зациклится на собственном
 * результате.
 */
export function mergeInstallExtraIntoSnapshot(
  prev: CalculatorLeadSnapshot | null,
  input: InstallMergeInput
): CalculatorLeadSnapshot | null {
  if (!prev) return prev;

  const prevExtra = Number(prev.extraInstallRub ?? 0);
  const sameAmount = Math.abs(prevExtra - input.extraInstallTotal) < 0.5;
  const sameLines = (prev.extraInstallLines ?? []).join("|") === input.extraInstallLines.join("|");

  if (sameAmount && sameLines) return prev;

  return {
    ...prev,
    // T-008: grandTotal устарел — итог считают селекторы.
    grandTotal: undefined,
    extraInstallRub: input.extraInstallTotal,
    extraInstallLines: input.extraInstallLines,
  };
}
