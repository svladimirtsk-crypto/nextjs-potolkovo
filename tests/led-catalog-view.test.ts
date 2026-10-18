import { describe, expect, it } from "vitest";

import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";
import {
  LED_GROUPS,
  controlKindOfStrip,
  controlStatusOf,
  ledGroupOfProduct,
  ledMetersFromQuery,
  ledMetersFromTasks,
  ledMetersNote,
  ledPlanFor,
  ledTaskRefFromQuery,
  ledProductsOfGroup,
  ledStripOptions,
  psuWattsOf,
} from "@/lib/lighting/led-catalog-view";
import { parseControllerSpec, parseRemoteSpec, parseStripSpec } from "@/lib/lighting/led-hardware";

function product(name: string): FeedCatalogProduct {
  return {
    productId: `p-${name.slice(0, 10)}`,
    vendorCode: "УУ-00000000",
    offerId: "1",
    name,
    url: "https://eksmarket.ru/",
    categoryId: "213",
    categoryPath: "Светодиодная лента",
    images: [],
    coverImage: "",
    priceRub: 1000,
    available: true,
    params: [],
    keyAttributes: [],
    system: "SMART_HOME",
    kind: "LED_STRIP",
    unit: "m",
    lengthMeters: null,
    pieceLengthMeters: null,
  };
}

const STRIP = "Светодиодная лента СТАНДАРТ 140 24V 112 диодов 10W 4200К катушка 5 м ЧЗ";
const PSU_100 = "Блок питания СТАНДАРТ 24V 100W 120шт ЧЗ";
const PSU_150 = "Блок питания ПРО 24V 150W 36шт ЧЗ";
const WIFI_CCT = "Контроллер для светодиодной ленты WIFI TUYA CCT C02 15A,12-24В";
const RF_CCT = "Контроллер для светодиодной ленты CCT C02RF 12A, 12-24В";
const REMOTE = "Пульт для светодиодной ленты CCT 4 канала RC02RF черный, 12-24В";
const KIT = "Пульт с контролером для светодиодной ленты монохром 1 канал DC12-24В EKS6A*2, 50";
const WIFI_MONO = "Контроллер для светодиодной ленты WIFI TUYA монохром C01 15A,12-24В";
const WIFI_5IN1 = "Контроллер для светодиодной ленты WIFI TUYA 5в1 WB5 15A,12-24В";

const catalog = [product(STRIP), product(PSU_100), product(PSU_150), product(WIFI_CCT), product(RF_CCT), product(REMOTE), product(KIT), product(WIFI_MONO)];

describe("LED-раздел · группы комплектующих", () => {
  it("раскладывает позиции по трём понятным группам", () => {
    expect(ledGroupOfProduct(product(STRIP))).toBe("strips");
    expect(ledGroupOfProduct(product(PSU_100))).toBe("power");
    expect(ledGroupOfProduct(product(WIFI_CCT))).toBe("control");
    expect(ledGroupOfProduct(product(REMOTE))).toBe("control");
    expect(ledGroupOfProduct(product(KIT))).toBe("control");
    expect(ledGroupOfProduct(product("Вент.решетка D100 мм"))).toBeNull();
  });

  it("в каждой группе только её позиции", () => {
    expect(ledProductsOfGroup(catalog, "strips").map((p) => p.name)).toEqual([STRIP]);
    expect(ledProductsOfGroup(catalog, "power")).toHaveLength(2);
    // Wi-Fi CCT, RF CCT, пульт CCT, набор «пульт + контроллер» и Wi-Fi моно — всё управление.
    expect(ledProductsOfGroup(catalog, "control")).toHaveLength(5);
    expect(ledProductsOfGroup(catalog, "power").some((p) => /пульт/i.test(p.name))).toBe(false);
  });

  it("в подбор лент попадают только ленты с подтверждённой мощностью", () => {
    const options = ledStripOptions([...catalog, product("Светодиодная лента без параметров")]);
    expect(options).toHaveLength(1);
    expect(options[0].spec.wPerMeter).toBe(10);
  });

  it("подписи групп объясняют, что внутри", () => {
    expect(LED_GROUPS.map((g) => g.label)).toEqual(["Ленты", "Питание", "Управление"]);
    expect(LED_GROUPS.every((g) => g.hint.length > 20)).toBe(true);
  });
});

