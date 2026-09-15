"use client";

/**
 * PT-018 (B-F104, T-324) · мастер Шага 1 «Свет»: состояние экрана и переходы.
 *
 * Шаг 1 живёт не так, как остальные шаги модалки: у него есть собственный
 * внутренний экран (`wStep`), который выводится резолвером `resolveInitialStep`
 * из данных Шага 0 и корзины, а ручной выбор человека ложится поверх него
 * оверрайдом. Плюс восемь переходов между экранами и правило «Готово с
 * недобором показывает недостающий экран».
 *
 * Всё это было размазано по компоненту между корзиной и разметкой. Здесь хук
 * собирает экран мастера из фактов: на вход — данные Шага 0, корзина и каталог,
 * на выход — текущий экран, списки товаров для него и обработчики переходов.
 * Правила переходов — чистые функции `step1-progress`, правила выдачи —
 * `step1-selectors`; хук только связывает их с состоянием.
 *
 * Состояние оверрайда (`wOverride`) намеренно осталось в компоненте: его
 * сеттер нужен ещё и корзине (профиль выбирает систему), а создавать сеттер
 * внутри хука, который вызывается после корзины, значило бы завести цикл
 * зависимостей. Перевод Шага 1 на собственный редьюсер — отдельная задача.
 *
 * ВАЖНО: все возвращаемые функции стабильны между рендерами (useCallback).
 * Их идентичность входит в зависимости `useLayoutEffect`, который публикует
 * кнопку футера в контекст модалки: «плавающая» ссылка привела бы к публикации
 * на каждом рендере и бесконечному обновлению контекста.
 */
import { useCallback, useMemo } from "react";

import type { CatalogSectionId, TrackSystemId } from "@/lib/catalog-ui-config";
import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";
import type { CartEntry } from "@/lib/lighting/cart-derived";
import { resolveInitialLightingStep, type WizardStep } from "@/lib/lighting/resolve-initial-step";
import {
  backFromLamps,
  calcStep1Progress,
  missingActionFor,
  nextAfterChandeliers,
  nextAfterLamps,
  nextAfterPoints,
  nextAfterTrackFixtures,
  nextAfterTrackProfile,
  shownStepFor,
  type MissingAction,
  type Step1NavResult,
  type Step1ProgressInput,
} from "@/lib/lighting/step1-progress";
import {
  detectCartTrackSystem,
  selectTrackFixtures,
  selectWizardTrackProfiles,
  summarizeCartForStep,
  wizardSystemOptionsFor,
  type TrackMountType,
  type TrackProfileRecommendation,
} from "@/lib/lighting/step1-selectors";

/** Ручной выбор человека поверх стартового экрана. */
export type WizardOverride = { step: WizardStep; system: TrackSystemId | null } | null;

export type UseStep1WizardInput = {
  /* Данные Шага 0 */
  requiredTrackMeters: number;
  requiredPointQty: number;
  trackMountType: TrackMountType;
  needsChandeliers: boolean;
  needsCorniceLighting: boolean;

  /* Корзина */
  cartEntries: CartEntry[];
  missingLampsCount: number;
  selectedTrackMeters: number;
  selectedPointQty: number;
  lampRequiredTotal: number;
  lampCurrentTotal: number;

  /* Каталог */
  products: FeedCatalogProduct[];
  recommendedTrackProfiles: TrackProfileRecommendation[];

  /* Состояние мастера (владеет компонент) */
  wOverride: WizardOverride;
  setWStep: (step: WizardStep) => void;
  setWSystem: (system: TrackSystemId | null) => void;
  clearTrackProductsForSystem: (system: TrackSystemId | null) => void;

  /* Действия интерфейса */
  onSelectCatalogSection: (section: CatalogSectionId) => void;
  /** Открыть вкладку «Подбор» в режиме каталога — путь к недостающему пункту. */
  onOpenRecommendations: () => void;
};

export type Step1WizardApi = {
  wStep: WizardStep;
  shownWStep: WizardStep;
  selectedTrackSystem: TrackSystemId | null;
  wizardSystemOptions: TrackSystemId[];
  trackProfiles: FeedCatalogProduct[];
  trackFixtures: FeedCatalogProduct[];

  trackComplete: boolean;
  pointsComplete: boolean;
  lampsComplete: boolean;
  requiredSelectionComplete: boolean;
  missingAction: MissingAction | null;

  chooseWizardSystem: (system: TrackSystemId) => void;
  chooseNoTrackFlow: () => void;
  goAfterTrackProfile: () => void;
  goAfterTrackFixtures: () => void;
  goAfterLamps: () => void;
  goAfterChandeliers: () => void;
  goAfterPoints: () => void;
  goBackFromLamps: () => void;
  goToMissingAction: () => void;
};

