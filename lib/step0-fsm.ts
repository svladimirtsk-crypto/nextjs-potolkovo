// Step0 Quiz V2 — FSM
// Один экран = одна карточка. Без resumeStep-ловушек, с history-stack.

import type { SolutionScenario } from "./calculator-modal-types";

export type ParamId =
  | "area"
  | "ceiling"
  | "shadowProfile"
  | "floatingProfile"
  | "lightLines"
  | "cornice"
  | "track"
  | "chandeliers"
  | "lights";

export const ALL_PARAMS: ParamId[] = [
  "area",
  "ceiling",
  "shadowProfile",
  "floatingProfile",
  "lightLines",
  "cornice",
  "track",
  "chandeliers",
  "lights",
];

export type Step0Screen =
  | { t: "scenario" }
  | { t: "roomPicker"; mode: "first" | "add" }
  | { t: "roomEdit"; roomId: string }
  | { t: "param"; roomId: string | "object"; param: ParamId }
  | { t: "summary" };

export type Step0History = Step0Screen[];

export function screenKey(s: Step0Screen): string {
  switch (s.t) {
    case "scenario": return "scenario";
    case "roomPicker": return `roomPicker:${s.mode}`;
    case "roomEdit": return `roomEdit:${s.roomId}`;
    case "param": return `param:${s.roomId}:${s.param}`;
    case "summary": return "summary";
  }
}

export function isSameScreen(a: Step0Screen, b: Step0Screen): boolean {
  return screenKey(a) === screenKey(b);
}

// Контекст для вычисления следующего шага
export type Step0FlowContext = {
  scenario: SolutionScenario;
  calcMode: "room" | "object" | null;
  roomsCount: number;
  activeRoomId: string | null;
  // какие параметры актуальны для текущей комнаты/объекта
  enabledParams: ParamId[];
  // какие уже подтверждены
  confirmed: Partial<Record<ParamId, boolean>>;
  // есть ли следующая незавершённая комната
  hasNextIncompleteRoom: boolean;
};

export function getEnabledParams(opts: {
  scenario: SolutionScenario;
  shadowEnabled: boolean;
  floatingEnabled: boolean;
  showModernOptions: boolean;
}): ParamId[] {
  const p: ParamId[] = ["area", "ceiling"];
  if (opts.shadowEnabled && opts.floatingEnabled) {
    p.push("shadowProfile"); // объединённый шаг
  } else {
    if (opts.shadowEnabled) p.push("shadowProfile");
    if (opts.floatingEnabled) p.push("floatingProfile");
  }
  if (opts.showModernOptions) p.push("lightLines");
  p.push("cornice");
  if (opts.showModernOptions) p.push("track");
  p.push("chandeliers", "lights");
  return p;
}

export function getFirstUnconfirmed(
  enabled: ParamId[],
  confirmed: Partial<Record<ParamId, boolean>>
): ParamId | null {
  return enabled.find((id) => !confirmed[id]) ?? null;
}

// Линейный следующий экран (без resume-ловушек)
export function getNextScreen(
  current: Step0Screen,
  ctx: Step0FlowContext
): Step0Screen | null {
  switch (current.t) {
    case "scenario":
      // T-041: экран режима расчёта удалён — режим переключается на экране площади.
      if (ctx.calcMode === "object") {
        const firstParam = ctx.enabledParams[0] ?? "area";
        return { t: "param", roomId: "object", param: firstParam };
      }
      return ctx.roomsCount === 0
        ? { t: "roomPicker", mode: "first" }
        : { t: "roomPicker", mode: "add" };
    case "roomPicker":
      // после выбора комнаты — всегда area
      if (ctx.activeRoomId) {
        return { t: "param", roomId: ctx.activeRoomId, param: "area" };
      }
      return null;
    case "param": {
      // если параметр подтверждён — идём к следующему неподтверждённому
      const nextParam = getFirstUnconfirmed(ctx.enabledParams, ctx.confirmed);
      if (nextParam) {
        return { t: "param", roomId: current.roomId, param: nextParam };
      }
      // все параметры комнаты готовы
      if (ctx.calcMode === "room") {
        // есть следующая незавершённая комната?
        if (ctx.hasNextIncompleteRoom) {
          return { t: "roomPicker", mode: "add" };
        }
        // иначе — сводка (или roomEdit, решаем снаружи)
        return { t: "summary" };
      }
      return { t: "summary" };
    }
    case "roomEdit":
      // из карточки комнаты — ждём явного выбора параметра
      return null;
    case "summary":
      return null;
  }
}

// Куда идти по кнопке "Назад" — просто pop history.
// Но иногда нужен умный fallback, если history пуст:
export function getBackFallback(
  current: Step0Screen,
  ctx: Step0FlowContext
): Step0Screen | null {
  switch (current.t) {
    case "scenario": return null;
    case "roomPicker":
      return { t: "scenario" };
    case "param": {
      // найти предыдущий подтверждённый параметр
      const idx = ctx.enabledParams.indexOf(current.param);
      if (idx > 0) {
        const prev = ctx.enabledParams[idx - 1];
        return { t: "param", roomId: current.roomId, param: prev };
      }
      // первый параметр → назад к выбору помещения или к сценарию
      if (ctx.calcMode === "room") {
        return { t: "roomPicker", mode: ctx.roomsCount > 1 ? "add" : "first" };
      }
      return { t: "scenario" };
    }
    case "roomEdit":
      return { t: "summary" };
    case "summary": {
      // назад со сводки → последний параметр
      const last = ctx.enabledParams[ctx.enabledParams.length - 1];
      if (last) {
        const roomId = ctx.activeRoomId ?? "object";
        return { t: "param", roomId, param: last };
      }
      return { t: "scenario" };
    }
  }
}

// Прогресс для хедера модалки

// Лейблы для футера
export function getParamConfirmLabel(param: ParamId): string {
  const map: Record<ParamId, string> = {
    area: "Подтвердить площадь →",
    ceiling: "Подтвердить тип →",
    shadowProfile: "Подтвердить профиль →",
    floatingProfile: "Подтвердить профиль →",
    lightLines: "Подтвердить линии →",
    cornice: "Подтвердить карниз →",
    track: "Подтвердить трек →",
    chandeliers: "Подтвердить люстры →",
    lights: "Подтвердить свет →",
  };
  return map[param];
}
