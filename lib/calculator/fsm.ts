/**
 * T-030 · Переходы квиза Шага 0.
 *
 * Перенос `lib/step0-fsm.ts` в единый стор: тот модуль остаётся тонкой
 * ре-экспортной обёрткой на время миграции. Ключевое отличие — прогресс:
 * знаменатель `M` фиксирован для сценария (`maxParamsForScenario`), поэтому
 * полоска «вопрос N из M» больше не прыгает, когда включение теневого профиля
 * добавляет параметр в середине опроса.
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
  /** Сколько шагов уже позади. */
  done: number;
  /** Фиксированный знаменатель: параметры сценария + сценарий, режим и сводка. */
  total: number;
};

/**
 * Прогресс с фиксированным знаменателем. Считаем по позиции экрана в потоке,
 * а не по числу подтверждённых параметров, чтобы полоска не откатывалась назад
 * при возврате на предыдущий вопрос.
 */
export function calcProgress(
  screen: Step0Screen,
  ctx: { scenario: SolutionScenario; enabledParams: ParamId[] }
): Step0Progress {
  const maxParams = maxParamsForScenario(ctx.scenario);
  // scenario + calcMode + параметры + summary
  const total = maxParams + 3;

  let done = 0;
  switch (screen.t) {
    case "scenario":
      done = 0;
      break;
    case "calcMode":
      done = 1;
      break;
    case "roomPicker":
      done = 2;
      break;
    case "param": {
      const index = ctx.enabledParams.indexOf(screen.param);
      done = 2 + Math.max(0, index);
      break;
    }
    case "roomEdit":
      done = 2 + maxParams;
      break;
    case "summary":
      done = total - 1;
      break;
  }

  return { done: Math.min(done, total), total };
}

/** Номер текущего вопроса для подписи «вопрос N из M». */
export function paramPosition(
  screen: Step0Screen,
  ctx: { scenario: SolutionScenario; enabledParams: ParamId[] }
): { index: number; total: number } | null {
  if (screen.t !== "param") return null;

  const index = ctx.enabledParams.indexOf(screen.param);
  if (index < 0) return null;

  return { index: index + 1, total: maxParamsForScenario(ctx.scenario) };
}