export function useStep1Wizard(input: UseStep1WizardInput): Step1WizardApi {
  const {
    requiredTrackMeters,
    requiredPointQty,
    trackMountType,
    needsChandeliers,
    needsCorniceLighting,
    cartEntries,
    missingLampsCount,
    selectedTrackMeters,
    selectedPointQty,
    lampRequiredTotal,
    lampCurrentTotal,
    products,
    recommendedTrackProfiles,
    wOverride,
    setWStep,
    setWSystem,
    clearTrackProductsForSystem,
    onSelectCatalogSection,
    onOpenRecommendations,
  } = input;

  /* ─── T-010: стартовый экран пересчитывается резолвером ─── */

  const resolvedInitialStep = useMemo(
    () =>
      resolveInitialLightingStep({
        requiredTrackMeters,
        requiredPointQty,
        cart: summarizeCartForStep(cartEntries, missingLampsCount),
      }),
    [cartEntries, missingLampsCount, requiredPointQty, requiredTrackMeters]
  );

  // Итоговые экран и система: override пользователя поверх резолвера.
  const wStep: WizardStep = wOverride?.step ?? resolvedInitialStep;

  const cartTrackSystem = useMemo<TrackSystemId | null>(
    () => detectCartTrackSystem(cartEntries),
    [cartEntries]
  );

  const wSystem: TrackSystemId | null =
    requiredTrackMeters > 0 ? (wOverride ? wOverride.system : cartTrackSystem) : null;

  const selectedTrackSystem = useMemo<TrackSystemId | null>(
    () => wSystem ?? detectCartTrackSystem(cartEntries, { withAccessory: true }),
    [cartEntries, wSystem]
  );

  const wizardSystemOptions = useMemo<TrackSystemId[]>(
    () => wizardSystemOptionsFor({ requiredTrackMeters, trackMountType }),
    [requiredTrackMeters, trackMountType]
  );

  /* ─── Товары экранов, которые зависят от выбранной системы ─── */

  const trackProfiles = useMemo(
    () =>
      selectWizardTrackProfiles({
        products,
        selectedSystem: selectedTrackSystem,
        recommendedSystems: recommendedTrackProfiles.map((r) => r.system),
        trackMountType,
      }),
    [products, recommendedTrackProfiles, selectedTrackSystem, trackMountType]
  );

  const trackFixtures = useMemo(
    () => selectTrackFixtures(products, selectedTrackSystem),
    [products, selectedTrackSystem]
  );

  /* ─── Переходы между экранами ─── */

  const nav: Step1ProgressInput = useMemo(
    () => ({
      requiredTrackMeters,
      requiredPointQty,
      selectedTrackMeters,
      selectedPointQty,
      lampRequiredTotal,
      lampCurrentTotal,
      selectedTrackSystem,
      trackFixturesCount: trackFixtures.length,
      needsChandeliers,
      needsCorniceLighting,
    }),
    [lampCurrentTotal, lampRequiredTotal, needsChandeliers, needsCorniceLighting,
      requiredPointQty, requiredTrackMeters, selectedPointQty, selectedTrackMeters,
      selectedTrackSystem, trackFixtures.length]
  );

  /**
   * Переход: ставим экран и, если он про каталог, показываем нужный раздел.
   * `null` — оставаться на месте (профиль не добран).
   */
  const applyNav = useCallback(
    (result: Step1NavResult | null) => {
      if (!result) return;
      if (result.catalogSection) onSelectCatalogSection(result.catalogSection);
      setWStep(result.step);
    },
    [onSelectCatalogSection, setWStep]
  );

  /** Один обработчик на все переходы: правило перехода подставляется функцией. */
  const go = useCallback(
    (rule: (facts: Step1ProgressInput) => Step1NavResult | null) => applyNav(rule(nav)),
    [applyNav, nav]
  );

  const goAfterTrackProfile = useCallback(() => go(nextAfterTrackProfile), [go]);
  const goAfterTrackFixtures = useCallback(() => go(nextAfterTrackFixtures), [go]);
  /** T-043: после ламп — люстры, затем подсветка карниза. */
  const goAfterLamps = useCallback(() => go(nextAfterLamps), [go]);
  const goAfterChandeliers = useCallback(() => go(nextAfterChandeliers), [go]);
  const goAfterPoints = useCallback(() => go(nextAfterPoints), [go]);
  const goBackFromLamps = useCallback(() => go(backFromLamps), [go]);

  /* ─── Выбор системы и отказ от трека ─── */

  const chooseWizardSystem = useCallback(
    (system: TrackSystemId) => {
      setWSystem(system);
      clearTrackProductsForSystem(system);
      setWStep("trackProfile");
    },
    [clearTrackProductsForSystem, setWStep, setWSystem]
  );

  const chooseNoTrackFlow = useCallback(() => {
    setWSystem(null);
    clearTrackProductsForSystem(null);
    setWStep(requiredPointQty > 0 ? "points" : "done");
  }, [clearTrackProductsForSystem, requiredPointQty, setWStep, setWSystem]);

  /* ─── Прогресс обязательного подбора ─── */

  const progress = useMemo(() => calcStep1Progress(nav), [nav]);
  const { trackComplete, pointsComplete, lampsComplete, requiredSelectionComplete } = progress;

  const missingAction = useMemo(
    () => missingActionFor(progress, selectedTrackSystem),
    [progress, selectedTrackSystem]
  );

  const goToMissingAction = useCallback(() => {
    if (!missingAction) return;
    onOpenRecommendations();
    setWStep(missingAction.step);
  }, [missingAction, onOpenRecommendations, setWStep]);

  // «Готово» с незакрытыми требованиями — показываем недостающий экран, а не тупик.
  const shownWStep = shownStepFor(wStep, progress, missingAction);

  return {
    wStep,
    shownWStep,
    selectedTrackSystem,
    wizardSystemOptions,
    trackProfiles,
    trackFixtures,
    trackComplete,
    pointsComplete,
    lampsComplete,
    requiredSelectionComplete,
    missingAction,
    chooseWizardSystem,
    chooseNoTrackFlow,
    goAfterTrackProfile,
    goAfterTrackFixtures,
    goAfterLamps,
    goAfterChandeliers,
    goAfterPoints,
    goBackFromLamps,
    goToMissingAction,
  };
}
