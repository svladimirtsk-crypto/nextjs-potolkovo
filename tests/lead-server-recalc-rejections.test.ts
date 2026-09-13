/**
 * PT-010 · Что сервер отклоняет и что принимает с пометкой.
 *
 * Граница простая: отклоняется только то, что нельзя пересчитать честно
 * (неизвестный SKU, дробное количество штучного товара). Всё остальное —
 * недоступный товар, снятая с продажи позиция, снапшот старого клиента,
 * заявка без снапшота — принимается, но оставляет след в `priceCheck.issues`:
 * терять контакт человека из-за арифметики нельзя.
 */
import { describe, expect, it } from "vitest";

import { pricing } from "@/content/pricing";
import { roomConfigFromBreakdown, buildRoomBreakdown } from "@/lib/calculator/room-snapshot";
import {
  applyLightingOnlyDiscount,
  calcLightingDiscountAmount,
} from "@/lib/lighting-formulas";
import { LeadPayloadSchema, type LeadPayload } from "@/lib/lead/schema";
import { recalculateLeadPriceWithCatalog } from "@/lib/lead/server-recalc";

import {
  BASE_ROOM,
  METER_PROFILE_ID,
  MOUNT_ID,
  PROFILE_ID,
  buildClientPayload,
  catalogPromise,
  fakeProduct,
  pick,
} from "./helpers/lead-payload-factory";

describe("PT-010 · отклонение составов, которые нельзя пересчитать", () => {
  it("неизвестный SKU отклоняется", async () => {
    const products = await catalogPromise;
    const payload = buildClientPayload({
      rooms: [BASE_ROOM],
      cart: [{ product: pick(products, MOUNT_ID), qty: 4 }],
      discountMode: "with-ceiling",
    });

    const tampered: LeadPayload = {
      ...payload,
      snapshot: {
        ...payload.snapshot!,
        lighting: {
          ...payload.snapshot!.lighting!,
          items: [
            {
              sku: "несуществующий-товар",
              name: "Что угодно",
              qty: 4,
              priceRub: 10,
              unit: "pcs",
            },
          ],
        },
      },
    };

    const result = recalculateLeadPriceWithCatalog(tampered, products);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.rejection.code).toBe("unknown_sku");
    expect(result.rejection.sku).toBe("несуществующий-товар");
  });

  it("позиция резолвится по артикулу поставщика, если sku неизвестен", async () => {
    const products = await catalogPromise;
    const mount = pick(products, MOUNT_ID);
    const payload = buildClientPayload({
      rooms: [],
      cart: [{ product: mount, qty: 4 }],
      discountMode: "lighting-only",
      phone: "+79160001129",
    });

    const byVendorCode: LeadPayload = {
      ...payload,
      snapshot: {
        ...payload.snapshot!,
        lighting: {
          ...payload.snapshot!.lighting!,
          items: payload.snapshot!.lighting!.items.map((item) => ({
            ...item,
            sku: mount.vendorCode,
            vendorCode: undefined,
          })),
        },
      },
    };

    const result = recalculateLeadPriceWithCatalog(byVendorCode, products);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot?.lighting?.items[0].sku).toBe(mount.productId);
    expect(result.snapshot?.lighting?.regularTotalRub).toBe(mount.priceRub * 4);
  });

  it("дробное количество штучного товара отклоняется", async () => {
    const products = await catalogPromise;
    const payload = buildClientPayload({
      rooms: [],
      cart: [{ product: pick(products, MOUNT_ID), qty: 3 }],
      discountMode: "lighting-only",
      phone: "+79160001130",
    });

    const fractional: LeadPayload = {
      ...payload,
      snapshot: {
        ...payload.snapshot!,
        lighting: {
          ...payload.snapshot!.lighting!,
          items: payload.snapshot!.lighting!.items.map((item) => ({ ...item, qty: 2.5 })),
        },
      },
    };

    const result = recalculateLeadPriceWithCatalog(fractional, products);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.rejection.code).toBe("fractional_qty");
  });

  it("схема payload самостоятельно не пропускает дробные штуки", () => {
    const parsed = LeadPayloadSchema.safeParse({
      name: "Иван",
      phone: "+79160001131",
      consent: true,
      source: "home:hero",
      placement: "home",
      leadKind: "lighting-only",
      snapshot: {
        version: 2,
        scenario: "modern",
        scope: "room",
        rooms: [],
        lighting: {
          mode: "catalog",
          items: [{ sku: "x", name: "Спот", qty: 2.5, priceRub: 380, unit: "pcs" }],
          regularTotalRub: 950,
          effectiveTotalRub: 855,
          discountMode: "lighting-only",
          discountPercentApplied: 10,
          discountAmountRub: 95,
        },
        totals: {
          ceilingRaw: 0,
          minimumApplied: false,
          installExtra: 0,
          lightingRegular: 950,
          lightingEffective: 855,
          discountPct: 10,
          grand: 855,
        },
        source: "home:hero",
        entry: "lighting-first",
      },
    });

    expect(parsed.success).toBe(false);
  });

  it("дробный метраж принимается: профиль продаётся метрами", async () => {
    const products = await catalogPromise;
    const meterProfile = pick(products, METER_PROFILE_ID);
    expect(meterProfile.unit).toBe("m");

    const payload = buildClientPayload({
      rooms: [],
      cart: [{ product: meterProfile, qty: 2.5 }],
      discountMode: "lighting-only",
      phone: "+79160001132",
    });

    const result = recalculateLeadPriceWithCatalog(payload, products);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot?.lighting?.regularTotalRub).toBe(meterProfile.priceRub * 2.5);
  });

  it("недоступный товар принимается с пометкой, а не роняет заявку", async () => {
    const unavailable = fakeProduct({ available: false, priceRub: 2500 });
    const payload = LeadPayloadSchema.parse({
      name: "Иван",
      phone: "+79160001133",
      consent: true,
      source: "home:hero",
      placement: "home",
      leadKind: "lighting-only",
      snapshot: {
        version: 2,
        scenario: "modern",
        scope: "room",
        rooms: [],
        lighting: {
          mode: "catalog",
          items: [
            {
              sku: unavailable.productId,
              name: unavailable.name,
              qty: 2,
              priceRub: 2500,
              unit: "pcs",
            },
          ],
          regularTotalRub: 5000,
          effectiveTotalRub: applyLightingOnlyDiscount(5000),
          discountMode: "lighting-only",
          discountPercentApplied: pricing.lightingDiscount.lightingOnlyPct,
          discountAmountRub: calcLightingDiscountAmount(5000, applyLightingOnlyDiscount(5000)),
        },
        totals: {
          ceilingRaw: 0,
          minimumApplied: false,
          installExtra: 0,
          lightingRegular: 5000,
          lightingEffective: applyLightingOnlyDiscount(5000),
          discountPct: pricing.lightingDiscount.lightingOnlyPct,
          grand: applyLightingOnlyDiscount(5000),
        },
        source: "home:hero",
        entry: "lighting-first",
      },
    });

    const result = recalculateLeadPriceWithCatalog(payload, [unavailable]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.grandTotal).toBe(applyLightingOnlyDiscount(5000));
    expect(result.priceCheck.issues.some((issue) => issue.code === "unavailable-product")).toBe(
      true
    );
  });

  it("заявка без снапшота остаётся непроверенной с суммой клиента", () => {
    const payload = LeadPayloadSchema.parse({
      phone: "+79160001134",
      consent: true,
      source: "calculator",
      placement: "rescue",
      leadKind: "rescue",
      grandTotal: 62_000,
    });

    const result = recalculateLeadPriceWithCatalog(payload, []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.priceCheck.status).toBe("unverified");
    expect(result.priceCheck.serverGrand).toBeNull();
    expect(result.grandTotal).toBe(62_000);
    expect(result.snapshot).toBeNull();
    expect(result.payload).toBe(payload);
  });
});

