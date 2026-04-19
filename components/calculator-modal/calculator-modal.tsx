// components/calculator-modal/calculator-modal.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { WizardStep } from "@/lib/calculator-modal-types";
import { isSnapshotValid } from "@/lib/calculator-snapshot-guard";
import { calcRequiredWorksFromLighting } from "@/lib/lighting-formulas";
import { useCalculatorModal } from "./calculator-modal-context";
import { usePriceCalculatorBridge } from "@/components/home/price-calculator-context";
import { scrollToAnchorTarget } from "@/lib/scroll-to-anchor";
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

  useEffect(() => {
    setMounted(true);
  }, []);

  const shouldApplyPreset = options?.preset && (!snapshot || options.forcePreset === true);
  const activePreset = shouldApplyPreset ? options?.preset : undefined;

  const snapshotValid = isSnapshotValid(snapshot);
  const isNextDisabled = currentStep < 2 && !snapshotValid;

  const stepTitle = useMemo(() => {
    if (currentStep === 1) {
      const hasLight =
        lightingDraft &&
        lightingDraft.mode !== "none" &&
        (lightingDraft.items?.length ?? 0) > 0;
      return hasLight ? "Освещение ✓" : "Освещение";
    }

    const titles: Record<WizardStep, string> = {
      0: "Параметры потолка",
      1: "Освещение",
      2: "Итог расчёта",
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
      if (panelRef.current) {
        const focusable = getFocusableElements(panelRef.current);
        if (focusable.length > 0) focusable[0].focus();
      }
    });

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setVisible(false);
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
        previousFocusRef.current = null;
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeCalculator();
        return;
      }

      if (e.key === "Tab" && panelRef.current) {
        const focusable = getFocusableElements(panelRef.current);
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
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
    if (snapshot) {
      const { requiredLightsCount } = calcRequiredWorksFromLighting(lightingDraft?.items);

      const currentLightsCount = snapshot.lightsCount ?? 0;
      const needsReconcile =
        requiredLightsCount !== null && requiredLightsCount !== currentLightsCount;

      const reconciledLightsCount = needsReconcile
        ? requiredLightsCount
        : currentLightsCount;

      const reconciledLightsTotal = needsReconcile
        ? reconciledLightsCount * snapshot.lightsRatePerUnit
        : snapshot.lightsTotal;

      const reconciledTotal = needsReconcile
        ? snapshot.ceilingBaseTotal +
          snapshot.ceilingExtraTotal +
          snapshot.lightLinesTotal +
          snapshot.corniceTotal +
          snapshot.trackTotal +
          reconciledLightsTotal
        : snapshot.total;

      const computedGrandTotal = reconciledTotal + (lightingDiscountedTotal ?? 0);

      setSnapshot({
        ...snapshot,
        lightsEnabled: needsReconcile
          ? reconciledLightsCount > 0
          : snapshot.lightsEnabled,
        lightsCount: needsReconcile ? reconciledLightsCount : snapshot.lightsCount,
        lightsTotal: reconciledLightsTotal,
        total: reconciledTotal,
        lighting: lightingDraft ?? undefined,
        grandTotal: computedGrandTotal,
        leadSource: snapshot.leadSource ?? options?.source ?? "",
        _reconciled: needsReconcile,
      } as typeof snapshot & { _reconciled?: boolean });
    }

    setHasInteracted(true);
    closeCalculator();

    requestAnimationFrame(() => {
      scrollToAnchorTarget("#action", { focus: true, highlight: true });
    });
  }, [
    snapshot,
    lightingDraft,
    lightingDiscountedTotal,
    setSnapshot,
    setHasInteracted,
    closeCalculator,
    options,
  ]);

  if (!mounted) return null;

  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const transitionClass = reducedMotion ? "" : "transition-all duration-200";

  return createPortal(
   <div
  aria-hidden={!isOpen}
  className={`fixed inset-0 z-[120] ${isOpen ? "pointer-events-auto" : "pointer-events-none"}`}
>
      <div
        ref={overlayRef}
        onClick={handleOverlayClick}
        className={`fixed inset-0 z-[120] bg-black/50 ${transitionClass} ${
          visible && isOpen ? "opacity-100" : "opacity-0"
        } ${isOpen ? "pointer-events-auto" : "pointer-events-none"}`}
      />

      <div
        className={`fixed inset-0 z-[121] flex items-end md:items-center md:justify-center ${
          isOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal={isOpen ? "true" : undefined}
          aria-labelledby="calc-modal-title"
          className={`
            w-full
            md:max-w-3xl
            bg-white md:rounded-2xl rounded-t-2xl shadow-2xl
            max-h-[90dvh] md:max-h-[88dvh]
            flex flex-col
            ${transitionClass}
            ${
              visible && isOpen
                ? "opacity-100 translate-y-0 md:scale-100"
                : "opacity-0 translate-y-4 md:scale-95"
            }
            ${isOpen ? "pointer-events-auto" : "pointer-events-none"}
          `}
        >
          <div className="flex shrink-0 items-center justify-between px-5 py-4 border-b border-slate-200">
            <div>
              <h2 id="calc-modal-title" className="text-lg font-semibold text-slate-950">
                {stepTitle}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Шаг {currentStep + 1} из 3
              </p>
            </div>

            <button
              type="button"
              onClick={closeCalculator}
              aria-label="Закрыть"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              style={{ minHeight: 48, minWidth: 48 }}
            >
              ✕
            </button>
          </div>

          <div className="hidden md:block">
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

          <div className="block md:hidden">
            <PriceStrip />
          </div>

          <div className="shrink-0 border-t border-slate-200 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              {currentStep > 0 ? (
                <button
                  type="button"
                  onClick={() => goToStep((currentStep - 1) as WizardStep)}
                  className="h-12 px-5 rounded-2xl text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
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
                      className="flex h-12 px-6 rounded-2xl bg-slate-950 text-white text-sm font-semibold hover:bg-slate-800 transition-colors items-center disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-950"
                      style={{ minHeight: 48 }}
                    >
                      Далее →
                    </button>

                    {isNextDisabled ? (
                      <p
                        className="text-xs text-slate-400 text-right"
                        role="status"
                        aria-live="polite"
                      >
                        Подвигайте слайдер площади — расчёт появится автоматически
                      </p>
                    ) : null}
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleConfirm}
                    className="flex h-12 px-6 rounded-2xl bg-slate-950 text-white text-sm font-semibold hover:bg-slate-800 transition-colors items-center"
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
