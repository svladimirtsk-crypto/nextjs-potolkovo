import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  CALC_DRAFT_STORAGE_KEY,
  CALC_DRAFT_TTL_MS,
  clearCalcDraft,
  describeCalcDraft,
  inspectCalcDraft,
  readCalcDraft,
  saveCalcDraft,
} from "@/lib/calculator/draft";
import type { LightingSnapshot } from "@/lib/calculator-modal-types";
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

/**
 * PT-007 · раздел 3.2 ТЗ: «неизвестная версия — безопасный отказ с явным
 * выбором „начать новый расчёт“, не молчаливая перезапись и не падение UI».
 *
 * `readCalcDraft` возвращал `null` и за чужую версию, и за битые данные, и за
 * отсутствие записи — вызывающий не мог их различить и молча перезаписывал
 * сохранённое. `inspectCalcDraft` различает.
 */
describe("PT-007 · inspectCalcDraft", () => {
  const cart: LightingSnapshot = {
    mode: "catalog",
    kitBaseName: "Для кухни",
    items: [
      { sku: "SKU-SPOT-1", name: "Светильник врезной", qty: 6, priceRub: 350 },
      { sku: "SKU-TRACK-2", name: "Трек 2 м", qty: 2, priceRub: 1890, auto: true },
    ],
    totalRub: 5880,
    discountMode: "with-ceiling",
    discountPercentApplied: 25,
    discountAmountRub: 1470,
    userCustomizedLighting: false,
  };

  it("пусто — status empty", () => {
    expect(inspectCalcDraft()).toEqual({ status: "empty" });
  });

  it("сохранённый черновик — status ok", () => {
    saveCalcDraft({
      scenario: "modern",
      scope: "room",
      rooms: [room],
      cart: null,
      totalArea: 24,
      totalRub: 24000,
    });
    const result = inspectCalcDraft();
    expect(result.status).toBe("ok");
    if (result.status === "ok") expect(result.draft.rooms).toHaveLength(1);
  });

  it("корзина света переживает save → read целиком: SKU, количества, режим скидки", () => {
    saveCalcDraft({
      scenario: "modern",
      scope: "room",
      rooms: [room],
      cart,
      totalArea: 24,
      totalRub: 29880,
    });
    const restored = readCalcDraft()?.cart;
    expect(restored).toEqual(cart);
    expect(restored?.items?.map((i) => [i.sku, i.qty])).toEqual([
      ["SKU-SPOT-1", 6],
      ["SKU-TRACK-2", 2],
    ]);
    expect(restored?.discountMode).toBe("with-ceiling");
  });

  it("чужая версия — unreadable, а не empty", () => {
    window.sessionStorage.setItem(
      CALC_DRAFT_STORAGE_KEY,
      JSON.stringify({ version: 3, savedAt: Date.now(), rooms: [room] })
    );
    expect(inspectCalcDraft()).toEqual({
      status: "unreadable",
      reason: "unknown-version",
    });
  });

  it("нечитаемый черновик не удаляется сам — стирать его может только выбор пользователя", () => {
    window.sessionStorage.setItem(
      CALC_DRAFT_STORAGE_KEY,
      JSON.stringify({ version: 99, savedAt: Date.now(), rooms: [room] })
    );
    expect(readCalcDraft()).toBeNull();
    expect(inspectCalcDraft().status).toBe("unreadable");
    // Запись на месте: `readCalcDraft` не очистил её за спиной пользователя.
    expect(window.sessionStorage.getItem(CALC_DRAFT_STORAGE_KEY)).not.toBeNull();
    clearCalcDraft();
    expect(inspectCalcDraft()).toEqual({ status: "empty" });
  });

  it("битый JSON — unreadable/corrupt, без исключения", () => {
    window.sessionStorage.setItem(CALC_DRAFT_STORAGE_KEY, "{not json");
    expect(inspectCalcDraft()).toEqual({ status: "unreadable", reason: "corrupt" });
    expect(readCalcDraft()).toBeNull();
  });

  it("версия та же, но комнаты пустые — corrupt", () => {
    window.sessionStorage.setItem(
      CALC_DRAFT_STORAGE_KEY,
      JSON.stringify({ version: 2, savedAt: Date.now(), rooms: [] })
    );
    expect(inspectCalcDraft()).toEqual({ status: "unreadable", reason: "corrupt" });
  });

  it("просроченный — empty и удалён: предлагать продолжить нельзя", () => {
    saveCalcDraft({
      scenario: "standard",
      scope: "room",
      rooms: [room],
      cart: null,
      totalArea: 24,
      totalRub: 24000,
    });
    const later = Date.now() + CALC_DRAFT_TTL_MS + 1000;
    expect(inspectCalcDraft(later)).toEqual({ status: "empty" });
    expect(window.sessionStorage.getItem(CALC_DRAFT_STORAGE_KEY)).toBeNull();
  });
});
