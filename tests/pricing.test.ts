import { describe, expect, it } from "vitest";

import { applyMinimumOrder, formatFrom, pricing } from "@/content/pricing";
import { homepage } from "@/content/homepage";
import { calcRoomsTotal, type V2RoomConfig } from "@/lib/calculator/room-snapshot";
import { describeRoom, formatRoomLine, scenarioLabel } from "@/lib/calculator/labels";

function room(patch: Partial<V2RoomConfig> = {}): V2RoomConfig {
  return {
    id: "r1",
    label: "Комната",
    area: 18,
    ceilingType: "standard",
    shadowEnabled: false,
    shadowLength: 0,
    floatingEnabled: false,
    floatingLength: 0,
    lightLinesEnabled: false,
    lightLinesLength: 0,
    corniceType: "none",
    corniceLength: 0,
    corniceLightingEnabled: false,
    corniceLightingLength: 0,
    corniceLightingPowerSupplies: 0,
    trackType: "none",
    trackLength: 0,
    chandeliersEnabled: false,
    chandeliersCount: 0,
    lightsEnabled: false,
    lightsCount: 0,
    ...patch,
  };
}

describe("T-020 · единый прайс", () => {
  it("значения совпадают с homepage.price.calculator", () => {
    const calc = homepage.price.calculator;
    expect(calc.ceilingTypes.find((c) => c.slug === "standard")?.baseRatePerSqm).toBe(
      pricing.ceiling.standard
    );
    expect(calc.ceilingTypes.find((c) => c.slug === "shadow")?.extraRatePerMeter).toBe(
      pricing.ceiling.shadowProfilePerM
    );
    expect(calc.ceilingTypes.find((c) => c.slug === "floating")?.extraRatePerMeter).toBe(
      pricing.ceiling.floatingProfilePerM
    );
    expect(calc.cornices.find((c) => c.slug === "built-in")?.ratePerMeter).toBe(
      pricing.cornice.builtIn
    );
    expect(calc.lightLines.ratePerMeter).toBe(pricing.lightLinesPerM);
    expect(calc.lights.ratePerUnit).toBe(pricing.spotInstall);
    expect(calc.chandeliers?.ratePerUnit).toBe(pricing.chandelierInstall);
  });

  it("formatFrom печатает человекочитаемо", () => {
    expect(formatFrom(950, "м.п.")).toBe("от 950 ₽ / м.п.");
  });
});

describe("T-004 · минимальный заказ", () => {
  it("маленькая комната добивается до 18 000 ₽", () => {
    const result = calcRoomsTotal([room({ area: 10 })]);
    expect(result.applied).toBe(18000);
    expect(result.minimumApplied).toBe(true);
  });

  it("большая комната считается как есть", () => {
    const result = calcRoomsTotal([room({ area: 30 })]);
    expect(result.applied).toBe(30000);
    expect(result.minimumApplied).toBe(false);
  });

  it("нулевой расчёт не превращается в минимальный заказ", () => {
    expect(applyMinimumOrder(0)).toEqual({ raw: 0, applied: 0, minimumApplied: false });
  });
});

describe("T-005 · человеческие лейблы", () => {
  it("describeRoom возвращает строку теневого профиля", () => {
    const { lines } = describeRoom(
      room({ ceilingType: "shadow", shadowEnabled: true, shadowLength: 17 })
    );
    const shadow = lines.find((l) => l.label === "Теневой профиль");
    expect(shadow).toBeDefined();
    expect(formatRoomLine(shadow!).replace(/\u00a0/g, " ")).toBe(
      "Теневой профиль · 17 м.п. · 16 150 ₽"
    );
  });

  it("сценарий переводится на русский", () => {
    expect(scenarioLabel("modern")).toBe("Современный сценарий");
  });
});
