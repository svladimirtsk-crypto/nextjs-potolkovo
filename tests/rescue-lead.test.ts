/**
 * PT-004 · Rescue-заявка: полный снапшот, проверка ответа, реальное согласие.
 *
 * Три регресса, которые эти тесты держат:
 *  1. раньше в `/api/lead` уходила одна сумма — состав расчёта терялся;
 *  2. `markLeadSubmitted()` вызывался после любого HTTP-статуса;
 *  3. `consent: true` был константой, а не результатом действия человека.
 *
 * Пункт 3 проверяется на уровне UI (`e2e/rescue-and-draft.spec.ts`): здесь
 * фиксируется, что payload, собранный после явного согласия, проходит
 * серверную zod-схему целиком.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LightingSnapshot } from "@/lib/calculator-modal-types";
import { buildRoomBreakdown, type V2RoomConfig } from "@/lib/calculator/room-snapshot";
import type { CalculatorLeadSnapshot } from "@/lib/calculator/snapshot-types";
import { LeadPayloadSchema } from "@/lib/lead/schema";
import {
  buildRescueLeadPayload,
  hasRescueCalculation,
  rescueFailureMessage,
  submitRescueLead,
  type RescueLeadInput,
} from "@/lib/lead/rescue-lead";

const ym = vi.fn();

function reachGoalCalls(goal: string) {
  return ym.mock.calls.filter((c) => c[1] === "reachGoal" && c[2] === goal);
}

function room(id: string, patch: Partial<V2RoomConfig> = {}): V2RoomConfig {
  return {
    id,
    label: id,
    area: 18,
    ceilingType: "standard",
    shadowEnabled: false,
    shadowLength: 0,
    floatingEnabled: false,
    floatingLength: 0,
    lightLinesEnabled: false,
    lightLinesLength: 0,
    corniceType: "none",
    corniceLength: 0,
    corniceLightingEnabled: false,
    corniceLightingLength: 0,
    corniceLightingPowerSupplies: 0,
    trackType: "none",
    trackLength: 0,
    chandeliersEnabled: false,
    chandeliersCount: 0,
    lightsEnabled: false,
    lightsCount: 0,
    ...patch,
  };
}

const LIGHTING: LightingSnapshot = {
  mode: "catalog",
  userCustomizedLighting: true,
  discountMode: "with-ceiling",
  discountPercentApplied: 25,
  discountAmountRub: 5000,
  totalRub: 20000,
  discountedTotalRub: 15000,
  items: [
    {
      sku: "sku-spot-1",
      vendorCode: "VC-1",
      name: "Светильник точечный",
      qty: 6,
      priceRub: 1500,
      system: "track",
      kind: "spot",
      unit: "шт.",
    },
    {
      sku: "sku-track-2",
      vendorCode: "VC-2",
      name: "Трек магнитный 2 м",
      qty: 5,
      priceRub: 2200,
      unit: "шт.",
      auto: true,
    },
  ],
};

/** Расчёт из двух комнат и корзины света — тот самый кейс «18 м² / 19 м / 10 м». */
function fullSnapshot(): CalculatorLeadSnapshot {
  return {
    area: 36,
    calculationScope: "object",
    solutionScenario: "modern",
    roomBreakdown: [
      buildRoomBreakdown(
        room("kuhnya", {
          area: 12,
          shadowEnabled: true,
          shadowLength: 19,
          trackType: "built-in",
          trackLength: 10,
          lightsEnabled: true,
          lightsCount: 6,
          chandeliersEnabled: true,
          chandeliersCount: 1,
        })
      ),
      buildRoomBreakdown(room("gostinaya", { area: 24, corniceType: "hidden-niche", corniceLength: 5 })),
    ],
    total: 40000,
    totalRawRub: 40000,
    minimumOrderApplied: false,
    extraInstallRub: 2500,
    lighting: LIGHTING,
    lightingDiscountMode: "with-ceiling",
    lightingDiscountPercentApplied: 25,
    derivedInputs: {
      pointSpotsQty: 6,
      trackMountType: "built-in",
      trackLengthMeters: 10,
      recommendedTrackSpotsQty: 6,
    },
  } as unknown as CalculatorLeadSnapshot;
}

