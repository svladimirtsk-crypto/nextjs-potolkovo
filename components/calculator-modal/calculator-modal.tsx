"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { WizardStep } from "@/lib/calculator-modal-types";
import { isSnapshotValid } from "@/lib/calculator-snapshot-guard";
import { trackWizardConfirm } from "@/lib/analytics";
import { useCalculatorModal } from "./calculator-modal-context";
import { PriceStrip } from "./price-strip";
import { LightingFooterProgress } from "./lighting-footer-progress";
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
  const { isOpen, currentStep, closeCalculator, goToStep, options, lightingDraft, lightingDraft: hasLightingData } = useCalculatorModal();
  const { snapshot } = usePriceCalculatorBridge();

  const panelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [renderedSteps, setRenderedSteps] = useState<Set<WizardStep>>(() => new Set());

  // P1.3: Swipe-to-close state
  const [dragY, setDragY] = useState(0);
  const touchStartRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => setMounted(true), []);

  // Keep visited steps mounted so confirmed user choices do not reset on back navigation.
  useEffect(() => {
    if (!isOpen) {
      setRenderedSteps(new Set());
      return;
    }

    setRenderedSteps((prev) => {
      if (prev.has(currentStep)) return prev;
      const next = new Set(prev);
      next.add(currentStep);
      return next;
    });
  }, [currentStep, isOpen]);

  // Scroll content to top when step changes
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTo({ top: 0 });
    }
  }, [currentStep]);

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

  // P0.7: confirm before close if has data
  const hasAnyData = useMemo(() => {
    if (snapshot && snapshot.total > 0) return true;
    if (lightingDraft && lightingDraft.mode !== "none") return true;
    return false;
  }, [snapshot, lightingDraft]);

  const requestClose = useCallback(() => {
    // P0.7: confirm dialog if there's data
    if (hasAnyData && typeof window !== "undefined") {
      const confirmed = window.confirm("Закрыть калькулятор? Ваш расчёт не сохранится.");
      if (!confirmed) return;
    }
    setVisible(false);
    setDragY(0);
    closeCalculator();
  }, [closeCalculator, hasAnyData]);

  // P1.3: Swipe-to-close handlers
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (window.innerWidth >= 1024) return; // только на мобиле
    touchStartRef.current = e.touches[0].clientY;
    setIsDragging(true);
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (window.innerWidth >= 1024) return;
    const y = e.touches[0].clientY - touchStartRef.current;
    if (y > 0) setDragY(y);
  }, []);

  const onTouchEnd = useCallback(() => {
    if (window.innerWidth >= 1024) return;
    setIsDragging(false);
    if (dragY > 200) requestClose();
    else setDragY(0);
  }, [dragY, requestClose]);

  useEffect(() => {
    if (!isOpen) return;
    previousFocusRef.current = document.activeElement as HTMLElement;
    document.body.style.overflow = "hidden";

    // P2.8: add modal-open class
    document.body.classList.add("modal-open");

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
      document.body.classList.remove("modal-open");
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) return;
    setVisible(false);
    setDragY(0);
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

  // P0.6: Progress bar
  const ProgressBar = () => (
    <div className="flex items-center gap-3" role="progressbar" aria-valuenow={currentStep + 1} aria-valuemin={1} aria-valuemax={3}>
      {[0, 1, 2].map((i) => {
        const isCurrent = i === currentStep;
        const isPast = i < currentStep;
        const canVisit = i < currentStep;
        const stepLabels = ["Потолок", "Свет", "Итог"];
        return (
          <button
            key={i}
            onClick={() => canVisit && goToStep(i as WizardStep)}
            disabled={!canVisit && !isCurrent}
            aria-label={`Шаг ${i + 1}: ${stepLabels[i]}`}
            className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
              isCurrent
                ? "bg-slate-950 text-white"
                : isPast
                  ? "bg-slate-200 text-slate-700 cursor-pointer hover:bg-slate-300"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed"
            }`}
          >
            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
              isPast ? "bg-slate-950 text-white" : ""
            }`}>
              {isPast ? "✓" : i + 1}
            </span>
            <span className="hidden sm:inline">{stepLabels[i]}</span>
          </button>
        );
      })}
    </div>
  );

  return createPortal(
    <div aria-hidden={!isOpen} className={`fixed inset-0 z-[120] ${modalActive ? "pointer-events-auto" : "pointer-events-none"}`}>
      {/* Overlay */}
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
          // P1.1: full-screen bottom sheet on mobile + P1.3: drag transform
          className={`w-full max-h-[92dvh] flex flex-col rounded-t-2xl bg-white shadow-2xl lg:max-h-[90dvh] lg:max-w-5xl lg:rounded-2xl xl:max-w-6xl ${transitionClass} ${
            modalActive
              ? "translate-y-0 opacity-100 lg:scale-100 pointer-events-auto"
              : "translate-y-4 opacity-0 lg:scale-95 pointer-events-none"
          } max-sm:fixed max-sm:inset-0 max-sm:max-h-screen max-sm:rounded-none max-sm:animate-slideUp`}
          // P1.3: swipe-to-close
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          style={
            isDragging && dragY > 0
              ? { transform: `translateY(${dragY}px)`, transition: "none" }
              : undefined
          }
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2 id="calc-modal-title" className="text-lg font-semibold text-slate-950">
                {stepTitle}
              </h2>
              {/* P0.6: progress bar instead of text */}
              <div className="mt-2">
                <ProgressBar />
              </div>
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

          {/* P2.14: Sticky PriceStrip */}
          <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-5 py-3">
            <PriceStrip />
          </div>

          {/* Content */}
          <div ref={contentRef} className="flex-1 overflow-y-auto px-5 py-5">
            {(renderedSteps.has(0) || (isOpen && currentStep === 0)) ? (
              <div
                key="step0"
                aria-hidden={currentStep !== 0}
                className={currentStep === 0 ? "animate-fade-slide-in" : "hidden"}
              >
                <WizardStep0Calculator preset={options?.preset} />
              </div>
            ) : null}
            {(renderedSteps.has(1) || (isOpen && currentStep === 1)) ? (
              <div
                key="step1"
                aria-hidden={currentStep !== 1}
                className={currentStep === 1 ? "animate-fade-slide-in" : "hidden"}
              >
                <WizardStep1Lighting />
              </div>
            ) : null}
            {(renderedSteps.has(2) || (isOpen && currentStep === 2)) ? (
              <div
                key="step2"
                aria-hidden={currentStep !== 2}
                className={currentStep === 2 ? "animate-fade-slide-in" : "hidden"}
              >
                <WizardStep2Summary />
              </div>
            ) : null}
          </div>

          {/* Footer */}
          <div
            className="shrink-0 border-t border-slate-200 px-5 py-4"
            // P1.2: iOS safe-area for footer
            style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}
          >
            <LightingFooterProgress />
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
                    {currentStep === 1 && (lightingDraft?.items?.length ?? 0) > 0 ? "К итогу →" : "Далее →"}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    trackWizardConfirm(String(options?.source ?? "unknown"));
                    scrollToInlineForm();
                  }}
                  className="flex h-12 items-center rounded-2xl bg-slate-950 px-6 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
                  style={{ minHeight: 48 }}
                >
                  Записаться на замер →
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
