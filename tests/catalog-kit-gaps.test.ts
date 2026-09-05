import { describe, expect, it } from "vitest";

import {
  calcClarusPsuOptions,
  calcLampCurrentBySocket,
  calcLampRequiredBySocket,
  calcMissingLamps,
  calcMissingMounts,
  groupLampsBySocket,
  type CartEntry,
} from "@/lib/lighting/catalog-kit-gaps";
import { POINT_TO_MOUNT_VENDOR_CODE } from "@/lib/catalog-ui-config";
import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";

const product = (over: Partial<FeedCatalogProduct>): FeedCatalogProduct =>
  ({
    productId: "p1",
    vendorCode: "",
    offerId: "",
    name: "Товар",
    url: "",
    categoryId: "",
    categoryPath: "",
    images: [],
    coverImage: "",
    priceRub: 100,
    available: true,
    params: [],
    keyAttributes: [],
    system: "NONE",
    kind: "OTHER",
    unit: "pcs",
    lengthMeters: null,
    pieceLengthMeters: null,
    ...over,
  }) as FeedCatalogProduct;

const lamp = (id: string, socket: string, price: number) =>
  product({ productId: id, name: `Лампа ${socket}`, kind: "LAMP", priceRub: price });

describe("Лампы по цоколям", () => {
  const lamps = [lamp("gx-dear", "GX53", 300), lamp("gx-cheap", "GX53", 100), lamp("gu-1", "GU10", 200)];

  it("сортирует по цене: первая — самая доступная", () => {
    const grouped = groupLampsBySocket(lamps);
    expect(grouped.GX53.map((p) => p.productId)).toEqual(["gx-cheap", "gx-dear"]);
  });

  it("не берёт недоступные и без цены", () => {
    const grouped = groupLampsBySocket([
      product({ productId: "no-price", name: "Лампа GX53", kind: "LAMP", priceRub: 0 }),
      product({ productId: "gone", name: "Лампа GX53", kind: "LAMP", available: false }),
    ]);
    expect(grouped.GX53).toHaveLength(0);
  });

  /**
   * Регрессия: счётчик обходил только GX53 и MR16, поэтому купленные лампы
   * GU10 не засчитывались и предупреждение висело вечно.
   */
  it("засчитывает лампы GU10, а не только GX53 и MR16", () => {
    const grouped = groupLampsBySocket(lamps);
    const current = calcLampCurrentBySocket({ "gu-1": 3 }, grouped);

    expect(current.GU10).toBe(3);
  });

  it("предупреждение о нехватке GU10 гаснет, когда лампы добавлены", () => {
    const grouped = groupLampsBySocket(lamps);
    const fixture = product({ productId: "f1", name: "Светильник цоколь GU10", kind: "SPOT_FIXTURE" });
    const required = calcLampRequiredBySocket([{ product: fixture, qty: 2 }]);
    expect(required.GU10).toBe(2);

    const before = calcMissingLamps(required, calcLampCurrentBySocket({}, grouped), grouped);
    expect(before.map((m) => m.socket)).toContain("GU10");
    expect(before[0].cheapestLampId).toBe("gu-1");

    const after = calcMissingLamps(required, calcLampCurrentBySocket({ "gu-1": 2 }, grouped), grouped);
    expect(after).toHaveLength(0);
  });

  it("лампа не требует лампы — бесконечного добивания 1:1 нет", () => {
    expect(calcLampRequiredBySocket([{ product: lamp("gx-cheap", "GX53", 100), qty: 5 }]).GX53).toBe(0);
  });

  it("без подходящей лампы в каталоге отдаёт null вместо кнопки", () => {
    const grouped = groupLampsBySocket([]);
    const required = { GX53: 2, MR16: 0, GU10: 0 } as const;
    const missing = calcMissingLamps({ ...required }, { GX53: 0, MR16: 0, GU10: 0 }, grouped);
    expect(missing[0].cheapestLampId).toBeNull();
  });
});

describe("Закладные 1:1", () => {
  const [fixtureVendor, mountVendor] = Object.entries(POINT_TO_MOUNT_VENDOR_CODE)[0];
  const byVendor = new Map([
    [fixtureVendor, "fix-id"],
    [mountVendor, "mount-id"],
  ]);
  const byId = new Map([
    ["fix-id", product({ productId: "fix-id", vendorCode: fixtureVendor })],
    ["mount-id", product({ productId: "mount-id", vendorCode: mountVendor, name: "Закладная" })],
  ]);

  it("требует закладную на каждый светильник", () => {
    const missing = calcMissingMounts({ "fix-id": 3, "mount-id": 1 }, byVendor, byId);
    expect(missing[0]).toMatchObject({ requiredQty: 3, currentQty: 1, mountName: "Закладная" });
  });

  it("молчит, когда закладных хватает", () => {
    expect(calcMissingMounts({ "fix-id": 2, "mount-id": 2 }, byVendor, byId)).toHaveLength(0);
  });
});

describe("Блок питания CLARUS", () => {
  const fixture = product({ productId: "cl-1", system: "CLARUS_48", kind: "TRACK_FIXTURE" });
  const psuVendor = "PSU-1";
  const byVendor = new Map([[psuVendor, "psu-id"]]);
  const byId = new Map([["psu-id", product({ productId: "psu-id", name: "БП CLARUS" })]]);

  it("не предлагает БП, когда система не CLARUS", () => {
    const entries: CartEntry[] = [{ product: product({ kind: "TRACK_FIXTURE" }), qty: 1 }];
    expect(calcClarusPsuOptions(entries, byVendor, byId)).toHaveLength(0);
  });

  it("предлагает только те артикулы, у которых есть карточка в фиде", () => {
    const options = calcClarusPsuOptions([{ product: fixture, qty: 1 }], new Map(), byId);
    expect(options).toHaveLength(0);
  });
});
