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

type ProgressBarProps = {
  currentStep: WizardStep;
  hasLightingSelected: boolean;
  goToStep: (step: WizardStep) => void;
};

function ProgressBar({ currentStep, hasLightingSelected, goToStep }: ProgressBarProps) {
  return (
    <div
      className="flex items-center gap-3 max-sm:gap-2"
      role="progressbar"
      aria-valuenow={currentStep + 1}
      aria-valuemin={1}
      aria-valuemax={3}
    >
      {[0, 1, 2].map((i) => {
        const isCurrent = i === currentStep;
        const isPast = i < currentStep;
        const canVisit = i < currentStep;
        const stepLabels = ["Потолок", "Свет", "Итог"];
        const isSkippedLighting = i === 1 && isPast && !hasLightingSelected;
        const visualDone = isPast && !isSkippedLighting;

        return (
          <button
            key={i}
            onClick={() => canVisit && goToStep(i as WizardStep)}
            disabled={!canVisit && !isCurrent}
            aria-label={`Шаг ${i + 1}: ${isSkippedLighting ? "Свет пропущен" : stepLabels[i]}`}
            className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-all max-sm:px-2.5 max-sm:py-1 max-sm:text-[11px] ${
              isCurrent
                ? "bg-slate-950 text-white"
                : isSkippedLighting
                  ? "bg-slate-100 text-slate-500 cursor-pointer hover:bg-slate-200"
                  : isPast
                    ? "bg-slate-200 text-slate-700 cursor-pointer hover:bg-slate-300"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
            }`}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold max-sm:h-4 max-sm:w-4 max-sm:text-[9px] ${
                visualDone
                  ? "bg-slate-950 text-white"
                  : isSkippedLighting
                    ? "bg-slate-200 text-slate-500"
                    : ""
              }`}
            >
              {visualDone ? "✓" : isSkippedLighting ? "—" : i + 1}
            </span>
            <span className="hidden sm:inline">{isSkippedLighting ? "Свет —" : stepLabels[i]}</span>
          </button>
        );
      })}
    </div>
  );
}

