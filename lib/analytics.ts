// lib/analytics.ts

type YmParams = Record<string, string | number | boolean>;

declare global {
  interface Window {
    ym?: (
      counterId: number,
      action: string,
      goalNameOrParams?: string | YmParams,
      params?: YmParams
    ) => void;
  }
}

export const YM_COUNTER = 107200362;

/**
 * T-025 · Единственная точка отправки целей в Метрику.
 * Экспортирована, чтобы юнит-тесты могли проверить контракт событий.
 */
export function ymReachGoal(goal: string, params?: YmParams) {
  if (typeof window === "undefined") return;
  if (typeof window.ym !== "function") return;
  window.ym(YM_COUNTER, "reachGoal", goal, params);
}

/** T-025 · Параметры визита (`calc_total`, `calc_scenario`, `lead_total`). */
export function ymVisitParams(params: YmParams) {
  if (typeof window === "undefined") return;
  if (typeof window.ym !== "function") return;
  window.ym(YM_COUNTER, "params", params);
}

// ── Public API ────────────────────────────────────────────────────────────────

export function trackCalculatorOpen(
  source: string,
  extra?: { entryMode?: string | null; hasDraft?: boolean }
) {
  ymReachGoal("calculator_open", {
    source,
    ...(extra?.entryMode ? { entry_mode: extra.entryMode } : {}),
    ...(typeof extra?.hasDraft === "boolean" ? { has_draft: extra.hasDraft ? 1 : 0 } : {}),
  });
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

// ── T-025 · Приложение В: экраны квиза, Шаг 1, закрытие, лид ──────────────────

export type QuizScenario = "standard" | "modern" | "advanced";

export function trackQuizScreenView(params: {
  screen: string;
  param?: string | null;
  index?: number;
  total?: number;
  scenario: QuizScenario;
}) {
  ymReachGoal("quiz_screen_view", {
    screen: params.screen,
    ...(params.param ? { param: params.param } : {}),
    ...(typeof params.index === "number" ? { index: params.index } : {}),
    ...(typeof params.total === "number" ? { total: params.total } : {}),
    scenario: params.scenario,
  });
}

export function trackQuizParamConfirm(params: {
  param: string;
  value: string | number | boolean;
  roomIndex: number;
}) {
  ymReachGoal("quiz_param_confirm", {
    param: params.param,
    value: params.value,
    room_index: params.roomIndex,
  });
}

export function trackQuizBack(params: { from: string }) {
  ymReachGoal("quiz_back", { from: params.from });
}

export function trackQuizSummary(params: {
  total: number;
  rooms: number;
  scenario: QuizScenario;
  minimumApplied: boolean;
}) {
  ymReachGoal("quiz_summary", {
    total: params.total,
    rooms: params.rooms,
    scenario: params.scenario,
    minimum_applied: params.minimumApplied ? 1 : 0,
  });
  // параметр визита обновляем при каждой сводке
  ymVisitParams({ calc_total: params.total, calc_scenario: params.scenario });
}

export function trackLightingStepView(params: {
  wstep: string;
  requiredTrackM: number;
  requiredPoints: number;
}) {
  ymReachGoal("lighting_step_view", {
    wstep: params.wstep,
    required_track_m: params.requiredTrackM,
    required_points: params.requiredPoints,
  });
}

export function trackLightingSystemSelected(params: { system: string }) {
  ymReachGoal("lighting_system_selected", { system: params.system });
}

export function trackLightingSkip(params: { from: string }) {
  ymReachGoal("lighting_skip", { from: params.from });
}

export function trackLightingKitComplete(params: {
  items: number;
  total: number;
  autoItems: number;
  system: string;
}) {
  ymReachGoal("lighting_kit_complete", {
    items: params.items,
    total: params.total,
    auto_items: params.autoItems,
    system: params.system,
  });
}

export function trackLightingConflict(params: {
  from: string;
  to: string;
  removedTotal: number;
  confirmed: boolean;
}) {
  ymReachGoal("lighting_conflict", {
    from: params.from,
    to: params.to,
    removed_total: params.removedTotal,
    confirmed: params.confirmed ? 1 : 0,
  });
}

let searchTimeout: ReturnType<typeof setTimeout> | null = null;

/** Поиск по каталогу — с дебаунсом 800 мс, чтобы не слать цель на каждую букву. */
export function trackLightingSearch(params: { q: string; section: string; results: number }) {
  if (typeof window === "undefined") return;
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    ymReachGoal("lighting_search", {
      q: params.q.slice(0, 64),
      section: params.section,
      results: params.results,
    });
  }, 800);
}

export function trackCalculatorClose(params: {
  step: number;
  screen: string;
  hasData: boolean;
  leadSent: boolean;
}) {
  ymReachGoal("calculator_close", {
    step: params.step,
    screen: params.screen,
    has_data: params.hasData ? 1 : 0,
    lead_sent: params.leadSent ? 1 : 0,
  });
}

export function trackLeadRescueShown(params: { total: number }) {
  ymReachGoal("lead_rescue_shown", { total: params.total });
}

export function trackLeadRescueAccepted(params: { total: number }) {
  ymReachGoal("lead_rescue_accepted", { total: params.total });
}

export function trackLeadSubmit(params: {
  placement: string;
  leadKind: string;
  orderIntent: string;
  grandTotal: number;
  rooms: number;
  lightingItems: number;
  source: string;
  pagePath: string;
  leadId?: string | number | null;
}) {
  ymReachGoal("lead_submit", {
    placement: params.placement,
    lead_kind: params.leadKind,
    order_intent: params.orderIntent,
    grand_total: params.grandTotal,
    rooms: params.rooms,
    lighting_items: params.lightingItems,
    source: params.source,
    page_path: params.pagePath,
    ...(params.leadId ? { lead_id: String(params.leadId) } : {}),
  });
  ymVisitParams({ lead_total: params.grandTotal });
}

export function trackLeadError(params: {
  kind: "validation" | "network" | "server" | "ratelimit";
  placement: string;
}) {
  ymReachGoal("lead_error", { kind: params.kind, placement: params.placement });
}
