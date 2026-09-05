"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import type {
  CalculatorModalContextValue,
  LightingSnapshot,
  OpenCalculatorOptions,
  WizardStep,
  Step1FooterAction,
  CalculatorFooterAction,
  CalculatorFooterBackAction,
} from "@/lib/calculator-modal-types";
import {
  resolveInitialLightingTab,
  resolveInitialLightingView,
  resolveInitialWizardStep,
} from "@/lib/calculator-flow";

import {
  calcCeilingEffectiveTotal,
  calcLightingTotals,
  isCeilingSnapshotReady,
  shouldShowCeiling,
  toNumber,
} from "@/lib/calculator/pricing";
import { LIGHTING_WITH_CEILING_DISCOUNT_PERCENT } from "@/lib/lighting-formulas";
import { DEFAULT_CALCULATOR_AREA } from "@/lib/catalog-ui-config";
import { useCalculatorStore } from "@/lib/calculator/store";
import type { CalculatorLeadSnapshot } from "@/lib/calculator/snapshot-types";
import { mergeLightingIntoSnapshot } from "@/lib/calculator/snapshot-merge";
import { trackCalculatorOpen, trackWizardStepView } from "@/lib/analytics";
import { readCalcDraft } from "@/lib/calculator/draft";




function createLightingOnlySnapshot(): CalculatorLeadSnapshot {
  return {
    area: 0,
    ceilingTypeLabel: "Потолок пока не рассчитан",
    ceilingBaseRate: 0,
    ceilingBaseTotal: 0,
    ceilingExtraLabel: null,
    ceilingLength: null,
    ceilingExtraRatePerMeter: null,
    ceilingExtraTotal: 0,
    lightLinesEnabled: false,
    lightLinesLabel: null,
    lightLinesLength: null,
    lightLinesRatePerMeter: null,
    lightLinesTotal: 0,
    corniceLabel: null,
    corniceLength: null,
    corniceRatePerMeter: null,
    corniceTotal: 0,
    trackLabel: null,
    trackLength: null,
    trackRatePerMeter: null,
    trackTotal: 0,
    lightsEnabled: false,
    lightsCount: null,
    lightsRatePerUnit: 0,
    lightsTotal: 0,
    total: 0,
    derivedInputs: {
      pointSpotsQty: 0,
      trackMountType: "none",
      trackLengthMeters: 0,
      recommendedTrackSpotsQty: 0,
    },
  };
}

// P1.10: чтение UTM из sessionStorage при открытии модалки
function captureUtmIntoSession() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const keys = [
    "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
    "yclid", "gclid", "_openstat", "fbclid",
  ];
  for (const key of keys) {
    const v = params.get(key);
    // FIRST CLICK ATTRIBUTION: only set if NOT already present in sessionStorage!
    if (v && !sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, v);
    }
  }
  if (!sessionStorage.getItem("first_landing")) {
    sessionStorage.setItem("first_landing", window.location.href);
  }
  if (!sessionStorage.getItem("first_referrer")) {
    sessionStorage.setItem("first_referrer", document.referrer || window.location.href);
  }
}

const CalculatorModalContext = createContext<CalculatorModalContextValue | null>(null);

