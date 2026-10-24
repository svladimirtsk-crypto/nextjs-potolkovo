import { describe, expect, it } from "vitest";
import {
  buildLedIntakeReview,
  ceilingAfterLedReplacement,
  evaluateLedPsuReplacement,
  type LedCommercialItem,
  type LedCommercialLighting,
  type LedCommercialRoom,
} from "@/lib/lighting/led-commercial";

const cornice: LedCommercialRoom = {
  id: "r1", label: "Гостиная", corniceType: "built-in", corniceLightingEnabled: true,
  corniceLightingLength: 6, corniceLightingPowerSupplies: 1,
};
const psu: LedCommercialItem = {
  sku: "psu-24", name: "Блок питания для светодиодной ленты 24V 72W",
  qty: 1, priceRub: 860, kind: "LED_STRIP", unit: "pcs",
};
const lighting: LedCommercialLighting = {
  items: [psu], catalogVersion: "cat-old", discountMode: "with-ceiling",
  ledPsuAssignments: [{ taskId: "r1:cornice", sku: "psu-24", qty: 1 }],
};

describe("LED-21 · equipment extra, included cornice PSU replaced only with binding", () => {
  it("replaces the existing 1 500 ₽ from raw ceiling; minimum order recalculated", () => {
    const result = evaluateLedPsuReplacement({ rooms: [cornice], lighting });
    expect(result).toEqual({ includedRub: 1500, assignments: lighting.ledPsuAssignments, issues: [] });
    expect(ceilingAfterLedReplacement(25_000, result.includedRub)).toMatchObject({ raw: 23_500, applied: 23_500 });
    expect(ceilingAfterLedReplacement(19_000, result.includedRub)).toMatchObject({
      raw: 17_500, applied: 18_000, minimumApplied: true,
    });
    // Replacing equipment is not a discount on installation or a negative invoice.
    expect(ceilingAfterLedReplacement(800, 1500).applied).toBe(0);
  });

  it("does not deduct anything without explicit valid matching SKU + room + paid quantity", () => {
    expect(evaluateLedPsuReplacement({ rooms: [cornice], lighting: { ...lighting, ledPsuAssignments: [] } }).includedRub).toBe(0);
    for (const invalid of [
      { taskId: "r2:cornice", sku: psu.sku, qty: 1 },
      { taskId: "r1:floating", sku: psu.sku, qty: 1 },
      { taskId: "r1:cornice", sku: "other", qty: 1 },
      { taskId: "r1:cornice", sku: psu.sku, qty: 2 },
      { taskId: "r1:cornice", sku: psu.sku, qty: 0.5 },
    ]) {
      const result = evaluateLedPsuReplacement({ rooms: [cornice], lighting: { ...lighting, ledPsuAssignments: [invalid] } });
      expect(result.includedRub, JSON.stringify(invalid)).toBe(0);
      expect(result.issues.length).toBeGreaterThan(0);
    }
    expect(evaluateLedPsuReplacement({ rooms: [cornice], lighting: {
      ...lighting, items: [{ ...psu, kind: "PSU" }],
    } }).includedRub).toBe(0);
    for (const unavailable of [{ moscowStock: 0 }, { availabilityState: "supplier_unavailable" as const }]) {
      const result = evaluateLedPsuReplacement({ rooms: [cornice], lighting: {
        ...lighting, items: [{ ...psu, ...unavailable }],
      } });
      expect(result.includedRub).toBe(0);
      expect(result.issues.join(" ")).toContain("замена ставки");
    } // A track-system PSU is not an LED PSU.
    expect(evaluateLedPsuReplacement({ rooms: [cornice], lighting: {
      ...lighting, items: [{ ...psu, name: "Контроллер светодиодной ленты 24V" }],
    } }).includedRub).toBe(0);
    expect(evaluateLedPsuReplacement({ rooms: [{ ...cornice, corniceLightingPowerSupplies: 0 }], lighting }).includedRub).toBe(0);
    expect(evaluateLedPsuReplacement({ rooms: [cornice], lighting: { ...lighting, discountMode: "lighting-only" } }).includedRub).toBe(0);
  });

  it("a duplicate/overallocated task makes ALL replacements fail closed", () => {
    const secondRoom = { ...cornice, id: "r2", label: "Кухня" };
    const result = evaluateLedPsuReplacement({ rooms: [cornice, secondRoom], lighting: {
      ...lighting, ledPsuAssignments: [
        ...lighting.ledPsuAssignments!, { taskId: "r2:cornice", sku: psu.sku, qty: 1 },
      ],
    } });
    expect(result.includedRub).toBe(0);
    expect(result.assignments).toEqual([]);
    expect(result.issues.join(" ")).toContain("чаще, чем выбран");
    expect(evaluateLedPsuReplacement({ rooms: [cornice, cornice], lighting }).includedRub).toBe(0);
  });
});

