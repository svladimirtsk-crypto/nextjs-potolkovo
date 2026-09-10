import { describe, expect, it } from "vitest";

import {
  hasLightingItems,
  mergeInstallExtraIntoSnapshot,
  mergeLightingIntoSnapshot,
  type LightingMergeInput,
} from "../lib/calculator/snapshot-merge";
import type { CalculatorLeadSnapshot } from "../lib/calculator/snapshot-types";
import type { LightingSnapshot } from "../lib/calculator-modal-types";

/**
 * N-050 · Слияния снапшота раньше жили внутри useEffect и проверялись только
 * прогоном воронки в браузере. Тесты фиксируют два свойства, от которых
 * зависит корректность заявки и отсутствие циклов рендера:
 * «изменений нет → тот же объект» и «данные света доезжают в снапшот».
 */

const emptySnapshot = (): CalculatorLeadSnapshot => ({
  area: 0,
  ceilingTypeLabel: "Потолок пока не рассчитан",
  ceilingBaseRate: 0,
  ceilingBaseTotal: 0,
  ceilingExtraLabel: null,
  ceilingLength: null,
  ceilingExtraRatePerMeter: null,
  ceilingExtraTotal: 0,
  lightLinesEnabled: false,
  lightLinesLabel: null,
  lightLinesLength: null,
  lightLinesRatePerMeter: null,
  lightLinesTotal: 0,
  corniceLabel: null,
  corniceLength: null,
  corniceRatePerMeter: null,
  corniceTotal: 0,
  trackLabel: null,
  trackLength: null,
  trackRatePerMeter: null,
  trackTotal: 0,
  lightsEnabled: false,
  lightsCount: null,
  lightsRatePerUnit: 0,
  lightsTotal: 0,
  total: 0,
  derivedInputs: {
    pointSpotsQty: 0,
    trackMeters: 0,
    corniceLightingMeters: 0,
    chandeliersQty: 0,
  } as unknown as CalculatorLeadSnapshot["derivedInputs"],
});

const draft = (items: number): LightingSnapshot =>
  ({
    mode: "kit",
    items: Array.from({ length: items }, (_, i) => ({
      sku: `sku-${i}`,
      name: `Товар ${i}`,
      qty: 1,
      priceRub: 100,
      totalRub: 100,
    })),
  }) as unknown as LightingSnapshot;

const lightingInput = (over: Partial<LightingMergeInput> = {}): LightingMergeInput => ({
  lightingDraft: draft(2),
  regularTotal: 1000,
  effectiveTotal: 750,
  standaloneTotal: 900,
  withCeilingTotal: 750,
  discountMode: "with-ceiling",
  discountPercentApplied: 25,
  discountAmount: 250,
  source: "hero",
  createEmpty: emptySnapshot,
  ...over,
});

describe("hasLightingItems", () => {
  it("пустой черновик и режим none не считаются выбором света", () => {
    expect(hasLightingItems(null)).toBe(false);
    expect(hasLightingItems(undefined)).toBe(false);
    expect(hasLightingItems(draft(0))).toBe(false);
    expect(hasLightingItems({ ...draft(2), mode: "none" } as LightingSnapshot)).toBe(false);
  });

  it("позиции в корзине считаются выбором света", () => {
    expect(hasLightingItems(draft(1))).toBe(true);
  });
});

describe("mergeLightingIntoSnapshot", () => {
  it("без снапшота и без света ничего не создаёт", () => {
    expect(mergeLightingIntoSnapshot(null, lightingInput({ lightingDraft: null }))).toBeNull();
  });

  it("вход «сначала свет»: снапшот создаётся с нуля и несёт источник лида", () => {
    const out = mergeLightingIntoSnapshot(null, lightingInput({ source: "track-page" }));
    expect(out).not.toBeNull();
    expect(out?.leadSource).toBe("track-page");
    expect(out?.lighting?.items).toHaveLength(2);
  });

  it("суммы и режим скидки попадают в блок освещения", () => {
    const out = mergeLightingIntoSnapshot(emptySnapshot(), lightingInput());
    expect(out?.lighting?.totalRub).toBe(1000);
    expect(out?.lighting?.discountedTotalRub).toBe(750);
    expect(out?.lightingDiscountMode).toBe("with-ceiling");
    expect(out?.lightingDiscountPercentApplied).toBe(25);
    expect(out?.lightingDiscountAmountRub).toBe(250);
    expect(out?.lightingDiscountApplied).toBe(true);
  });

  it("режим none означает «скидка не применена»", () => {
    const out = mergeLightingIntoSnapshot(
      emptySnapshot(),
      lightingInput({ discountMode: "none", discountPercentApplied: 0, discountAmount: 0 })
    );
    expect(out?.lightingDiscountApplied).toBe(false);
  });

  it("очистка корзины убирает блок света, не трогая потолок", () => {
    const withCeiling = { ...emptySnapshot(), area: 18, total: 25500 };
    const out = mergeLightingIntoSnapshot(withCeiling, lightingInput({ lightingDraft: draft(0) }));
    expect(out?.lighting).toBeUndefined();
    expect(out?.total).toBe(25500);
  });

  it("уже заданный источник лида не перетирается", () => {
    const prev = { ...emptySnapshot(), leadSource: "uslugi/skrytye-karnizy" };
    const out = mergeLightingIntoSnapshot(prev, lightingInput({ source: "hero" }));
    expect(out?.leadSource).toBe("uslugi/skrytye-karnizy");
  });
});

describe("mergeInstallExtraIntoSnapshot", () => {
  const base = { ...emptySnapshot(), area: 18, total: 25500 };

  it("без снапшота ничего не делает", () => {
    expect(mergeInstallExtraIntoSnapshot(null, { extraInstallTotal: 500, extraInstallLines: [] })).toBeNull();
  });

  it("те же данные возвращают ровно тот же объект — рендера не будет", () => {
    const prev = { ...base, extraInstallRub: 1500, extraInstallLines: ["Монтаж ещё 3 точек · 1 500 ₽"] };
    const out = mergeInstallExtraIntoSnapshot(prev, {
      extraInstallTotal: 1500,
      extraInstallLines: ["Монтаж ещё 3 точек · 1 500 ₽"],
    });
    expect(out).toBe(prev);
  });

  it("копеечная разница не считается изменением", () => {
    const prev = { ...base, extraInstallRub: 1500, extraInstallLines: [] };
    expect(mergeInstallExtraIntoSnapshot(prev, { extraInstallTotal: 1500.3, extraInstallLines: [] })).toBe(prev);
  });

  it("изменение суммы записывается и сбрасывает устаревший grandTotal", () => {
    const prev = { ...base, extraInstallRub: 1500, grandTotal: 27000, extraInstallLines: [] };
    const out = mergeInstallExtraIntoSnapshot(prev, { extraInstallTotal: 2000, extraInstallLines: ["x"] });
    expect(out).not.toBe(prev);
    expect(out?.extraInstallRub).toBe(2000);
    expect(out?.grandTotal).toBeUndefined();
  });

  it("сумма та же, но состав строк другой — обновляем", () => {
    const prev = { ...base, extraInstallRub: 1500, extraInstallLines: ["Монтаж ещё 3 точек · 1 500 ₽"] };
    const out = mergeInstallExtraIntoSnapshot(prev, {
      extraInstallTotal: 1500,
      extraInstallLines: ["Монтаж ещё 1 м трека · 1 500 ₽"],
    });
    expect(out).not.toBe(prev);
    expect(out?.extraInstallLines).toEqual(["Монтаж ещё 1 м трека · 1 500 ₽"]);
  });
});
