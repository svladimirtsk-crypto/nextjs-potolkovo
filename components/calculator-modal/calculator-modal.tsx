"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { CalculatorLeadSnapshot } from "@/components/home/price-calculator-context";
import { usePriceCalculatorBridge } from "@/components/home/price-calculator-context";
import type { WizardStep } from "@/lib/calculator-modal-types";
import { isSnapshotValid } from "@/lib/calculator-snapshot-guard";
import { calcRequiredWorksFromLighting } from "@/lib/lighting-formulas";
import { scrollToAnchorTarget } from "@/lib/scroll-to-anchor";

import { useCalculatorModal } from "./calculator-modal-context";
import { PriceStrip } from "./price-strip";
import { WizardStep0Calculator } from "./wizard-step0-calculator";
import { WizardStep1Lighting } from "./wizard-step1-lighting";
import { WizardStep2Summary } from "./wizard-step2-summary";

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    '[tabindex]:not([tabindex="-1"])',
  ].join(", ");
  return Array.from(container.querySelectorAll<HTMLElement>(selector));
}

function createEmptySnapshot(source: string, lightingDiscountedTotal: number): CalculatorLeadSnapshot {
  return {
    area: 0,
    ceilingTypeLabel: "Не выбрано",
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
    lightsCount: 0,
    lightsRatePerUnit: 0,
    lightsTotal: 0,
    total: 0,
    grandTotal: lightingDiscountedTotal,
    derivedInputs: {
      pointSpotsQty: 0,
      trackMountType: "none",
      trackLengthMeters: 0,
      recommendedTrackSpotsQty: 0,
    },
    leadSource: source,
  };
}

