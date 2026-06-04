// lib/analytics.ts

type YmParams = Record<string, string | number | boolean>;

declare global {
  interface Window {
    ym?: (counterId: number, action: string, goalName?: string, params?: YmParams) => void;
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

// ── New goals (Metrika) ───────────────────────────────────────────────────────

export function trackKitClicked(params: {
  kitBaseName: string;
  itemsCount: number;
  totalRub: number;
  source?: string;
}) {
  ymReachGoal("kit_clicked", {
    kit: params.kitBaseName,
    items_count: params.itemsCount,
    total_rub: params.totalRub,
    ...(params.source ? { source: params.source } : {}),
  });
}

export function trackLightingCartChanged(params: {
  action: "add" | "remove" | "change";
  sku: string;
  productKind: string;
  qty: number;
  source?: string;
}) {
  ymReachGoal("lighting_cart_changed", {
    action: params.action,
    sku: params.sku,
    kind: params.productKind,
    qty: params.qty,
    ...(params.source ? { source: params.source } : {}),
  });
}

export function trackFormOpened(params: {
  formPlacement: "modal" | "page";
  source?: string;
}) {
  ymReachGoal("form_opened", {
    form: params.formPlacement,
    ...(params.source ? { source: params.source } : {}),
  });
}

export function trackPhoneValidated(params: {
  formPlacement: "modal" | "page";
  source?: string;
}) {
  ymReachGoal("phone_validated", {
    form: params.formPlacement,
    ...(params.source ? { source: params.source } : {}),
  });
}

export function trackFormSubmitError(params: {
  kind: "validation" | "config" | "provider" | "network";
  formPlacement: "modal" | "page";
  source?: string;
}) {
  ymReachGoal("form_submit_error", {
    kind: params.kind,
    form: params.formPlacement,
    ...(params.source ? { source: params.source } : {}),
  });
}
