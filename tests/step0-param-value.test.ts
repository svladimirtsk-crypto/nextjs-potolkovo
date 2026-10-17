/**
 * PT-024 · В `quiz_param_confirm` уходит значение своего параметра.
 *
 * Раньше квиз отправлял площадь комнаты для всех девяти экранов, а в режиме
 * «весь объект» — пустую строку (`screen.roomId === "object"`, комната
 * `object-1`). Здесь закреплено и то, и другое.
 */
import { describe, expect, it } from "vitest";

import type { RoomConfig } from "@/lib/calculator/use-calculator-engine";
import { paramConfirmValue, quizRoomIndex, resolveQuizRoom } from "@/lib/step0-param-value";

function room(overrides: Partial<RoomConfig> = {}): RoomConfig {
  return {
    id: "r1",
    label: "Кухня",
    area: 24,
    ceilingType: "shadow-floating",
    shadowEnabled: true,
    shadowLength: 17,
    floatingEnabled: true,
    floatingLength: 18.5,
    lightLinesEnabled: true,
    lightLinesLength: 12,
    corniceType: "built-in",
    corniceLength: 20,
    corniceLightingEnabled: false,
    corniceLightingLength: 0,
    corniceLightingPowerSupplies: 0,
    trackType: "surface",
    trackLength: 10,
    chandeliersEnabled: true,
    chandeliersCount: 2,
    lightsEnabled: true,
    lightsCount: 6,
    ...overrides,
  };
}

describe("PT-024 · paramConfirmValue", () => {
  const r = room();

  it("каждый из девяти параметров отдаёт своё поле, а не площадь", () => {
    expect(paramConfirmValue(r, "area")).toBe(24);
    expect(paramConfirmValue(r, "ceiling")).toBe("shadow-floating");
    expect(paramConfirmValue(r, "shadowProfile")).toBe(17);
    expect(paramConfirmValue(r, "floatingProfile")).toBe(18.5);
    expect(paramConfirmValue(r, "lightLines")).toBe(12);
    expect(paramConfirmValue(r, "cornice")).toBe(20);
    expect(paramConfirmValue(r, "track")).toBe(10);
    expect(paramConfirmValue(r, "chandeliers")).toBe(2);
    expect(paramConfirmValue(r, "lights")).toBe(6);
  });

  it("метраж трека не подменяется площадью, даже если они совпали по величине", () => {
    const same = room({ area: 10, trackLength: 10, shadowLength: 10 });
    expect(paramConfirmValue(same, "track")).toBe(10);
    // Площадь, метраж и «выключено» различимы по типу/значению.
    expect(paramConfirmValue(same, "cornice")).toBe(20);
    expect(paramConfirmValue(room({ corniceType: "none" }), "cornice")).toBe(false);
    expect(paramConfirmValue(room({ trackType: "none" }), "track")).toBe(false);
  });

  it("выключенная функция — false, а не 0 и не area", () => {
    const off = room({
      shadowEnabled: false,
      floatingEnabled: false,
      lightLinesEnabled: false,
      chandeliersEnabled: false,
      lightsEnabled: false,
    });
    for (const param of [
      "shadowProfile",
      "floatingProfile",
      "lightLines",
      "chandeliers",
      "lights",
    ] as const) {
      expect(paramConfirmValue(off, param)).toBe(false);
      expect(paramConfirmValue(off, param)).not.toBe(off.area);
    }
  });

  it("площадь остаётся числом, тип потолка — строкой", () => {
    expect(typeof paramConfirmValue(r, "area")).toBe("number");
    expect(typeof paramConfirmValue(r, "ceiling")).toBe("string");
  });
});

describe("PT-024 · resolveQuizRoom", () => {
  const object = room({ id: "object-1", label: "Весь объект" });
  const kitchen = room({ id: "r1" });

  it("находит комнату по точному id", () => {
    expect(resolveQuizRoom([kitchen, object], "r1", "r1")?.id).toBe("r1");
  });

  it('режим «весь объект»: "object" ведёт на object-1, а не в undefined', () => {
    expect(resolveQuizRoom([object], "object", "object-1")?.id).toBe("object-1");
    expect(resolveQuizRoom([object], "object")?.id).toBe("object-1");
  });

  it("единственная комната сессии принимается за объект", () => {
    expect(resolveQuizRoom([kitchen], "object", "r1")?.id).toBe("r1");
  });

  it("неизвестный id откатывается на активную комнату движка", () => {
    expect(resolveQuizRoom([kitchen, object], "deleted-room", "object-1")?.id).toBe("object-1");
  });

  it("без совпадений — null, а не чужая комната", () => {
    expect(resolveQuizRoom([kitchen, object], "ghost", null)).toBeNull();
    expect(resolveQuizRoom([], "object", null)).toBeNull();
  });
});

describe("PT-024 · quizRoomIndex", () => {
  const first = room({ id: "r1" });
  const second = room({ id: "r2" });

  it("индекс — позиция найденной комнаты", () => {
    expect(quizRoomIndex([first, second], second)).toBe(1);
    expect(quizRoomIndex([first, second], first)).toBe(0);
  });

  it("неизвестная комната — 0, как и раньше", () => {
    expect(quizRoomIndex([first, second], null)).toBe(0);
  });
});
