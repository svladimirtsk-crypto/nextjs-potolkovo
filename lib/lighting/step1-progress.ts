/**
 * PT-018 (B-F104, T-324) · переходы между экранами Шага 1 «Свет».
 *
 * Шаг 1 — это маленький конечный автомат: система → профиль → светильники →
 * точки → лампы → люстры → подсветка карниза → готово. Правила перехода
 * («куда дальше, если точки набраны, а лампы нет») были зашиты в пять
 * `useCallback` внутри компонента, и прочитать их можно было только целиком,
 * вместе с корзиной и разметкой. Здесь — та же логика чистыми функциями: на
 * вход факты, на выход следующий экран (и раздел каталога, который надо
 * показать вместе с ним).
 *
 * Компонент по-прежнему владеет состоянием (`wOverride`) — это сознательно:
 * перевод Шага 1 на собственный редьюсер является отдельной задачей.
 */
import type { CatalogSectionId, TrackSystemId } from "@/lib/catalog-ui-config";
import type { WizardStep } from "@/lib/lighting/resolve-initial-step";

/** Факты, по которым решается переход. Всё это компонент уже посчитал. */
export type Step1ProgressInput = {
  requiredTrackMeters: number;
  requiredPointQty: number;
  selectedTrackMeters: number;
  selectedPointQty: number;
  lampRequiredTotal: number;
  lampCurrentTotal: number;
  selectedTrackSystem: TrackSystemId | null;
  /** Сколько светильников выбранной системы есть в каталоге: если 0 — экран пропускаем. */
  trackFixturesCount: number;
  needsChandeliers: boolean;
  needsCorniceLighting: boolean;
};

/** Куда идём. `catalogSection` — раздел каталога, который надо показать вместе с экраном. */
export type Step1NavResult = { step: WizardStep; catalogSection?: CatalogSectionId };

export type Step1Progress = {
  trackComplete: boolean;
  pointsComplete: boolean;
  lampsComplete: boolean;
  requiredSelectionComplete: boolean;
  missingTrackMeters: number;
  missingPointQty: number;
  missingLampQty: number;
};

/** Что из обязательного уже закрыто и чего не хватает в штуках/метрах. */
export function calcStep1Progress(input: Step1ProgressInput): Step1Progress {
  const trackComplete =
    input.requiredTrackMeters <= 0 || input.selectedTrackMeters >= input.requiredTrackMeters;
  const pointsComplete =
    input.requiredPointQty <= 0 || input.selectedPointQty >= input.requiredPointQty;
  const lampsComplete =
    input.lampRequiredTotal <= 0 || input.lampCurrentTotal >= input.lampRequiredTotal;

  return {
    trackComplete,
    pointsComplete,
    lampsComplete,
    requiredSelectionComplete: trackComplete && pointsComplete && lampsComplete,
    missingTrackMeters: Math.max(0, input.requiredTrackMeters - input.selectedTrackMeters),
    missingPointQty: Math.max(0, input.requiredPointQty - input.selectedPointQty),
    missingLampQty: Math.max(0, input.lampRequiredTotal - input.lampCurrentTotal),
  };
}

/**
 * После выбора профиля.
 *
 * `null` — не переходить: метраж задан, но система не выбрана или профиля
 * набрано меньше. Кнопка в этом состоянии ничего не делает, а не уводит
 * человека дальше с неполным комплектом.
 */
export function nextAfterTrackProfile(input: Step1ProgressInput): Step1NavResult | null {
  if (
    input.requiredTrackMeters > 0 &&
    (!input.selectedTrackSystem || input.selectedTrackMeters < input.requiredTrackMeters)
  ) {
    return null;
  }

  if (input.trackFixturesCount > 0) return { step: "trackFixtures" };
  if (input.requiredPointQty > 0 && input.selectedPointQty < input.requiredPointQty) {
    return { step: "points" };
  }
  if (input.lampRequiredTotal > 0 && input.lampCurrentTotal < input.lampRequiredTotal) {
    return { step: "lamps" };
  }
  return { step: "done" };
}

/** После светильников трека: точки, затем лампы. */
export function nextAfterTrackFixtures(input: Step1ProgressInput): Step1NavResult {
  if (input.requiredPointQty > 0 && input.selectedPointQty < input.requiredPointQty) {
    return { step: "points" };
  }
  if (input.lampRequiredTotal > 0 && input.lampCurrentTotal < input.lampRequiredTotal) {
    return { step: "lamps" };
  }
  return { step: "done" };
}

/** T-043: после ламп — люстры, затем подсветка карниза. */
export function nextAfterLamps(input: Step1ProgressInput): Step1NavResult {
  if (input.needsChandeliers) return { step: "chandeliers", catalogSection: "chandeliers" };
  if (input.needsCorniceLighting) {
    return { step: "corniceLighting", catalogSection: "cornice-lighting" };
  }
  return { step: "done" };
}

/** После люстр остаётся только подсветка карниза. */
export function nextAfterChandeliers(input: Step1ProgressInput): Step1NavResult {
  if (input.needsCorniceLighting) {
    return { step: "corniceLighting", catalogSection: "cornice-lighting" };
  }
  return { step: "done" };
}

/** После точек: сначала добираем лампы, дальше — как после ламп. */
export function nextAfterPoints(input: Step1ProgressInput): Step1NavResult {
  if (input.lampRequiredTotal > 0 && input.lampCurrentTotal < input.lampRequiredTotal) {
    return { step: "lamps" };
  }
  return nextAfterLamps(input);
}

/**
 * «Назад» с точек — к экрану трека, если трек выбран или требуется.
 * PT-018: правило жило инлайн-стрелкой в JSX вкладки «Подбор» и было копией
 * `backFromLamps` без первой ветки.
 */
export function backFromPoints(input: Step1ProgressInput): Step1NavResult {
  if (input.selectedTrackSystem) return { step: "trackFixtures" };
  if (input.requiredTrackMeters > 0) return { step: "trackProfile" };
  return { step: "system" };
}

/** «Назад» с ламп — к последнему осмысленному экрану до них. */
export function backFromLamps(input: Step1ProgressInput): Step1NavResult {
  if (input.requiredPointQty > 0) return { step: "points" };
  if (input.selectedTrackSystem) return { step: "trackFixtures" };
  if (input.requiredTrackMeters > 0) return { step: "trackProfile" };
  return { step: "system" };
}

export type MissingAction = { label: string; step: WizardStep };

/**
 * Чего не хватает до полного комплекта — первым по порядку приоритета:
 * метры трека → точки → лампы. `null`, если закрыто всё.
 */
export function missingActionFor(
  progress: Step1Progress,
  selectedTrackSystem: TrackSystemId | null
): MissingAction | null {
  if (progress.missingTrackMeters > 0) {
    return selectedTrackSystem
      ? { label: "Добрать профиль →", step: "trackProfile" }
      : { label: "Выбрать систему →", step: "system" };
  }
  if (progress.missingPointQty > 0) return { label: "Выбрать светильники →", step: "points" };
  if (progress.missingLampQty > 0) return { label: "Добавить лампы →", step: "lamps" };
  return null;
}

/**
 * «Готово» с незакрытыми требованиями показывает недостающий экран, а не тупик:
 * человек нажимает «Дальше» и видит, что именно осталось добрать.
 */
export function shownStepFor(
  step: WizardStep,
  progress: Step1Progress,
  missingAction: MissingAction | null
): WizardStep {
  if (step === "done" && !progress.requiredSelectionComplete && missingAction) {
    return missingAction.step;
  }
  return step;
}
