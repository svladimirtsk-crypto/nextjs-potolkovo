import { describe, expect, it } from "vitest";

import { selectStripState, type StripInput } from "@/lib/calculator/selectors";
import { pricing } from "@/content/pricing";

const base: StripInput = {
  ceilingRub: 0,
  ceilingKnown: true,
  lightingEffectiveRub: 0,
  lightingRegularRub: 0,
  lightingDiscountPct: 0,
  extraInstallRub: 0,
  minimumApplied: false,
  questionsTotal: 6,
};

describe("N-012 · состояния ценовой полосы", () => {
  it("idle: до первого ответа приглашает ответить, а не показывает ноль", () => {
    const state = selectStripState(base);
    expect(state.kind).toBe("idle");
    if (state.kind !== "idle") return;
    expect(state.text).toContain("6 вопросов");
    expect(state.text).not.toContain("0 ₽");
  });

  it("estimating: одна сумма — потолок без света", () => {
    const state = selectStripState({ ...base, ceilingRub: 25500 });
    expect(state.kind).toBe("estimating");
    if (state.kind !== "estimating") return;
    expect(state.totalRub).toBe(25500);
    expect(state.hint).toBeNull();
  });

  /**
   * Ради этого объяснения задача и заведена: на 18 м² человек видит 18 000 ₽
   * вместо ожидаемых 14 400 и не понимает, откуда разница.
   */
  it("estimating: при минимальном заказе объясняет, что в него входит", () => {
    const state = selectStripState({ ...base, ceilingRub: 18000, minimumApplied: true });
    expect(state.kind).toBe("estimating");
    if (state.kind !== "estimating") return;
    expect(state.hint).toContain(pricing.minimumOrderRub.toLocaleString("ru-RU"));
    expect(state.hint).toContain("выезд, замер и монтаж");
  });

  it("detailed: потолок и свет — две составляющие и общий итог", () => {
    const state = selectStripState({
      ...base,
      ceilingRub: 38000,
      lightingEffectiveRub: 6000,
      lightingRegularRub: 8000,
      lightingDiscountPct: 25,
    });

    expect(state.kind).toBe("detailed");
    if (state.kind !== "detailed") return;
    expect(state.totalRub).toBe(44000);
    expect(state.parts.map((p) => p.id)).toEqual(["ceiling", "lighting"]);
    expect(state.lightingDiscountPct).toBe(25);
  });

  /** F-04: «Потолок 18 000 · Итого 18 000» — одно число дважды. */
  it("не раскладывает итог, когда составляющая всего одна", () => {
    const state = selectStripState({ ...base, ceilingRub: 18000 });
    expect(state.kind).not.toBe("detailed");
  });

  it("свет без потолка: страница света считается до расчёта потолка", () => {
    const state = selectStripState({
      ...base,
      ceilingKnown: false,
      ceilingRub: 10000,
      lightingEffectiveRub: 2772,
      lightingRegularRub: 3080,
      lightingDiscountPct: 10,
    });

    expect(state.kind).toBe("estimating");
    if (state.kind !== "estimating") return;
    // Потолок неизвестен — в сумму он попасть не должен.
    expect(state.totalRub).toBe(2772);
  });

  it("досчёт монтажа — отдельная составляющая", () => {
    const state = selectStripState({
      ...base,
      ceilingRub: 18000,
      lightingEffectiveRub: 5000,
      lightingRegularRub: 5000,
      extraInstallRub: 1200,
    });

    expect(state.kind).toBe("detailed");
    if (state.kind !== "detailed") return;
    expect(state.totalRub).toBe(24200);
    expect(state.parts.map((p) => p.id)).toContain("install");
  });

  it("скидка не показывается, когда её нет", () => {
    const state = selectStripState({
      ...base,
      ceilingRub: 18000,
      lightingEffectiveRub: 5000,
      lightingRegularRub: 5000,
      lightingDiscountPct: 25,
    });

    expect(state.kind).toBe("detailed");
    if (state.kind !== "detailed") return;
    expect(state.lightingDiscountPct).toBe(0);
  });
});
