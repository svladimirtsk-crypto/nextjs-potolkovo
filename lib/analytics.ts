// lib/analytics.ts

type YmParams = Record<string, string | number | boolean>;

declare global {
  interface Window {
    ym?: (
      counterId: number,
      action: string,
      goalName?: string,
      params?: YmParams
    ) => void;
  }
}

const YM_COUNTER = 107200362;

function ymReachGoal(goal: string, params?: YmParams) {
  if (typeof window === "undefined") return;
  if (typeof window.ym !== "function") return;
  window.ym(YM_COUNTER, "reachGoal", goal, params);
}

// ── Public API ────────────────────────────────────────────────────────────────

export function trackCalculatorOpen(source: string) {
  ymReachGoal("calculator_open", { source });
}

export function trackWizardStepView(step: 0 | 1 | 2, source?: string) {
  // step 0-based internally → показываем пользователю 1-based
  ymReachGoal("wizard_step_view", {
    step: step + 1,
    ...(source ? { source } : {}),
  });
}

export function trackWizardConfirm(source?: string) {
  ymReachGoal("wizard_confirm", {
    ...(source ? { source } : {}),
  });
}

export function trackFormSubmitSuccess(source?: string) {
  ymReachGoal("form_submit_success", {
    ...(source ? { source } : {}),
  });
}
