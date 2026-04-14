"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";

import type { WizardStep } from "@/lib/calculator-modal-types";
import { useCalculatorModal } from "./calculator-modal-context";
import { usePriceCalculatorBridge } from "@/components/home/price-calculator-context";
import { scrollToAnchorTarget } from "@/lib/scroll-to-anchor";
import { PriceStrip } from "./price-strip";
import { WizardStep0Calculator } from "./wizard-step0-calculator";
import { WizardStep1Lighting } from "./wizard-step1-lighting";
import { WizardStep2Summary } from "./wizard-step2-summary";

const STEP_TITLES = [
  "Параметры потолка",
  "Освещение",
  "Итог расчёта",
] as const;

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(", ");
  return Array.from(container.querySelectorAll(selector));
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
  const { hasInteracted, snapshot, setSnapshot, setHasInteracted } =
    usePriceCalculatorBridge();

  const panelRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  const shouldApplyPreset =
    options?.preset && (!hasInteracted || options.forcePreset === true);
  const activePreset = shouldApplyPreset ? options.preset : undefined;

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
      requestAnimationFrame(() => {
        setVisible(true);
      });
    }

    requestAnimationFrame(() => {
      if (panelRef.current) {
        const focusable = getFocusableElements(panelRef.current);
        if (focusable.length > 0) {
          focusable[0].focus();
        }
      }
    });

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Restore focus on close
  useEffect(() => {
    if (!isOpen && previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
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
        const last = focusable[focusable.length - 1];

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
      if (e.target === overlayRef.current) {
        closeCalculator();
      }
    },
    [closeCalculator]
  );

  const handleConfirm = useCallback(() => {
    if (snapshot && lightingDraft) {
      setSnapshot({ ...snapshot, lighting: lightingDraft });
    }
    setHasInteracted(true);
    closeCalculator();

    requestAnimationFrame(() => {
      scrollToAnchorTarget("#action", { focus: true, highlight: true });
    });
  }, [snapshot, lightingDraft, setSnapshot, setHasInteracted, closeCalculator]);

  if (!isOpen) return null;

  const stepTitle = STEP_TITLES[currentStep] ?? STEP_TITLES[0];
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
          className={`pointer-events-auto w-full md:max-w-3xl bg-white md:rounded-2xl rounded-t-2xl shadow-2xl max-h-[90dvh] md:max-h-[88dvh] flex flex-col ${transitionClass} ${
            visible
              ? "opacity-100 translate-y-0 md:scale-100"
              : "opacity-0 translate-y-4 md:scale-95"
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
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
              className="h-10 w-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors min-h-[48px] min-w-[48px]"
              aria-label="Закрыть"
            >
              ✕
            </button>
          </div>

          {/* PriceStrip — desktop: between header and body */}
          <div className="hidden md:block shrink-0">
            <PriceStrip />
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-5">
            {currentStep === 0 ? (
              <WizardStep0Calculator preset={activePreset} />
            ) : null}
            {currentStep === 1 ? <WizardStep1Lighting /> : null}
            {currentStep === 2 ? (
              <WizardStep2Summary />
            ) : null}
          </div>

          {/* PriceStrip — mobile: sticky above footer */}
          <div className="md:hidden shrink-0 sticky bottom-0">
            <PriceStrip />
          </div>

          {/* Footer */}
          <div className="border-t border-slate-200 px-5 py-4 flex items-center justify-between gap-3 shrink-0">
            {currentStep > 0 ? (
              <button
                type="button"
                onClick={() => goToStep((currentStep - 1) as WizardStep)}
                className="h-12 px-5 rounded-2xl text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors min-h-[48px]"
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
                className="h-12 px-6 rounded-2xl bg-slate-950 text-white text-sm font-medium hover:bg-slate-800 transition-colors min-h-[48px]"
              >
                Далее →
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConfirm}
                className="h-12 px-6 rounded-2xl bg-slate-950 text-white text-sm font-medium hover:bg-slate-800 transition-colors min-h-[48px]"
              >
                Зафиксировать смету
              </button>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
