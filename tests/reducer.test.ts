import { describe, expect, it } from "vitest";

import {
  NO_TOUCHED,
  calculatorReducer,
  createInitialState,
  isParamConfirmed,
  selectActiveRoom,
  selectScreen,
  type CalculatorState,
} from "@/lib/calculator/reducer";
import type { RoomConfig } from "@/lib/calculator-v2/use-ceiling-calculator-engine";

function makeRoom(id: string, patch: Partial<RoomConfig> = {}): RoomConfig {
  return {
    id,
    label: `Комната ${id}`,
    area: 18,
    ceilingType: "standard",
    shadowEnabled: false,
    shadowLength: 18,
    floatingEnabled: false,
    floatingLength: 18,
    lightLinesEnabled: false,
    lightLinesLength: 2,
    corniceType: "none",
    corniceLength: 2,
    corniceLightingEnabled: false,
    corniceLightingLength: 2,
    corniceLightingPowerSupplies: 1,
    trackType: "none",
    trackLength: 2,
    chandeliersEnabled: false,
    chandeliersCount: 1,
    lightsEnabled: false,
    lightsCount: 6,
    ...patch,
  };
}

function withRooms(...rooms: RoomConfig[]): CalculatorState {
  return rooms.reduce(
    (state, room) => calculatorReducer(state, { type: "room/add", room }),
    createInitialState()
  );
}

describe("T-030 - reducer: sessiya", () => {
  it("startovyy ekran zavisit ot scenariya", () => {
    expect(selectScreen(createInitialState("standard")).t).toBe("scenario");
    // Сценарий со страницы услуги уже выбран — экран выбора пропускаем
    // и сразу спрашиваем помещение (T-041: экран режима расчёта удалён).
    expect(selectScreen(createInitialState("modern")).t).toBe("roomPicker");
  });

  it("session/reset ochishchaet komnaty i inkrementiruet sessionId", () => {
    const dirty = calculatorReducer(withRooms(makeRoom("r1")), {
      type: "param/confirm",
      roomId: "r1",
      param: "area",
      value: true,
    });

    const fresh = calculatorReducer(dirty, { type: "session/reset" });

    expect(fresh.rooms).toEqual([]);
    expect(fresh.confirmed).toEqual({});
    expect(fresh.sessionId).toBe(dirty.sessionId + 1);
  });
});

describe("T-030 - reducer: komnaty", () => {
  it("room/add delaet komnatu aktivnoy i dvigaet schetchik", () => {
    const state = withRooms(makeRoom("r1"));

    expect(state.rooms).toHaveLength(1);
    expect(state.activeRoomId).toBe("r1");
    expect(state.roomSeq).toBe(2);
    expect(selectActiveRoom(state)?.id).toBe("r1");
  });

  it("room/update menyaet tolko nuzhnuyu komnatu", () => {
    const state = calculatorReducer(withRooms(makeRoom("r1"), makeRoom("r2")), {
      type: "room/update",
      roomId: "r2",
      patch: { area: 40 },
    });

    expect(state.rooms[0].area).toBe(18);
    expect(state.rooms[1].area).toBe(40);
  });

  it("room/update dlya nesushchestvuyushchey komnaty ne menyaet state", () => {
    const before = withRooms(makeRoom("r1"));
    const after = calculatorReducer(before, {
      type: "room/update",
      roomId: "missing",
      patch: { area: 99 },
    });

    expect(after).toBe(before);
  });

  it("room/remove chistit podtverzhdeniya i perevybiraet aktivnuyu", () => {
    let state = withRooms(makeRoom("r1"), makeRoom("r2"));
    state = calculatorReducer(state, {
      type: "param/confirm",
      roomId: "r2",
      param: "area",
      value: true,
    });
    state = calculatorReducer(state, { type: "room/remove", roomId: "r2" });

    expect(state.rooms.map((r) => r.id)).toEqual(["r1"]);
    expect(state.confirmed.r2).toBeUndefined();
    expect(state.activeRoomId).toBe("r1");
  });

  it("scope=object sozdaet edinstvennuyu virtualnuyu komnatu", () => {
    const state = calculatorReducer(createInitialState(), {
      type: "scope/choose",
      scope: "object",
      room: makeRoom("object-1", { area: 30 }),
    });

    expect(state.scope).toBe("object");
    expect(state.rooms).toHaveLength(1);
    expect(state.activeRoomId).toBe("object-1");
  });
});