function input(patch: Partial<RescueLeadInput> = {}): RescueLeadInput {
  return {
    phone: "9161234567",
    source: "tenevoy-profil:hero",
    pagePath: "/uslugi/tenevoy-profil",
    entryMode: "default",
    snapshot: fullSnapshot(),
    ceilingEffectiveTotal: 42500,
    lightingRegularTotal: 20000,
    lightingEffectiveTotal: 15000,
    grandTotal: 57500,
    ...patch,
  };
}

function stubFetch(response: Response) {
  const calls: Array<{ url: string; body: unknown }> = [];
  const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init?.body)) });
    return response;
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

function jsonResponse(body: unknown, status = 201): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  ym.mockClear();
  vi.stubGlobal("window", {
    ym,
    sessionStorage: { getItem: () => null },
    location: { pathname: "/uslugi/tenevoy-profil" },
  } as unknown as Window);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PT-004 - hasRescueCalculation", () => {
  it("net dannych -> net snepshota", () => {
    expect(hasRescueCalculation(null)).toBe(false);
    expect(
      hasRescueCalculation({ total: 0, derivedInputs: {} } as unknown as CalculatorLeadSnapshot)
    ).toBe(false);
  });

  it("est potolok ili korzina -> snepshot prikladyvaetsya", () => {
    expect(hasRescueCalculation(fullSnapshot())).toBe(true);
    expect(
      hasRescueCalculation({
        total: 0,
        lighting: LIGHTING,
        derivedInputs: {},
      } as unknown as CalculatorLeadSnapshot)
    ).toBe(true);
  });
});

describe("PT-004 - buildRescueLeadPayload", () => {
  it("polnyy snepshot: komnaty, dliny, kolichestva i korzina sveta", () => {
    const payload = buildRescueLeadPayload(input());

    expect(payload.snapshot).toBeDefined();
    const snapshot = payload.snapshot;
    if (!snapshot) throw new Error("ожидался снапшот");

    expect(snapshot.version).toBe(2);
    expect(snapshot.rooms).toHaveLength(2);
    expect(snapshot.rooms[0].shadowLength).toBe(19);
    expect(snapshot.rooms[0].trackLength).toBe(10);
    expect(snapshot.rooms[0].lightsCount).toBe(6);
    expect(snapshot.rooms[0].chandeliersCount).toBe(1);
    expect(snapshot.rooms[1].corniceLength).toBe(5);

    expect(snapshot.lighting?.items).toHaveLength(2);
    expect(snapshot.lighting?.items[1].auto).toBe(true);
    expect(snapshot.lighting?.regularTotalRub).toBe(20000);
    expect(snapshot.lighting?.effectiveTotalRub).toBe(15000);

    expect(snapshot.totals.grand).toBe(57500);
    expect(snapshot.totals.installExtra).toBe(2500);
    expect(snapshot.totals.discountPct).toBe(25);
  });

  it("payload prokhodit servernuyu zod-skhemu", () => {
    const parsed = LeadPayloadSchema.safeParse(buildRescueLeadPayload(input()));
    if (!parsed.success) {
      throw new Error(JSON.stringify(parsed.error.issues));
    }
    expect(parsed.data.leadKind).toBe("rescue");
    expect(parsed.data.placement).toBe("rescue");
    expect(parsed.data.consent).toBe(true);
  });

  it("telefon normalizuetsya do +7", () => {
    expect(buildRescueLeadPayload(input({ phone: "9161234567" })).phone).toBe("+79161234567");
    expect(buildRescueLeadPayload(input({ phone: "8 (916) 123-45-67" })).phone).toBe("+79161234567");
  });

  it("orderIntent i entry schitayutsya po sostavu, a ne po umolchaniyu", () => {
    expect(buildRescueLeadPayload(input()).orderIntent).toBe("lighting_with_ceiling");
    expect(buildRescueLeadPayload(input({ entryMode: "lighting-first" })).snapshot?.entry).toBe(
      "lighting-first"
    );

    // Только корзина света, потолка нет: раньше уходило `ceiling_only`.
    const lightingOnly = input({
      entryMode: "lighting-first",
      ceilingEffectiveTotal: 0,
      lightingEffectiveTotal: 15000,
      grandTotal: 15000,
      snapshot: {
        area: 0,
        total: 0,
        lighting: LIGHTING,
        lightingDiscountMode: "lighting-only",
        derivedInputs: {},
      } as unknown as CalculatorLeadSnapshot,
    });
    const payload = buildRescueLeadPayload(lightingOnly);
    expect(payload.orderIntent).toBe("lighting_only");
    expect(payload.grandTotal).toBe(15000);
  });

  it("bez raschyota snepshota net, no summa i consent ostayutsya", () => {
    const payload = buildRescueLeadPayload(
      input({ snapshot: null, ceilingEffectiveTotal: 0, lightingRegularTotal: 0, lightingEffectiveTotal: 0, grandTotal: 0 })
    );

    expect(payload.snapshot).toBeUndefined();
    expect(payload.totals).toBeUndefined();
    expect(payload.grandTotal).toBe(0);
    expect(payload.consent).toBe(true);
    expect(LeadPayloadSchema.safeParse(payload).success).toBe(true);
  });
});

