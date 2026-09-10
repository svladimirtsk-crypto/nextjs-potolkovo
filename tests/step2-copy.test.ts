import { describe, expect, it } from "vitest";

import { fillCallbackWindow, resolveStep2Copy } from "@/lib/calculator-flow";

describe("T-028 - copyright Shaga 2 po intentu", () => {
  it("ceiling_only i lighting_with_ceiling - odinakovyy potolochnyy blok", () => {
    const ceiling = resolveStep2Copy("ceiling_only");
    expect(resolveStep2Copy("lighting_with_ceiling")).toEqual(ceiling);
    expect(ceiling.formTitle).toBe("Записаться на бесплатный замер");
    expect(ceiling.submitLabel).toBe("Записаться на замер");
    expect(ceiling.chips).toEqual([
      "Договор",
      "Гарантия 2 года",
      "Монтаж за 1 день",
      "Уборка после",
    ]);
    expect(ceiling.showFulfilment).toBe(false);
  });

  it("lighting_only - schet na komplekt, bez montazha za 1 den", () => {
    const copy = resolveStep2Copy("lighting_only");
    expect(copy.formTitle).toBe("Получить счёт на комплект");
    expect(copy.submitLabel).toBe("Получить счёт");
    expect(copy.chips).toEqual([
      "Проверю совместимость",
      "Наличие и цена перед счётом",
      "Гарантия производителя",
    ]);
    // Приёмка ТЗ: в комплектном сценарии нет монтажных обещаний.
    expect(copy.chips.join(" ")).not.toContain("Монтаж за 1 день");
    expect(copy.nextSteps.join(" ")).not.toContain("замер");
    // Нужны поля «Получение» и «Когда удобно».
    expect(copy.showFulfilment).toBe(true);
  });

  it("advanced - obsudit proekt", () => {
    const copy = resolveStep2Copy("advanced");
    expect(copy.formTitle).toBe("Обсудить проект");
    expect(copy.submitLabel).toBe("Обсудить проект");
    expect(copy.chips).toContain("Схема света");
  });

  it("direct - zagolovok zadaet sekciya stranicy", () => {
    const copy = resolveStep2Copy("direct");
    expect(copy.formTitle).toBe("");
    expect(copy.formSubtitle).toBe("");
    expect(copy.submitLabel).toBe("Записаться на замер");
  });

  it("kazhdyy intent nachinaet 'chto dalshe' s perezvona", () => {
    for (const intent of ["ceiling_only", "lighting_only", "advanced"] as const) {
      expect(resolveStep2Copy(intent).nextSteps[0]).toBe("Перезвоню {callbackWindow}");
      expect(resolveStep2Copy(intent).nextSteps).toHaveLength(3);
    }
  });
});

describe("T-028 - podstanovka okna perezvona", () => {
  it("podstavlyaet znachenie s servera", () => {
    const steps = fillCallbackWindow(resolveStep2Copy("lighting_only").nextSteps, "сегодня до 21:00");
    expect(steps[0]).toBe("Перезвоню сегодня до 21:00");
    expect(steps[2]).toBe("Самовывоз или доставка");
  });

  it("pustoe okno -> nejtralnyy fallback", () => {
    expect(fillCallbackWindow(["Перезвоню {callbackWindow}"], "  ")).toEqual([
      "Перезвоню в ближайшее время",
    ]);
  });
});
