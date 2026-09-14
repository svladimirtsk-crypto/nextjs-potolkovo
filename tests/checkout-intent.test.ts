import { describe, expect, it } from "vitest";

import {
  resolveCheckoutIntentAction,
  type CheckoutIntentOutcome,
} from "../lib/lighting/catalog-checkout";

/**
 * PT-011 · Экран интента «Как оформляем комплект?».
 *
 * Регресс был в типе результата: диалог возвращал `boolean`, и закрытие
 * (Escape / клик по подложке) давало тот же `false`, что и кнопка «Только
 * оборудование −10 %». Человек, который просто уходил из диалога, оказывался
 * в форме заявки с режимом скидки, который он не выбирал.
 *
 * Проверяем таблицу «исход → действие»: все три исхода обязаны быть различимы,
 * а `dismissed` — не вести ни в один из путей оформления.
 */
describe("PT-011 · resolveCheckoutIntentAction", () => {
  it("«с потолком» ведёт в расчёт потолка", () => {
    expect(resolveCheckoutIntentAction("with-ceiling")).toBe("open-ceiling-flow");
  });

  it("«только оборудование» ведёт к заявке без потолка", () => {
    expect(resolveCheckoutIntentAction("lighting-only")).toBe("open-lighting-order");
  });

  it("закрытый диалог оставляет человека в каталоге", () => {
    expect(resolveCheckoutIntentAction("dismissed")).toBe("stay-in-catalog");
  });

  it("закрытие не равносильно выбору «только оборудование» (регресс PT-011)", () => {
    expect(resolveCheckoutIntentAction("dismissed")).not.toBe(
      resolveCheckoutIntentAction("lighting-only")
    );
  });

  it("все три исхода различимы и ни один не остаётся без действия", () => {
    const outcomes: CheckoutIntentOutcome[] = ["with-ceiling", "lighting-only", "dismissed"];
    const actions = outcomes.map((outcome) => resolveCheckoutIntentAction(outcome));

    expect(actions.every((action) => typeof action === "string" && action.length > 0)).toBe(true);
    expect(new Set(actions).size).toBe(outcomes.length);
  });
});
