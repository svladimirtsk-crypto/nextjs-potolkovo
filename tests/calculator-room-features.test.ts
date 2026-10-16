import { describe, expect, it } from "vitest";

import { effectiveCeilingType, roomQuestionPlan, scenarioFromRooms, setCeilingFeature, setTrackFeature } from "@/lib/calculator/room-features";
import { paramsForRoom } from "@/lib/calculator/room-workspace";
import type { RoomConfig } from "@/lib/calculator/use-calculator-engine";

function room(patch: Partial<RoomConfig> = {}): RoomConfig {
  return {
    id: "r1", label: "Кухня", area: 18, ceilingType: "standard",
    shadowEnabled: false, shadowLength: 17, floatingEnabled: false, floatingLength: 17,
    lightLinesEnabled: false, lightLinesLength: 3,
    corniceType: "none", corniceLength: 2, corniceLightingEnabled: false, corniceLightingLength: 2, corniceLightingPowerSupplies: 1,
    trackType: "none", trackLength: 2, chandeliersEnabled: false, chandeliersCount: 1, lightsEnabled: false, lightsCount: 6,
    ...patch,
  };
}

describe("UX-R2 · решения комнаты не зависят от уровня", () => {
  it("список вопросов комнаты не зависит от сохранённого уровня проекта", () => {
    expect(paramsForRoom(room())).toEqual(["area", "ceiling", "cornice", "chandeliers", "lights"]);
    /* Уровень остаётся только полем совместимости: он не добавляет вопросов. */
    const legacyModern = { ...room(), scenario: "modern" } as unknown as RoomConfig;
    expect(paramsForRoom(legacyModern)).toEqual(paramsForRoom(room()));
  });

  it("теневой и парящий доступны без выбора «современного» уровня", () => {
    const shadow = roomQuestionPlan(setCeilingFeature(room(), "shadow", true) as RoomConfig);
    expect(shadow).toContain("shadowProfile");
    expect(shadow).not.toContain("floatingProfile");
    const floating = roomQuestionPlan({ ...room(), floatingEnabled: true });
    expect(floating).toContain("floatingProfile");
    const both = roomQuestionPlan(setCeilingFeature(setCeilingFeature(room(), "shadow", true) as RoomConfig, "floating", true) as RoomConfig);
    expect(both).toContain("shadowProfile");
    expect(both).not.toContain("floatingProfile");
  });

  it("линии, карниз и трек — отдельные вопросы этой комнаты", () => {
    expect(roomQuestionPlan({ ...room(), lightLinesEnabled: true })).toContain("lightLines");
    expect(roomQuestionPlan({ ...room(), trackType: "built-in" })).toContain("track");
    /* Карниз спрашивается всегда: даже «без карниза» — это осознанный ответ. */
    expect(paramsForRoom(room({ corniceType: "hidden-niche" }))).toContain("cornice");
    expect(paramsForRoom(room({ corniceType: "none" }))).toContain("cornice");
  });

  it("не теряет текущий вопрос, если решение отключили на его же экране", () => {
    expect(roomQuestionPlan(room(), "lightLines")).toContain("lightLines");
    expect(roomQuestionPlan(room(), "track")).toContain("track");
    expect(roomQuestionPlan(room())).not.toContain("lightLines");
  });

  it("roomQuestionPlan — единственный источник списка вопросов", () => {
    const both = room({ shadowEnabled: true, floatingEnabled: true, lightLinesEnabled: true, trackType: "surface" });
    expect(paramsForRoom(both)).toEqual(roomQuestionPlan(both));
  });
});

describe("UX-R2 · уровень проекта описывает фактические решения", () => {
  it("комната с теневым, парящим, линиями, карнизом или треком — modern", () => {
    expect(scenarioFromRooms([{ shadowEnabled: true }])).toBe("modern");
    expect(scenarioFromRooms([{ floatingEnabled: true }])).toBe("modern");
    expect(scenarioFromRooms([{ lightLinesEnabled: true }])).toBe("modern");
    expect(scenarioFromRooms([{ corniceType: "hidden-niche" }])).toBe("modern");
    expect(scenarioFromRooms([{ trackType: "built-in" }])).toBe("modern");
    expect(scenarioFromRooms([{ trackType: "none", corniceType: "none" }])).toBe("standard");
    expect(scenarioFromRooms([])).toBe("standard");
  });

  it("одна комната с решением делает проект modern, чужие комнаты не мешают", () => {
    expect(scenarioFromRooms([{ shadowEnabled: false }, { shadowEnabled: true }])).toBe("modern");
    expect(scenarioFromRooms([{ shadowEnabled: false }, { shadowEnabled: false }])).toBe("standard");
  });

  it("advanced не выдумывается из комнат: он остаётся только явным уровнем", () => {
    expect(scenarioFromRooms([{ shadowEnabled: true }], "advanced")).toBe("advanced");
    expect(scenarioFromRooms([], "advanced")).toBe("advanced");
  });
});

