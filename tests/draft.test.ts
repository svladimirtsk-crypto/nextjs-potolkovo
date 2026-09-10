import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  CALC_DRAFT_STORAGE_KEY,
  CALC_DRAFT_TTL_MS,
  clearCalcDraft,
  describeCalcDraft,
  readCalcDraft,
  saveCalcDraft,
} from "@/lib/calculator/draft";
import type { V2RoomConfig } from "@/lib/calculator/room-snapshot";

function makeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, v),
  } as Storage;
}

const room = {
  id: "r1",
  label: "Кухня",
  area: 24,
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
} as V2RoomConfig;

beforeEach(() => {
  vi.stubGlobal("window", { sessionStorage: makeStorage() } as unknown as Window);
});

describe("T-023 - chernovik rascheta", () => {
  it("kluch versionirovan", () => {
    expect(CALC_DRAFT_STORAGE_KEY).toBe("potolkovo:calc-draft:v2");
  });

  it("save -> read vozvrashchaet komnaty i summy", () => {
    saveCalcDraft({
      scenario: "modern",
      scope: "object",
      rooms: [room],
      cart: null,
      totalArea: 48,
      totalRub: 72000,
    });
    const draft = readCalcDraft();
    expect(draft).not.toBeNull();
    expect(draft?.rooms).toHaveLength(1);
    expect(draft?.scenario).toBe("modern");
    expect(draft?.scope).toBe("object");
    expect(draft?.totalRub).toBe(72000);
  });

  it("podpis: 48 m2, 72 000 rub", () => {
    saveCalcDraft({
      scenario: "standard",
      scope: "room",
      rooms: [room],
      cart: null,
      totalArea: 48,
      totalRub: 72000,
    });
    const draft = readCalcDraft();
    expect(draft && describeCalcDraft(draft).replace(/\u00a0/g, " ")).toBe("48 м², 72 000 ₽");
  });

  it("pustye komnaty ne sohranyayutsya", () => {
    saveCalcDraft({ scenario: "standard", scope: "room", rooms: [], cart: null, totalArea: 0, totalRub: 0 });
    expect(readCalcDraft()).toBeNull();
  });

  it("prosrochenniy chernovik ignoriruetsya", () => {
    saveCalcDraft({
      scenario: "standard",
      scope: "room",
      rooms: [room],
      cart: null,
      totalArea: 24,
      totalRub: 24000,
    });
    expect(readCalcDraft(Date.now() + CALC_DRAFT_TTL_MS + 1000)).toBeNull();
  });

  it("clearCalcDraft udalyaet zapis", () => {
    saveCalcDraft({
      scenario: "standard",
      scope: "room",
      rooms: [room],
      cart: null,
      totalArea: 24,
      totalRub: 24000,
    });
    clearCalcDraft();
    expect(readCalcDraft()).toBeNull();
  });

  it("bitiy JSON ne lomaet chtenie", () => {
    window.sessionStorage.setItem(CALC_DRAFT_STORAGE_KEY, "{not json");
    expect(readCalcDraft()).toBeNull();
  });
});