describe("PT-010 · снапшоты старого клиента", () => {
  it("комната без нормализованных полей восстанавливается по лейблам", async () => {
    const products = await catalogPromise;
    const payload = buildClientPayload({
      rooms: [{ ...BASE_ROOM, corniceLightingPowerSupplies: 1 }],
      cart: [{ product: pick(products, PROFILE_ID), qty: 6 }],
      discountMode: "with-ceiling",
    });

    const legacy = structuredClone(payload);
    const legacyRoom = legacy.snapshot!.rooms[0] as Record<string, unknown>;
    for (const key of [
      "ceilingType",
      "shadowEnabled",
      "floatingEnabled",
      "lightLinesEnabled",
      "corniceType",
      "corniceLightingEnabled",
      "corniceLightingPowerSupplies",
      "trackType",
      "chandeliersEnabled",
      "lightsEnabled",
    ]) {
      delete legacyRoom[key];
    }
    const legacyPayload = LeadPayloadSchema.parse(legacy);

    const freshResult = recalculateLeadPriceWithCatalog(payload, products);
    const legacyResult = recalculateLeadPriceWithCatalog(legacyPayload, products);

    expect(legacyResult.ok).toBe(true);
    if (!legacyResult.ok || !freshResult.ok) return;

    // Запасной путь по лейблам даёт ту же сумму: иначе все заявки со старых
    // клиентов (открытые до деплоя страницы, черновики в localStorage)
    // получили бы пометку расхождения.
    expect(legacyResult.grandTotal).toBe(freshResult.grandTotal);
    expect(
      legacyResult.priceCheck.issues.some((issue) => issue.code === "legacy-room-snapshot")
    ).toBe(true);
  });

  it("число блоков питания подсветки по лейблам не восстанавливается — это видно в логе", async () => {
    const products = await catalogPromise;
    const payload = buildClientPayload({
      rooms: [BASE_ROOM],
      cart: [],
      discountMode: "none",
      phone: "+79160001135",
    });

    const legacy = structuredClone(payload);
    delete (legacy.snapshot!.rooms[0] as Record<string, unknown>).corniceLightingPowerSupplies;
    delete (legacy.snapshot!.rooms[0] as Record<string, unknown>).ceilingType;
    delete (legacy.snapshot!.rooms[0] as Record<string, unknown>).corniceType;
    delete (legacy.snapshot!.rooms[0] as Record<string, unknown>).trackType;

    const result = recalculateLeadPriceWithCatalog(LeadPayloadSchema.parse(legacy), products);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Один блок питания вместо двух — занижение на ставку прайса. Молча такое
    // проходить не должно: допущение попадает в `priceCheck.issues`.
    expect(
      result.priceCheck.issues.some((issue) =>
        issue.message.includes("cornice-power-supplies-default-1")
      )
    ).toBe(true);
    expect(result.grandTotal).toBe(
      (payload.snapshot?.totals.grand ?? 0) - pricing.corniceLighting.psu
    );
  });

  it("buildRoomBreakdown → roomConfigFromBreakdown возвращает исходный конфиг", () => {
    const restore = roomConfigFromBreakdown(buildRoomBreakdown(BASE_ROOM));
    expect(restore.normalized).toBe(true);
    expect(restore.assumptions).toEqual([]);
    expect(restore.config).toEqual(BASE_ROOM);
  });
});
