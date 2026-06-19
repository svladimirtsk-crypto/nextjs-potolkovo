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
  LightingDiscountMode,
} from "@/lib/calculator-modal-types";

import {
  LIGHTING_ONLY_DISCOUNT_PERCENT,
  LIGHTING_WITH_CEILING_DISCOUNT_PERCENT,
  applyLightingOnlyDiscount,
  applyLightingWithCeilingDiscount,
  calcLightingDiscountAmount,
} from "@/lib/lighting-formulas";
import { DEFAULT_CALCULATOR_AREA } from "@/lib/catalog-ui-config";
import {
  type CalculatorLeadSnapshot,
  usePriceCalculatorBridge,
} from "@/components/home/price-calculator-context";
import { trackCalculatorOpen, trackWizardStepView } from "@/lib/analytics";

function toNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function isCeilingSnapshotReady(
  snapshot: CalculatorLeadSnapshot | null | undefined
): boolean {
  if (!snapshot) return false;
  const area = Number(snapshot.area);
  const total = Number(snapshot.total);
  if (!Number.isFinite(area) || area <= 0) return false;
  if (!Number.isFinite(total) || total < 0) return false;
  return true;
}

function calcLightingRegularTotal(draft: LightingSnapshot | null): number {
  if (!draft) return 0;

  if (Number.isFinite(draft.totalRub)) return toNumber(draft.totalRub);

  const items = draft.mode === "catalog" ? (draft.items ?? []) : [];
  return items.reduce((sum, it) => sum + toNumber(it.qty) * toNumber(it.priceRub), 0);
}

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
  const [currentStep, setCurrentStep] = useState<WizardStep>(0);
  const [options, setOptions] = useState<OpenCalculatorOptions | null>(null);

  const [lightingDraft, setLightingDraftState] = useState<LightingSnapshot | null>(null);

  const [step0SessionInteracted, setStep0SessionInteracted] = useState(false);
  const [step0AreaConfirmed, setStep0AreaConfirmed] = useState(false);

  // скидка с потолком: разрешена только после подтверждения потолка 0->1
  const [lightingDiscountEligible, setLightingDiscountEligible] = useState(false);

  const [step1CatalogView, setStep1CatalogView] = useState<"selected" | "browse" | null>(null);
  const [step1FooterAction, setStep1FooterActionState] = useState<Step1FooterAction | null>(null);

  const { snapshot, setSnapshot, setHasInteracted } = usePriceCalculatorBridge();

  const setLightingDraft = useCallback((draft: LightingSnapshot | null) => {
    setLightingDraftState(draft);
  }, []);

  const markStep0SessionInteracted = useCallback(() => {
    setStep0SessionInteracted(true);
    // строго: любое изменение Step0 сбрасывает "инженерное подтверждение"
    setStep0AreaConfirmed(false);
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
        initialStep: incoming.initialStep ?? (isLightingFirst ? 1 : 0),
        initialLightingTab:
          incoming.initialLightingTab ?? (isLightingFirst ? "catalog" : undefined),
        initialLightingView:
          incoming.initialLightingView ?? (isLightingFirst ? "browse" : undefined),
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
      trackCalculatorOpen(effectiveSource);
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
      setStep0SessionInteracted(false);
      setStep0AreaConfirmed(false);

      // В lighting-first скидка с потолком НЕ применяется сразу: сначала действует −10% на свет.
      const enableDiscountNow = false;
      setLightingDiscountEligible(enableDiscountNow);

      setStep1CatalogView(resolvedOpts.initialLightingView ?? null);
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
    },
    [setSnapshot, snapshot]
  );

  const closeCalculator = useCallback(() => {
    setIsOpen(false);
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

      setCurrentStep(step);
    },
   [currentStep, options, setHasInteracted, setSnapshot, snapshot]
  );

  const ceilingTotal = toNumber(snapshot?.total);

  const lightingRegularTotal = useMemo(
    () => calcLightingRegularTotal(lightingDraft),
    [lightingDraft]
  );

  const lightingStandaloneTotal = useMemo(() => {
    if (!lightingDraft || lightingRegularTotal <= 0) return 0;
    return applyLightingOnlyDiscount(lightingRegularTotal);
  }, [lightingDraft, lightingRegularTotal]);

  const lightingWithCeilingTotal = useMemo(() => {
    if (!lightingDraft || lightingRegularTotal <= 0) return 0;
    return applyLightingWithCeilingDiscount(lightingRegularTotal);
  }, [lightingDraft, lightingRegularTotal]);

  // legacy field: total with ceiling discount (−25%)
  const lightingDiscountedTotal = lightingWithCeilingTotal;

  const lightingDiscountMode = useMemo<LightingDiscountMode>(() => {
    if (!lightingDraft || lightingRegularTotal <= 0) return "none";
    if (lightingDiscountEligible) return "with-ceiling";
    if (options?.entryMode === "lighting-first") return "lighting-only";
    return "none";
  }, [lightingDiscountEligible, lightingDraft, lightingRegularTotal, options?.entryMode]);

  const lightingEffectiveTotal = useMemo(() => {
    if (lightingDiscountMode === "with-ceiling") return lightingWithCeilingTotal;
    if (lightingDiscountMode === "lighting-only") return lightingStandaloneTotal;
    return lightingRegularTotal;
  }, [lightingDiscountMode, lightingRegularTotal, lightingStandaloneTotal, lightingWithCeilingTotal]);

  const lightingDiscountPercentApplied = useMemo(() => {
    if (lightingDiscountMode === "with-ceiling") return LIGHTING_WITH_CEILING_DISCOUNT_PERCENT;
    if (lightingDiscountMode === "lighting-only") return LIGHTING_ONLY_DISCOUNT_PERCENT;
    return 0;
  }, [lightingDiscountMode]);

  const lightingDiscountAmount = useMemo(() => {
    return calcLightingDiscountAmount(lightingRegularTotal, lightingEffectiveTotal);
  }, [lightingEffectiveTotal, lightingRegularTotal]);

  const showCeilingInUi = useMemo(() => {
    const isLightingFirst = options?.entryMode === "lighting-first";
    if (!isLightingFirst) return true;
    return currentStep === 0 || step0SessionInteracted;
  }, [currentStep, options?.entryMode, step0SessionInteracted]);

  const ceilingEffectiveTotal = useMemo(() => {
    if (!showCeilingInUi) return 0;

    const total = toNumber(snapshot?.total);

    // строго: grandTotal (с досчётом монтажа) учитываем только если Step0 подтверждён
    if (!step0AreaConfirmed) return total;

    const grand = toNumber(snapshot?.grandTotal);
    if (Number.isFinite(grand) && grand >= total) return grand;

    return total;
  }, [showCeilingInUi, snapshot, step0AreaConfirmed]);

  const grandTotal = useMemo(() => {
    return ceilingEffectiveTotal + lightingEffectiveTotal;
  }, [ceilingEffectiveTotal, lightingEffectiveTotal]);

  // Синхронизируем выбранное освещение в общий snapshot, чтобы оно уходило в заявку на почту.
  useEffect(() => {
    setSnapshot((prev) => {
      const hasLighting = Boolean(lightingDraft && lightingDraft.mode !== "none" && (lightingDraft.items?.length ?? 0) > 0);
      if (!prev && !hasLighting) return prev;

      const base = prev ?? createLightingOnlySnapshot();

      const lightingForSnapshot = hasLighting && lightingDraft
        ? {
            ...lightingDraft,
            totalRub: lightingRegularTotal,
            discountedTotalRub: lightingEffectiveTotal,
            standaloneDiscountedTotalRub: lightingStandaloneTotal,
            withCeilingDiscountedTotalRub: lightingWithCeilingTotal,
            discountMode: lightingDiscountMode,
            discountPercentApplied: lightingDiscountPercentApplied,
            discountAmountRub: lightingDiscountAmount,
          }
        : undefined;

      return {
        ...base,
        leadSource: base.leadSource ?? String(options?.source ?? ""),
        lighting: lightingForSnapshot,
        lightingDiscountApplied: lightingDiscountMode !== "none",
        lightingDiscountPercentApplied,
        lightingDiscountMode,
        lightingDiscountAmountRub: lightingDiscountAmount,
      };
    });
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
        currentStep,
        options,
        openCalculator,
        closeCalculator,
        goToStep,

        lightingDraft,
        setLightingDraft,

        ceilingTotal,

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

        step1CatalogView,
        setStep1CatalogView,
        step1FooterAction,
        setStep1FooterAction,
      }) as CalculatorModalContextValue,
    [
      isOpen,
      currentStep,
      options,
      openCalculator,
      closeCalculator,
      goToStep,
      lightingDraft,
      setLightingDraft,
      ceilingTotal,
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
