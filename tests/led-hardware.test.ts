import { describe, expect, it } from "vitest";

import {
  PSU_MARGIN_PERCENT,
  isAliceCapable,
  isUniversalController,
  ledRoleOf,
  parseControllerSpec,
  parsePsuSpec,
  parseRemoteSpec,
  parseStripSpec,
  planLedPower,
} from "@/lib/lighting/led-hardware";
import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";

/** Минимальный товар для проверок: важны только name/kind, остальное — заглушки. */
function product(name: string, kind: FeedCatalogProduct["kind"] = "LED_STRIP", priceRub = 1000): FeedCatalogProduct {
  return {
    productId: `p-${name.slice(0, 12)}`,
    vendorCode: "УУ-00000000",
    offerId: "1",
    name,
    url: "https://eksmarket.ru/",
    categoryId: "213",
    categoryPath: "Светодиодная лента",
    images: [],
    coverImage: "",
    priceRub,
    available: true,
    params: [],
    keyAttributes: [],
    system: "SMART_HOME",
    kind,
    unit: "m",
    lengthMeters: null,
    pieceLengthMeters: null,
  };
}

const STRIP_6W = "Светодиодная лента СТАНДАРТ 140 24V  64 диода 6W 2700К катушка 5 м ЧЗ";
const STRIP_10W = "Светодиодная лента СТАНДАРТ 140 24V 112 диодов 10W 4200К катушка 5 м ЧЗ";
const STRIP_22W = "Светодиодная лента ПРО 160 24V 240 диодов 22W 6500К катушка 5 м ЧЗ";
const STRIP_RGB = "Светодиодная лента RGB 24V 60 диода 14,4W катушка 5 м ЧЗ";
const STRIP_CCT = "Светодиодная лента CCT 24V 120 диодов 10.8W 2700-6500K катушка 5 м ЧЗ";

describe("LED · роль позиции", () => {
  it("набор «пульт с контроллером» — это управление целиком, а не лента", () => {
    expect(ledRoleOf(product("Пульт с контролером для светодиодной ленты монохром 1 канал DC12-24В EKS6A*2, 50"))).toBe(
      "controller-remote-kit"
    );
  });

  it("различает пульт, контроллер, блок питания и ленту", () => {
    expect(ledRoleOf(product("Пульт для светодиодной ленты CCT 4 канала RC02RF черный, 12-24В, 100шт"))).toBe("remote");
    expect(ledRoleOf(product("Контроллер для светодиодной ленты WIFI TUYA CCT C02 15A,12-24В"))).toBe("controller");
    expect(ledRoleOf(product("Блок питания СТАНДАРТ 24V 100W 120шт ЧЗ"))).toBe("psu");
    expect(ledRoleOf(product(STRIP_6W))).toBe("strip");
  });

  it("не трогает товары вне LED-группы", () => {
    expect(ledRoleOf(product("Вент.решетка D100 мм белая с кольцом", "OTHER"))).toBeNull();
  });
});

describe("LED · характеристики лент", () => {
  it("читает напряжение, Вт/м, диоды, катушку и считает мощность катушки", () => {
    const spec = parseStripSpec(STRIP_6W);
    expect(spec).toMatchObject({
      voltage: 24,
      wPerMeter: 6,
      ledsPerMeter: 64,
      kind: "mono",
      reelMeters: 5,
      wattsPerReel: 30,
      ampsPerReel: 1.25,
      cct: "2700",
    });
  });

  it("понимает десятичную запятую и диапазон CCT", () => {
    expect(parseStripSpec(STRIP_RGB)).toMatchObject({ kind: "rgb", wPerMeter: 14.4 });
    expect(parseStripSpec(STRIP_CCT)).toMatchObject({ kind: "cct", wPerMeter: 10.8, cct: "2700-6500" });
  });

  it("не выдаёт характеристики за паспорт: у неизвестной строки просто нет чисел", () => {
    expect(parseStripSpec("Светодиодная лента безымянная")).toMatchObject({
      voltage: null,
      wPerMeter: null,
      wattsPerReel: null,
    });
  });
});

