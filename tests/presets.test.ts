import { describe, expect, it } from "vitest";

import { servicePageContent } from "@/content/services";
import {
  DISABLED_PRESET_SLUGS,
  defaultPerimeterMeters,
  presetToRoom,
  resolvePresetScenario,
} from "@/lib/calculator/presets";

const list = Object.values(servicePageContent);

function preset(slug: string) {
  const service = list.find((s) => s.slug === slug);
  if (!service) throw new Error(`Нет услуги ${slug}`);
  return service.price.calculatorPreset;
}

describe("T-021 - presety stranic uslug", () => {
  it("tenevoy-profil: teneviy vklyuchen, ploshchad 22", () => {
    const { room, scenario } = presetToRoom(preset("tenevoy-profil"));
    expect(room.shadowEnabled).toBe(true);
    expect(room.floatingEnabled).toBe(false);
    expect(room.area).toBe(22);
    expect(scenario).toBe("modern");
  });

  it("paryashchie-potolki: paryashchiy vklyuchen", () => {
    const { room } = presetToRoom(preset("paryashchie-potolki"));
    expect(room.floatingEnabled).toBe(true);
    expect(room.shadowEnabled).toBe(false);
    expect(Number(room.floatingLength)).toBeGreaterThan(0);
  });

  it("svetovye-linii: linii 4 m.p.", () => {
    const { room } = presetToRoom(preset("svetovye-linii"));
    expect(room.lightLinesEnabled).toBe(true);
    expect(room.lightLinesLength).toBe(4);
  });

  it("skrytye-karnizy: skrytaya nisha s dlinoy", () => {
    const { room } = presetToRoom(preset("skrytye-karnizy"));
    expect(room.corniceType).toBe("hidden-niche");
    expect(Number(room.corniceLength)).toBeGreaterThan(0);
  });

  it("trekovoe-osveshchenie: vstroenniy trek", () => {
    const { room, scenario } = presetToRoom(preset("trekovoe-osveshchenie"));
    expect(room.trackType).toBe("built-in");
    expect(Number(room.trackLength)).toBeGreaterThan(0);
    expect(scenario).toBe("modern");
  });

  it("prostye-potolki: bazoviy scenariy", () => {
    const { room, scenario } = presetToRoom(preset("prostye-potolki"));
    expect(room.shadowEnabled).toBe(false);
    expect(room.floatingEnabled).toBe(false);
    expect(scenario).toBe("standard");
  });

  it("kazhdiy preset daet ploshchad i pomechaet prefilled", () => {
    for (const service of list) {
      const result = presetToRoom(service.price.calculatorPreset, { slug: service.slug });
      expect(Number(result.room.area), service.slug).toBeGreaterThan(0);
      expect(result.prefilled, service.slug).toContain("area");
    }
  });

  it("svetoprozrachnye-potolki: preset otklyuchen", () => {
    expect(DISABLED_PRESET_SLUGS.has("svetoprozrachnye-potolki")).toBe(true);
    const result = presetToRoom(preset("svetoprozrachnye-potolki"), {
      slug: "svetoprozrachnye-potolki",
    });
    expect(result.disabled).toBe(true);
  });

  it("perimetr po umolchaniyu = round(4*sqrt(area))", () => {
    expect(defaultPerimeterMeters(25)).toBe(20);
    expect(defaultPerimeterMeters(18)).toBe(17);
  });

  it("scenariy bez preseta - bazoviy", () => {
    expect(resolvePresetScenario(null)).toBe("standard");
  });
});

describe("T-041 - defolty ploshchadi i perimetra", () => {
  it("perimetr = round(4*sqrt(area)), a ne 1:1 k ploshchadi", () => {
    // Ключевая правка T-041: профиль больше не считается равным площади.
    expect(defaultPerimeterMeters(18)).toBe(17);
    expect(defaultPerimeterMeters(60)).toBe(31);
    expect(defaultPerimeterMeters(100)).toBe(40);
  });

  it("perimetr ne padaet nizhe 1 na vyrozhdennoy ploshchadi", () => {
    expect(defaultPerimeterMeters(0)).toBeGreaterThanOrEqual(1);
    expect(defaultPerimeterMeters(Number.NaN)).toBeGreaterThanOrEqual(1);
  });
});
