"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { WizardStep } from "@/lib/calculator-modal-types";
import { trackWizardConfirm } from "@/lib/analytics";
import { useCalculatorModal } from "./calculator-modal-context";
import { PriceStrip } from "./price-strip";
import { LightingFooterProgress } from "./lighting-footer-progress";
import { WizardStep0Calculator } from "./wizard-step0-calculator";
import { WizardStep1Lighting } from "./wizard-step1-lighting";
import { WizardStep2Summary } from "./wizard-step2-summary";

import { usePriceCalculatorBridge } from "@/components/home/price-calculator-context";
import { showConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  trackCalculatorClose,
  trackLeadRescueAccepted,
  trackLeadRescueShown,
} from "@/lib/analytics";

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
  /** T-028: Шаг 0 мог быть пропущен (вход «сначала свет») — тогда показываем «Потолок —». */
  hasCeilingCompleted: boolean;
  goToStep: (step: WizardStep) => void;
};

function ProgressBar({
  currentStep,
  hasLightingSelected,
  hasCeilingCompleted,
  goToStep,
}: ProgressBarProps) {
  return (
    <nav className="flex items-center gap-3 max-sm:gap-2" aria-label="Шаги калькулятора">
      {[0, 1, 2].map((i) => {
        const isCurrent = i === currentStep;
        const isPast = i < currentStep;
        const canVisit = i < currentStep;
        const stepLabels = ["Потолок", "Свет", "Итог"];
        const isSkippedLighting = i === 1 && isPast && !hasLightingSelected;
        const isSkippedCeiling = i === 0 && isPast && !hasCeilingCompleted;
        const isSkipped = isSkippedLighting || isSkippedCeiling;
        const visualDone = isPast && !isSkipped;

        return (
          <button
            key={i}
            onClick={() => canVisit && goToStep(i as WizardStep)}
            disabled={!canVisit && !isCurrent}
            aria-label={`Шаг ${i + 1}: ${isSkipped ? `${stepLabels[i]} пропущен` : stepLabels[i]}`}
            aria-current={isCurrent ? "step" : undefined}
            className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-all max-sm:px-2.5 max-sm:py-1 max-sm:text-[11px] ${
              isCurrent
                ? "bg-slate-950 text-white"
                : isSkipped
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
                  : isSkipped
                    ? "bg-slate-200 text-slate-500"
                    : ""
              }`}
            >
              {visualDone ? "✓" : isSkipped ? "—" : i + 1}
            </span>
            <span className="hidden sm:inline">{isSkipped ? `${stepLabels[i]} —` : stepLabels[i]}</span>
          </button>
        );
      })}
    </nav>
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
    step0FooterAction,
    step0BackAction,
    step0Progress,
    isStep0SummaryReady,
    sessionId,
    leadSubmittedAt,
    markLeadSubmitted,
    grandTotal,
  } = useCalculatorModal();
  const { snapshot } = usePriceCalculatorBridge();

  const panelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const lastConfirmTimeRef = useRef(0);

  const [mounted, setMounted] = useState(false);
  const [isActionFormVisible, setIsActionFormVisible] = useState(false);

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

  const step0HasBackButton = currentStep === 0 ? Boolean(step0BackAction.visible && step0BackAction.onClick) : false;
  // Пока конкретного действия нет (экран выбора сценария/помещения),
  // показываем понятную подпись вместо «мёртвой» кнопки «Подтвердить →».
  const step0FooterLabel = currentStep === 0 ? (step0FooterAction?.label ?? "Выберите вариант выше") : "Подтвердить →";
  const actionFormVisible = currentStep === 2 ? isActionFormVisible : false;

  const isNextDisabled = useMemo(() => {
    // Step 0: пока квиз не выдал конкретное действие (экран выбора сценария
    // или выбора помещения), кнопка «Далее» неактивна. Раньше при валидном
    // snapshot (например, уже есть посчитанная комната) клик проваливался в
    // goToStep(1) и лида выбрасывало на Шаг 1 в обход квиза.
    if (currentStep === 0) return step0FooterAction ? Boolean(step0FooterAction.disabled) : true;
    return false;
  }, [currentStep, step0FooterAction]);

  const stepTitle = useMemo(() => {
    if (currentStep === 1) {
      const hasLight = Boolean(
        lightingDraft && lightingDraft.mode !== "none" && (lightingDraft.items?.length ?? 0) > 0
      );
      return hasLight ? "Освещение ✓" : "Освещение";
    }
    if (currentStep === 0 && isStep0SummaryReady) {
      // Квиз-флоу: на сводке показываем «Проверка» вместо «Параметры потолка».
      return "Проверка";
    }
    const titles: Record<WizardStep, string> = {
      0: "Параметры потолка",
      1: "Освещение",
      2: "Итог расчета",
    };
    return titles[currentStep];
  }, [currentStep, lightingDraft, isStep0SummaryReady]);

  // P0.7: confirm before close if has data
  const hasAnyData = useMemo(() => {
    if (snapshot && snapshot.total > 0) return true;
    if (lightingDraft && lightingDraft.mode !== "none") return true;
    return false;
  }, [snapshot, lightingDraft]);

  /** T-026: короткая заявка «спасения» — только телефон и текущий расчёт. */
  const submitRescueLead = async (phone: string) => {
      try {
        await fetch("/api/lead", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone,
            consent: true,
            source: String(options?.source ?? "modal"),
            placement: "rescue",
            leadKind: "rescue",
            pagePath: typeof window !== "undefined" ? window.location.pathname : "",
            grandTotal,
          }),
        });
        markLeadSubmitted();
      } catch {
        // rescue не должен мешать закрытию модалки
      }
  };

  const requestClose = useCallback(async () => {
    const now = Date.now();
    if (now - lastConfirmTimeRef.current < 300) {
      return; // Skip if we recently closed a confirm dialog to prevent double execution
    }

    // T-023/T-026: после отправленной заявки ничего не спрашиваем — расчёт уже у мастера
    if (hasAnyData && !leadSubmittedAt && typeof window !== "undefined") {
      lastConfirmTimeRef.current = now;

      // T-026: rescue-оффер — предлагаем сохранить расчёт и прислать его на телефон
      trackLeadRescueShown({ total: grandTotal });
      const result = await showConfirmDialog({
        title: "Сохранить расчёт и получить его на телефон?",
        message:
          "Пришлю расчёт и отвечу на вопросы. Если не нужно — просто закройте, ничего не отправится.",
        confirmLabel: "Отправить",
        cancelLabel: "Просто закрыть",
        variant: "info",
        phoneField: {
          label: "Телефон",
          hint: "Перезвоню в удобное время, спама не будет.",
        },
      });
      lastConfirmTimeRef.current = Date.now();

      if (typeof result === "string" && result.trim()) {
        trackLeadRescueAccepted({ total: grandTotal });
        void submitRescueLead(result.trim());
      }
    }
    // T-025: закрытие калькулятора
    trackCalculatorClose({
      step: currentStep,
      screen:
        typeof document !== "undefined"
          ? String(
              document.querySelector("[data-quiz-v2]")?.getAttribute("data-active-screen") ?? "unknown"
            )
          : "unknown",
      hasData: hasAnyData,
      leadSent: Boolean(leadSubmittedAt),
    });

    closeCalculator();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closeCalculator, hasAnyData, leadSubmittedAt, currentStep, grandTotal]);

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
          data-testid="calculator-modal"
          data-open={isOpen ? "true" : "false"}
          aria-modal={isOpen ? "true" : undefined}
          aria-labelledby="calc-modal-title"
          // Fullscreen calculator wizard on all viewports
          /*
           * N-010 · На мобильном модалка остаётся полноэкранной, а на desktop
           * становится окном 1200×92dvh с двумя колонками: слева мастер,
           * справа липкая сводка. Раньше панель растягивалась на всю ширину
           * экрана, и на 1440 px контент болтался в пустоте (F-01, F-02).
           */
          className={`calculator-modal-panel fixed inset-0 flex h-[100dvh] max-h-[100dvh] w-screen max-w-none flex-col overflow-hidden rounded-none bg-white shadow-none lg:static lg:h-[92dvh] lg:max-h-[92dvh] lg:w-full lg:max-w-[1200px] lg:flex-row lg:rounded-3xl lg:shadow-2xl ${transitionClass} ${
            modalActive
              ? "translate-y-0 opacity-100 pointer-events-auto"
              : "translate-y-0 opacity-0 pointer-events-none"
          }`}
        >
          {/* N-010 · Левая колонка: шапка + прокручиваемый контент + футер. */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4 max-sm:px-4 max-sm:py-3">
            <div className="min-w-0 flex-1">
              <h2 id="calc-modal-title" className="text-lg font-semibold text-slate-950 max-sm:text-base">
                {stepTitle}
              </h2>
              {/* T-030: один индикатор внутри Шага 0 — тонкая полоска «вопрос N из M»
                  с фиксированным M. Дублирующие точки на мобильном удалены. */}
              {currentStep === 0 && step0Progress ? (
                <div className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                  <span className="font-semibold text-slate-950">
                    Шаг {step0Progress.done} из {step0Progress.total}
                  </span>
                  <div
                    className="relative h-1.5 w-32 overflow-hidden rounded-full bg-slate-200 max-sm:w-20"
                    role="progressbar"
                    aria-valuenow={step0Progress.done}
                    aria-valuemin={0}
                    aria-valuemax={step0Progress.total}
                  >
                    <div
                      className="h-full rounded-full bg-slate-950 transition-all duration-300 ease-out"
                      style={{
                        width: `${
                          step0Progress.total > 0
                            ? Math.round((step0Progress.done / step0Progress.total) * 100)
                            : 0
                        }%`,
                      }}
                      aria-hidden="true"
                    />
                  </div>
                </div>
              ) : null}
              {/* P0.6: progress bar instead of text */}
              <div className="mt-2 max-sm:mt-1.5">
                <ProgressBar
                  currentStep={currentStep}
                  hasLightingSelected={hasLightingSelected}
                  hasCeilingCompleted={Number(snapshot?.total ?? 0) > 0}
                  goToStep={goToStep}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={requestClose}
              aria-label="Закрыть"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-600"
              style={{ minHeight: 48, minWidth: 48 }}
            >
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-4 w-4"><path d="M5 5l10 10M15 5L5 15" /></svg>
            </button>
          </div>

          {/* P2.14: Sticky PriceStrip */}
          {currentStep !== 2 ? (
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-5 py-3 max-sm:px-4 max-sm:py-2 lg:hidden">
              <PriceStrip />
            </div>
          ) : null}

          {/* Content */}
          <div ref={contentRef} className="calculator-modal-content flex-1 overflow-y-auto px-5 py-5 max-lg:pb-8 max-sm:px-4 max-sm:py-4">
            <div
              key="step0"
              aria-hidden={currentStep !== 0}
              className={currentStep === 0 ? "animate-fade-slide-in" : "hidden"}
            >
              {/* T-023: key={sessionId} — новая сессия монтирует чистый шаг */}
              <WizardStep0Calculator key={`step0-${sessionId}`} preset={options?.preset} />
            </div>
            <div
              key="step1"
              aria-hidden={currentStep !== 1}
              className={currentStep === 1 ? "animate-fade-slide-in" : "hidden"}
            >
              <WizardStep1Lighting key={`step1-${sessionId}`} />
            </div>
            {/* T-023: Шаг 2 монтируется только когда он активен */}
            {currentStep === 2 ? (
              <div key="step2" className="animate-fade-slide-in">
                <WizardStep2Summary key={`step2-${sessionId}`} />
              </div>
            ) : null}
          </div>

          {/* Footer */}
          <div
            className="calculator-modal-footer shrink-0 border-t border-slate-200 bg-white px-5 py-4 max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-[145] max-lg:px-4 max-lg:py-3 max-lg:shadow-[0_-8px_24px_rgba(15,23,42,0.10)]"
            // P1.2: iOS safe-area for footer
            style={{ paddingBottom: "max(calc(env(safe-area-inset-bottom, 0px) + 12px), 16px)" }}
          >
            <LightingFooterProgress />
            <div className="flex items-center justify-between gap-3 max-lg:justify-stretch">
              {currentStep > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    // «Назад» со Step 2: если свет не выбирался (лид шёл
                    // 0 → 2 по сценарию standard/advanced), возвращаем на
                    // Step 0 — а не в пропущенный шаг освещения, которого
                    // лид не видел. Если свет есть — назад на Step 1.
                    if (currentStep === 2 && !hasLightingSelected) {
                      goToStep(0);
                      return;
                    }
                    goToStep((currentStep - 1) as WizardStep);
                  }}
                  className="h-12 rounded-2xl px-5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 max-sm:h-11 max-sm:px-3"
                  style={{ minHeight: 48 }}
                >
                  ← Назад
                </button>
              ) : step0HasBackButton ? (
                <button
                  type="button"
                  onClick={() => step0BackAction.onClick?.()}
                  className="h-12 rounded-2xl px-5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 max-sm:h-11 max-sm:px-3"
                  style={{ minHeight: 48 }}
                >
                  ← Назад
                </button>
              ) : (
                <div className="max-lg:hidden" />
              )}

              {currentStep < 2 ? (
                <div className="flex flex-col items-end gap-1 max-lg:flex-1 max-lg:items-stretch">
                  <button
                    type="button"
                    onClick={() => {
                      if (currentStep === 0 && step0FooterAction) {
                        step0FooterAction.onClick();
                        return;
                      }
                      if (currentStep === 1 && step1FooterAction) {
                        step1FooterAction.onClick();
                        return;
                      }
                      goToStep((currentStep + 1) as WizardStep);
                    }}
                    disabled={currentStep === 1 && step1FooterAction ? Boolean(step1FooterAction.disabled) : isNextDisabled}
                    aria-disabled={currentStep === 1 && step1FooterAction ? Boolean(step1FooterAction.disabled) : isNextDisabled}
                    className="flex h-12 items-center justify-center rounded-2xl bg-slate-950 px-6 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-slate-950 max-lg:h-12 max-lg:w-full max-lg:px-5"
                    style={{ minHeight: 48 }}
                  >
                    {currentStep === 0
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

          {/*
           * N-010 · Правая колонка (desktop): липкая сводка.
           * Держит сумму и прогресс подбора всегда на виду — на мобильном её
           * роль выполняют строка цены сверху и прогресс в футере.
           */}
          <aside className="hidden w-[360px] shrink-0 flex-col gap-4 overflow-y-auto border-l border-slate-200 bg-slate-50 px-5 py-5 lg:flex">
            <div>
              <h3 className="text-sm font-semibold text-slate-950">Сводка</h3>
              <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
                <PriceStrip />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>,
    document.body
  );
}
