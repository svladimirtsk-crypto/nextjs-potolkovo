"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { WizardStep } from "@/lib/calculator-modal-types";
import { isSnapshotValid } from "@/lib/calculator-snapshot-guard";

import { useCalculatorModal } from "./calculator-modal-context";
import { PriceStrip } from "./price-strip";
import { WizardStep0Calculator } from "./wizard-step0-calculator";
import { WizardStep1Lighting } from "./wizard-step1-lighting";
import { WizardStep2Summary } from "./wizard-step2-summary";

import { usePriceCalculatorBridge } from "@/components/home/price-calculator-context";

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
  const { isOpen, currentStep, closeCalculator, goToStep, options, lightingDraft } = useCalculatorModal();
  const { snapshot } = usePriceCalculatorBridge();

  const panelRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => setMounted(true), []);

  const snapshotValid = isSnapshotValid(snapshot);

  const isNextDisabled = useMemo(() => {
    // убираем “серую кнопку” как UX-поломку: Step0 допускаем всегда, если snapshot уже валиден
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

  const requestClose = useCallback(() => {
    setVisible(false);
    closeCalculator();
  }, [closeCalculator]);

  useEffect(() => {
    if (!isOpen) return;
    previousFocusRef.current = document.activeElement as HTMLElement;
    document.body.style.overflow = "hidden";

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) setVisible(true);
    else requestAnimationFrame(() => setVisible(true));

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
        requestClose();
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
  }, [isOpen, requestClose]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (!isOpen) return;
      if (e.target === overlayRef.current) requestClose();
    },
    [isOpen, requestClose]
  );

  const scrollToInlineForm = () => {
    if (!panelRef.current) return;
    const target = panelRef.current.querySelector<HTMLElement>("#modal-action-form");
    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "start" });

    requestAnimationFrame(() => {
      const input = target.querySelector<HTMLInputElement>("input");
      if (input) input.focus();
    });
  };

  if (!mounted) return null;

  const reducedMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const transitionClass = reducedMotion ? "" : "transition-all duration-200";
  const modalActive = isOpen && visible;

  return createPortal(
    <div aria-hidden={!isOpen} className={`fixed inset-0 z-[120] ${modalActive ? "pointer-events-auto" : "pointer-events-none"}`}>
      <div
        ref={overlayRef}
        onClick={handleOverlayClick}
        className={`fixed inset-0 z-[120] bg-black/50 ${transitionClass} ${
          modalActive ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
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
            modalActive
              ? "translate-y-0 opacity-100 lg:scale-100 pointer-events-auto"
              : "translate-y-4 opacity-0 lg:scale-95 pointer-events-none"
          }`}
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
              onClick={requestClose}
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
              <WizardStep0Calculator preset={options?.preset} />
            </div>
            <div className={currentStep === 1 ? "" : "hidden"} aria-hidden={currentStep !== 1}>
              <WizardStep1Lighting />
            </div>
            <div className={currentStep === 2 ? "" : "hidden"} aria-hidden={currentStep !== 2}>
              <WizardStep2Summary />
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

              {currentStep < 2 ? (
                <div className="flex flex-col items-end gap-1">
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
                </div>
              ) : (
                <button
                  type="button"
                  onClick={scrollToInlineForm}
                  className="flex h-12 items-center rounded-2xl bg-slate-950 px-6 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
                  style={{ minHeight: 48 }}
                >
                  Оставить заявку →
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