describe("UX-R2 · трек из готового комплекта не спрашивается заново", () => {
  it("комплект уже определил трек — вопрос не появляется", () => {
    const fromKit = room({ trackType: "built-in", trackLength: 6, trackFromEntry: true });
    expect(roomQuestionPlan(fromKit)).not.toContain("track");
    expect(paramsForRoom(fromKit)).not.toContain("track");
  });

  it("человек сам включил трек — вопрос возвращается", () => {
    const chosen = { ...room({ trackType: "built-in" }), ...setTrackFeature(room(), true) } as RoomConfig;
    expect(chosen.trackFromEntry).toBe(false);
    expect(roomQuestionPlan(chosen)).toContain("track");
  });

  it("метраж комплекта сохраняется и трек остаётся доступен из карточки", () => {
    const fromKit = room({ trackType: "surface", trackLength: 10, trackFromEntry: true });
    const toggled = { ...fromKit, ...setTrackFeature(fromKit, false) } as RoomConfig;
    expect(toggled.trackLength).toBe(10);
    expect(toggled.lastTrackType).toBe("surface");
    const back = { ...toggled, ...setTrackFeature(toggled, true) } as RoomConfig;
    expect(back.trackType).toBe("surface");
    expect(roomQuestionPlan(back)).toContain("track");
  });
});

describe("UX-R2 · переключатели решений", () => {
  it("собирает ceilingType из фактических флагов", () => {
    expect(effectiveCeilingType({ shadowEnabled: false, floatingEnabled: false })).toBe("standard");
    expect(effectiveCeilingType({ shadowEnabled: true, floatingEnabled: false })).toBe("shadow");
    expect(effectiveCeilingType({ shadowEnabled: false, floatingEnabled: true })).toBe("floating");
    expect(effectiveCeilingType({ shadowEnabled: true, floatingEnabled: true })).toBe("shadow-floating");
  });

  it("включение и выключение профиля меняет только свой флаг", () => {
    const shadowOn = setCeilingFeature(room(), "shadow", true);
    expect(shadowOn).toEqual({ shadowEnabled: true, floatingEnabled: false, ceilingType: "shadow" });
    const floatingOn = setCeilingFeature(room(), "floating", true);
    expect(floatingOn).toEqual({ shadowEnabled: false, floatingEnabled: true, ceilingType: "floating" });
    const both = setCeilingFeature({ ...room(), ...shadowOn } as RoomConfig, "floating", true);
    expect(both).toEqual({ shadowEnabled: true, floatingEnabled: true, ceilingType: "shadow-floating" });
    const back = setCeilingFeature({ ...room(), ...both } as RoomConfig, "shadow", false);
    expect(back).toEqual({ shadowEnabled: false, floatingEnabled: true, ceilingType: "floating" });
  });

  it("сохраняет метраж профиля при выключении — метры не обнуляются молча", () => {
    const withMetres = room({ shadowEnabled: true, ceilingType: "shadow", shadowLength: 21 });
    const off = setCeilingFeature(withMetres, "shadow", false);
    expect(withMetres.shadowLength).toBe(21);
    expect(off).toMatchObject({ shadowEnabled: false, ceilingType: "standard" });
    expect(withMetres.shadowLength).toBe(21);
  });

  it("помнит тип трека между выключением и включением", () => {
    const on = setTrackFeature(room(), true);
    expect(on).toEqual({ trackType: "built-in", lastTrackType: "built-in", trackFromEntry: false });
    const surface = setTrackFeature({ ...room(), trackType: "surface" } as RoomConfig, true);
    expect(surface).toMatchObject({ trackType: "surface", lastTrackType: "surface" });
    const off = setTrackFeature({ ...room(), trackType: "surface" } as RoomConfig, false);
    expect(off).toMatchObject({ trackType: "none", lastTrackType: "surface" });
    const again = setTrackFeature({ ...room(), trackType: "none", lastTrackType: "surface" } as RoomConfig, true);
    expect(again.trackType).toBe("surface");
  });
});
