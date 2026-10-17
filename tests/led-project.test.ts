/**
 * Часть C · Приёмочные сценарии инженерной модели (`CATALOG-LED-TZ.md` §5–§6,
 * §10). Проверяются именно те ошибки, из-за которых калькулятор считал бы
 * «красиво, но неверно»: метраж без рядов, общий ток в норме при перегруженном
 * канале, зоны и цепи, смешанные напряжения.
 */
import { describe, expect, it } from "vitest";

import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";
import {
  CONTROLLER_LIMITS,
  activeChannelsOf,
  checkControllerForLoad,
  parseControllerSpec,
} from "@/lib/lighting/led-hardware";
import {
  LED_RULES_VERSION,
  installedMetersOf,
  planLedProject,
  worstStatus,
  type LedRun,
  type LedZone,
} from "@/lib/lighting/led-project";

function product(
  name: string,
  kind: FeedCatalogProduct["kind"] = "LED_STRIP",
  priceRub = 1000
): FeedCatalogProduct {
  return {
    productId: `p-${name.slice(0, 16)}`,
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

const STRIP_10W = {
  voltage: 24,
  wPerMeter: 10,
  ledsPerMeter: 112,
  kind: "mono" as const,
  reelMeters: 5,
  wattsPerReel: 50,
  ampsPerReel: 2.08,
  cct: "4200",
  series: "СТАНДАРТ 140",
};
const STRIP_144 = {
  ...STRIP_10W,
  wPerMeter: 14.4,
  kind: "rgbw" as const,
  wattsPerReel: 72,
  ampsPerReel: 3,
};
const STRIP_48V = { ...STRIP_10W, voltage: 48 };

const catalog = [
  product("Блок питания МИНИ 24V 72W"),
  product("Блок питания СТАНДАРТ 24V 100W", "LED_STRIP", 1230),
  product("Блок питания СТАНДАРТ 24V 150W", "LED_STRIP", 1590),
  product("Блок питания СТАНДАРТ 24V 200W", "LED_STRIP", 1880),
  product("Блок питания ПРО 24V 300W", "LED_STRIP", 3000),
  product("Блок питания ПРО 48V 300W", "LED_STRIP", 3100),
  product("Контроллер для светодиодной ленты монохром C01RF 12A, 12-24В", "LED_STRIP", 920),
  product("Контроллер для светодиодной ленты WIFI TUYA монохром C01 15A,12-24В", "LED_STRIP", 2230),
  product("Контроллер для светодиодной ленты WIFI TUYA 5в1 WB5 15A,12-24В", "LED_STRIP", 2500),
  product("Контроллер для светодиодной ленты 5в1 LM051 15A, 12-24В", "LED_STRIP", 1660),
  product("Пульт для светодиодной ленты монохром 4 канала RC01RF белый, 12-24В", "LED_STRIP", 1640),
];

function run(overrides: Partial<LedRun> = {}): LedRun {
  return {
    id: "run-1",
    roomId: "r1",
    roomLabel: "Гостиная",
    feature: "light-lines",
    meters: 6,
    rows: 1,
    strip: STRIP_10W,
    stripProductId: "strip-1",
    stripName: "Лента СТАНДАРТ 140 24V 10W",
    source: "task",
    confirmed: true,
    ...overrides,
  };
}

const zone = (id: string, runIds: string[], roomId = "r1"): LedZone => ({ id, roomId, runIds });

describe("C · установленная длина и нагрузка", () => {
  it("6 м линии в два ряда — это 12 м ленты и 120 Вт, а не 6 м и 60 Вт", () => {
    expect(installedMetersOf({ meters: 6, rows: 2 })).toBe(12);
    const plan = planLedProject({ products: catalog, runs: [run({ meters: 6, rows: 2 })] });
    expect(plan.totals.installedMeters).toBe(12);
    expect(plan.totals.loadW).toBe(120);
  });

  it("неизвестный метраж не превращается в «ноль ватт и всё хорошо»", () => {
    const plan = planLedProject({ products: catalog, runs: [run({ meters: null })] });
    expect(plan.totals.loadW).toBe(0);
    expect(plan.status).toBe("needs_review");
    expect(plan.zones[0]?.status).toBe("needs_review");
    expect(plan.questions.join(" ")).toContain("уточнить длину");
    // Лента без метража не получает выдуманное количество.
    const strip = plan.bom.find((line) => line.role === "strip");
    expect(strip?.qty).toBe(0);
    expect(strip?.status).toBe("needs_review");
  });

  it("без подтверждённой единицы продажи метраж округляется вверх до метра", () => {
    const plan = planLedProject({ products: catalog, runs: [run({ meters: 6, rows: 2 })] });
    const strip = plan.bom.find((line) => line.role === "strip");
    // Позиции «strip-1» нет в каталоге → базис неизвестен: 12 м, а не выдуманные катушки.
    expect(strip?.qty).toBe(12);
    expect(strip?.unit).toBe("m");
    expect(strip?.status).toBe("needs_review");
    expect(strip?.reason).toContain("2 ряда");
    expect(plan.totals.loadW).toBe(120);
  });

  it("катушка за 970 ₽ продаётся штуками: 12 м → 3 шт, цена не умножается на метры", () => {
    // Та же позиция, но с ценой за катушку — как в живом фиде EKS.
    const reelProduct = {
      ...product("Светодиодная лента СТАНДАРТ 140 24V 112 диодов 10W 4200К катушка 5 м ЧЗ", "LED_STRIP", 1230),
      productId: "strip-1",
    };
    const plan = planLedProject({ products: [reelProduct], runs: [run({ meters: 6, rows: 2 })] });
    const strip = plan.bom.find((line) => line.role === "strip");
    expect(strip?.qty).toBe(3);
    expect(strip?.unit).toBe("pcs");
    expect(strip?.reason).toContain("3 шт");
    expect(strip?.reason).toContain("12 м");
  });
});

describe("C · блок питания", () => {
  it("запас 30 %: 120 Вт нагрузки требуют 156 Вт, берётся 200 Вт, а не 150", () => {
    const plan = planLedProject({ products: catalog, runs: [run({ meters: 6, rows: 2 })] });
    expect(plan.circuits[0]?.requiredW).toBe(156);
    expect(plan.circuits[0]?.psu?.watts).toBe(200);
  });

  it("17 м × 14,4 Вт/м: 244,8 Вт → 318,2 Вт с запасом 30 %, 250 и 300 Вт не проходят", () => {
    const plan = planLedProject({
      products: catalog,
      runs: [run({ meters: 17, strip: STRIP_144, rows: 1 })],
    });
    expect(plan.totals.loadW).toBe(244.8);
    expect(plan.circuits[0]?.requiredW).toBe(318.2);
    expect(plan.circuits[0]?.psu).toBeNull();
    expect(plan.circuits[0]?.warnings.join(" ")).toContain("не покрывает");
    expect(plan.status).toBe("needs_review");
  });

  it("блок 48 В не ставится к ленте 24 В — с причиной отказа", () => {
    const plan = planLedProject({ products: catalog, runs: [run({ meters: 12 })] });
    // 12 м × 10 = 120 Вт → 156 Вт; 48-вольтовый на 300 Вт отброшен по напряжению.
    expect(plan.circuits[0]?.psu?.name).toContain("24V");
    // Отдельная цепь 48 В получает свой блок и не делит его с 24 В.
    const mixed = planLedProject({
      products: catalog,
      runs: [
        run({ id: "a", meters: 6 }),
        run({ id: "b", meters: 6, strip: STRIP_48V, roomId: "r1" }),
      ],
    });
    expect(mixed.circuits).toHaveLength(2);
    const volts = mixed.circuits.map((circuit) => circuit.voltage).sort();
    expect(volts).toEqual([24, 48]);
  });
});

describe("C · контроллер: ток, канал, вход", () => {
  it("C01RF с этикетки: 6 А на канал и 5 А на круглом входе", () => {
    expect(CONTROLLER_LIMITS.C01RF?.channelAmps).toBe(6);
    expect(CONTROLLER_LIMITS.C01RF?.inputRoundAmps).toBe(5);
    expect(CONTROLLER_LIMITS.WB5?.channelAmps).toBe(6);
    expect(CONTROLLER_LIMITS.WB5?.totalAmps).toBe(15);
  });

  it("пять каналов RGBW и один канал моно считаются по-разному", () => {
    expect(activeChannelsOf("mono")).toBe(1);
    expect(activeChannelsOf("cct")).toBe(2);
    expect(activeChannelsOf("rgb")).toBe(3);
    expect(activeChannelsOf("rgbw")).toBe(4);
    expect(activeChannelsOf("rgb-cct")).toBe(5);
  });

  it("общий ток в норме, но канал перегружен — контроллер отклоняется", () => {
    // WB5: 15 А суммарно, но 6 А на канал. 24 В × 8,5 А = 204 Вт на один канал моно.
    const check = checkControllerForLoad({
      spec: parseControllerSpec("Контроллер для светодиодной ленты WIFI TUYA 5в1 WB5 15A,12-24В")!,
      voltage: 24,
      currentA: 8.5,
      channels: activeChannelsOf("mono"),
    });
    expect(check.ok).toBe(false);
    expect(check.reason).toContain("на канал");
  });

  it("тот же WB5 с RGBW (5 каналов) проходит по каналу, но проходит ли — по сумме", () => {
    const spec = parseControllerSpec("Контроллер для светодиодной ленты WIFI TUYA 5в1 WB5 15A,12-24В")!;
    expect(checkControllerForLoad({ spec, voltage: 24, currentA: 8.5, channels: 5 }).ok).toBe(true);
    expect(checkControllerForLoad({ spec, voltage: 24, currentA: 16, channels: 5 }).ok).toBe(false);
  });

  it("ток выше 5 А у C01RF даёт предупреждение о круглом входе", () => {
    const spec = parseControllerSpec("Контроллер для светодиодной ленты монохром C01RF 12A, 12-24В")!;
    const check = checkControllerForLoad({ spec, voltage: 24, currentA: 5.5, channels: 1 });
    expect(check.ok).toBe(true);
    expect(check.warnings.join(" ")).toContain("круглого входа");
  });

  it("длинная моно-линия: подбор уходит к другому контроллеру, отказ объяснён", () => {
    // 24 м × 15 Вт/м ≈ 360 Вт → 15 А: у C01RF 12 А суммарно — отказ.
    const plan = planLedProject({
      products: catalog,
      runs: [run({ meters: 24, strip: { ...STRIP_10W, wPerMeter: 15 } })],
    });
    const zonePlan = plan.zones[0];
    expect(zonePlan?.controller?.model).not.toBe("C01RF");
    expect(zonePlan?.rejectedControllers.some((item) => item.name.includes("C01RF"))).toBe(true);
  });
});

describe("C · зоны и цепи", () => {
  it("две зоны в комнате — два контроллера, но один БП с пометкой о схеме", () => {
    const runs = [
      run({ id: "run-1", meters: 6 }),
      run({ id: "run-2", meters: 4 }),
    ];
    const plan = planLedProject({
      products: catalog,
      runs,
      zones: [zone("z1", ["run-1"]), zone("z2", ["run-2"])],
    });
    expect(plan.totals.controllers).toBe(2);
    expect(plan.totals.psus).toBe(1);
    expect(plan.circuits[0]?.warnings.join(" ")).toContain("2 зоны");
    expect(plan.status).toBe("needs_review");
  });

  it("участок вне зон получает свою зону, а не приклеивается молча", () => {
    const runs = [run({ id: "run-1" }), run({ id: "run-2", meters: 3 })];
    const plan = planLedProject({ products: catalog, runs, zones: [zone("z1", ["run-1"])] });
    expect(plan.zones).toHaveLength(2);
    expect(plan.zones[1]?.id).toContain("run-2");
    expect(plan.warnings.join(" ")).toContain("не входил ни в одну зону");
  });

  it("одна зона с моно и CCT лентами не управляется одним контроллером", () => {
    const plan = planLedProject({
      products: catalog,
      runs: [
        run({ id: "a", meters: 5 }),
        run({ id: "b", meters: 5, strip: { ...STRIP_10W, kind: "cct" } }),
      ],
      zones: [zone("z1", ["a", "b"])],
    });
    expect(plan.zones[0]?.status).toBe("incompatible");
    expect(plan.questions.join(" ")).toContain("разделить");
  });

  it("пустой проект не выдаёт «всё ок»", () => {
    const plan = planLedProject({ products: catalog, runs: [] });
    expect(plan.bom).toHaveLength(0);
    expect(plan.questions.join(" ")).toContain("Нет ни одного участка");
  });
});

describe("C · BOM и версия правил", () => {
  it("каждая позиция объяснена и не имеет дробных штук", () => {
    const plan = planLedProject({ products: catalog, runs: [run({ meters: 12 })] });
    expect(plan.rulesVersion).toBe(LED_RULES_VERSION);
    expect(plan.bom.length).toBeGreaterThanOrEqual(3);
    for (const line of plan.bom) {
      expect(line.reason.length).toBeGreaterThan(10);
      if (line.unit === "pcs") expect(Number.isInteger(line.qty)).toBe(true);
    }
    const psu = plan.bom.find((line) => line.role === "psu");
    expect(psu?.reason).toContain("156");
    const controller = plan.bom.find((line) => line.role === "controller");
    expect(controller?.reason).toContain("А");
  });

  it("RF-контроллер тянет за собой пульт, Wi-Fi — нет", () => {
    const rfOnly = catalog.filter((item) => !/WIFI/i.test(item.name));
    const rf = planLedProject({ products: rfOnly, runs: [run({ meters: 6 })] });
    expect(rf.bom.some((line) => line.role === "remote")).toBe(true);

    const wifi = planLedProject({ products: catalog, runs: [run({ meters: 6 })] });
    expect(wifi.bom.some((line) => line.role === "remote")).toBe(false);
  });

  it("worstStatus не прячет несовместимость за «нужна проверка»", () => {
    expect(worstStatus(["ok", "needs_review"])).toBe("needs_review");
    expect(worstStatus(["needs_review", "incompatible"])).toBe("incompatible");
    expect(worstStatus(["ok"])).toBe("ok");
  });
});
