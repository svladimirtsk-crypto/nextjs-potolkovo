import type { Step1FooterAction } from "@/lib/calculator-modal-types";
import type { WizardStep } from "@/lib/lighting/resolve-initial-step";

/**
 * N-050 · Какая кнопка стоит в футере модалки на Шаге 1.
 *
 * Раньше это решение жило внутри `useEffect`, который на каждый рендер
 * проталкивал результат в контекст модалки через `setStep1FooterAction`.
 * Состояние футера оказывалось производным от состояния шага, но хранилось
 * отдельно — классический «второй источник правды»: при рассинхроне на
 * кнопке оставалась подпись предыдущего экрана.
 *
 * Здесь описан только выбор подписи и признака блокировки. Функция чистая,
 * поэтому её поведение проверяется тестами без рендера дерева, а компонент
 * получает готовый дескриптор и подставляет обработчики.
 */

/** Идентификатор действия. Обработчик по нему подбирает вызывающая сторона. */
export type Step1FooterIntent =
  | "missing"
  | "finish"
  | "pickSystem"
  | "confirmTrackProfile"
  | "confirmTrackFixtures"
  | "confirmPoints"
  | "confirmLamps"
  | "confirmChandeliers"
  | "confirmCornice";

export type Step1FooterDescriptor = {
  intent: Step1FooterIntent;
  /** Подпись; для `missing` и `finish` её подставляет вызывающая сторона. */
  label?: string;
  disabled?: boolean;
};

export type Step1FooterInput = {
  /** Вкладка «Подбор» — только на ней футер ведёт по шагам мастера. */
  activeTab: string;
  /** Шаг с учётом подмены на незакрытый пункт (`shownWStep`). */
  shownWStep: WizardStep;
  /** Есть незакрытый обязательный пункт подбора. */
  hasMissingAction: boolean;
  /** На экране выбора системы есть из чего выбирать. */
  hasSystemOptions: boolean;
  /** Комплект без блока питания — «К итогу» блокируется. */
  psuBlocks: boolean;
  requiredSelectionComplete: boolean;
  requiredTrackMeters: number;
  hasTrackSystem: boolean;
  trackComplete: boolean;
  pointsComplete: boolean;
  lampsComplete: boolean;
};

export function resolveStep1FooterAction(input: Step1FooterInput): Step1FooterDescriptor {
  const fallback: Step1FooterDescriptor = input.hasMissingAction
    ? { intent: "missing" }
    : { intent: "finish" };

  // Вкладки «Каталог» и «Выбранное» не ведут по шагам: там футер завершающий.
  if (input.activeTab !== "recommendations") return fallback;

  switch (input.shownWStep) {
    case "none":
      return { intent: "finish" };

    case "system":
      if (input.hasSystemOptions) {
        return { intent: "pickSystem", label: "Выберите систему", disabled: true };
      }
      return {
        intent: "finish",
        disabled: input.psuBlocks || !input.requiredSelectionComplete,
      };

    case "trackProfile":
      return {
        intent: "confirmTrackProfile",
        label: "Подтвердить профиль →",
        disabled: input.requiredTrackMeters > 0 && (!input.hasTrackSystem || !input.trackComplete),
      };

    case "trackFixtures":
      return { intent: "confirmTrackFixtures", label: "Подтвердить светильники →" };

    case "points":
      return {
        intent: "confirmPoints",
        label: "Подтвердить светильники →",
        disabled: !input.pointsComplete,
      };

    case "lamps":
      return {
        intent: "confirmLamps",
        label: "Подтвердить лампы →",
        disabled: !input.lampsComplete,
      };

    case "chandeliers":
      return { intent: "confirmChandeliers", label: "Подтвердить люстры →" };

    case "corniceLighting":
      return { intent: "confirmCornice", label: "Подтвердить подсветку →" };

    default:
      return fallback;
  }
}

/**
 * N-050 · Сборка действия футера Шага 1 из дескриптора и обработчиков.
 *
 * Раньше это ветвление жило прямо в эффекте компонента: три ветки,
 * словарь обработчиков и вызовы сеттера в каждой. Логика чистая — какой
 * обработчик соответствует намерению, — и проверять её удобнее тестом,
 * а не кликами по мастеру.
 */
export function buildStep1FooterAction(
  descriptor: { intent: string; label?: string; disabled?: boolean },
  deps: {
    missingAction: { label: string } | null;
    goToMissingAction: () => void;
    finishAction: () => Step1FooterAction;
    handlers: Record<string, () => void>;
  }
): Step1FooterAction {
  const { intent, label, disabled } = descriptor;

  if (intent === "missing") {
    return deps.missingAction
      ? { label: deps.missingAction.label, onClick: deps.goToMissingAction }
      : deps.finishAction();
  }

  if (intent === "finish") {
    const base = deps.finishAction();
    return disabled === undefined ? base : { ...base, disabled };
  }

  return {
    label: label ?? "",
    disabled,
    onClick: deps.handlers[intent] ?? (() => undefined),
  };
}
