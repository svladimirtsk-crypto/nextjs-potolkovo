/**
 * T-030 · Переходы квиза Шага 0.
 *
 * Перенос `lib/step0-fsm.ts` в единый стор: тот модуль остаётся тонкой
 * ре-экспортной обёрткой на время миграции. Ключевое отличие — прогресс:
 * прогресс относится к реальным параметрам текущей комнаты.
 * Служебный сценарий и проверка больше не маскируются под вопросы;
 * при явном включении новой функции число параметров может измениться.
 */
import type { SolutionScenario } from "@/lib/calculator-modal-types";
import {
  ALL_PARAMS,
  getBackFallback,
  getEnabledParams,
  getFirstUnconfirmed,
  getNextScreen,
  getParamConfirmLabel,
  isSameScreen,
  screenKey,
  type ParamId,
  type Step0FlowContext,
  type Step0History,
  type Step0Screen,
} from "@/lib/step0-fsm";

export {
  ALL_PARAMS,
  getBackFallback,
  getEnabledParams,
  getFirstUnconfirmed,
  getNextScreen,
  getParamConfirmLabel,
  isSameScreen,
  screenKey,
};
export type { ParamId, Step0FlowContext, Step0History, Step0Screen };

/**
 * Сколько параметров максимум может спросить сценарий.
 *
 * `standard` — area, ceiling, cornice, chandeliers, lights.
 * `modern`/`advanced` дополнительно: lightLines, track и оба профиля
 * (теневой и парящий), которые появляются по мере выбора типа потолка.
 */
export function maxParamsForScenario(scenario: SolutionScenario): number {
  const base = getEnabledParams({
    scenario,
    shadowEnabled: true,
    floatingEnabled: false,
    showModernOptions: scenario !== "standard",
  });

  // Парящий профиль спрашивается отдельным экраном, когда выбран без теневого.
  const withFloating = getEnabledParams({
    scenario,
    shadowEnabled: false,
    floatingEnabled: true,
    showModernOptions: scenario !== "standard",
  });

  return Math.max(base.length, withFloating.length);
}

export type Step0Progress = {
  done: number;
  total: number;
  /** Plain-language state for screens that are not questions. */
  caption?: string;
};

export function calcProgress(screen: Step0Screen, ctx: { scenario: SolutionScenario; enabledParams: ParamId[] }): Step0Progress {
  const total = ctx.enabledParams.length;
  if (screen.t === "param") {
    const index = ctx.enabledParams.indexOf(screen.param);
    return { done: index >= 0 ? index + 1 : 0, total };
  }
  if (screen.t === "summary") return { done: total, total };
  return { done: 0, total };
}

export function paramPosition(screen: Step0Screen, ctx: { scenario: SolutionScenario; enabledParams: ParamId[] }): { index: number; total: number } | null {
  if (screen.t !== "param") return null;
  const index = ctx.enabledParams.indexOf(screen.param);
  return index < 0 ? null : { index: index + 1, total: ctx.enabledParams.length };
}
