import { describe, expect, it } from "vitest";

import { buildRoomBreakdown, type V2RoomConfig } from "@/lib/calculator-v2/room-snapshot";
import { buildLeadSnapshotV2 } from "@/lib/calculator/types";
import type { CalculatorLeadSnapshot } from "@/lib/calculator/snapshot-types";

function room(id: string, patch: Partial<V2RoomConfig> = {}): V2RoomConfig {
  return {
    id,
    label: id,
    area: 20,
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

describe("T-022 - polniy sostav komnat", () => {
  it("2 komnaty: roomBreakdown[1].lightsCount === 6", () => {
    const rooms = [
      room("kuhnya", { area: 12, lightsEnabled: true, lightsCount: 4 }),
      room("gostinaya", { area: 24, lightsEnabled: true, lightsCount: 6 }),
    ];
    const breakdown = rooms.map(buildRoomBreakdown);
    expect(breakdown).toHaveLength(2);
    expect(breakdown[1].lightsCount).toBe(6);
    expect(breakdown[0].lightsCount).toBe(4);
  });

  it("vse dliny i kolichestva popadayut v breakdown", () => {
    const b = buildRoomBreakdown(
      room("spalnya", {
        shadowEnabled: true,
        shadowLength: 18,
        floatingEnabled: true,
        floatingLength: 6,
        lightLinesEnabled: true,
        lightLinesLength: 4,
        corniceType: "hidden-niche",
        corniceLength: 5,
        corniceLightingEnabled: true,
        corniceLightingLength: 5,
        corniceLightingPowerSupplies: 1,
        trackType: "built-in",
        trackLength: 10,
        chandeliersEnabled: true,
        chandeliersCount: 2,
      })
    );
    expect(b.shadowLength).toBe(18);
    expect(b.floatingLength).toBe(6);
    expect(b.lightLinesLength).toBe(4);
    expect(b.corniceLength).toBe(5);
    expect(b.corniceLightingLength).toBe(5);
    expect(b.trackLength).toBe(10);
    expect(b.chandeliersCount).toBe(2);
    expect(b.totalRub).toBeGreaterThan(0);
  });

  it("ceilingTypeLabel: Teneviy + Paryashchiy", () => {
    expect(buildRoomBreakdown(room("a")).ceilingTypeLabel).toBe("Простой потолок");
    expect(buildRoomBreakdown(room("b", { shadowEnabled: true })).ceilingTypeLabel).toBe("Теневой");
    expect(buildRoomBreakdown(room("c", { floatingEnabled: true })).ceilingTypeLabel).toBe("Парящий");
    expect(
      buildRoomBreakdown(room("d", { shadowEnabled: true, floatingEnabled: true })).ceilingTypeLabel
    ).toBe("Теневой + Парящий");
  });
});

describe("T-022 - LeadSnapshotV2", () => {
  const base = {
    area: 36,
    calculationScope: "object" as const,
    solutionScenario: "modern" as const,
    roomBreakdown: [room("kuhnya"), room("gostinaya", { lightsEnabled: true, lightsCount: 6 })].map(
      buildRoomBreakdown
    ),
    total: 40000,
    totalRawRub: 40000,
    minimumOrderApplied: false,
    extraInstallRub: 2500,
    lightingDiscountPercentApplied: 25,
  } as unknown as CalculatorLeadSnapshot;

  it("sobiraet scenario, scope, rooms i totals", () => {
    const lead = buildLeadSnapshotV2({
      snapshot: base,
      ceilingEffectiveTotal: 42500,
      lightingRegularTotal: 20000,
      lightingEffectiveTotal: 15000,
      source: "tenevoy-profil:hero",
      entry: "ceiling-first",
    });

    expect(lead.version).toBe(2);
    expect(lead.scenario).toBe("modern");
    expect(lead.scope).toBe("object");
    expect(lead.rooms).toHaveLength(2);
    expect(lead.rooms[1].lightsCount).toBe(6);
    expect(lead.totals.ceilingRaw).toBe(40000);
    expect(lead.totals.installExtra).toBe(2500);
    expect(lead.totals.lightingRegular).toBe(20000);
    expect(lead.totals.lightingEffective).toBe(15000);
    expect(lead.totals.discountPct).toBe(25);
    expect(lead.totals.grand).toBe(42500 + 15000);
    expect(lead.source).toBe("tenevoy-profil:hero");
    expect(lead.entry).toBe("ceiling-first");
  });

  it("bez sveta lighting = null, grand = potolok", () => {
    const lead = buildLeadSnapshotV2({
      snapshot: base,
      ceilingEffectiveTotal: 42500,
      lightingRegularTotal: 0,
      lightingEffectiveTotal: 0,
      source: "home:sticky",
    });
    expect(lead.lighting).toBeNull();
    expect(lead.totals.grand).toBe(42500);
  });

  it("pustoy snapshot ne padaet", () => {
    const lead = buildLeadSnapshotV2({
      snapshot: null,
      ceilingEffectiveTotal: 0,
      lightingRegularTotal: 0,
      lightingEffectiveTotal: 0,
      source: "home:header",
    });
    expect(lead.scenario).toBe("standard");
    expect(lead.scope).toBe("room");
    expect(lead.rooms).toEqual([]);
    expect(lead.totals.grand).toBe(0);
  });
});
