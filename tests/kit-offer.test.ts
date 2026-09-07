import { describe, expect, it } from "vitest";

import { kitCompositionLine, kitPartRole, kitSkuCount } from "../lib/lighting/kit-offer";
import type { LightingItem } from "../lib/calculator-modal-types";

/**
 * N-040 · Состав комплекта на языке клиента (F-41).
 */
function item(partial: Partial<LightingItem> & { name: string; kind: string }): LightingItem {
  return {
    sku: partial.sku ?? partial.name,
    name: partial.name,
    qty: partial.qty ?? 1,
    priceRub: partial.priceRub ?? 1000,
    kind: partial.kind,
  };
}

const kitchenKit: LightingItem[] = [
  item({ name: "Профиль COLIBRI 2 м чёрный", kind: "TRACK_PROFILE", qty: 1 }),
  item({ name: "Профиль COLIBRI 1 м чёрный", kind: "TRACK_PROFILE", qty: 1 }),
  item({ name: "Светильник ЛИЦЦИ чёрный, 15W", kind: "TRACK_FIXTURE", qty: 2 }),
  item({ name: "Светильник ЛИЦЦИ чёрный, 8W", kind: "TRACK_FIXTURE", qty: 3 }),
  item({ name: "Угловой соединитель", kind: "TRACK_ACCESSORY", qty: 1 }),
  item({ name: "Ввод питания", kind: "PSU", qty: 1 }),
];

describe("kitPartRole", () => {
  it("различает профиль, светильники, питание и лампы", () => {
    expect(kitPartRole(item({ name: "Профиль 2 м", kind: "TRACK_PROFILE" }))).toBe("profile");
    expect(kitPartRole(item({ name: "Светильник", kind: "TRACK_FIXTURE" }))).toBe("fixture");
    expect(kitPartRole(item({ name: "Спот", kind: "SPOT_FIXTURE" }))).toBe("fixture");
    expect(kitPartRole(item({ name: "Панель", kind: "PANEL" }))).toBe("fixture");
    expect(kitPartRole(item({ name: "Блок питания", kind: "PSU" }))).toBe("power");
    expect(kitPartRole(item({ name: "Лампа GX53", kind: "LAMP" }))).toBe("lamp");
  });

  it("всё остальное — крепёж: перечислять коннекторы поштучно бессмысленно", () => {
    expect(kitPartRole(item({ name: "Коннектор", kind: "TRACK_ACCESSORY" }))).toBe("hardware");
    expect(kitPartRole(item({ name: "Заглушка", kind: "OTHER" }))).toBe("hardware");
  });
});

describe("kitCompositionLine", () => {
  it("сворачивает накладную в одну человеческую строку", () => {
    // До N-040 здесь было шесть строк с артикулами и ваттами.
    expect(kitCompositionLine(kitchenKit)).toBe(
      "3 м профиля · 5 светильников · питание · крепёж"
    );
  });

  it("метры профиля складываются с учётом количества", () => {
    const line = kitCompositionLine([
      item({ name: "Профиль 2 м", kind: "TRACK_PROFILE", qty: 3 }),
    ]);
    expect(line).toBe("6 м профиля");
  });

  it("дробная длина не превращается в 2.5000000001 м", () => {
    const line = kitCompositionLine([
      item({ name: "Профиль 0,5 м", kind: "TRACK_PROFILE", qty: 5 }),
    ]);
    expect(line).toBe("2.5 м профиля");
  });

  it("склонения светильников и ламп", () => {
    const one = kitCompositionLine([item({ name: "Спот", kind: "SPOT_FIXTURE", qty: 1 })]);
    const few = kitCompositionLine([item({ name: "Спот", kind: "SPOT_FIXTURE", qty: 3 })]);
    const many = kitCompositionLine([item({ name: "Спот", kind: "SPOT_FIXTURE", qty: 7 })]);
    expect(one).toBe("1 светильник");
    expect(few).toBe("3 светильника");
    expect(many).toBe("7 светильников");

    expect(kitCompositionLine([item({ name: "Лампа", kind: "LAMP", qty: 1 })])).toBe("1 лампа");
    expect(kitCompositionLine([item({ name: "Лампа", kind: "LAMP", qty: 4 })])).toBe("4 лампы");
    expect(kitCompositionLine([item({ name: "Лампа", kind: "LAMP", qty: 11 })])).toBe("11 ламп");
  });

  it("порядок частей: размер, свет, потом обвязка", () => {
    const line = kitCompositionLine(kitchenKit);
    expect(line.indexOf("профиля")).toBeLessThan(line.indexOf("светильник"));
    expect(line.indexOf("светильник")).toBeLessThan(line.indexOf("питание"));
  });

  it("профиль без длины в названии не даёт «0 м профиля»", () => {
    const line = kitCompositionLine([
      item({ name: "Профиль COLIBRI чёрный", kind: "TRACK_PROFILE", qty: 1 }),
      item({ name: "Спот", kind: "SPOT_FIXTURE", qty: 2 }),
    ]);
    expect(line).toBe("2 светильника");
  });

  it("пустой комплект даёт пустую строку, а не мусор", () => {
    expect(kitCompositionLine([])).toBe("");
  });
});

describe("kitSkuCount", () => {
  it("считает позиции, скрытые под «Состав по артикулам»", () => {
    expect(kitSkuCount(kitchenKit)).toBe(6);
  });
});

describe("N-040 · длина профиля в реальных названиях фида", () => {
  it("габариты в миллиметрах читаются как длина", () => {
    // Так профиль записан у поставщика: «2000*62*51 мм», а не «2 м».
    const line = kitCompositionLine([
      item({ name: "КОЛИБРИ трековый профиль под гарпун 220V чёрный, 2000*62*51 мм", kind: "TRACK_PROFILE", qty: 1 }),
      item({ name: "КОЛИБРИ трековый профиль под гарпун 220V чёрный, 1000*62*51 мм", kind: "TRACK_PROFILE", qty: 1 }),
    ]);
    expect(line).toBe("3 м профиля");
  });

  it("«мм» в габаритах не принимается за метры", () => {
    const line = kitCompositionLine([
      item({ name: "КЛАРУС трековый профиль 48V чёрный, 1000*60*33 мм", kind: "TRACK_PROFILE", qty: 2 }),
    ]);
    expect(line).toBe("2 м профиля");
  });

  it("формат «2 м (цена за пог м)» тоже понимается", () => {
    const line = kitCompositionLine([
      item({ name: "Профиль 8255 для однофазного шинопровода, 2 м (цена за пог м)", kind: "TRACK_PROFILE", qty: 3 }),
    ]);
    expect(line).toBe("6 м профиля");
  });
});
