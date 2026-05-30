"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type {
  CalculatorModalContextValue,
  CatalogViewMode,
  LightingSnapshot,
  OpenCalculatorOptions,
  WizardStep,
} from "@/lib/calculator-modal-types";
import { applyLightingDiscount } from "@/lib/lighting-formulas";
import { usePriceCalculatorBridge } from "@/components/home/price-calculator-context";
import { DEFAULT_CALCULATOR_AREA } from "@/lib/catalog-ui-config";

const CalculatorModalContext = createContext<CalculatorModalContextValue | null>(null);

export function CalculatorModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<WizardStep>(0);
  const [options, setOptions] = useState<OpenCalculatorOptions | null>(null);
  const [lightingDraft, setLightingDraftState] = useState<LightingSnapshot | null>(null);
  const [step0SessionInteracted, setStep0SessionInteracted] = useState(false);
  const [step1CatalogView, setStep1CatalogView] = useState<CatalogViewMode | null>(null);

  const { snapshot, setSnapshot } = usePriceCalculatorBridge();

  const setLightingDraft = useCallback((draft: LightingSnapshot | null) => {
    setLightingDraftState(draft);
  }, []);

  const markStep0SessionInteracted = useCallback(() => {
    setStep0SessionInteracted(true);
  }, []);

  const openCalculator = useCallback(
    (opts?: OpenCalculatorOptions) => {
      const incoming = opts ?? {};
      const isLightingFirst = incoming.entryMode === "lighting-first";

      const resolvedOpts: OpenCalculatorOptions = {
        ...incoming,
        initialStep: incoming.initialStep ?? (isLightingFirst ? 1 : 0),
        initialLightingTab: incoming.initialLightingTab ?? (isLightingFirst ? "catalog" : undefined),
        initialLightingView: incoming.initialLightingView ?? (isLightingFirst ? "browse" : undefined),
        preset:
          incoming.preset ??
          (isLightingFirst
            ? undefined
            : {
                ceilingType: "standard",
                areaDefault: DEFAULT_CALCULATOR_AREA,
              }),
      };

      setOptions(resolvedOpts);
      setCurrentStep(resolvedOpts.initialStep ?? 0);

      if (resolvedOpts.initialLighting) {
        setLightingDraftState(resolvedOpts.initialLighting);
      } else {
        setLightingDraftState(null);
      }

      const source = String(resolvedOpts.source ?? "");
      if (source.length > 0) {
        setSnapshot((prev) => (prev ? { ...prev, leadSource: source } : prev));
      }

      setStep0SessionInteracted(false);
      setStep1CatalogView(resolvedOpts.initialLightingView ?? null);
      setIsOpen(true);
    },
    [setSnapshot]
  );

  const closeCalculator = useCallback(() => {
    setIsOpen(false);
  }, []);

  const goToStep = useCallback((step: WizardStep) => {
    setCurrentStep(step);
  }, []);

  const ceilingTotal = Number(snapshot?.total ?? 0);

  const lightingDiscountedTotal = useMemo(() => {
    if (!lightingDraft) return 0;

    if (Number.isFinite(lightingDraft.discountedTotalRub)) {
      return Number(lightingDraft.discountedTotalRub ?? 0);
    }

    if (Number.isFinite(lightingDraft.totalRub)) {
      return applyLightingDiscount(Number(lightingDraft.totalRub ?? 0));
    }

    return 0;
  }, [lightingDraft]);

  const grandTotal = ceilingTotal + lightingDiscountedTotal;

  const value = useMemo<CalculatorModalContextValue>(
    () => ({
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
      grandTotal,
      step0SessionInteracted,
      markStep0SessionInteracted,
      step1CatalogView,
      setStep1CatalogView,
    }),
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
      grandTotal,
      step0SessionInteracted,
      markStep0SessionInteracted,
      step1CatalogView,
      setStep1CatalogView,
    ]
  );

  return <CalculatorModalContext.Provider value={value}>{children}</CalculatorModalContext.Provider>;
}

export function useCalculatorModal(): CalculatorModalContextValue {
  const context = useContext(CalculatorModalContext);
  if (!context) {
    throw new Error("useCalculatorModal must be used inside CalculatorModalProvider.");
  }
  return context;
}