describe("T-030 - reducer: touched i prefill", () => {
  it("pravka treka i tochek stavit touched avtomaticheski", () => {
    let state = withRooms(makeRoom("r1"));
    expect(state.touched).toEqual(NO_TOUCHED);

    state = calculatorReducer(state, {
      type: "room/update",
      roomId: "r1",
      patch: { trackLength: 12 },
    });
    expect(state.touched.trackLength).toBe(true);
    expect(state.touched.lights).toBe(false);

    state = calculatorReducer(state, {
      type: "room/update",
      roomId: "r1",
      patch: { lightsCount: 8 },
    });
    expect(state.touched.lights).toBe(true);
  });

  it("pravka ploshchadi ne trogaet touched-flagi", () => {
    const state = calculatorReducer(withRooms(makeRoom("r1")), {
      type: "room/update",
      roomId: "r1",
      patch: { area: 25 },
    });

    expect(state.touched).toEqual(NO_TOUCHED);
  });

  it("preset/apply zapolnyaet prefilled i sbrasyvaet touched", () => {
    const dirty = calculatorReducer(withRooms(makeRoom("r1")), {
      type: "touched/mark",
      key: "lights",
    });

    const state = calculatorReducer(dirty, {
      type: "preset/apply",
      rooms: [makeRoom("room-1", { area: 24 })],
      scenario: "modern",
      scope: "room",
      prefilled: ["area", "ceiling"],
      note: "Похожее решение загружено",
    });

    expect(state.prefilled).toEqual({ area: true, ceiling: true });
    expect(state.presetNote).toBe("Похожее решение загружено");
    expect(state.touched).toEqual(NO_TOUCHED);
    expect(state.scenario).toBe("modern");
    // Пресет уже ответил за сценарий и комнату — квиз стартует с площади.
    expect(selectScreen(state).t).toBe("param");
  });

  it("rooms/replace vosstanavlivaet chernovik", () => {
    const state = calculatorReducer(createInitialState(), {
      type: "rooms/replace",
      rooms: [makeRoom("r1"), makeRoom("r2")],
      scenario: "advanced",
      scope: "room",
    });

    expect(state.rooms).toHaveLength(2);
    expect(state.roomSeq).toBe(3);
    expect(state.scenario).toBe("advanced");
    expect(state.prefilled).toEqual({});
  });
});

describe("T-030 - reducer: podtverzhdeniya i ekrany", () => {
  it("param/confirm hranit flag po komnate", () => {
    const state = calculatorReducer(withRooms(makeRoom("r1")), {
      type: "param/confirm",
      roomId: "r1",
      param: "area",
      value: true,
    });

    expect(isParamConfirmed(state, "r1", "area")).toBe(true);
    expect(isParamConfirmed(state, "r1", "ceiling")).toBe(false);
  });

  it("push/pop rabotayut kak istoriya, pervyy ekran ne teryaetsya", () => {
    let state = createInitialState();
    state = calculatorReducer(state, {
      type: "screen/push",
      screen: { t: "roomPicker", mode: "first" },
    });
    state = calculatorReducer(state, {
      type: "screen/push",
      screen: { t: "param", roomId: "r1", param: "area" },
    });
    expect(selectScreen(state).t).toBe("param");

    state = calculatorReducer(state, { type: "screen/pop" });
    expect(selectScreen(state).t).toBe("roomPicker");

    state = calculatorReducer(state, { type: "screen/pop" });
    state = calculatorReducer(state, { type: "screen/pop" });
    expect(state.screenHistory).toHaveLength(1);
    expect(selectScreen(state).t).toBe("scenario");
  });

  it("screen/replace menyaet tekushchiy ekran bez rosta istorii", () => {
    let state = calculatorReducer(createInitialState(), {
      type: "screen/push",
      screen: { t: "roomPicker", mode: "first" },
    });
    const before = state.screenHistory.length;

    state = calculatorReducer(state, { type: "screen/replace", screen: { t: "summary" } });

    expect(state.screenHistory).toHaveLength(before);
    expect(selectScreen(state).t).toBe("summary");
  });
});