export function CalculatorModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  // T-029: остаётся true после первого открытия, чтобы модалка не перемонтировалась.
  const [hasEverOpened, setHasEverOpened] = useState(false);
  const [currentStep, setCurrentStep] = useState<WizardStep>(0);
  // T-023: ремаунт всех шагов при новом открытии
  const [sessionId, setSessionId] = useState(0);
  const [leadSubmittedAt, setLeadSubmittedAt] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [options, setOptions] = useState<OpenCalculatorOptions | null>(null);

  const [lightingDraft, setLightingDraftState] = useState<LightingSnapshot | null>(null);

  const [step0SessionInteracted, setStep0SessionInteracted] = useState(false);
  const [step0AreaConfirmed, setStep0AreaConfirmed] = useState(false);

  // Квиз-флоу: прогресс Step 0 (X из Y шагов) и состояние сводки.
  // Обновляется из PriceCalculatorClient через setter. Используется в header модалки.
  const [step0Progress, setStep0Progress] = useState<{ done: number; total: number } | null>(null);
  const [isStep0SummaryReady, setIsStep0SummaryReady] = useState(false);

  // скидка с потолком: разрешена только после подтверждения потолка 0->1
  const [lightingDiscountEligible, setLightingDiscountEligible] = useState(false);

  const [step1CatalogView, setStep1CatalogView] = useState<"selected" | "browse" | null>(null);
  const [step0FooterAction, setStep0FooterActionState] = useState<CalculatorFooterAction | null>(null);
  const [step0BackAction, setStep0BackActionState] = useState<CalculatorFooterBackAction>({ visible: false });
  const [step1FooterAction, setStep1FooterActionState] = useState<Step1FooterAction | null>(null);

  const { snapshot, setSnapshot, setHasInteracted } = useCalculatorStore();

  const setLightingDraft = useCallback(
    (draft: LightingSnapshot | null | ((prev: LightingSnapshot | null) => LightingSnapshot | null)) => {
      setLightingDraftState(draft);
    },
    []
  );

  const markStep0SessionInteracted = useCallback(() => {
    setStep0SessionInteracted(true);
    // строго: любое изменение Step0 сбрасывает "инженерное подтверждение"
    setStep0AreaConfirmed(false);
    // T-008: устаревший grandTotal больше не хранится в snapshot
    setSnapshot((prev) => (prev && prev.grandTotal !== undefined ? { ...prev, grandTotal: undefined } : prev));
  }, [setSnapshot]);

  const setStep0FooterAction = useCallback((action: CalculatorFooterAction | null) => {
    setStep0FooterActionState(action);
  }, []);

  const setStep0BackAction = useCallback((action: CalculatorFooterBackAction) => {
    setStep0BackActionState(action);
  }, []);

  const setStep1FooterAction = useCallback((action: Step1FooterAction | null) => {
    setStep1FooterActionState(action);
  }, []);

  const openCalculator = useCallback(
    (opts?: OpenCalculatorOptions) => {
      const incoming = opts ?? {};
      const isLightingFirst = incoming.entryMode === "lighting-first";

      const resolvedOpts: OpenCalculatorOptions = {
        ...incoming,
        initialStep: resolveInitialWizardStep({
          entryMode: incoming.entryMode,
          initialStep: incoming.initialStep,
        }),
        initialLightingTab: resolveInitialLightingTab({
          entryMode: incoming.entryMode,
          initialLightingTab: incoming.initialLightingTab,
        }),
        initialLightingView: resolveInitialLightingView({
          entryMode: incoming.entryMode,
          initialLightingView: incoming.initialLightingView,
        }),
        preset:
          incoming.preset ??
          (isLightingFirst
            ? undefined
            : {
                ceilingType: "standard",
                areaDefault: DEFAULT_CALCULATOR_AREA,
              }),
      };

      const effectiveSource = String(resolvedOpts.source ?? "unknown");
      trackCalculatorOpen(effectiveSource, {
        entryMode: resolvedOpts.entryMode ?? null,
        hasDraft: Boolean(readCalcDraft()),
      });
      trackWizardStepView((resolvedOpts.initialStep ?? 0) as 0 | 1 | 2, effectiveSource);

      // P1.10: захват UTM при открытии
      captureUtmIntoSession();

      setOptions(resolvedOpts);
      setCurrentStep(resolvedOpts.initialStep ?? 0);

      if (resolvedOpts.initialLighting) {
        setLightingDraftState(resolvedOpts.initialLighting);
      } else if (snapshot?.lighting && snapshot.lighting.mode !== "none") {
        setLightingDraftState(snapshot.lighting);
      } else if (lightingDraft && lightingDraft.mode !== "none") {
        setLightingDraftState(lightingDraft);
      } else {
        setLightingDraftState(null);
      }

      // reset flags on each open
      setSessionId((prev) => prev + 1);
      setLeadSubmittedAt(null);
      setShowResult(false);
      setStep0SessionInteracted(false);
      setStep0AreaConfirmed(false);
      setStep0Progress(null);
      setIsStep0SummaryReady(false);

      // В lighting-first скидка с потолком НЕ применяется сразу: сначала действует −10% на свет.
      const enableDiscountNow = false;
      setLightingDiscountEligible(enableDiscountNow);

      setStep1CatalogView(resolvedOpts.initialLightingView ?? null);
      setStep0FooterActionState(null);
      setStep0BackActionState({ visible: false });
      setStep1FooterActionState(null);

      // скидка и источник: сбрасываем/ставим на snapshot (если он есть)
      setSnapshot((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          leadSource: effectiveSource,
          lightingDiscountApplied: false,
          lightingDiscountPercentApplied: 0,
          lightingDiscountMode: "none",
          lightingDiscountAmountRub: 0,
        };
      });
      setIsOpen(true);
      setHasEverOpened(true);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setSnapshot, snapshot]
  );

  const closeCalculator = useCallback(() => {
    setIsOpen(false);
  }, []);

  const markLeadSubmitted = useCallback(() => {
    setLeadSubmittedAt(Date.now());
  }, []);

  const goToStep = useCallback(
    (step: WizardStep) => {
      const effectiveSource = String(options?.source ?? "unknown");
      trackWizardStepView(step as 0 | 1 | 2, effectiveSource);
      // подтверждение Step0 фиксируем на переходе 0 -> 1 или 0 -> 2
      if (currentStep === 0 && step >= 1) {
        if (isCeilingSnapshotReady(snapshot)) {
          setStep0AreaConfirmed(true);

          // скидка становится "разрешённой"
          setLightingDiscountEligible(true);

          // это важно для формы: если человек прошёл Step0 и нажал Далее — это взаимодействие
          setHasInteracted(true);

          // записываем в snapshot флаг скидки как "будет применена"
          setSnapshot((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              lightingDiscountApplied: true,
              lightingDiscountPercentApplied: LIGHTING_WITH_CEILING_DISCOUNT_PERCENT,
              lightingDiscountMode: "with-ceiling",
            };
          });
        }
      }

      // T-031: переход 0 → 1 всегда открывает Шаг 1 с начала подбора.
      if (currentStep === 0 && step === 1) setStep1CatalogView(null);

      setCurrentStep(step);
    },
   [currentStep, options, setHasInteracted, setSnapshot, snapshot]
  );

  const ceilingTotal = toNumber(snapshot?.total);

  /**
   * N-050: все денежные вычисления — чистые функции из
   * `lib/calculator/pricing.ts`. Контекст только подставляет входные данные.
   */
  const lightingTotals = useMemo(
    () =>
      calcLightingTotals({
        lightingDraft,
        discountEligibleWithCeiling: lightingDiscountEligible,
        entryMode: options?.entryMode,
      }),
    [lightingDraft, lightingDiscountEligible, options?.entryMode]
  );

  const {
    regularTotal: lightingRegularTotal,
    standaloneTotal: lightingStandaloneTotal,
    withCeilingTotal: lightingWithCeilingTotal,
    effectiveTotal: lightingEffectiveTotal,
    discountMode: lightingDiscountMode,
    discountPercentApplied: lightingDiscountPercentApplied,
    discountAmount: lightingDiscountAmount,
  } = lightingTotals;

  // legacy field: total with ceiling discount (−25%)
  const lightingDiscountedTotal = lightingWithCeilingTotal;

  const showCeilingInUi = useMemo(
    () =>
      shouldShowCeiling({
        entryMode: options?.entryMode,
        currentStep,
        step0SessionInteracted,
      }),
    [currentStep, options?.entryMode, step0SessionInteracted]
  );

  const ceilingEffectiveTotal = useMemo(
    () => calcCeilingEffectiveTotal({ snapshot, showCeilingInUi, step0AreaConfirmed }),
    [showCeilingInUi, snapshot, step0AreaConfirmed]
  );

  const grandTotal = ceilingEffectiveTotal + lightingEffectiveTotal;

  /**
   * N-050: слияние вынесено в чистую mergeLightingIntoSnapshot.
   * Эффект остаётся только как мост к внешнему стору снапшота; функция
   * возвращает прежний объект, если менять нечего, поэтому лишнего рендера
   * такой setSnapshot не вызывает.
   */
  useEffect(() => {
    setSnapshot((prev) =>
      mergeLightingIntoSnapshot(prev, {
        lightingDraft,
        regularTotal: lightingRegularTotal,
        effectiveTotal: lightingEffectiveTotal,
        standaloneTotal: lightingStandaloneTotal,
        withCeilingTotal: lightingWithCeilingTotal,
        discountMode: lightingDiscountMode,
        discountPercentApplied: lightingDiscountPercentApplied,
        discountAmount: lightingDiscountAmount,
        source: String(options?.source ?? ""),
        createEmpty: createLightingOnlySnapshot,
      })
    );
  }, [
    lightingDiscountAmount,
    lightingDiscountMode,
    lightingDiscountPercentApplied,
    lightingDraft,
    lightingEffectiveTotal,
    lightingRegularTotal,
    options?.source,
    lightingStandaloneTotal,
    lightingWithCeilingTotal,
    setSnapshot,
  ]);

  const value = useMemo(
    () =>
      ({
        isOpen,
        hasEverOpened,
        currentStep,
        options,
        sessionId,
        leadSubmittedAt,
        markLeadSubmitted,
        showResult,
        setShowResult,
        openCalculator,
        closeCalculator,
        goToStep,

        lightingDraft,
        setLightingDraft,

        ceilingTotal,
        ceilingEffectiveTotal,

        // legacy поле (оставляем совместимость)
        lightingDiscountedTotal,

        // новые поля (используются в UI)
        lightingRegularTotal,
        lightingStandaloneTotal,
        lightingWithCeilingTotal,
        lightingEffectiveTotal,
        lightingDiscountEligible,
        lightingDiscountMode,
        lightingDiscountPercentApplied,
        lightingDiscountAmount,

        showCeilingInUi,
        grandTotal,

        step0SessionInteracted,
        markStep0SessionInteracted,
        step0AreaConfirmed,
        step0Progress,
        setStep0Progress,
        isStep0SummaryReady,
        setIsStep0SummaryReady,

        step0FooterAction,
        setStep0FooterAction,
        step0BackAction,
        setStep0BackAction,

        step1CatalogView,
        setStep1CatalogView,
        step1FooterAction,
        setStep1FooterAction,
      }) as CalculatorModalContextValue,
    [
      isOpen,
      hasEverOpened,
      currentStep,
      options,
      sessionId,
      leadSubmittedAt,
      markLeadSubmitted,
      showResult,
      openCalculator,
      closeCalculator,
      goToStep,
      lightingDraft,
      setLightingDraft,
      ceilingTotal,
      ceilingEffectiveTotal,
      lightingDiscountedTotal,
      lightingRegularTotal,
      lightingStandaloneTotal,
      lightingWithCeilingTotal,
      lightingEffectiveTotal,
      lightingDiscountEligible,
      lightingDiscountMode,
      lightingDiscountPercentApplied,
      lightingDiscountAmount,
      showCeilingInUi,
      grandTotal,
      step0SessionInteracted,
      markStep0SessionInteracted,
      step0AreaConfirmed,
      step0Progress,
      isStep0SummaryReady,
      step0FooterAction,
      setStep0FooterAction,
      step0BackAction,
      setStep0BackAction,
      step1CatalogView,
      setStep1CatalogView,
      step1FooterAction,
      setStep1FooterAction,
    ]
  );

  return (
    <CalculatorModalContext.Provider value={value}>
      {children}
    </CalculatorModalContext.Provider>
  );
}

export function useCalculatorModal(): CalculatorModalContextValue {
  const ctx = useContext(CalculatorModalContext);
  if (!ctx) throw new Error("useCalculatorModal must be used inside CalculatorModalProvider.");
  return ctx;
}
