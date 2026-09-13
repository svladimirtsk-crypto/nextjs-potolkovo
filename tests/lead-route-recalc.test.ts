/**
 * PT-010 · POST /api/lead с серверным пересчётом цены.
 *
 * Проверяется поведение роута, а не арифметика (арифметика — в
 * `tests/lead-server-recalc.test.ts`): что заниженная сумма не доезжает до
 * хранилища, что непересчитываемый состав отклоняется `422`, что письмо мастеру
 * содержит серверную сумму и служебную пометку, и что флаг аварийного отката
 * `LEAD_SERVER_RECALC_ENABLED=0` действительно возвращает прежнее поведение.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetRateLimitForTests } from "@/lib/lead/rate-limit";
import { getLeadStore, resetLeadStoreForTests } from "@/lib/lead/store";
import { resetEnvCache } from "@/lib/env";

// Моки внешних каналов — сеть в тестах не трогаем.
vi.mock("@/lib/lead/deliver-telegram", () => ({
  deliverToTelegram: vi.fn(async () => ({ ok: true }) as const),
}));
vi.mock("@/lib/lead/deliver-web3forms", () => ({
  deliverToWeb3Forms: vi.fn(async () => ({ ok: true }) as const),
}));

import { POST } from "@/app/api/lead/route";
import { pricing } from "@/content/pricing";
import { formatLeadBody, formatLeadSubject } from "@/lib/lead/format-lead";
import { getCatalogProducts } from "@/lib/lighting/catalog-products";
import { applyLightingWithCeilingDiscount } from "@/lib/lighting-formulas";
import type { StoredLeadSnapshot } from "@/lib/lead/server-recalc";

function makeRequest(body: unknown, ip = "10.0.0.2"): Request {
  return new Request("http://localhost/api/lead", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

const catalogPromise = getCatalogProducts();

/** Реальный штучный товар каталога: крепление АРТ. */
const MOUNT_ID = "eks-00010705";

/**
 * Заявка «потолок + свет» с намеренно заниженными деньгами: сумма 1 ₽, цена
 * позиции 1 ₽. Параметры при этом честные — именно их и должен использовать
 * сервер.
 */
async function tamperedBody(phone: string) {
  const products = await catalogPromise;
  const mount = products.find((product) => product.productId === MOUNT_ID);
  if (!mount) throw new Error("В каталоге нет тестового товара — фид изменился");

  return {
    name: "Иван",
    phone,
    consent: true,
    source: "home:hero",
    placement: "home",
    pagePath: "/",
    leadKind: "calculator",
    orderIntent: "lighting_with_ceiling",
    snapshot: {
      version: 2,
      scenario: "modern",
      scope: "room",
      rooms: [
        {
          id: "r1",
          label: "Кухня",
          area: 18,
          totalRub: 1,
          ceilingTypeLabel: "Теневой",
          ceilingType: "shadow",
          shadowEnabled: true,
          shadowLength: 19,
          floatingEnabled: false,
          lightLinesEnabled: false,
          corniceType: "none",
          corniceLightingEnabled: false,
          trackType: "none",
          chandeliersEnabled: false,
          lightsEnabled: false,
        },
      ],
      lighting: {
        mode: "catalog",
        items: [
          {
            sku: mount.productId,
            vendorCode: mount.vendorCode,
            name: mount.name,
            qty: 10,
            priceRub: 1,
            unit: mount.unit,
            system: mount.system,
            kind: mount.kind,
          },
        ],
        regularTotalRub: 10,
        effectiveTotalRub: 8,
        discountMode: "with-ceiling",
        discountPercentApplied: 99,
        discountAmountRub: 2,
      },
      totals: {
        ceilingRaw: 1,
        minimumApplied: false,
        installExtra: 0,
        lightingRegular: 10,
        lightingEffective: 8,
        discountPct: 99,
        grand: 1,
      },
      source: "home:hero",
      entry: "ceiling-first",
    },
    totals: {
      ceilingRaw: 1,
      minimumApplied: false,
      installExtra: 0,
      lightingRegular: 10,
      lightingEffective: 8,
      discountPct: 99,
      grand: 1,
    },
    grandTotal: 1,
  };
}

