import { describe, expect, it } from "vitest";

import {
  getBackFallback,
  getEnabledParams,
  getFirstUnconfirmed,
  getNextScreen,
  isSameScreen,
  screenKey,
  type ParamId,
  type Step0FlowContext,
  type Step0Screen,
} from "../lib/step0-fsm";
import { calcProgress } from "../lib/calculator/fsm";
import type { SolutionScenario } from "../lib/calculator-modal-types";

/** Контекст «обычной комнаты» — база, которую тесты точечно переопределяют. */
function makeCtx(patch: Partial<Step0FlowContext> = {}): Step0FlowContext {
  const enabledParams = getEnabledParams({
    scenario: "modern",
    shadowEnabled: true,
    floatingEnabled: false,
    showModernOptions: true,
  });

  return {
    scenario: "modern",
    calcMode: "room",
    roomsCount: 1,
    activeRoomId: "room-1",
    enabledParams,
    confirmed: {},
    hasNextIncompleteRoom: false,
    ...patch,
  };
}

describe("T-091 · fsm: набор параметров", () => {
  it("базовый сценарий — только площадь и потолок", () => {
    const params = getEnabledParams({
      scenario: "standard",
      shadowEnabled: false,
      floatingEnabled: false,
      showModernOptions: false,
    });

    expect(params).toEqual(["area", "ceiling", "cornice", "chandeliers", "lights"]);
  });

  it("теневой и парящий вместе дают один объединённый шаг, а не два", () => {
    const both = getEnabledParams({
      scenario: "modern",
      shadowEnabled: true,
      floatingEnabled: true,
      showModernOptions: true,
    });

    expect(both.filter((p) => p === "shadowProfile")).toHaveLength(1);
    expect(both).not.toContain("floatingProfile");
  });

  it("современные опции добавляют линии и трек", () => {
    const modern = getEnabledParams({
      scenario: "modern",
      shadowEnabled: false,
      floatingEnabled: false,
      showModernOptions: true,
    });

    expect(modern).toContain("lightLines");
    expect(modern).toContain("track");
  });
});

describe("T-091 · fsm: первый неподтверждённый", () => {
  const enabled: ParamId[] = ["area", "ceiling", "cornice"];

  it("возвращает первый неподтверждённый по порядку", () => {
    expect(getFirstUnconfirmed(enabled, { area: true })).toBe("ceiling");
  });

  it("null, когда подтверждено всё", () => {
    expect(getFirstUnconfirmed(enabled, { area: true, ceiling: true, cornice: true })).toBeNull();
  });
});

describe("T-091 · fsm: next / back", () => {
  it("со сценария идём дальше, а назад — некуда", () => {
    const ctx = makeCtx();
    expect(getNextScreen({ t: "scenario" }, ctx)).not.toBeNull();
    expect(getBackFallback({ t: "scenario" }, ctx)).toBeNull();
  });

  it("назад с параметра — на предыдущий параметр", () => {
    const ctx = makeCtx();
    const [first, second] = ctx.enabledParams;

    const back = getBackFallback({ t: "param", roomId: "room-1", param: second }, ctx);
    expect(back).toEqual({ t: "param", roomId: "room-1", param: first });
  });

  it("назад с первого параметра в режиме комнат — к выбору помещения", () => {
    const ctx = makeCtx({ roomsCount: 2 });
    const back = getBackFallback(
      { t: "param", roomId: "room-1", param: ctx.enabledParams[0] },
      ctx
    );

    expect(back).toEqual({ t: "roomPicker", mode: "add" });
  });

  it("назад с первого параметра в режиме объекта — к сценарию", () => {
    const ctx = makeCtx({ calcMode: "object", activeRoomId: null });
    const back = getBackFallback(
      { t: "param", roomId: "object", param: ctx.enabledParams[0] },
      ctx
    );

    expect(back).toEqual({ t: "scenario" });
  });

  it("назад со сводки — на последний параметр, а не в начало", () => {
    const ctx = makeCtx();
    const last = ctx.enabledParams[ctx.enabledParams.length - 1];

    expect(getBackFallback({ t: "summary" }, ctx)).toEqual({
      t: "param",
      roomId: "room-1",
      param: last,
    });
  });

  it("цепочка «назад» со сводки доходит до старта и не зацикливается", () => {
    const ctx = makeCtx();
    let screen: Step0Screen | null = { t: "summary" };
    const visited: string[] = [];

    for (let i = 0; i < 50 && screen; i += 1) {
      const key = screenKey(screen);
      expect(visited, `повтор экрана ${key}`).not.toContain(key);
      visited.push(key);
      screen = getBackFallback(screen, ctx);
    }

    expect(screen).toBeNull();
    expect(visited.at(-1)).toBe("scenario");
  });
});

describe("T-091 · fsm: сравнение экранов", () => {
  it("экраны параметров различаются по комнате и параметру", () => {
    const a: Step0Screen = { t: "param", roomId: "room-1", param: "area" };
    expect(isSameScreen(a, { t: "param", roomId: "room-1", param: "area" })).toBe(true);
    expect(isSameScreen(a, { t: "param", roomId: "room-2", param: "area" })).toBe(false);
    expect(isSameScreen(a, { t: "param", roomId: "room-1", param: "ceiling" })).toBe(false);
  });
});

/**
 * N-011 · Фиксируем фактический знаменатель «вопрос N из M».
 *
 * ТЗ v2 предполагало 5/8/9, но реальные значения другие: экран режима расчёта
 * удалён в T-041, а парящий профиль спрашивается отдельным экраном. Тест
 * закрепляет факт, чтобы M не «поплыл» незаметно при правке списка параметров.
 */
describe("N-011 · знаменатель прогресса Шага 0", () => {
  it("standard = 8, modern = 10, advanced = 10", () => {
    const totalFor = (scenario: SolutionScenario) =>
      calcProgress({ t: "scenario" }, { scenario, enabledParams: [] }).total;

    expect(totalFor("standard")).toBe(8);
    expect(totalFor("modern")).toBe(10);
    expect(totalFor("advanced")).toBe(10);
  });

  it("знаменатель не меняется по мере ответов", () => {
    const ctx = { scenario: "standard" as SolutionScenario, enabledParams: ["area" as const] };
    const atStart = calcProgress({ t: "scenario" }, ctx).total;
    const atSummary = calcProgress({ t: "summary" }, ctx).total;

    expect(atSummary).toBe(atStart);
  });
});
