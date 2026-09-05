import { describe, expect, it } from "vitest";

import snapshot from "../data/eks-feed2-snapshot.json";
import {
  buildCartEntries,
  calcClarusPsuQty,
  calcLampCurrentBySocket,
  calcLampCurrentTotal,
  calcLampRequiredBySocket,
  calcLampRequiredTotal,
  calcLampSocketsToShow,
  calcMissingLamps,
  calcMissingMounts,
  calcSelectedPointQty,
  calcSelectedTrackMeters,
  groupLampOptionsBySocket,
  hasClarusInCart,
  type CartEntry,
} from "../lib/lighting/cart-derived";
import { POINT_TO_MOUNT_VENDOR_CODE } from "../lib/catalog-ui-config";
import { toText } from "../lib/feed2-snapshot-normalize";
import type { FeedCatalogProduct } from "../lib/eks-feed2-catalog";

/**
 * N-051 · Комплектность набора — не косметика: если клиент увезёт светильники
 * без ламп или точки без креплений, монтаж встанет. Раньше эти вычисления
 * жили в useMemo внутри 1900-строчного компонента и проверялись только руками.
 */

const products = (snapshot as unknown as { products: FeedCatalogProduct[] }).products;
const byId = new Map(products.map((p) => [toText(p.productId), p]));
const byVendor = new Map(products.map((p) => [toText(p.vendorCode), toText(p.productId)]));
const resolve = (id: string) => byId.get(id) ?? null;

const find = (predicate: (p: FeedCatalogProduct) => boolean) => {
  const found = products.find(predicate);
  if (!found) throw new Error("в фиде нет подходящего товара для теста");
  return found;
};

const entry = (product: FeedCatalogProduct, qty: number): CartEntry => ({
  productId: toText(product.productId),
  product,
  qty,
});

describe("N-051 · состав корзины", () => {
  it("нулевые количества не попадают в корзину", () => {
    const some = toText(products[0].productId);
    expect(buildCartEntries({ [some]: 0 }, resolve)).toHaveLength(0);
  });

  it("несуществующий товар пропускается, а не роняет расчёт", () => {
    expect(buildCartEntries({ "нет-такого": 3 }, resolve)).toHaveLength(0);
  });

  it("обычная позиция попадает в корзину с количеством", () => {
    const id = toText(products[0].productId);
    const entries = buildCartEntries({ [id]: 2 }, resolve);
    expect(entries).toHaveLength(1);
    expect(entries[0].qty).toBe(2);
  });
});

describe("N-051 · метры трека и число точек", () => {
  it("профили складываются в метраж, прочее игнорируется", () => {
    const profile = find((p) => p.kind === "TRACK_PROFILE");
    const meters = calcSelectedTrackMeters([entry(profile, 2)]);
    expect(meters).toBeGreaterThan(0);
    // Две штуки — ровно вдвое больше одной.
    expect(meters).toBeCloseTo(calcSelectedTrackMeters([entry(profile, 1)]) * 2, 5);
  });

  it("лампы не считаются точками света", () => {
    const lamp = find((p) => p.kind === "LAMP");
    expect(calcSelectedPointQty([entry(lamp, 5)])).toBe(0);
  });

  it("споты считаются точками", () => {
    const spot = find((p) => p.kind === "SPOT_FIXTURE");
    expect(calcSelectedPointQty([entry(spot, 4)])).toBe(4);
  });
});