/**
 * Честная сумма того же состава — посчитана вручную по ставкам
 * `content/pricing.ts`, а не модулем под тестом:
 * потолок 18 м² «теневой» + 19 м.п. профиля, досчёт монтажа за 10 креплений
 * (в потолке точек не заложено) и свет со скидкой 25 %.
 */
async function honestGrand() {
  const products = await catalogPromise;
  const mount = products.find((product) => product.productId === MOUNT_ID)!;

  const ceilingRaw = 18 * pricing.ceiling.shadowBase + 19 * pricing.ceiling.shadowProfilePerM;
  const ceilingApplied = Math.max(ceilingRaw, pricing.minimumOrderRub);
  const extraInstall = 10 * pricing.spotInstall;
  const lighting = applyLightingWithCeilingDiscount(mount.priceRub * 10);

  return ceilingApplied + extraInstall + lighting;
}

beforeEach(() => {
  resetRateLimitForTests();
  resetLeadStoreForTests();
  resetEnvCache();
});

afterEach(() => {
  delete process.env.LEAD_SERVER_RECALC_ENABLED;
  resetEnvCache();
});

describe("PT-010 · POST /api/lead пересчитывает цену на сервере", () => {
  it("заниженная сумма не попадает в хранилище — пишется серверная", async () => {
    const response = await POST(makeRequest(await tamperedBody("+79161000001")));
    expect(response.status).toBe(201);

    const stored = await getLeadStore().getLead(1);
    expect(stored).not.toBeNull();
    expect(stored?.grandTotal).toBe(await honestGrand());
    expect(stored?.grandTotal).toBeGreaterThan(1);

    const snapshot = stored?.payload.snapshot as StoredLeadSnapshot | undefined;
    expect(snapshot?.priceCheck?.status).toBe("mismatch");
    expect(snapshot?.priceCheck?.clientGrand).toBe(1);
    expect(snapshot?.totals.grand).toBe(await honestGrand());
    // Цена позиции и процент скидки — из каталога и прайса, а не из запроса.
    const products = await catalogPromise;
    const mount = products.find((product) => product.productId === MOUNT_ID)!;
    expect(snapshot?.lighting?.items[0].priceRub).toBe(mount.priceRub);
    expect(snapshot?.lighting?.discountPercentApplied).toBe(25);
  });

  it("письмо мастеру содержит серверную сумму и служебную пометку", async () => {
    await POST(makeRequest(await tamperedBody("+79161000002")));

    const stored = await getLeadStore().getLead(1);
    const payload = stored?.payload;
    expect(payload).toBeTruthy();

    const expected = (await honestGrand()).toLocaleString("ru-RU").replace(/\u00a0/g, " ");
    const subject = formatLeadSubject(payload!).replace(/\u00a0/g, " ");
    const body = formatLeadBody(payload!, "TEST1").replace(/\u00a0/g, " ");

    expect(subject).toContain(expected);
    expect(body).toContain(`Общий ориентир: ~${expected} ₽`);
    expect(body).toContain("Сумма пересчитана сервером: клиент видел ~1 ₽");
    expect(body).toContain("СЛУЖЕБНОЕ");
  });

  it("неизвестный SKU отклоняется 422 и не создаёт заявку", async () => {
    const body = await tamperedBody("+79161000003");
    body.snapshot.lighting.items[0].sku = "sku-kotorogo-net";
    body.snapshot.lighting.items[0].vendorCode = "0У-00000000";

    const response = await POST(makeRequest(body));
    expect(response.status).toBe(422);

    const json = (await response.json()) as { ok: boolean; error: string; code: string };
    expect(json.ok).toBe(false);
    expect(json.code).toBe("unknown_sku");
    expect(await getLeadStore().getLead(1)).toBeNull();
  });

  it("дробное количество штучного товара отклоняется 422", async () => {
    const body = await tamperedBody("+79161000004");
    body.snapshot.lighting.items[0].qty = 2.5;

    const response = await POST(makeRequest(body));
    expect(response.status).toBe(422);
    expect(await getLeadStore().getLead(1)).toBeNull();
  });

  it("честная заявка проходит без пометки расхождения", async () => {
    const products = await catalogPromise;
    const mount = products.find((product) => product.productId === MOUNT_ID)!;
    const lightingRegular = mount.priceRub * 4;
    const lightingEffective = applyLightingWithCeilingDiscount(lightingRegular);
    const ceiling = 18 * pricing.ceiling.shadowBase + 19 * pricing.ceiling.shadowProfilePerM;
    // 4 крепления в корзине — это 4 точки монтажа сверх заложенных в потолке.
    const extraInstall = 4 * pricing.spotInstall;
    const grand = Math.max(ceiling, pricing.minimumOrderRub) + extraInstall + lightingEffective;

    const response = await POST(
      makeRequest({
        name: "Иван",
        phone: "+79161000005",
        consent: true,
        source: "home:hero",
        placement: "home",
        pagePath: "/",
        leadKind: "calculator",
        orderIntent: "lighting_with_ceiling",
        snapshot: {
          version: 2,
          scenario: "modern",
          scope: "room",
          rooms: [
            {
              id: "r1",
              label: "Кухня",
              area: 18,
              totalRub: ceiling,
              ceilingTypeLabel: "Теневой",
              ceilingType: "shadow",
              shadowEnabled: true,
              shadowLength: 19,
              floatingEnabled: false,
              lightLinesEnabled: false,
              corniceType: "none",
              corniceLightingEnabled: false,
              trackType: "none",
              chandeliersEnabled: false,
              lightsEnabled: false,
            },
          ],
          lighting: {
            mode: "catalog",
            items: [
              {
                sku: mount.productId,
                vendorCode: mount.vendorCode,
                name: mount.name,
                qty: 4,
                priceRub: mount.priceRub,
                unit: mount.unit,
                system: mount.system,
                kind: mount.kind,
              },
            ],
            regularTotalRub: lightingRegular,
            effectiveTotalRub: lightingEffective,
            discountMode: "with-ceiling",
            discountPercentApplied: 25,
            discountAmountRub: lightingRegular - lightingEffective,
          },
          totals: {
            ceilingRaw: ceiling,
            minimumApplied: false,
            installExtra: extraInstall,
            lightingRegular,
            lightingEffective,
            discountPct: 25,
            grand,
          },
          source: "home:hero",
          entry: "ceiling-first",
        },
      })
    );

    expect(response.status).toBe(201);
    const stored = await getLeadStore().getLead(1);
    expect(stored?.grandTotal).toBe(grand);
    const snapshot = stored?.payload.snapshot as StoredLeadSnapshot | undefined;
    expect(snapshot?.priceCheck?.status).toBe("verified");
    expect(snapshot?.priceCheck?.issues).toEqual([]);
  });

  it("rescue-заявка без снапшота принимается с суммой клиента", async () => {
    const response = await POST(
      makeRequest({
        phone: "+79161000006",
        consent: true,
        source: "calculator",
        placement: "rescue",
        leadKind: "rescue",
        grandTotal: 72_000,
      })
    );

    expect(response.status).toBe(201);
    const stored = await getLeadStore().getLead(1);
    expect(stored?.status).toBe("rescue");
    expect(stored?.grandTotal).toBe(72_000);
  });
});

describe("PT-010 · флаг аварийного отката LEAD_SERVER_RECALC_ENABLED=0", () => {
  beforeEach(() => {
    process.env.LEAD_SERVER_RECALC_ENABLED = "0";
    resetEnvCache();
  });

  it("сумма клиента проходит как есть, неизвестный SKU больше не отклоняется", async () => {
    const response = await POST(makeRequest(await tamperedBody("+79161000007")));
    expect(response.status).toBe(201);

    const stored = await getLeadStore().getLead(1);
    // Это ровно тот дефект, который закрыт задачей: цифра из запроса в БД.
    expect(stored?.grandTotal).toBe(1);
    const snapshot = stored?.payload.snapshot as StoredLeadSnapshot | undefined;
    expect(snapshot?.priceCheck).toBeUndefined();

    const unknown = await tamperedBody("+79161000008");
    unknown.snapshot.lighting.items[0].sku = "sku-kotorogo-net";
    expect((await POST(makeRequest(unknown))).status).toBe(201);
  });
});
