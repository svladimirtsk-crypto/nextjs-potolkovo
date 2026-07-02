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

export function trackWizardBack(params: {
  step: number;
  fromSummary: boolean;
  source?: string;
}) {
  ymReachGoal("wizard_back", {
    step: params.step,
    from_summary: params.fromSummary ? 1 : 0,
    ...(params.source ? { source: params.source } : {}),
  });
}

export function trackScenarioSelected(params: {
  scenario: "standard" | "modern" | "advanced";
  source?: string;
}) {
  ymReachGoal("scenario_selected", {
    scenario: params.scenario,
    ...(params.source ? { source: params.source } : {}),
  });
}

export function trackSmartInterestSelected(params: {
  placement: "modal" | "catalog";
  enabled: boolean;
  source?: string;
}) {
  ymReachGoal("smart_interest_selected", {
    placement: params.placement,
    enabled: params.enabled,
    ...(params.source ? { source: params.source } : {}),
  });
}

export function trackLightingCartCheckout(params: {
  mode: "lighting-only" | "with-ceiling" | "open-calculator";
  itemsCount: number;
  lightingTotalRub: number;
  lightingDiscountedRub: number;
  source?: string;
}) {
  ymReachGoal("lighting_cart_checkout", {
    mode: params.mode,
    items_count: params.itemsCount,
    lighting_total_rub: params.lightingTotalRub,
    lighting_discounted_rub: params.lightingDiscountedRub,
    ...(params.source ? { source: params.source } : {}),
  });
}

let cartChangeTimeout: NodeJS.Timeout | null = null;
const cartChangeBuffer: Record<string, { action: "add" | "remove" | "change"; sku: string; productKind: string; qty: number; source?: string }> = {};

export function trackLightingCartChanged(params: {
  action: "add" | "remove" | "change";
  sku: string;
  productKind: string;
  qty: number;
  source?: string;
}) {
  if (typeof window === "undefined") return;

  // Buffer the events by SKU so we only send the latest state for each product
  cartChangeBuffer[params.sku] = params;

  if (cartChangeTimeout) clearTimeout(cartChangeTimeout);

  cartChangeTimeout = setTimeout(() => {
    // Send all buffered changes
    for (const sku of Object.keys(cartChangeBuffer)) {
      const p = cartChangeBuffer[sku];
      ymReachGoal("lighting_cart_changed", {
        action: p.action,
        sku: p.sku,
        kind: p.productKind,
        qty: p.qty,
        ...(p.source ? { source: p.source } : {}),
      });
      delete cartChangeBuffer[sku];
    }
  }, 500);
}

export function trackMessengerClick(params: {
  messenger: "whatsapp" | "telegram";
  placement: "modal_summary" | "page_action" | "catalog_error";
  source?: string;
  orderIntent?: string;
  grandTotal?: number;
}) {
  ymReachGoal("messenger_click", {
    messenger: params.messenger,
    placement: params.placement,
    ...(params.source ? { source: params.source } : {}),
    ...(params.orderIntent ? { order_intent: params.orderIntent } : {}),
    ...(typeof params.grandTotal === "number" ? { grand_total: params.grandTotal } : {}),
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
