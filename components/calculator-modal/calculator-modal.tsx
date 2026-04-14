"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { WizardStep } from "@/lib/calculator-modal-types";
import { useCalculatorModal } from "./calculator-modal-context";
import { usePriceCalculatorBridge } from "@/components/home/price-calculator-context";
import { scrollToAnchorTarget } from "@/lib/scroll-to-anchor";
import { PriceStrip } from "./price-strip";
import { WizardStep0Calculator } from "./wizard-step0-calculator";
import { WizardStep1Lighting } from "./wizard-step1-lighting";
import { WizardStep2Summary } from "./wizard-step2-summary";

const STEP_TITLES: Record<WizardStep, string> = {
  0: "Параметры потолка",
  1: "Освещение",
  2: "Итог расчёта",
};

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
  } = useCalculatorModal();

  const { snapshot, setSnapshot, setHasInteracted } = usePriceCalculatorBridge();

  const panelRef           = useRef<HTMLDivElement>(null);
  const overlayRef         = useRef<HTMLDivElement>(null);
  const previousFocusRef   = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  // SSR guard for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  const shouldApplyPreset =
    options?.preset && (!snapshot || options.forcePreset === true);
  const activePreset = shouldApplyPreset ? options?.preset : undefined;

  // Enter animation + scroll lock + focus
  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement as HTMLElement;
    document.body.style.overflow = "hidden";

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

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

  // Restore focus on close
  useEffect(() => {
    if (!isOpen) {
      setVisible(false);
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
        previousFocusRef.current = null;
      }
    }
  }, [isOpen]);

  // Escape + focus trap
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
        const last  = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeCalculator]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) closeCalculator();
    },
    [closeCalculator]
  );

  const handleConfirm = useCallback(() => {
    // Merge lightingDraft into snapshot
    if (snapshot) {
      setSnapshot({
        ...snapshot,
        lighting: lightingDraft ?? undefined,
      });
    }
    setHasInteracted(true);
    closeCalculator();

    requestAnimationFrame(() => {
      scrollToAnchorTarget("#action", { focus: true, highlight: true });
    });
  }, [snapshot, lightingDraft, setSnapshot, setHasInteracted, closeCalculator]);

  if (!mounted || !isOpen) return null;

  const stepTitle = STEP_TITLES[currentStep];
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const transitionClass = reducedMotion ? "" : "transition-all duration-200";

  return createPortal(
    <>
      {/* Overlay */}
      <div
        ref={overlayRef}
        onClick={handleOverlayClick}
        className={`fixed inset-0 z-50 bg-black/50 ${transitionClass} ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden="true"
      />

      {/* Panel container */}
      <div className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center pointer-events-none">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="calc-modal-title"
          className={`
            pointer-events-auto w-full
            md:max-w-3xl
            bg-white md:rounded-2xl rounded-t-2xl shadow-2xl
            max-h-[90dvh] md:max-h-[88dvh]
            flex flex-col
            ${transitionClass}
            ${visible ? "opacity-100 translate-y-0 md:scale-100" : "opacity-0 translate-y-4 md:scale-95"}
          `}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between px-5 py-4 border-b border-slate-200">
            <div>
              <h2
                id="calc-modal-title"
                className="text-lg font-semibold text-slate-950"
              >
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

          {/* PriceStrip — desktop: between header and body */}
          <div className="hidden md:block">
            <PriceStrip />
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-5">
            {currentStep === 0 ? (
              <WizardStep0Calculator preset={activePreset} />
            ) : null}
            {currentStep === 1 ? <WizardStep1Lighting /> : null}
            {currentStep === 2 ? (
              <WizardStep2Summary onConfirm={handleConfirm} />
            ) : null}
          </div>

          {/* PriceStrip — mobile: sticky above footer */}
          <div className="block md:hidden">
            <PriceStrip />
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t border-slate-200 px-5 py-4 flex items-center justify-between gap-3">
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

            {currentStep < 2 ? (
              <button
                type="button"
                onClick={() => goToStep((currentStep + 1) as WizardStep)}
                className="h-12 px-6 rounded-2xl bg-slate-950 text-white text-sm font-semibold hover:bg-slate-800 transition-colors"
                style={{ minHeight: 48 }}
              >
                Далее →
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConfirm}
                className="hidden md:flex h-12 px-6 rounded-2xl bg-slate-950 text-white text-sm font-semibold hover:bg-slate-800 transition-colors items-center"
                style={{ minHeight: 48 }}
              >
                Зафиксировать смету →
              </button>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