describe("LED · питание и управление", () => {
  it("читает БП, контроллер с Wi-Fi и RF-пульт", () => {
    expect(parsePsuSpec("Блок питания ПРО 24V 150W 36шт ЧЗ")).toMatchObject({ voltage: 24, watts: 150 });
    const wifi = parseControllerSpec("Контроллер для светодиодной ленты WIFI TUYA CCT C02 15A,12-24В");
    expect(wifi).toMatchObject({ controlKind: "cct", amps: 15, wifi: true, model: "C02" });
    expect(isAliceCapable(wifi!)).toBe(true);
    expect(parseControllerSpec("Контроллер для светодиодной ленты RGB C03RF 12A, 12-24В")).toMatchObject({
      controlKind: "rgb",
      wifi: false,
      model: "C03RF",
    });
    expect(parseRemoteSpec("Пульт для светодиодной ленты RGB 4 канала RC03RF белый, 12-24В, 100шт")).toMatchObject({
      controlKind: "rgb",
      channels: 4,
      model: "RC03RF",
    });
    expect(parseRemoteSpec("Пульт с контролером для светодиодной ленты RGB 1 канал DC12-24В")).toBeNull();
  });
});

describe("LED · расчёт питания по метражу", () => {
  const catalog = [
    product("Блок питания МИНИ 24V  72W 80шт ЧЗ", "LED_STRIP"),
    product("Блок питания СТАНДАРТ 24V 100W 120шт ЧЗ", "LED_STRIP"),
    product("Блок питания ПРО 24V 150W 36шт ЧЗ", "LED_STRIP"),
    product("Блок питания ПРО 24V 500W 30шт ЧЗ", "LED_STRIP"),
    product("Контроллер для светодиодной ленты WIFI TUYA CCT C02 15A,12-24В", "LED_STRIP"),
    product("Контроллер для светодиодной ленты CCT C02RF 12A, 12-24В", "LED_STRIP"),
    product("Пульт для светодиодной ленты CCT 4 канала RC02RF черный, 12-24В", "LED_STRIP"),
  ];

  it("запас 30 %: 12 м × 10 Вт/м = 120 Вт нагрузки → БП на 150 Вт", () => {
    const plan = planLedPower({ strip: parseStripSpec(STRIP_10W)!, meters: 12, products: catalog });
    expect(PSU_MARGIN_PERCENT).toBe(30);
    expect(plan.loadW).toBe(120);
    expect(plan.requiredW).toBe(156);
    expect(plan.psu?.spec.watts).toBe(500); // 150 Вт < 156 Вт, берём ближайший подходящий
    expect(plan.currentA).toBe(5);
    expect(plan.status).toBe("needs_review");
  });

  it("выбирает минимальный подходящий БП и Wi-Fi-контроллер для CCT", () => {
    const plan = planLedPower({ strip: parseStripSpec(STRIP_CCT)!, meters: 6, products: catalog });
    expect(plan.loadW).toBe(64.8);
    expect(plan.requiredW).toBe(84.2);
    expect(plan.psu?.spec.watts).toBe(100);
    expect(plan.controller?.spec.model).toBe("C02");
    expect(plan.controller && isAliceCapable(plan.controller.spec)).toBe(true);
    expect(plan.remote).toBeNull(); // Wi-Fi не требует пульта
  });

  it("5-в-1 Wi-Fi работает со всеми лентами и предлагается как универсальная альтернатива", () => {
    const withUniversal = [
      ...catalog,
      product("Контроллер для светодиодной ленты WIFI TUYA монохром C01 15A,12-24В", "LED_STRIP"),
      product("Контроллер для светодиодной ленты 5в1 LM051 15A, 12-24В", "LED_STRIP"),
      product("Контроллер для светодиодной ленты WIFI TUYA 5в1 WB5 15A,12-24В", "LED_STRIP"),
    ];
    expect(isUniversalController(parseControllerSpec("Контроллер для светодиодной ленты WIFI TUYA 5в1 WB5 15A,12-24В")!)).toBe(true);
    expect(isUniversalController(parseControllerSpec("Контроллер для светодиодной ленты WIFI TUYA CCT C02 15A,12-24В")!)).toBe(false);

    // Монохром: основной подбор — модель под тип ленты, но 5-в-1 виден как альтернатива.
    const mono = planLedPower({ strip: parseStripSpec(STRIP_10W)!, meters: 12, products: withUniversal });
    expect(mono.controller?.spec.model).toBe("C01");
    expect(mono.controllerScope).toBe("kind");
    expect(mono.universalController?.spec.model).toBe("WB5");
    expect(mono.universalController?.spec.wifi).toBe(true);

    // RGBW: точного соответствия нет, поэтому основным становится 5-в-1 — и это тот же вариант.
    const rgbw = parseStripSpec("Светодиодная лента RGBW 24V 60 диода 14,4W катушка 5 м ЧЗ")!;
    const plan = planLedPower({ strip: rgbw, meters: 5, products: withUniversal });
    expect(plan.controller?.spec.model).toBe("WB5");
    expect(plan.controllerScope).toBe("universal");
    expect(plan.universalController?.spec.model).toBe("WB5");
  });

  it("при равном токе выбирается Wi-Fi-контроллер: пульт не нужен", () => {
    const both = [
      ...catalog,
      product("Контроллер для светодиодной ленты 5в1 LM051 15A, 12-24В", "LED_STRIP"),
      product("Контроллер для светодиодной ленты WIFI TUYA 5в1 WB5 15A,12-24В", "LED_STRIP"),
    ];
    const rgbw = parseStripSpec("Светодиодная лента RGBW 24V 60 диода 14,4W катушка 5 м ЧЗ")!;
    const plan = planLedPower({ strip: rgbw, meters: 10, products: both });
    expect(plan.controller?.spec.model).toBe("WB5");
    expect(plan.controller?.spec.wifi).toBe(true);
    expect(plan.remote).toBeNull();
  });

  it("для RF-контроллера добавляет пульт и не обещает Алису", () => {
    const rfOnly = catalog.filter((p) => !/WIFI/i.test(p.name));
    const plan = planLedPower({ strip: parseStripSpec(STRIP_CCT)!, meters: 6, products: rfOnly });
    expect(plan.controller?.spec.model).toBe("C02RF");
    expect(isAliceCapable(plan.controller!.spec)).toBe(false);
    expect(plan.remote?.spec.model).toBe("RC02RF");
  });

  it("без подтверждённых Вт/м не выдумывает числа: needs_review и без позиций", () => {
    const plan = planLedPower({ strip: parseStripSpec("Светодиодная лента безымянная")!, meters: 10, products: catalog });
    expect(plan.loadW).toBe(0);
    expect(plan.psu).toBeNull();
    expect(plan.status).toBe("needs_review");
    expect(plan.warnings.join(" ")).toContain("не подтверждены");
  });

  it("RGBW требует 5-в-1 и честно предупреждает о канале W", () => {
    const plan = planLedPower({
      strip: parseStripSpec("Светодиодная лента RGBW 24V 60 диода 14,4W катушка 5 м ЧЗ")!,
      meters: 5,
      products: catalog,
    });
    expect(plan.controller).toBeNull();
    expect(plan.warnings.join(" ")).toContain("5-в-1");
    expect(plan.status).toBe("needs_review");
  });

  it("слишком большая нагрузка не маскируется: предупреждение о нескольких БП", () => {
    const plan = planLedPower({ strip: parseStripSpec(STRIP_22W)!, meters: 60, products: catalog });
    expect(plan.requiredW).toBe(1716);
    expect(plan.psu).toBeNull();
    expect(plan.warnings.join(" ")).toContain("нет позиции");
  });
});