describe("LED-22/23 · intake context and provisional quote revision", () => {
  it("keeps room geometry, chosen components and every question for specialist, not a checked electrical kit", () => {
    const review = buildLedIntakeReview({ rooms: [cornice], lighting });
    expect(review).toMatchObject({
      status: "needs_review", commercialStatus: "needs_review", installation: "unknown",
      equipment: "extra_except_linked_cornice_psu", replacedCeilingRub: 1500,
      tasks: [{ id: "r1:cornice", roomId: "r1", geometryMeters: 6 }],
      bom: [{ sku: "psu-24", qty: 1, role: "psu", taskId: "r1:cornice" }],
    });
    expect(review?.quoteVersion).toMatch(/^ledq1-[a-f0-9]{16}$/);
    expect(review?.questions.join(" ")).toContain("подтвердить ряды ленты");
    expect(review?.questions.join(" ")).toContain("наличие и резерв только в Москве");
    expect(buildLedIntakeReview({ rooms: [], lighting: null })).toBeNull();
  });

  it("a changed length, SKU, quantity, price, binding or catalog version invalidates the old quote fingerprint", () => {
    const initial = buildLedIntakeReview({ rooms: [cornice], lighting })!.quoteVersion;
    const other = (rooms: LedCommercialRoom[], cart: LedCommercialLighting, version?: string) =>
      buildLedIntakeReview({ rooms, lighting: cart, catalogVersion: version })!.quoteVersion;
    expect(other([cornice], lighting)).toBe(initial);
    expect(other([{ ...cornice, corniceLightingLength: 8 }], lighting)).not.toBe(initial);
    expect(other([cornice], { ...lighting, items: [{ ...psu, priceRub: 980 }] })).not.toBe(initial);
    expect(other([cornice], { ...lighting, items: [{ ...psu, qty: 2 }] })).not.toBe(initial);
    expect(other([cornice], { ...lighting, items: [{ ...psu, sku: "new-psu" }] })).not.toBe(initial);
    expect(other([cornice], { ...lighting, items: [psu, { sku: "ctrl", name: "Контроллер для светодиодной ленты WiFi 24V", qty: 1,
      priceRub: 1200, kind: "CONTROL", system: "LED_STRIP", unit: "pcs" }] })).not.toBe(initial);
    expect(other([cornice], { ...lighting, ledPsuAssignments: [] })).not.toBe(initial);
    expect(other([cornice], lighting, "cat-new")).not.toBe(initial);
    const planning = { taskId: "r1:cornice", meters: 6, rows: 1, zones: 1,
      stripSku: "strip-1", source: "task" as const, confirmed: false as const };
    const planned = other([cornice], { ...lighting, ledPlanning: [planning] });
    expect(planned).not.toBe(initial);
    expect(other([cornice], { ...lighting, ledPlanning: [{ ...planning, zones: 2 }] })).not.toBe(planned);
    expect(other([cornice], { ...lighting, ledPlanning: [{ ...planning, rows: 2 }] })).not.toBe(planned);
    expect(other([cornice], { ...lighting, ledPlanning: [{ ...planning, stripSku: "strip-2" }] })).not.toBe(planned);
    expect(other([cornice], { ...lighting, ledPlanning: [{ ...planning, meters: 8 }] })).not.toBe(planned);
  });

  it("missing BOM remains a reviewable lead rather than a fabricated product", () => {
    const review = buildLedIntakeReview({ rooms: [cornice], lighting: null });
    expect(review?.bom).toEqual([]);
    expect(review?.status).toBe("needs_review");
    expect(review?.questions.length).toBeGreaterThan(0);
    expect(review?.replacedCeilingRub).toBe(0);
  });
});