export function CalculatorModal() {
  const {
    isOpen,
    currentStep,
    closeCalculator,
    goToStep,
    options,
    lightingDraft,
    lightingDiscountedTotal,
  } = useCalculatorModal();

  const { snapshot, setSnapshot, setHasInteracted } = usePriceCalculatorBridge();

  const panelRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => setMounted(true), []);

  const shouldApplyPreset = options?.preset && (!snapshot || options.forcePreset === true);
  const activePreset = shouldApplyPreset ? options?.preset : undefined;
  const snapshotValid = isSnapshotValid(snapshot);

  const isNextDisabled = useMemo(() => {
    if (currentStep === 0) return !snapshotValid;
    return false;
  }, [currentStep, snapshotValid]);

  const stepTitle = useMemo(() => {
    if (currentStep === 1) {
      const hasLight = Boolean(
        lightingDraft && lightingDraft.mode !== "none" && (lightingDraft.items?.length ?? 0) > 0
      );
      return hasLight ? "Освещение ✓" : "Освещение";
    }
    const titles: Record<WizardStep, string> = {
      0: "Параметры потолка",
      1: "Освещение",
      2: "Итог расчета",
    };
    return titles[currentStep];
  }, [currentStep, lightingDraft]);

  useEffect(() => {
    if (!isOpen) return;
    previousFocusRef.current = document.activeElement as HTMLElement;
    document.body.style.overflow = "hidden";

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      setVisible(true);
    } else {
      requestAnimationFrame(() => setVisible(true));
    }

    requestAnimationFrame(() => {
      if (!panelRef.current) return;
      const focusable = getFocusableElements(panelRef.current);
      if (focusable.length > 0) focusable[0].focus();
    });

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) return;
    setVisible(false);
    if (!previousFocusRef.current) return;
    previousFocusRef.current.focus();
    previousFocusRef.current = null;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeCalculator();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;

      const focusable = getFocusableElements(panelRef.current);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeCalculator]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (!isOpen) return;
      if (e.target === overlayRef.current) closeCalculator();
    },
    [closeCalculator, isOpen]
  );

  const handleConfirm = useCallback(() => {
    const source: string = String(options?.source ?? "");

    const baseSnapshot = snapshot ?? createEmptySnapshot(source, lightingDiscountedTotal);
    const { requiredLightsCount } = calcRequiredWorksFromLighting(lightingDraft?.items);

    const currentLightsCount = baseSnapshot.lightsCount ?? 0;
    const needsReconcile = requiredLightsCount !== null && requiredLightsCount !== currentLightsCount;

    const reconciledLightsCount = needsReconcile ? requiredLightsCount : currentLightsCount;
    const reconciledLightsTotal = needsReconcile
      ? reconciledLightsCount * baseSnapshot.lightsRatePerUnit
      : baseSnapshot.lightsTotal;

    const reconciledTotal = needsReconcile
      ? baseSnapshot.ceilingBaseTotal +
        baseSnapshot.ceilingExtraTotal +
        baseSnapshot.lightLinesTotal +
        baseSnapshot.corniceTotal +
        baseSnapshot.trackTotal +
        reconciledLightsTotal
      : baseSnapshot.total;

    const finalLightingDiscounted = Number(
      lightingDraft?.discountedTotalRub ?? lightingDiscountedTotal ?? 0
    );

    setSnapshot({
      ...baseSnapshot,
      lightsEnabled: needsReconcile ? reconciledLightsCount > 0 : baseSnapshot.lightsEnabled,
      lightsCount: needsReconcile ? reconciledLightsCount : baseSnapshot.lightsCount,
      lightsTotal: reconciledLightsTotal,
      total: reconciledTotal,
      lighting: lightingDraft ?? undefined,
      grandTotal: reconciledTotal + finalLightingDiscounted,
      leadSource: String(baseSnapshot.leadSource ?? source),
      _reconciled: needsReconcile,
    });

    if (snapshotValid) {
      setHasInteracted(true);
    }

    closeCalculator();
    requestAnimationFrame(() => {
      scrollToAnchorTarget("#action", { focus: true, highlight: true });
    });
  }, [
    options?.source,
    snapshot,
    lightingDraft,
    lightingDiscountedTotal,
    setSnapshot,
    snapshotValid,
    setHasInteracted,
    closeCalculator,
  ]);

  if (!mounted) return null;

  const reducedMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const transitionClass = reducedMotion ? "" : "transition-all duration-200";
  const modalActive = isOpen && visible;

  return createPortal(
    <div
      aria-hidden={!isOpen}
      className={`fixed inset-0 z-[120] ${modalActive ? "pointer-events-auto" : "pointer-events-none"}`}
    >
      <div
        ref={overlayRef}
        onClick={handleOverlayClick}
        className={`fixed inset-0 z-[120] bg-black/50 ${transitionClass} ${
          visible && isOpen ? "opacity-100" : "opacity-0"
        } ${modalActive ? "pointer-events-auto" : "pointer-events-none"}`}
      />

      <div
        className={`fixed inset-0 z-[121] flex items-end lg:items-center lg:justify-center ${
          modalActive ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal={isOpen ? "true" : undefined}
          aria-labelledby="calc-modal-title"
          className={`w-full max-h-[92dvh] flex flex-col rounded-t-2xl bg-white shadow-2xl lg:max-h-[90dvh] lg:max-w-5xl lg:rounded-2xl xl:max-w-6xl ${transitionClass} ${
            visible && isOpen
              ? "translate-y-0 opacity-100 lg:scale-100"
              : "translate-y-4 opacity-0 lg:scale-95"
          } ${modalActive ? "pointer-events-auto" : "pointer-events-none"}`}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2 id="calc-modal-title" className="text-lg font-semibold text-slate-950">
                {stepTitle}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">Шаг {currentStep + 1} из 3</p>
            </div>
            <button
              type="button"
              onClick={closeCalculator}
              aria-label="Закрыть"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              style={{ minHeight: 48, minWidth: 48 }}
            >
              ✕
            </button>
          </div>

          <div className="sticky top-0 z-10 border-b border-slate-200 bg-white">
            <PriceStrip />
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5">
            <div className={currentStep === 0 ? "" : "hidden"} aria-hidden={currentStep !== 0}>
              <WizardStep0Calculator preset={activePreset} />
            </div>
            <div className={currentStep === 1 ? "" : "hidden"} aria-hidden={currentStep !== 1}>
              <WizardStep1Lighting />
            </div>
            <div className={currentStep === 2 ? "" : "hidden"} aria-hidden={currentStep !== 2}>
              <WizardStep2Summary onConfirm={handleConfirm} />
            </div>
          </div>

          <div className="shrink-0 border-t border-slate-200 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              {currentStep > 0 ? (
                <button
                  type="button"
                  onClick={() => goToStep((currentStep - 1) as WizardStep)}
                  className="h-12 rounded-2xl px-5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                  style={{ minHeight: 48 }}
                >
                  ← Назад
                </button>
              ) : (
                <div />
              )}

              <div className="flex flex-col items-end gap-1">
                {currentStep < 2 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => goToStep((currentStep + 1) as WizardStep)}
                      disabled={isNextDisabled}
                      aria-disabled={isNextDisabled}
                      className="flex h-12 items-center rounded-2xl bg-slate-950 px-6 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-slate-950"
                      style={{ minHeight: 48 }}
                    >
                      Далее →
                    </button>
                    {isNextDisabled ? (
                      <p className="text-right text-xs text-slate-400" role="status" aria-live="polite">
                        Подвигайте слайдер площади - расчет появится автоматически
                      </p>
                    ) : null}
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleConfirm}
                    className="flex h-12 items-center rounded-2xl bg-slate-950 px-6 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
                    style={{ minHeight: 48 }}
                  >
                    Записаться на бесплатный замер →
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
