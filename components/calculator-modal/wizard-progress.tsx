"use client";

import type { WizardStep } from "@/lib/calculator-modal-types";

const LABELS = ["Потолок", "Свет", "Итог"] as const;

/** Presentation only: completed steps keep the existing back-navigation contract. */
export function WizardProgress({ currentStep, hasLightingSelected, hasCeilingCompleted, goToStep, step0Progress }: {
  currentStep: WizardStep;
  hasLightingSelected: boolean;
  hasCeilingCompleted: boolean;
  goToStep: (step: WizardStep) => void;
  step0Progress: { done: number; total: number; caption?: string } | null;
}) {
  const caption = currentStep === 0 && step0Progress?.caption ? step0Progress.caption
    : currentStep === 0 && step0Progress && step0Progress.total > 0
    ? `Потолок · вопрос ${step0Progress.done} из ${step0Progress.total}` : LABELS[currentStep];
  return <div className="pk-wizard-progress">
    <span className="pk-wizard-caption">{caption}</span>
    <nav aria-label="Шаги калькулятора" className="pk-wizard-steps">
      {LABELS.map((label, i) => {
        const canVisit = i < currentStep;
        const skipped = canVisit && ((i === 0 && !hasCeilingCompleted) || (i === 1 && !hasLightingSelected));
        return <button key={label} type="button" disabled={!canVisit}
          onClick={() => canVisit && goToStep(i as WizardStep)}
          aria-current={i === currentStep ? "step" : undefined}
          aria-label={skipped ? `${label} пропущен` : canVisit ? `Вернуться: ${label}` : label}
          data-status={i === currentStep ? "current" : canVisit ? (skipped ? "skipped" : "done") : "next"}>
          <span aria-hidden="true">{canVisit && !skipped ? "✓" : `0${i + 1}`}</span>{label}
        </button>;
      })}
    </nav>
  </div>;
}
