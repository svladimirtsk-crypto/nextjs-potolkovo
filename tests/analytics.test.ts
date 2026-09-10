import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  trackCalculatorClose,
  trackCalculatorOpen,
  trackLeadError,
  trackLeadSubmit,
  trackLightingConflict,
  trackLightingKitComplete,
  trackLightingSearch,
  trackLightingSkip,
  trackLightingStepView,
  trackLightingSystemSelected,
  trackQuizBack,
  trackQuizParamConfirm,
  trackQuizScreenView,
  trackQuizSummary,
  trackLeadRescueAccepted,
  trackLeadRescueShown,
} from "@/lib/analytics";

const ym = vi.fn();

function calls(goal: string) {
  return ym.mock.calls.filter((c) => c[1] === "reachGoal" && c[2] === goal);
}
function paramsCalls() {
  return ym.mock.calls.filter((c) => c[1] === "params");
}

beforeEach(() => {
  ym.mockClear();
  vi.stubGlobal("window", { ym } as unknown as Window);
});

describe("T-025 - obertka ymReachGoal", () => {
  it("calculator_open: source, entry_mode, has_draft", () => {
    trackCalculatorOpen("tenevoy-profil:hero", { entryMode: "lighting-first", hasDraft: true });
    expect(calls("calculator_open")[0][3]).toEqual({
      source: "tenevoy-profil:hero",
      entry_mode: "lighting-first",
      has_draft: 1,
    });
  });

  it("quiz_screen_view: screen, param, index, total, scenario", () => {
    trackQuizScreenView({ screen: "param", param: "area", index: 2, total: 5, scenario: "modern" });
    expect(calls("quiz_screen_view")[0][3]).toEqual({
      screen: "param",
      param: "area",
      index: 2,
      total: 5,
      scenario: "modern",
    });
  });

  it("quiz_param_confirm i quiz_back", () => {
    trackQuizParamConfirm({ param: "track", value: 10, roomIndex: 1 });
    expect(calls("quiz_param_confirm")[0][3]).toEqual({ param: "track", value: 10, room_index: 1 });
    trackQuizBack({ from: "param" });
    expect(calls("quiz_back")[0][3]).toEqual({ from: "param" });
  });

  it("quiz_summary shlet cel i parametr vizita calc_total", () => {
    trackQuizSummary({ total: 72000, rooms: 2, scenario: "modern", minimumApplied: false });
    expect(calls("quiz_summary")[0][3]).toEqual({
      total: 72000,
      rooms: 2,
      scenario: "modern",
      minimum_applied: 0,
    });
    expect(paramsCalls()[0][2]).toEqual({ calc_total: 72000, calc_scenario: "modern" });
  });

  it("sobytiya Shaga 1", () => {
    trackLightingStepView({ wstep: "trackProfile", requiredTrackM: 10, requiredPoints: 6 });
    expect(calls("lighting_step_view")[0][3]).toEqual({
      wstep: "trackProfile",
      required_track_m: 10,
      required_points: 6,
    });

    trackLightingSystemSelected({ system: "COLIBRI_220" });
    expect(calls("lighting_system_selected")[0][3]).toEqual({ system: "COLIBRI_220" });

    trackLightingSkip({ from: "system" });
    expect(calls("lighting_skip")[0][3]).toEqual({ from: "system" });

    trackLightingKitComplete({ items: 7, total: 21008, autoItems: 2, system: "COLIBRI_220" });
    expect(calls("lighting_kit_complete")[0][3]).toEqual({
      items: 7,
      total: 21008,
      auto_items: 2,
      system: "COLIBRI_220",
    });

    trackLightingConflict({ from: "COLIBRI_220", to: "TRACK_220", removedTotal: 5000, confirmed: true });
    expect(calls("lighting_conflict")[0][3]).toEqual({
      from: "COLIBRI_220",
      to: "TRACK_220",
      removed_total: 5000,
      confirmed: 1,
    });
  });

  it("lighting_search debounced na 800 ms", () => {
    vi.useFakeTimers();
    trackLightingSearch({ q: "трек", section: "track", results: 12 });
    trackLightingSearch({ q: "трек 3м", section: "track", results: 4 });
    expect(calls("lighting_search")).toHaveLength(0);
    vi.advanceTimersByTime(800);
    expect(calls("lighting_search")).toHaveLength(1);
    expect(calls("lighting_search")[0][3]).toEqual({ q: "трек 3м", section: "track", results: 4 });
    vi.useRealTimers();
  });

  it("calculator_close: step, screen, has_data, lead_sent", () => {
    trackCalculatorClose({ step: 1, screen: "param", hasData: true, leadSent: false });
    expect(calls("calculator_close")[0][3]).toEqual({
      step: 1,
      screen: "param",
      has_data: 1,
      lead_sent: 0,
    });
  });

  it("lead_submit: vse obyazatelnye polya + lead_total", () => {
    trackLeadSubmit({
      placement: "modal",
      leadKind: "calculator",
      orderIntent: "lighting_with_ceiling",
      grandTotal: 93000,
      rooms: 2,
      lightingItems: 7,
      source: "tenevoy-profil:hero",
      pagePath: "/uslugi/tenevoy-profil",
      leadId: "K7F3Q",
    });
    expect(calls("lead_submit")[0][3]).toEqual({
      placement: "modal",
      lead_kind: "calculator",
      order_intent: "lighting_with_ceiling",
      grand_total: 93000,
      rooms: 2,
      lighting_items: 7,
      source: "tenevoy-profil:hero",
      page_path: "/uslugi/tenevoy-profil",
      lead_id: "K7F3Q",
    });
    expect(paramsCalls()[0][2]).toEqual({ lead_total: 93000 });
  });

  it("lead_error i rescue", () => {
    trackLeadError({ kind: "ratelimit", placement: "modal" });
    expect(calls("lead_error")[0][3]).toEqual({ kind: "ratelimit", placement: "modal" });
    trackLeadRescueShown({ total: 72000 });
    trackLeadRescueAccepted({ total: 72000 });
    expect(calls("lead_rescue_shown")[0][3]).toEqual({ total: 72000 });
    expect(calls("lead_rescue_accepted")[0][3]).toEqual({ total: 72000 });
  });

  it("bez window.ym nichego ne padaet", () => {
    vi.stubGlobal("window", {} as unknown as Window);
    expect(() => trackQuizBack({ from: "summary" })).not.toThrow();
  });
});