describe("PT-004 - submitRescueLead: uspeh tolko posle otveta servera", () => {
  it("201 -> ok, lead_submit s sostavom raschyota", async () => {
    const { fetchImpl, calls } = stubFetch(
      jsonResponse({ ok: true, leadId: "K7F3Q", callbackWindow: "сегодня до 21:00" })
    );

    const outcome = await submitRescueLead(input(), { fetchImpl });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.leadId).toBe("K7F3Q");
    expect(outcome.message).toContain("K7F3Q");

    // В запросе — полный снапшот, а не одна сумма.
    const body = calls[0].body as Record<string, unknown>;
    expect(body.leadKind).toBe("rescue");
    expect(body.snapshot).toBeDefined();

    const submit = reachGoalCalls("lead_submit");
    expect(submit).toHaveLength(1);
    expect(submit[0][3]).toMatchObject({
      placement: "rescue",
      lead_kind: "rescue",
      order_intent: "lighting_with_ceiling",
      grand_total: 57500,
      rooms: 2,
      lighting_items: 2,
      lead_id: "K7F3Q",
    });
    expect(reachGoalCalls("lead_error")).toHaveLength(0);
  });

  it.each([422, 429, 500, 503])("%i -> ok:false, lead_submit ne schitaetsya", async (status) => {
    const { fetchImpl } = stubFetch(jsonResponse({ ok: false, error: "validation" }, status));

    const outcome = await submitRescueLead(input(), { fetchImpl });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.message.length).toBeGreaterThan(20);
    expect(reachGoalCalls("lead_submit")).toHaveLength(0);
    expect(reachGoalCalls("lead_error")).toHaveLength(1);
  });

  it("setevaya oshibka -> ok:false, bez uspeha", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;

    const outcome = await submitRescueLead(input(), { fetchImpl });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.kind).toBe("network");
    expect(reachGoalCalls("lead_submit")).toHaveLength(0);
  });

  it("nevalidnyy telefon: zapros ne ukhodit vovse", async () => {
    const { fetchImpl, calls } = stubFetch(jsonResponse({ ok: true }));

    const outcome = await submitRescueLead(input({ phone: "123" }), { fetchImpl });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.kind).toBe("validation");
    expect(outcome.message).toContain("Проверьте номер");
    expect(calls).toHaveLength(0);
    expect(reachGoalCalls("lead_submit")).toHaveLength(0);
  });

  it("silent ne trogaet Metriku", async () => {
    const { fetchImpl } = stubFetch(jsonResponse({ ok: true, leadId: "K7F3Q" }));
    const outcome = await submitRescueLead(input(), { fetchImpl, silent: true });
    expect(outcome.ok).toBe(true);
    expect(ym.mock.calls).toHaveLength(0);
  });
});

describe("PT-004 - tekst otkaza", () => {
  it("vsegda dayot zapasnoy put, a ne 'poprobuyte pozzhe'", () => {
    for (const kind of ["validation", "ratelimit", "unavailable", "server", "network", "timeout"] as const) {
      const message = rescueFailureMessage({ kind });
      expect(message).toContain("+7 905 521 99 09");
    }
  });

  it("429 pokazyvaet srok iz Retry-After", () => {
    expect(rescueFailureMessage({ kind: "ratelimit", retryAfterSec: 600 })).toContain("10 мин");
  });
});