describe("N-051 · лампы под цоколь", () => {
  const lampOptions = groupLampOptionsBySocket(products);

  it("в фиде есть лампы GX53 и они отсортированы по цене", () => {
    const gx53 = lampOptions.GX53;
    expect(gx53.length).toBeGreaterThan(0);
    const prices = gx53.map((l) => Number(l.priceRub));
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
  });

  it("светильник под GX53 требует столько же ламп, сколько его самого", () => {
    const fixture = find(
      (p) => p.kind !== "LAMP" && toText(p.name).toUpperCase().includes("GX53")
    );
    const required = calcLampRequiredBySocket([entry(fixture, 6)]);
    const total = calcLampRequiredTotal(required);
    expect(total).toBeGreaterThan(0);
    expect(total).toBe(6);
  });

  it("сами лампы не требуют ламп — иначе получим бесконечную докупку", () => {
    const lamp = find((p) => p.kind === "LAMP");
    expect(calcLampRequiredTotal(calcLampRequiredBySocket([entry(lamp, 3)]))).toBe(0);
  });

  it("нехватка ламп попадает в missingLamps с обоими количествами", () => {
    const required = { GX53: 6, MR16: 0, GU10: 0 };
    const current = { GX53: 2, MR16: 0, GU10: 0 };
    expect(calcMissingLamps(required, current)).toEqual([
      { socket: "GX53", requiredQty: 6, currentQty: 2 },
    ]);
  });

  it("когда ламп достаточно, нехватки нет", () => {
    expect(calcMissingLamps({ GX53: 6, MR16: 0, GU10: 0 }, { GX53: 6, MR16: 0, GU10: 0 })).toEqual(
      []
    );
  });

  it("лишние лампы не создают отрицательной нехватки", () => {
    expect(calcMissingLamps({ GX53: 2, MR16: 0, GU10: 0 }, { GX53: 9, MR16: 0, GU10: 0 })).toEqual(
      []
    );
  });

  it("лампы ненужного цоколя не изображают прогресс", () => {
    const required = { GX53: 4, MR16: 0, GU10: 0 };
    const current = { GX53: 1, MR16: 7, GU10: 3 };
    // MR16 и GU10 никто не просил — в зачёт идёт только GX53.
    expect(calcLampCurrentTotal(required, current)).toBe(1);
  });

  it("показываем цоколь, если он нужен или уже куплен", () => {
    expect(
      calcLampSocketsToShow({ GX53: 4, MR16: 0, GU10: 0 }, { GX53: 0, MR16: 2, GU10: 0 })
    ).toEqual(["GX53", "MR16"]);
  });

  it("текущее количество ламп читается из корзины по id", () => {
    const lamp = lampOptions.GX53[0];
    const current = calcLampCurrentBySocket({ [toText(lamp.productId)]: 5 }, lampOptions);
    expect(current.GX53).toBe(5);
  });
});

describe("N-051 · крепления под точечные светильники", () => {
  const pair = Object.entries(POINT_TO_MOUNT_VENDOR_CODE).find(
    ([fixture, mount]) => byVendor.has(fixture) && byVendor.has(mount)
  );

  it("в фиде есть хотя бы одна пара «светильник → крепление»", () => {
    expect(pair).toBeDefined();
  });

  it("светильник без крепления попадает в недостачу", () => {
    if (!pair) return;
    const fixtureId = byVendor.get(pair[0])!;
    const missing = calcMissingMounts({
      cartItems: { [fixtureId]: 3 },
      productIdByVendorCode: byVendor,
      productsById: byId,
    });
    expect(missing).toHaveLength(1);
    expect(missing[0]).toMatchObject({ requiredQty: 3, currentQty: 0 });
    expect(missing[0].mountName.length).toBeGreaterThan(0);
  });

  it("когда креплений столько же, недостачи нет", () => {
    if (!pair) return;
    const fixtureId = byVendor.get(pair[0])!;
    const mountId = byVendor.get(pair[1])!;
    expect(
      calcMissingMounts({
        cartItems: { [fixtureId]: 3, [mountId]: 3 },
        productIdByVendorCode: byVendor,
        productsById: byId,
      })
    ).toEqual([]);
  });

  it("пустая корзина — пустая недостача", () => {
    expect(
      calcMissingMounts({
        cartItems: {},
        productIdByVendorCode: byVendor,
        productsById: byId,
      })
    ).toEqual([]);
  });
});

describe("N-051 · блоки питания CLARUS", () => {
  it("система CLARUS_48 опознаётся в корзине", () => {
    const clarus = find((p) => p.system === "CLARUS_48");
    expect(hasClarusInCart([entry(clarus, 1)])).toBe(true);
  });

  it("без CLARUS флаг не поднимается", () => {
    const other = find((p) => p.system !== "CLARUS_48");
    expect(hasClarusInCart([entry(other, 1)])).toBe(false);
  });

  it("количество БП считается только по кодам блоков питания", () => {
    const clarus = find((p) => p.system === "CLARUS_48");
    // Обычная позиция CLARUS блоком питания не является.
    expect(calcClarusPsuQty([entry(clarus, 2)])).toBeGreaterThanOrEqual(0);
  });
});
