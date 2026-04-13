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
  OpenCalculatorOptions,
  WizardStep,
} from "@/lib/calculator-modal-types";
import { usePriceCalculatorBridge } from "@/components/home/price-calculator-context";

const CalculatorModalContext = createContext<CalculatorModalContextValue | null>(
  null
);

export function CalculatorModalProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<WizardStep>(0);
  const [options, setOptions] = useState<OpenCalculatorOptions | null>(null);

  const { hasInteracted } = usePriceCalculatorBridge();

  const openCalculator = useCallback(
    (opts?: OpenCalculatorOptions) => {
      const resolvedOpts = opts ?? {};
      setOptions(resolvedOpts);
      setCurrentStep(resolvedOpts.initialStep ?? 0);
      setIsOpen(true);
    },
    []
  );

  const closeCalculator = useCallback(() => {
    setIsOpen(false);
  }, []);

  const goToStep = useCallback((step: WizardStep) => {
    setCurrentStep(step);
  }, []);

  const value = useMemo<CalculatorModalContextValue>(
    () => ({
      isOpen,
      currentStep,
      options,
      openCalculator,
      closeCalculator,
      goToStep,
    }),
    [isOpen, currentStep, options, openCalculator, closeCalculator, goToStep]
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
    throw new Error(
      "useCalculatorModal must be used inside CalculatorModalProvider."
    );
  }

  return context;
}
