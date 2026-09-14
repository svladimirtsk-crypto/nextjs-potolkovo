/**
 * PT-010 · Серверный пересчёт цены заявки (ТЗ, стр. 161): паритет с клиентом
 * и подделанные числа.
 *
 * Приёмка задачи: заниженные `grandTotal`, `priceRub` и
 * `discountPercentApplied` не должны попадать в БД как авторитетные.
 * Отклонения составов (неизвестный SKU, дробные штуки) — в
 * `tests/lead-server-recalc-rejections.test.ts`.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { pricing } from "@/content/pricing";
import type { V2RoomConfig } from "@/lib/calculator/room-snapshot";
import { applyLightingOnlyDiscount, applyLightingWithCeilingDiscount } from "@/lib/lighting-formulas";
import { LeadPayloadSchema, type LeadPayload } from "@/lib/lead/schema";
import {
  PRICE_MISMATCH_THRESHOLD_PCT,
  clientGrandTotalOf,
  recalculateLeadPrice,
  recalculateLeadPriceWithCatalog,
} from "@/lib/lead/server-recalc";

import {
  BASE_ROOM,
  EMPTY_ROOM,
  MOUNT_ID,
  PROFILE_ID,
  buildClientPayload,
  catalogPromise,
  pick,
} from "./helpers/lead-payload-factory";

describe("PT-010 · паритет серверного пересчёта с клиентом", () => {
  it("честная заявка: сервер получает ту же сумму, что видел клиент", async () => {
    const products = await catalogPromise;
    const payload = buildClientPayload({
      rooms: [BASE_ROOM],
      cart: [
        { product: pick(products, PROFILE_ID), qty: 6 },
        { product: pick(products, MOUNT_ID), qty: 8, auto: true },
      ],
      discountMode: "with-ceiling",
    });

    const result = recalculateLeadPriceWithCatalog(payload, products);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const clientGrand = payload.snapshot?.totals.grand ?? 0;
    expect(result.grandTotal).toBe(clientGrand);
    expect(result.priceCheck.status).toBe("verified");
    expect(result.priceCheck.deltaPct).toBe(0);
    expect(result.priceCheck.serverGrand).toBe(clientGrand);
    // Никаких допущений: снапшот содержит нормализованные параметры.
    expect(result.priceCheck.issues).toEqual([]);
  });

  it("заявка без света и заявка «только свет» тоже совпадают", async () => {
    const products = await catalogPromise;

    const ceilingOnly = buildClientPayload({
      rooms: [BASE_ROOM],
      cart: [],
      discountMode: "none",
      phone: "+79160001123",
    });
    const ceilingResult = recalculateLeadPriceWithCatalog(ceilingOnly, products);
    expect(ceilingResult.ok).toBe(true);
    if (ceilingResult.ok) {
      expect(ceilingResult.grandTotal).toBe(ceilingOnly.snapshot?.totals.grand);
      expect(ceilingResult.priceCheck.status).toBe("verified");
    }

    const lightingOnly = buildClientPayload({
      rooms: [],
      cart: [
        { product: pick(products, PROFILE_ID), qty: 3 },
        { product: pick(products, MOUNT_ID), qty: 4 },
      ],
      discountMode: "lighting-only",
      phone: "+79160001124",
    });
    const lightingResult = recalculateLeadPriceWithCatalog(lightingOnly, products);
    expect(lightingResult.ok).toBe(true);
    if (lightingResult.ok) {
      expect(lightingResult.grandTotal).toBe(lightingOnly.snapshot?.totals.grand);
      expect(lightingResult.priceCheck.status).toBe("verified");
    }
  });

  it("пересчёт через каталог (recalculateLeadPrice) даёт тот же результат", async () => {
    const products = await catalogPromise;
    const payload = buildClientPayload({
      rooms: [BASE_ROOM],
      cart: [{ product: pick(products, MOUNT_ID), qty: 10 }],
      discountMode: "with-ceiling",
      phone: "+79160001125",
    });

    const result = await recalculateLeadPrice(payload);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.grandTotal).toBe(payload.snapshot?.totals.grand);
    }
  });
});

describe("PT-010 · заявка из настоящего браузера", () => {
  it("пересчитывается в ту же сумму, что видел человек", async () => {
    const products = await catalogPromise;
    const raw = JSON.parse(
      readFileSync(path.join(__dirname, "fixtures", "lead-payload-browser-case.json"), "utf-8")
    );

    // Фикстура перехвачена до валидации: проверяем, что живой payload проходит
    // новую схему (границы чисел, целые количества штучного товара).
    const parsed = LeadPayloadSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    const result = recalculateLeadPriceWithCatalog(parsed.data, products);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // 18 м² × 800 ₽ + 19 м.п. × 950 ₽ + 10 м.п. трека × 2 500 ₽ = 57 450 ₽.
    expect(parsed.data.snapshot?.totals.grand).toBe(57_450);
    expect(result.grandTotal).toBe(57_450);
    expect(result.priceCheck.status).toBe("verified");
    expect(result.priceCheck.issues).toEqual([]);
    expect(result.snapshot?.rooms[0].totalRub).toBe(57_450);
  });
});

describe("PT-010 · подделанные числа не становятся авторитетными", () => {
  it("заниженный totals.grand заменяется серверной суммой", async () => {
    const products = await catalogPromise;
    const honest = buildClientPayload({
      rooms: [BASE_ROOM],
      cart: [{ product: pick(products, PROFILE_ID), qty: 6 }],
      discountMode: "with-ceiling",
    });
    const honestGrand = honest.snapshot?.totals.grand ?? 0;

    const tampered: LeadPayload = {
      ...honest,
      snapshot: {
        ...honest.snapshot!,
        totals: { ...honest.snapshot!.totals, grand: 1 },
      },
    };

    const result = recalculateLeadPriceWithCatalog(tampered, products);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(clientGrandTotalOf(tampered)).toBe(1);
    expect(result.grandTotal).toBe(honestGrand);
    expect(result.grandTotal).toBeGreaterThan(1);
    expect(result.priceCheck.status).toBe("mismatch");
    expect(result.priceCheck.clientGrand).toBe(1);
    expect(result.priceCheck.serverGrand).toBe(honestGrand);
    expect(result.priceCheck.deltaPct).toBeGreaterThan(PRICE_MISMATCH_THRESHOLD_PCT);
    expect(result.priceCheck.issues.some((issue) => issue.code === "price-mismatch")).toBe(true);

    // В сохранённом снапшоте — серверные цифры, а не клиентская единица.
    expect(result.snapshot?.totals.grand).toBe(honestGrand);
    expect(result.payload.snapshot?.totals.grand).toBe(honestGrand);
  });

  it("заниженная цена позиции заменяется каталожной", async () => {
    const products = await catalogPromise;
    const profile = pick(products, PROFILE_ID);
    const payload = buildClientPayload({
      rooms: [BASE_ROOM],
      cart: [{ product: profile, qty: 6 }],
      discountMode: "with-ceiling",
    });

    const tampered: LeadPayload = {
      ...payload,
      snapshot: {
        ...payload.snapshot!,
        lighting: {
          ...payload.snapshot!.lighting!,
          items: payload.snapshot!.lighting!.items.map((item) => ({ ...item, priceRub: 1 })),
          regularTotalRub: 6,
          effectiveTotalRub: 5,
        },
        totals: { ...payload.snapshot!.totals, grand: 100_000 },
      },
    };

    const result = recalculateLeadPriceWithCatalog(tampered, products);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const storedItem = result.snapshot?.lighting?.items[0];
    expect(storedItem?.priceRub).toBe(profile.priceRub);
    expect(result.snapshot?.lighting?.regularTotalRub).toBe(profile.priceRub * 6);
    expect(result.priceCheck.issues.some((issue) => issue.code === "client-price-deviation")).toBe(
      true
    );

    const honest = recalculateLeadPriceWithCatalog(payload, products);
    expect(honest.ok && result.grandTotal === honest.grandTotal).toBe(true);
  });

  it("накрученный процент скидки пересчитывается по прайсу", async () => {
    const products = await catalogPromise;
    const payload = buildClientPayload({
      rooms: [BASE_ROOM],
      cart: [{ product: pick(products, MOUNT_ID), qty: 20 }],
      discountMode: "with-ceiling",
    });

    const tampered: LeadPayload = {
      ...payload,
      snapshot: {
        ...payload.snapshot!,
        lighting: {
          ...payload.snapshot!.lighting!,
          discountPercentApplied: 99,
          discountAmountRub: payload.snapshot!.lighting!.regularTotalRub,
          effectiveTotalRub: 1,
        },
      },
    };

    const result = recalculateLeadPriceWithCatalog(tampered, products);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.snapshot?.lighting?.discountPercentApplied).toBe(
      pricing.lightingDiscount.withCeilingPct
    );
    expect(result.snapshot?.lighting?.effectiveTotalRub).toBe(
      applyLightingWithCeilingDiscount(result.snapshot?.lighting?.regularTotalRub ?? 0)
    );
    expect(result.snapshot?.totals.discountPct).toBe(pricing.lightingDiscount.withCeilingPct);
  });

  it("скидка «с потолком» без потолка даунгрейдится до «только свет»", async () => {
    const products = await catalogPromise;
    const payload = buildClientPayload({
      rooms: [],
      cart: [{ product: pick(products, MOUNT_ID), qty: 10 }],
      discountMode: "with-ceiling",
      phone: "+79160001126",
    });

    const result = recalculateLeadPriceWithCatalog(payload, products);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const regular = result.snapshot?.lighting?.regularTotalRub ?? 0;
    expect(result.snapshot?.lighting?.discountMode).toBe("lighting-only");
    expect(result.snapshot?.lighting?.discountPercentApplied).toBe(
      pricing.lightingDiscount.lightingOnlyPct
    );
    expect(result.grandTotal).toBe(applyLightingOnlyDiscount(regular));
    expect(
      result.priceCheck.issues.some((issue) => issue.code === "discount-mode-downgraded")
    ).toBe(true);
  });

  it("режим «только свет» не добавляет к сумме потолок и минимальный заказ", async () => {
    const products = await catalogPromise;
    const payload = buildClientPayload({
      rooms: [{ ...BASE_ROOM, area: 4 }],
      cart: [{ product: pick(products, MOUNT_ID), qty: 2 }],
      discountMode: "lighting-only",
      phone: "+79160001127",
    });

    const result = recalculateLeadPriceWithCatalog(payload, products);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // N-050: потолок не заказан — его нет в сумме, иначе минимальный заказ
    // (18 000 ₽) превратил бы пару креплений в счёт на двадцать тысяч.
    expect(result.grandTotal).toBe(result.totals?.lightingEffective);
    expect(result.grandTotal).toBeLessThan(pricing.minimumOrderRub);
    expect(result.priceCheck.status).toBe("verified");
  });

  it("минимальный заказ поднимает маленькую комнату до порога прайса", async () => {
    const products = await catalogPromise;
    // Комната 4 м² без допов: 4 × 1 000 ₽ = 4 000 ₽ — меньше минимального заказа.
    const tinyRoom: V2RoomConfig = {
      ...EMPTY_ROOM,
      id: "r1",
      label: "Кладовая",
      area: 4,
      ceilingType: "standard",
    };

    const payload = buildClientPayload({
      rooms: [tinyRoom],
      cart: [],
      discountMode: "none",
      phone: "+79160001128",
    });

    const result = recalculateLeadPriceWithCatalog(payload, products);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.totals?.ceilingRaw).toBe(4 * pricing.ceiling.standard);
    expect(result.totals?.minimumApplied).toBe(true);
    expect(result.grandTotal).toBe(pricing.minimumOrderRub);
    // Клиент считает так же — расхождения нет.
    expect(result.priceCheck.status).toBe("verified");
  });
});