describe("LED-раздел · подбор питания по метражу", () => {
  it("12 м × 10 Вт/м = 120 Вт, БП с запасом 30 % → 150 Вт", () => {
    const plan = ledPlanFor({ products: catalog, strip: parseStripSpec(STRIP)!, meters: 12 })!;
    expect(plan.loadW).toBe(120);
    expect(plan.requiredW).toBe(156);
    expect(plan.marginPercent).toBe(30);
    // 100 Вт не проходит, 150 Вт < 156 Вт расчётных — берём следующий подходящий.
    expect(psuWattsOf(plan)).toBe(null); // в этой сетке ничего ≥ 156 Вт нет
    expect(plan.warnings.join(" ")).toContain("нет позиции");
  });

  it("универсальный 5-в-1 виден в плане как альтернатива для монохромной ленты", () => {
    const plan = ledPlanFor({
      products: [...catalog, product(WIFI_5IN1)],
      strip: parseStripSpec(STRIP)!,
      meters: 6,
    })!;
    expect(plan.controller?.spec.model).toBe("C01");
    expect(plan.controllerScope).toBe("kind");
    expect(plan.universalController?.spec.model).toBe("WB5");
  });

  it("на 6 м хватает БП 100 Вт, а рейки считаются по 5 м", () => {
    const plan = ledPlanFor({ products: catalog, strip: parseStripSpec(STRIP)!, meters: 6 })!;
    expect(plan.requiredW).toBe(78);
    expect(psuWattsOf(plan)).toBe(100);
    expect(plan.reels).toBe(2);
    // Лента 4200К — монохром, значит и контроллер должен быть монохромным, а не CCT.
    expect(plan.controller?.spec.model).toBe("C01");
    expect(plan.remote).toBeNull();
  });

  it("для монохромной ленты не подставляется CCT-контроллер", () => {
    const monoOnly = [product(STRIP), product(PSU_100), product(WIFI_CCT), product(RF_CCT)];
    const plan = ledPlanFor({ products: monoOnly, strip: parseStripSpec(STRIP)!, meters: 6 })!;
    expect(plan.controller).toBeNull();
    expect(plan.warnings.join(" ")).toContain("подбор по паспорту");
  });

  it("без метража расчёт не «сходится» и просит метраж", () => {
    const plan = ledPlanFor({ products: catalog, strip: parseStripSpec(STRIP)!, meters: 0 })!;
    expect(plan.status).toBe("needs_review");
    expect(plan.reels).toBeNull();
    expect(plan.warnings.join(" ")).toContain("Укажите метраж");
    expect(plan.psu).toBeNull();
  });

  it("без ленты расчёта нет — вместо цифр просьба уточнить", () => {
    expect(ledPlanFor({ products: catalog, strip: null, meters: 10 })).toBeNull();
    expect(ledMetersNote(0)).toContain("Укажите метраж");
    expect(ledMetersNote(-3)).toContain("Укажите метраж");
    expect(ledMetersNote(NaN)).toContain("Укажите метраж");
    expect(ledMetersNote(12)).toBe("Метраж 12 м.");
  });

  it("метраж из задач света суммируется и не выдумывается при пустых задачах", () => {
    expect(ledMetersFromTasks([{ geometryMeters: 3.5 }, { geometryMeters: 4 }, { geometryMeters: null }])).toBe(7.5);
    expect(ledMetersFromTasks([{ geometryMeters: null }])).toBeNull();
    expect(ledMetersFromTasks([])).toBeNull();
  });

  it("метраж из ссылки принимается только осмысленным", () => {
    expect(ledMetersFromQuery("?led=1&meters=12")).toBe(12);
    expect(ledMetersFromQuery("?led=1&meters=7,5")).toBe(7.5);
    expect(ledMetersFromQuery("?meters=12")).toBeNull(); // без метки входа из задачи
    expect(ledMetersFromQuery("?led=1&meters=abc")).toBeNull();
    expect(ledMetersFromQuery("?led=1&meters=-4")).toBeNull();
    expect(ledMetersFromQuery("?led=1&meters=9999")).toBeNull();
    expect(ledMetersFromQuery("")).toBeNull();
  });

  it("LED-04 · URL-задача распознаётся только для LED-входа и допустимых feature/room", () => {
    expect(ledTaskRefFromQuery("?led=1&room=r1&feature=floating&meters=9")).toEqual({ roomId: "r1", feature: "floating" });
    expect(ledTaskRefFromQuery("?led=1&room=r2&feature=light-lines")).toEqual({ roomId: "r2", feature: "light-lines" });
    expect(ledTaskRefFromQuery("?room=r1&feature=floating")).toBeNull();
    expect(ledTaskRefFromQuery("?led=1&feature=floating")).toBeNull();
    expect(ledTaskRefFromQuery("?led=1&room=r1&feature=track")).toBeNull();
    expect(ledTaskRefFromQuery(`?led=1&room=${"x".repeat(130)}&feature=cornice`)).toBeNull();
  });

  it("тип управления следует за типом ленты", () => {
    expect(controlKindOfStrip("mono")).toBe("mono");
    expect(controlKindOfStrip("cct")).toBe("cct");
    expect(controlKindOfStrip("rgb")).toBe("rgb");
    expect(controlKindOfStrip("rgbw")).toBe("rgb-cct");
    expect(controlKindOfStrip("rgb-cct")).toBe("rgb-cct");
  });
});

