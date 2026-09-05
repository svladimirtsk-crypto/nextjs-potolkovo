import { describe, expect, it } from "vitest";

import { resolveLightingDiscountMode } from "../lib/calculator-flow";

/**
 * T-091 · Таблица решений по скидке на свет.
 *
 * Правило бизнеса: 25 % даём только когда свет идёт вместе с потолком,
 * 10 % — когда человек покупает только оборудование. Ошибка здесь означает
 * либо потерянную маржу, либо обещанную и неотработанную скидку.
 */
const base = {
  hasLighting: true,
  regularTotal: 50_000,
  discountEligibleWithCeiling: false,
  entryMode: undefined,
} as const;

describe("T-091 · resolveLightingDiscountMode", () => {
  it("нет света — нет скидки", () => {
    expect(resolveLightingDiscountMode({ ...base, hasLighting: false })).toBe("none");
  });

  it("нулевая сумма — нет скидки, даже если свет формально выбран", () => {
    expect(resolveLightingDiscountMode({ ...base, regularTotal: 0 })).toBe("none");
    expect(resolveLightingDiscountMode({ ...base, regularTotal: -100 })).toBe("none");
  });

  it("свет вместе с потолком — 25 %", () => {
    expect(
      resolveLightingDiscountMode({ ...base, discountEligibleWithCeiling: true })
    ).toBe("with-ceiling");
  });

  it("потолок перевешивает вход «сначала свет»", () => {
    expect(
      resolveLightingDiscountMode({
        ...base,
        discountEligibleWithCeiling: true,
        entryMode: "lighting-first",
      })
    ).toBe("with-ceiling");
  });

  it("вход «сначала свет» без потолка — 10 %", () => {
    expect(resolveLightingDiscountMode({ ...base, entryMode: "lighting-first" })).toBe(
      "lighting-only"
    );
  });

  it("обычный вход без потолка — скидки нет", () => {
    expect(resolveLightingDiscountMode(base)).toBe("none");
  });
});
