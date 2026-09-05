import { describe, expect, it } from "vitest";

import {
  calcCeilingEffectiveTotal,
  calcLightingRegularTotal,
  calcLightingTotals,
  isCeilingSnapshotReady,
  shouldShowCeiling,
} from "../lib/calculator/pricing";
import type { LightingSnapshot } from "../lib/calculator-modal-types";
import type { CalculatorLeadSnapshot } from "../lib/calculator/snapshot-types";
import {
  LIGHTING_ONLY_DISCOUNT_PERCENT,
  LIGHTING_WITH_CEILING_DISCOUNT_PERCENT,
} from "../lib/lighting-formulas";

/**
 * N-050 · Суммы, которые видит клиент, считались десятком useMemo внутри
 * провайдера модалки и проверялись только прогоном воронки. Тесты фиксируют
 * скидочные режимы и досчёт монтажа — то, где ошибка стоит денег.
 */

function draft(patch: Partial<LightingSnapshot> = {}): LightingSnapshot {
  return {
    mode: "catalog",
    items: [{ id: "a", qty: 2, priceRub: 300 }],
    ...patch,
  } as LightingSnapshot;
}

describe("N-050 · сумма позиций света", () => {
  it("пустой черновик — ноль", () => {
    expect(calcLightingRegularTotal(null)).toBe(0);
  });

  it("считает по позициям каталога", () => {
    expect(calcLightingRegularTotal(draft())).toBe(600);
  });

  it("готовый totalRub имеет приоритет над позициями", () => {
    expect(calcLightingRegularTotal(draft({ totalRub: 852 }))).toBe(852);
  });

  it("режим none не тарифицируется по позициям", () => {
    expect(calcLightingRegularTotal(draft({ mode: "none" }))).toBe(0);
  });
});

describe("N-050 · скидки на свет", () => {
  const base = { entryMode: "default" as const };

  it("со скидкой на потолок применяется −25 %", () => {
    const t = calcLightingTotals({
      ...base,
      lightingDraft: draft({ totalRub: 852 }),
      discountEligibleWithCeiling: true,
    });
    expect(t.discountMode).toBe("with-ceiling");
    expect(t.discountPercentApplied).toBe(LIGHTING_WITH_CEILING_DISCOUNT_PERCENT);
    expect(t.effectiveTotal).toBe(639);
    expect(t.discountAmount).toBe(852 - 639);
  });

  it("без потолка — режим только оборудования", () => {
    const t = calcLightingTotals({
      ...base,
      lightingDraft: draft({ totalRub: 1000 }),
      discountEligibleWithCeiling: false,
    });
    expect(t.discountPercentApplied).toBe(
      t.discountMode === "lighting-only" ? LIGHTING_ONLY_DISCOUNT_PERCENT : 0
    );
    expect(t.effectiveTotal).toBeLessThanOrEqual(t.regularTotal);
  });

  it("скидка никогда не делает сумму отрицательной или больше исходной", () => {
    const t = calcLightingTotals({
      ...base,
      lightingDraft: draft({ totalRub: 1 }),
      discountEligibleWithCeiling: true,
    });
    expect(t.effectiveTotal).toBeGreaterThanOrEqual(0);
    expect(t.effectiveTotal).toBeLessThanOrEqual(t.regularTotal);
  });

  it("пустой свет — все суммы нулевые и без скидки", () => {
    const t = calcLightingTotals({
      ...base,
      lightingDraft: null,
      discountEligibleWithCeiling: true,
    });
    expect(t).toMatchObject({
      regularTotal: 0,
      effectiveTotal: 0,
      discountAmount: 0,
      discountPercentApplied: 0,
    });
  });
});

describe("N-050 · показ потолка и досчёт монтажа", () => {
  it("обычный вход всегда показывает потолок", () => {
    expect(
      shouldShowCeiling({ entryMode: "default", currentStep: 1, step0SessionInteracted: false })
    ).toBe(true);
  });

  it("вход «сначала свет» прячет потолок, пока клиент им не занялся", () => {
    expect(
      shouldShowCeiling({
        entryMode: "lighting-first",
        currentStep: 1,
        step0SessionInteracted: false,
      })
    ).toBe(false);
  });

  it("но показывает, как только Шаг 0 тронут", () => {
    expect(
      shouldShowCeiling({
        entryMode: "lighting-first",
        currentStep: 1,
        step0SessionInteracted: true,
      })
    ).toBe(true);
  });

  it("скрытый потолок не попадает в сумму", () => {
    expect(
      calcCeilingEffectiveTotal({
        snapshot: { total: 25500 } as CalculatorLeadSnapshot,
        showCeilingInUi: false,
        step0AreaConfirmed: true,
      })
    ).toBe(0);
  });

  it("до подтверждения площади монтаж не досчитывается", () => {
    expect(
      calcCeilingEffectiveTotal({
        snapshot: { total: 25500, extraInstallRub: 5000 } as CalculatorLeadSnapshot,
        showCeilingInUi: true,
        step0AreaConfirmed: false,
      })
    ).toBe(25500);
  });

  it("после подтверждения монтаж прибавляется", () => {
    expect(
      calcCeilingEffectiveTotal({
        snapshot: { total: 25500, extraInstallRub: 5000 } as CalculatorLeadSnapshot,
        showCeilingInUi: true,
        step0AreaConfirmed: true,
      })
    ).toBe(30500);
  });

  it("отрицательный досчёт не уменьшает смету", () => {
    expect(
      calcCeilingEffectiveTotal({
        snapshot: { total: 25500, extraInstallRub: -900 } as CalculatorLeadSnapshot,
        showCeilingInUi: true,
        step0AreaConfirmed: true,
      })
    ).toBe(25500);
  });
});

describe("N-050 · готовность снапшота потолка", () => {
  it("нулевая площадь — не готов", () => {
    expect(isCeilingSnapshotReady({ area: 0, total: 0 } as CalculatorLeadSnapshot)).toBe(false);
  });

  it("положительная площадь — готов", () => {
    expect(isCeilingSnapshotReady({ area: 18, total: 18000 } as CalculatorLeadSnapshot)).toBe(
      true
    );
  });

  it("отсутствующий снапшот — не готов", () => {
    expect(isCeilingSnapshotReady(null)).toBe(false);
  });
});
