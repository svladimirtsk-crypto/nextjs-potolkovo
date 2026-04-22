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

const CalculatorModalContext = createContext<CalculatorModalContextValue | null>(
  null
);

export function CalculatorModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<WizardStep>(0);
  const [options, setOptions] = useState<OpenCalculatorOptions | null>(null);
  const [lightingDraft, setLightingDraftState] =
    useState<LightingSnapshot | null>(null);
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
      const resolvedOpts = opts ?? {};
      setOptions(resolvedOpts);
      setCurrentStep(resolvedOpts.initialStep ?? 0);

      if (resolvedOpts.initialLighting) {
        setLightingDraftState(resolvedOpts.initialLighting);
      } else {
        setLightingDraftState(null);
      }

      if (resolvedOpts.source) {
        setSnapshot((prev) => (prev ? { ...prev, leadSource: resolvedOpts.source } : prev));
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

  const ceilingTotal = snapshot?.total ?? 0;

  const lightingDiscountedTotal = useMemo(() => {
    if (!lightingDraft) return 0;

    if (Number.isFinite(lightingDraft.discountedTotalRub)) {
      const discounted = Number(lightingDraft.discountedTotalRub ?? 0);
      return discounted;
    }

    if (Number.isFinite(lightingDraft.totalRub)) {
      const total = Number(lightingDraft.totalRub ?? 0);
      return applyLightingDiscount(total);
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

  return (
    <CalculatorModalContext.Provider value={value}>
      {children}
    </CalculatorModalContext.Provider>
  );
}

export function useCalculatorModal(): CalculatorModalContextValue {
  const context = useContext(CalculatorModalContext);
  if (!context) {
    throw new Error("useCalculatorModal must be used inside CalculatorModalProvider.");
  }
  return context;
}