export function CalculatorModal() {
  const {
    isOpen,
    currentStep,
    closeCalculator,
    goToStep,
    options,
    lightingDraft,
    step1FooterAction,
  } = useCalculatorModal();
  const { snapshot } = usePriceCalculatorBridge();

  const panelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const [mounted, setMounted] = useState(false);
  const [isActionFormVisible, setIsActionFormVisible] = useState(false);
  const [step0HasConfirmButtonState, setStep0HasConfirmButtonState] = useState(false);
  const [step0FooterLabelState, setStep0FooterLabelState] = useState("Подтвердить →");

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  // Scroll content to top when step changes
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTo({ top: 0 });
    }
  }, [currentStep]);

  useEffect(() => {
    if (currentStep !== 2) return;

    const root = contentRef.current;
    if (!root) return;

    let observer: IntersectionObserver | null = null;
    let frame = 0;

    const setupObserver = () => {
      const target = root.querySelector<HTMLElement>("#modal-action-form");
      if (!target) {
        frame = requestAnimationFrame(setupObserver);
        return;
      }

      observer = new IntersectionObserver(
        ([entry]) => setIsActionFormVisible(Boolean(entry?.isIntersecting)),
        { root, threshold: 0.08 }
      );
      observer.observe(target);
    };

    frame = requestAnimationFrame(setupObserver);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [currentStep]);

  useEffect(() => {
    if (currentStep !== 0) return;

    const isMobile = () => typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches;

    const getConfirmLabel = (button: HTMLButtonElement | null) => {
      if (!button) return "Подтвердить →";
      const classes = button.classList;
      if (classes.contains("step0-confirm-area")) return "Подтвердить площадь →";
      if (classes.contains("step0-confirm-ceiling")) return "Подтвердить тип →";
      if (classes.contains("step0-confirm-shadow")) return "Подтвердить профиль →";
      if (classes.contains("step0-confirm-floating")) return "Подтвердить профиль →";
      if (classes.contains("step0-confirm-light-lines")) return "Подтвердить линии →";
      if (classes.contains("step0-confirm-cornice")) return "Подтвердить карниз →";
      if (classes.contains("step0-confirm-track")) return "Подтвердить трек →";
      if (classes.contains("step0-confirm-chandeliers")) return "Подтвердить люстры →";
      if (classes.contains("step0-confirm-lights")) return "Подтвердить точки →";
      if (classes.contains("step0-confirm-room-continue")) return "Продолжить помещение →";
      if (classes.contains("step0-confirm-room-next")) return "К следующей комнате →";
      if (classes.contains("step0-confirm-room-light")) return "К подбору освещения →";
      return "Подтвердить →";
    };

    const update = () => {
      if (!isMobile()) {
        setStep0HasConfirmButtonState(false);
        setStep0FooterLabelState("Подтвердить →");
        return;
      }

      const button = contentRef.current?.querySelector<HTMLButtonElement>(
        ".step0-confirm-button:not(:disabled)"
      ) ?? null;
      setStep0HasConfirmButtonState(Boolean(button));
      setStep0FooterLabelState(getConfirmLabel(button));
    };

    const frame = requestAnimationFrame(update);

    const root = contentRef.current;
    if (!root) return;

    const observer = new MutationObserver(update);
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "disabled", "style", "aria-hidden"],
    });

    window.addEventListener("resize", update);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [currentStep]);

  const snapshotValid = isSnapshotValid(snapshot);
  const step0HasConfirmButton = currentStep === 0 ? step0HasConfirmButtonState : false;
  const step0FooterLabel = currentStep === 0 ? step0FooterLabelState : "Подтвердить →";
  const actionFormVisible = currentStep === 2 ? isActionFormVisible : false;

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
    closeCalculator();
  }, [closeCalculator, hasAnyData]);

  useEffect(() => {
    if (!isOpen) return;
    previousFocusRef.current = document.activeElement as HTMLElement;
    document.body.style.overflow = "hidden";

    // P2.8: add modal-open class
    document.body.classList.add("modal-open");

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
    const previousFocus = previousFocusRef.current;
    if (!previousFocus) return;

    requestAnimationFrame(() => previousFocus.focus());
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
  const modalActive = isOpen;

  const hasLightingSelected = Boolean(
    lightingDraft && lightingDraft.mode !== "none" && (lightingDraft.items?.length ?? 0) > 0
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
          // Fullscreen calculator wizard on all viewports
          className={`calculator-modal-panel fixed inset-0 flex h-[100dvh] max-h-[100dvh] w-screen max-w-none flex-col overflow-hidden rounded-none bg-white shadow-none ${transitionClass} ${
            modalActive
              ? "translate-y-0 opacity-100 pointer-events-auto"
              : "translate-y-0 opacity-0 pointer-events-none"
          }`}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4 max-sm:px-4 max-sm:py-3">
            <div>
              <h2 id="calc-modal-title" className="text-lg font-semibold text-slate-950 max-sm:text-base">
                {stepTitle}
              </h2>
              {/* P0.6: progress bar instead of text */}
              <div className="mt-2 max-sm:mt-1.5">
                <ProgressBar
                  currentStep={currentStep}
                  hasLightingSelected={hasLightingSelected}
                  goToStep={goToStep}
                />
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
          {currentStep !== 2 ? (
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-5 py-3 max-sm:px-4 max-sm:py-2">
              <PriceStrip />
            </div>
          ) : null}

          {/* Content */}
          <div ref={contentRef} className="flex-1 overflow-y-auto px-5 py-5 max-sm:px-4 max-sm:py-4 max-sm:pb-36">
            <div
              key="step0"
              aria-hidden={currentStep !== 0}
              className={currentStep === 0 ? "animate-fade-slide-in" : "hidden"}
            >
              <WizardStep0Calculator preset={options?.preset} />
            </div>
            <div
              key="step1"
              aria-hidden={currentStep !== 1}
              className={currentStep === 1 ? "animate-fade-slide-in" : "hidden"}
            >
              <WizardStep1Lighting />
            </div>
            <div
              key="step2"
              aria-hidden={currentStep !== 2}
              className={currentStep === 2 ? "animate-fade-slide-in" : "hidden"}
            >
              <WizardStep2Summary />
            </div>
          </div>

          {/* Footer */}
          <div
            className="shrink-0 border-t border-slate-200 px-5 py-4 max-sm:px-4 max-sm:py-3"
            // P1.2: iOS safe-area for footer
            style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}
          >
            <LightingFooterProgress />
            <div className="flex items-center justify-between gap-3">
              {currentStep > 0 ? (
                <button
                  type="button"
                  onClick={() => goToStep((currentStep - 1) as WizardStep)}
                  className="h-12 rounded-2xl px-5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 max-sm:h-11 max-sm:px-3"
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
                    onClick={() => {
                      if (currentStep === 0 && step0HasConfirmButton) {
                        const button = contentRef.current?.querySelector<HTMLButtonElement>(
                          ".step0-confirm-button:not(:disabled)"
                        );
                        if (button) {
                          button.click();
                          return;
                        }
                      }
                      if (currentStep === 1 && step1FooterAction) {
                        step1FooterAction.onClick();
                        return;
                      }
                      goToStep((currentStep + 1) as WizardStep);
                    }}
                    disabled={currentStep === 1 && step1FooterAction ? Boolean(step1FooterAction.disabled) : isNextDisabled}
                    aria-disabled={currentStep === 1 && step1FooterAction ? Boolean(step1FooterAction.disabled) : isNextDisabled}
                    className="flex h-12 items-center rounded-2xl bg-slate-950 px-6 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-slate-950 max-sm:h-11 max-sm:px-5"
                    style={{ minHeight: 48 }}
                  >
                    {currentStep === 0 && step0HasConfirmButton
                      ? step0FooterLabel
                      : currentStep === 1 && step1FooterAction
                        ? step1FooterAction.label
                        : currentStep === 1 && (lightingDraft?.items?.length ?? 0) > 0
                          ? "К итогу →"
                          : "Далее →"}
                  </button>
                </div>
              ) : actionFormVisible ? (
                <div />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    trackWizardConfirm(String(options?.source ?? "unknown"));
                    scrollToInlineForm();
                  }}
                  className="flex h-12 items-center rounded-2xl bg-slate-950 px-6 text-sm font-semibold text-white transition-colors hover:bg-slate-800 max-sm:h-11 max-sm:px-5"
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
