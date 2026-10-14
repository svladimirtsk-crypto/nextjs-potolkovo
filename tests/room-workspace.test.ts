import { nextRoomSequence } from "@/lib/calculator/reducer";
import { describe, expect, it } from "vitest";
import { calcProgress, getEnabledParams } from "@/lib/calculator/fsm";
import { changedRoomFields, confirmationsAfterEdit, createRoomEdit, firstRoomPending, paramsForRoom, parseRoomConfirmations, patchRoomEdit, snapshotAfterLastRoom } from "@/lib/calculator/room-workspace";
import type { RoomConfig } from "@/lib/calculator/use-calculator-engine";
import type { LightingSnapshot } from "@/lib/calculator-modal-types";
import { createLightingOnlySnapshot } from "@/lib/lighting/track-sale-snapshot";
const room: RoomConfig = {
  id: "r1", label: "Кухня", area: 18, ceilingType: "standard", shadowEnabled: false, shadowLength: 17,
  floatingEnabled: false, floatingLength: 17, lightLinesEnabled: false, lightLinesLength: 3,
  corniceType: "none", corniceLength: 2, corniceLightingEnabled: false, corniceLightingLength: 2, corniceLightingPowerSupplies: 1,
  trackType: "none", trackLength: 2, chandeliersEnabled: false, chandeliersCount: 1, lightsEnabled: false, lightsCount: 6,
};
const full = Object.fromEntries(paramsForRoom(room, "standard").map(p => [p, true]));

describe("Room edit transaction", () => {
  it("edits a separate draft, not the saved room or source quote", () => {
    const before = structuredClone(room); const e = createRoomEdit(room, "area", "standard");
    const changed = patchRoomEdit(e, { area: 25 });
    expect(room).toEqual(before); expect(e.draft.area).toBe(18); expect(changed.draft.area).toBe(25);
    expect(changedRoomFields(changed)).toEqual({ area: 25 });
  });
  it("returning to the original value produces no change or fake touched fields", () => {
    const e = patchRoomEdit(patchRoomEdit(createRoomEdit(room, "area", "standard"), { area: 25 }), { area: 18 });
    expect(changedRoomFields(e)).toEqual({});
  });
  it("never accepts an identity change through a parameter patch", () => {
    const e = patchRoomEdit(createRoomEdit(room, "area", "standard"), { id: "another", area: 20 });
    expect(e.draft.id).toBe("r1"); expect(changedRoomFields(e)).toEqual({ area: 20 });
  });
  it("does not revoke unchanged answers when area alone is saved", () => {
    const e = patchRoomEdit(createRoomEdit(room, "area", "standard"), { area: 25 });
    expect(confirmationsAfterEdit(e, full)).toEqual(full);
  });
  it("new profile choices require their metres to be checked", () => {
    const e = patchRoomEdit(createRoomEdit(room, "ceiling", "modern"), { shadowEnabled: true });
    const flags = confirmationsAfterEdit(e, { ...full, shadowProfile: true, floatingProfile: true });
    expect(flags.ceiling).toBe(true); expect(flags.shadowProfile).toBeUndefined(); expect(flags.floatingProfile).toBeUndefined();
    expect(firstRoomPending([e.draft], "modern", { r1: flags }, new Set())?.param).toBe("shadowProfile");
  });
  it("does not confuse two rooms with identical labels", () => {
    const other = { ...room, id: "r2" };
    expect(firstRoomPending([room, other], "standard", { r1: full }, new Set())).toMatchObject({ roomId: "r2", param: "area" });
  });
});

describe("Draft completion metadata and actual progress", () => {
  it("legacy drafts can be reviewed without forcing a new full questionnaire", () => {
    expect(firstRoomPending([room], "standard", {}, new Set([room.id]))).toBeNull();
    expect(parseRoomConfirmations(undefined)).toBeUndefined();
  });
  it("keeps only explicit true answers and known parameter names", () => {
    expect(parseRoomConfirmations({ r1: { area: true, ceiling: "yes", lights: 1, phone: true } })).toEqual({ r1: { area: true } });
    expect(parseRoomConfirmations([])).toBeUndefined(); expect(parseRoomConfirmations("bad")).toBeUndefined();
  });
  it("a partial new draft remains partial, not implicitly ready", () => {
    const map = parseRoomConfirmations({ r1: { area: true } })!;
    expect(firstRoomPending([room], "standard", map, new Set())?.param).toBe("ceiling");
  });
  for (const scenario of ["standard", "modern", "advanced"] as const) {
    it(`${scenario}: counts actual enabled questions and completes the summary`, () => {
      const params = getEnabledParams({ scenario, shadowEnabled: false, floatingEnabled: false, showModernOptions: scenario !== "standard" });
      const first = calcProgress({ t: "param", roomId: "r1", param: "area" }, { scenario, enabledParams: params });
      expect(first).toEqual({ done: 1, total: scenario === "standard" ? 5 : 7 });
      const end = calcProgress({ t: "summary" }, { scenario, enabledParams: params });
      expect(end.done).toBe(end.total);
    });
  }
  it("picker and editor are not numbered questions", () => {
    const ctx = { scenario: "standard" as const, enabledParams: paramsForRoom(room, "standard") };
    expect(calcProgress({ t: "roomPicker", mode: "first" }, ctx).done).toBe(0);
    expect(calcProgress({ t: "roomEdit", roomId: "r1" }, ctx).done).toBe(0);
  });
});

describe("Explicit deletion of last room", () => {
  it("clears geometry/minimum/installation while retaining the exact equipment and source", () => {
    const lighting: LightingSnapshot = { mode: "catalog", items: [{ sku: "fixture-test", name: "Тестовый светильник", qty: 2, priceRub: 1000 }], totalRub: 2000, userCustomizedLighting: true };
    const prev = { ...createLightingOnlySnapshot(), area: 18, total: 30000, totalRawRub: 30000, minimumOrderApplied: true, leadSource: "test-source", lighting };
    const next = snapshotAfterLastRoom(prev, lighting);
    expect(next.total).toBe(0); expect(next.area).toBe(0); expect(next.minimumOrderApplied).toBe(false); expect(next.roomBreakdown).toEqual([]);
    expect(next.lighting).toBe(lighting); expect(next.leadSource).toBe("test-source"); expect(prev.total).toBe(30000);
  });
  it("also supports a genuinely empty project without manufacturing a new room", () => {
    const next = snapshotAfterLastRoom(null, null);
    expect(next.total).toBe(0); expect(next.roomBreakdown).toEqual([]); expect(next.lighting).toBeUndefined();
  });
});


describe("Stable room identities after deletion and restore", () => {
  it("uses existing ids, not the number of surviving rooms", () => {
    expect(nextRoomSequence([{ id: "room-2" }])).toBe(3);
    expect(nextRoomSequence([{ id: "room-1" }, { id: "room-7" }])).toBe(8);
    expect(nextRoomSequence([{ id: "custom-room" }, { id: "object-1" }])).toBe(3);
  });
});
