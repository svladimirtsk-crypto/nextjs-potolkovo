import { describe, expect, it } from "vitest";

import { resolveStep0SummaryActions } from "@/lib/calculator-flow";

describe("UX-R2 · маршрут сводки зависит от решений комнат, а не от уровня", () => {
  it("парящий/линии/карниз/трек ведут к подбору света, а не в итог", () => {
    const withTasks = resolveStep0SummaryActions({ hasLighting: false, hasLightingTasks: true });
    expect(withTasks.primary).toEqual({ label: "Подобрать свет −25% →", destination: 1 });
    expect(withTasks.secondary).toEqual({ label: "К итогу →", destination: 2 });
  });

  it("если свет уже в корзине — предлагаем проверить его, а не подобрать заново", () => {
    const withCart = resolveStep0SummaryActions({ hasLighting: true, hasLightingTasks: true });
    expect(withCart.primary).toEqual({ label: "Проверить свет →", destination: 1 });
  });

  it("комната только с потолком ведёт в итог, подбор света остаётся вторичным", () => {
    const withoutTasks = resolveStep0SummaryActions({ hasLighting: false, hasLightingTasks: false });
    expect(withoutTasks.primary).toEqual({ label: "К итогу →", destination: 2 });
    expect(withoutTasks.secondary).toEqual({ label: "Подобрать свет −25% →", destination: 1 });
    const withCart = resolveStep0SummaryActions({ hasLighting: true, hasLightingTasks: false });
    expect(withCart.primary).toEqual({ label: "К итогу →", destination: 2 });
    expect(withCart.secondary).toEqual({ label: "Проверить свет →", destination: 1 });
  });

  it("«стандартный» уровень больше не делает выбор света второстепенным", () => {
    const standard = resolveStep0SummaryActions({ scenario: "standard", hasLighting: false, hasLightingTasks: true });
    const modern = resolveStep0SummaryActions({ scenario: "modern", hasLighting: false, hasLightingTasks: true });
    expect(standard).toEqual(modern);
  });

  it("старые вызовы без данных о комнатах сохраняют прежнее поведение", () => {
    expect(resolveStep0SummaryActions({ scenario: "standard", hasLighting: false }).primary.label).toBe("К итогу →");
    expect(resolveStep0SummaryActions({ scenario: "modern", hasLighting: false }).primary.label).toBe("Подобрать свет −25% →");
    expect(resolveStep0SummaryActions({ scenario: "advanced", hasLighting: false }).primary.label).toBe("Связаться и обсудить →");
  });
});
