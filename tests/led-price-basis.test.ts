/**
 * T8-010 · База цены ленты.
 *
 * Главный риск, который закрывают эти тесты: цена катушки, принятая за цену
 * метра. В фиде у лент стоит `<price>970</price>` без единицы; при гипотезе
 * «970 ₽ за катушку» пометка «метры» умножит 970 на длину. Тест фиксирует
 * расчётную ветку сценария 02, но не подтверждает `priceUnit` у EKS.
 */
import { describe, expect, it } from "vitest";

import { resolvePriceBasis, stripPurchaseQty, stripSaleUnit } from "@/lib/lighting/led-price-basis";
import { ledUnitOf } from "@/lib/lighting/led-hardware";

describe("T8-010 · resolvePriceBasis", () => {
  it("«катушка 5 м» — цена за катушку, а не за метр", () => {
    const info = resolvePriceBasis({
      name: "Светодиодная лента СТАНДАРТ 140 24V 112 диодов 10W 4200К катушка 5 м ЧЗ",
      priceRub: 1230,
    });
    expect(info.basis).toBe("per_reel");
    expect(info.evidence).toBe("title_reel");
    expect(info.reelMeters).toBe(5);
    expect(info.soldByReel).toBe(true);
    // 1230 / 5 = 246 ₽/м — только для сравнения, не для продажи.
    expect(info.pricePerMeterRub).toBe(246);
  });

  it("«цена за пог м» — явная цена метра, даже если рядом упомянута катушка", () => {
    const info = resolvePriceBasis({ name: "Лента 24V 10W, цена за пог м, катушка 5 м", priceRub: 250 });
    expect(info.basis).toBe("per_meter");
    expect(info.evidence).toBe("title_explicit");
    expect(info.soldByReel).toBe(false);
  });

  it("единица витрины `m` без явных маркеров — метр, но с пометкой «подтвердить»", () => {
    const info = resolvePriceBasis({
      name: "Светодиодная лента СТАНДАРТ 140 24V 112 диодов 10W 4200К 5 м",
      unit: "m",
      priceRub: 265,
    });
    expect(info.basis).toBe("per_meter");
    expect(info.evidence).toBe("feed_unit");
    expect(info.note).toContain("подтвердить");
  });

  it("без единицы и маркеров — unknown, а не «наверное метр»", () => {
    const info = resolvePriceBasis({ name: "Светодиодная лента безымянная 24V", priceRub: 500 });
    expect(info.basis).toBe("unknown");
    expect(info.evidence).toBe("none");
    expect(info.pricePerMeterRub).toBeNull();
  });
});

describe("T8-010 · единица продажи и количество", () => {
  const reel = resolvePriceBasis({
    name: "Светодиодная лента СТАНДАРТ 140 24V 64 диода 6W 2700К катушка 5 м ЧЗ",
    priceRub: 970,
  });
  const perMeter = resolvePriceBasis({ name: "Лента, цена за пог м", priceRub: 200 });

  it("катушка продаётся штуками", () => {
    expect(stripSaleUnit(reel)).toBe("pcs");
    expect(stripSaleUnit(perMeter)).toBe("m");
  });

  it("12 м установлено при катушке 5 м — это 3 шт, а не 15 м по цене катушки", () => {
    const purchase = stripPurchaseQty({ installedMeters: 12, basis: reel });
    expect(purchase).toEqual({ qty: 3, unit: "pcs", roundedMeters: 15 });
  });

  it("цена за метр — покупается точный метраж, без округления до катушки", () => {
    const purchase = stripPurchaseQty({ installedMeters: 12.5, basis: perMeter });
    expect(purchase).toEqual({ qty: 12.5, unit: "m", roundedMeters: 12.5 });
  });

  it("неизвестный базис — вверх до целого метра, консервативно", () => {
    const unknown = resolvePriceBasis({ name: "Лента 24V" });
    expect(stripPurchaseQty({ installedMeters: 12.4, basis: unknown })).toEqual({
      qty: 13,
      unit: "m",
      roundedMeters: 13,
    });
  });

  it("нулевой метраж не даёт ни штук, ни метров", () => {
    expect(stripPurchaseQty({ installedMeters: 0, basis: reel }).qty).toBe(0);
  });
});

describe("T8-010 · ledUnitOf учитывает базис", () => {
  const base = {
    productId: "p1",
    vendorCode: "УУ-00000001",
    offerId: "1",
    url: "https://eksmarket.ru/",
    categoryId: "213",
    categoryPath: "Светодиодная лента",
    images: [],
    coverImage: "",
    available: true,
    params: [],
    keyAttributes: [],
    system: "SMART_HOME" as const,
    kind: "LED_STRIP" as const,
    lengthMeters: null,
    pieceLengthMeters: null,
  };

  it("живой фид с ценой катушки — штуки", () => {
    const product = {
      ...base,
      name: "Светодиодная лента СТАНДАРТ 140 24V 112 диодов 10W 4200К катушка 5 м ЧЗ",
      priceRub: 1230,
      unit: "pcs" as const,
    };
    expect(ledUnitOf(product)).toBe("pcs");
  });

  it("витрина с ценой за метр — метры, как и раньше", () => {
    const product = {
      ...base,
      name: "Светодиодная лента СТАНДАРТ 140 24V 112 диодов 10W 4200К 5 м",
      priceRub: 265,
      unit: "m" as const,
    };
    expect(ledUnitOf(product)).toBe("m");
  });

  it("блок питания и контроллер остаются штуками", () => {
    expect(ledUnitOf({ ...base, name: "Блок питания СТАНДАРТ 24V 100W", kind: "PSU" })).toBe("pcs");
    expect(ledUnitOf({ ...base, name: "Контроллер для светодиодной ленты C01RF 12A", kind: "LED_STRIP" })).toBe("pcs");
  });
});