describe("LED-раздел · статусы управления", () => {
  it("Wi-Fi-контроллер: Алиса подтверждена владельцем на его комплекте", () => {
    const status = controlStatusOf({ role: "controller", controller: parseControllerSpec(WIFI_CCT) });
    expect(status.alice).toBe("owner-verified");
    expect(status.detail).toContain("подтверждена владельцем на его комплекте");
    expect(status.detail).not.toContain("паспорт");
  });

  it("Wi-Fi 5-в-1 описан как универсальный: работает со всеми лентами", () => {
    const status = controlStatusOf({
      role: "controller",
      controller: parseControllerSpec("Контроллер для светодиодной ленты WIFI TUYA 5в1 WB5 15A,12-24В"),
    });
    expect(status.title).toBe("Wi-Fi 5-в-1 контроллер");
    expect(status.detail).toContain("монохром, CCT, RGB, RGBW и RGB+CCT");
    expect(status.detail).toContain("подтверждено владельцем на его комплекте");
    expect(status.alice).toBe("owner-verified");
    // Про мощность обещания нет: это подтверждение режимов, не паспорт.
    expect(status.detail).not.toContain("любой мощности");
  });

  it("RF 5-в-1: один на все ленты, но без умного дома", () => {
    const status = controlStatusOf({
      role: "controller",
      controller: parseControllerSpec("Контроллер для светодиодной ленты 5в1 LM051 15A, 12-24В"),
    });
    expect(status.title).toBe("RF 5-в-1 контроллер");
    expect(status.detail).toContain("только пультом");
    expect(status.alice).toBe("no");
  });

  it("RF-контроллер и пульт честно говорят, что умного дома нет", () => {
    const rf = controlStatusOf({ role: "controller", controller: parseControllerSpec(RF_CCT) });
    expect(rf.alice).toBe("no");
    expect(rf.detail).toContain("только пультом");
    const remote = controlStatusOf({ role: "remote", remote: parseRemoteSpec(REMOTE) });
    expect(remote.detail).toContain("4 канала");
    expect(remote.alice).toBe("no");
  });

  it("набор «пульт + контроллер» не обещает совместимость, которой не проверяли", () => {
    const kit = controlStatusOf({ role: "controller-remote-kit" });
    expect(kit.alice).toBe("unknown");
    expect(kit.detail).toContain("проверяется по паспорту");
  });
});
