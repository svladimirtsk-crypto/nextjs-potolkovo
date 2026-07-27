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
  | { t: "calcMode" }
  | { t: "roomPicker"; mode: "first" | "add" }
  | { t: "roomEdit"; roomId: string }
  | { t: "param"; roomId: string | "object"; param: ParamId }
  | { t: "summary" };

export type Step0History = Step0Screen[];

export function screenKey(s: Step0Screen): string {
  switch (s.t) {
    case "scenario": return "scenario";
    case "calcMode": return "calcMode";
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
      return { t: "calcMode" };
    case "calcMode":
      if (ctx.calcMode === "room") {
        return ctx.roomsCount === 0
          ? { t: "roomPicker", mode: "first" }
          : { t: "roomPicker", mode: "add" };
      }
      // object-scope: сразу к первому параметру
      const firstParam = ctx.enabledParams[0] ?? "area";
      return { t: "param", roomId: "object", param: firstParam };
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
    case "calcMode": return { t: "scenario" };
    case "roomPicker":
      return { t: "calcMode" };
    case "param": {
      // найти предыдущий подтверждённый параметр
      const idx = ctx.enabledParams.indexOf(current.param);
      if (idx > 0) {
        const prev = ctx.enabledParams[idx - 1];
        return { t: "param", roomId: current.roomId, param: prev };
      }
      // первый параметр → назад к roomPicker или calcMode
      if (ctx.calcMode === "room") {
        return { t: "roomPicker", mode: ctx.roomsCount > 1 ? "add" : "first" };
      }
      return { t: "calcMode" };
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
      return { t: "calcMode" };
    }
  }
}

// Прогресс для хедера модалки
export function calcStep0Progress(
  screen: Step0Screen,
  ctx: Step0FlowContext
): { done: number; total: number } | null {
  const totalBase =
    1 + // scenario
    1 + // calcMode
    ctx.enabledParams.length +
    1; // summary

  let done = 0;
  switch (screen.t) {
    case "scenario": done = 0; break;
    case "calcMode": done = 1; break;
    case "roomPicker": done = 2; break;
    case "param": {
      const idx = ctx.enabledParams.indexOf(screen.param);
      done = 2 + Math.max(0, idx);
      // + подтверждённые до него
      break;
    }
    case "roomEdit": done = 2 + ctx.enabledParams.length; break;
    case "summary": done = totalBase - 1; break;
  }
  return { done, total: totalBase };
}

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
