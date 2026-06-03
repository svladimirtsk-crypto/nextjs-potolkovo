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
  LightingSnapshot,
  OpenCalculatorOptions,
  WizardStep,
} from "@/lib/calculator-modal-types";

import { applyLightingDiscount } from "@/lib/lighting-formulas";
import { usePriceCalculatorBridge } from "@/components/home/price-calculator-context";
import { DEFAULT_CALCULATOR_AREA } from "@/lib/catalog-ui-config";

const CalculatorModalContext = createContext<CalculatorModalContextValue | null>(null);

function isCeilingSnapshotReady(snapshot: any): boolean {
  if (!snapshot) return false;
  const area = Number(snapshot.area);
  const total = Number(snapshot.total);
  if (!Number.isFinite(area) || area <= 0) return false;
  if (!Number.isFinite(total) || total < 0) return false;
  return true;
}

function toNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function calcLightingRegularTotal(draft: LightingSnapshot | null): number {
  if (!draft) return 0;
  if (Number.isFinite(draft.totalRub)) return toNumber(draft.totalRub);

  const items = draft.mode === "catalog" ? (draft.items ?? []) : [];
  return items.reduce((sum, it) => sum + toNumber(it.qty) * toNumber(it.priceRub), 0);
}

export function CalculatorModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<WizardStep>(0);
  const [options, setOptions] = useState<OpenCalculatorOptions | null>(null);

  const [lightingDraft, setLightingDraftState] = useState<LightingSnapshot | null>(null);

  const [step0SessionInteracted, setStep0SessionInteracted] = useState(false);
  const [step0AreaConfirmed, setStep0AreaConfirmed] = useState(false);

  // NEW: скидка на свет “разрешена” после подтверждения потолка (0->1), не сбрасывается от мелких правок Step0
  const [lightingDiscountEligible, setLightingDiscountEligible] = useState(false);

  const [step1CatalogView, setStep1CatalogView] = useState<"selected" | "browse" | null>(null);

  const { snapshot, setSnapshot } = usePriceCalculatorBridge();

  const setLightingDraft = useCallback((draft: LightingSnapshot | null) => {
    setLightingDraftState(draft);
  }, []);

  const markStep0SessionInteracted = useCallback(() => {
    setStep0SessionInteracted(true);
    // ВАЖНО: любое изменение на Step0 делает старое подтверждение "неактуальным" для строгого досчёта монтажа
    setStep0AreaConfirmed(false);
    // lightingDiscountEligible НЕ сбрасываем — это “маркетинговая/заказная” часть, а не строгая инженерка
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

      if (resolvedOpts.initialLighting) setLightingDraftState(resolvedOpts.initialLighting);
      else setLightingDraftState(null);

      const source = String(resolvedOpts.source ?? "");
      if (source.length > 0) {
        setSnapshot((prev) => (prev ? { ...prev, leadSource: source } : prev));
      }

      // reset flags on each open
      setStep0SessionInteracted(false);
      setStep0AreaConfirmed(false);
      setLightingDiscountEligible(false);

      setStep1CatalogView(resolvedOpts.initialLightingView ?? null);

      // защитимся от “старого” grandTotal (досчёт монтажа) из прошлой сессии
      setSnapshot((prev) => {
        if (!prev) return prev;
        const total = toNumber(prev.total);
        const grand = toNumber((prev as any).grandTotal);
        // если grandTotal был чем-то “особенным” — сбрасываем к total
        if (Number.isFinite(grand) && grand !== 0 && grand !== total) {
          return { ...prev, grandTotal: total };
        }
        return prev;
      });

      setIsOpen(true);
    },
    [setSnapshot]
  );

  const closeCalculator = useCallback(() => {
    setIsOpen(false);
  }, []);

  const goToStep = useCallback(
    (step: WizardStep) => {
      // СТРОГО: подтверждение Step0 фиксируем на переходе 0 -> 1
      if (currentStep === 0 && step === 1) {
        if (isCeilingSnapshotReady(snapshot)) {
          setStep0AreaConfirmed(true);
          setLightingDiscountEligible(true);
        }
      }

      setCurrentStep(step);
    },
    [currentStep, snapshot]
  );

  const ceilingTotal = toNumber(snapshot?.total);

  const lightingRegularTotal = useMemo(() => {
    return calcLightingRegularTotal(lightingDraft);
  }, [lightingDraft]);

  const lightingDiscountedTotal = useMemo(() => {
    if (!lightingDraft) return 0;

    if (Number.isFinite(lightingDraft.discountedTotalRub)) {
      return toNumber(lightingDraft.discountedTotalRub);
    }

    if (lightingRegularTotal <= 0) return 0;
    return applyLightingDiscount(lightingRegularTotal);
  }, [lightingDraft, lightingRegularTotal]);

  const lightingEffectiveTotal = useMemo(() => {
    return lightingDiscountEligible ? lightingDiscountedTotal : lightingRegularTotal;
  }, [lightingDiscountEligible, lightingDiscountedTotal, lightingRegularTotal]);

  const showCeilingInUi = useMemo(() => {
    const isLightingFirst = options?.entryMode === "lighting-first";
    if (!isLightingFirst) return true;
    return currentStep === 0 || step0SessionInteracted;
  }, [currentStep, options?.entryMode, step0SessionInteracted]);

  const ceilingEffectiveTotal = useMemo(() => {
    if (!showCeilingInUi) return 0;

    const total = toNumber(snapshot?.total);
    if (!step0AreaConfirmed) return total;

    const grand = toNumber((snapshot as any)?.grandTotal);
    if (Number.isFinite(grand) && grand >= total) return grand;

    return total;
  }, [showCeilingInUi, snapshot, step0AreaConfirmed]);

  const grandTotal = useMemo(() => {
    return ceilingEffectiveTotal + lightingEffectiveTotal;
  }, [ceilingEffectiveTotal, lightingEffectiveTotal]);

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

      lightingRegularTotal,
      lightingDiscountedTotal,
      lightingEffectiveTotal,

      lightingDiscountEligible,
      showCeilingInUi,

      grandTotal,

      step0SessionInteracted,
      markStep0SessionInteracted,
      step0AreaConfirmed,

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
      lightingRegularTotal,
      lightingDiscountedTotal,
      lightingEffectiveTotal,
      lightingDiscountEligible,
      showCeilingInUi,
      grandTotal,
      step0SessionInteracted,
      markStep0SessionInteracted,
      step0AreaConfirmed,
      step1CatalogView,
      setStep1CatalogView,
    ]
  );

  return <CalculatorModalContext.Provider value={value}>{children}</CalculatorModalContext.Provider>;
}

export function useCalculatorModal(): CalculatorModalContextValue {
  const ctx = useContext(CalculatorModalContext);
  if (!ctx) {
    throw new Error("useCalculatorModal must be used inside CalculatorModalProvider.");
  }
  return ctx;
}
