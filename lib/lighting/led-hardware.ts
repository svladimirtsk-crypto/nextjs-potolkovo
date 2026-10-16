/**
 * LED-группа: роли позиций и расчёт питания по метражу.
 *
 * Зачем отдельный модуль. В витрине все 72 позиции группы «Светодиодная лента»
 * помечены как лента (`kind=LED_STRIP`), включая блоки питания, контроллеры,
 * пульты и наборы, и стоят в метрах. Из-за этого «подбор БП по метражу» считал
 * бы пульт погонным метром, а ленту — штукой.
 *
 * Здесь роль и характеристики определяются по названию (единственный источник:
 * на карточках EKS, кроме штрихкода и термостойкости, полей нет) и приводятся к
 * инженерным величинам: напряжение, Вт/м, Вт/катушка, ток, тип управления.
 *
 * Статус данных — «название, не паспорт». Трактовка «W в названии = Вт/м»
 * обоснована согласованностью Вт/диод (≈0,089–0,094) между сериями и стандартом
 * 24 В 5050 для RGB 14,4 Вт/м, но остаётся расчётной: см.
 * docs/evidence/catalog-led/led-strip-profiles.json. Поэтому расчёт питания —
 * предварительный и всегда помечается как требующий проверки.
 */
import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";

export type LedRole = "strip" | "psu" | "controller" | "remote" | "controller-remote-kit";
export type StripKind = "mono" | "cct" | "rgb" | "rgbw" | "rgb-cct";
export type ControlKind = "mono" | "cct" | "rgb" | "rgb-cct";

export type StripSpec = {
  voltage: number | null;
  wPerMeter: number | null;
  ledsPerMeter: number | null;
  kind: StripKind;
  reelMeters: number | null;
  wattsPerReel: number | null;
  ampsPerReel: number | null;
  /** Световая температура из названия: «2700», «4200», «6500», «2700-6500». */
  cct: string | null;
  series: string | null;
};

export type PsuSpec = { voltage: number | null; watts: number | null; series: string | null };

export type ControllerSpec = {
  controlKind: ControlKind;
  /** Ток по названию (канал или суммарный — это зависит от модели и требует паспорта). */
  amps: number | null;
  /** Wi-Fi в названии (TUYA). RF-модели без него управляются только пультом. */
  wifi: boolean;
  voltageRange: string | null;
  model: string | null;
};

export type RemoteSpec = { controlKind: ControlKind; channels: number | null; model: string | null };

/**
 * Единица измерения позиции LED-группы.
 *
 * Фид не отдаёт `unit` вообще, и в витрине вся категория «Светодиодная лента»
 * пришла в метрах — включая пульты, контроллеры и блоки питания. Пульт за
 * «1 м» в корзине это ошибка: лента считается метражом, остальное — штуками.
 * Для ленты метры оставляем: цена в фиде за метр, а катушка 5 м нужна для
 * округления метража вверх.
 */
export function ledUnitOf(product: LedIdentity): "m" | "pcs" {
  const role = ledRoleOf(product);
  if (role === "strip") return "m";
  if (role !== null) return "pcs";
  return product.unit === "m" ? "m" : "pcs";
}

export type LedIdentity = Pick<FeedCatalogProduct, "name"> & Partial<Pick<FeedCatalogProduct, "kind" | "categoryPath" | "unit">>;

const num = (value: string | undefined): number | null => {
  if (!value) return null;
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/** «24V» и «24 В» — одно и то же; берём первое двузначное напряжение. */
function voltageOf(name: string): number | null {
  const m = name.match(/(\d{2})\s*V/i) ?? name.match(/(\d{2})\s*В/i);
  return m ? Number(m[1]) : null;
}

function controlKindOf(name: string): ControlKind | null {
  const upper = name.toUpperCase();
  if (upper.includes("5В1") || upper.includes("5 В 1")) return "rgb-cct";
  if (upper.includes("RGBW")) return "rgb-cct";
  if (upper.includes("RGB")) return "rgb";
  if (upper.includes("CCT")) return "cct";
  if (/МОНОХРОМ|МОНО\b/.test(upper)) return "mono";
  return null;
}

function stripKindOf(name: string): StripKind {
  const upper = name.toUpperCase();
  if (upper.includes("RGBW")) return "rgbw";
  if (upper.includes("RGB+CCT") || upper.includes("RGB + CCT")) return "rgb-cct";
  if (upper.includes("RGB")) return "rgb";
  if (upper.includes("CCT")) return "cct";
  return "mono";
}

export function parseStripSpec(name: string): StripSpec | null {
  if (!/светодиодная лента/i.test(name)) return null;
  const voltage = voltageOf(name);
  const w = num(name.match(/(\d+(?:[.,]\d+)?)\s*W/i)?.[1]);
  const leds = name.match(/(\d+)\s*диод/i)?.[1];
  // В витрине «катушка 5 м», в выгрузке поставщика — «… 2700К 5 м». Длина катушки
  // нужна для округления метража вверх, поэтому читаем оба написания.
  const reel =
    num(name.match(/катушка\s*(\d+(?:[.,]\d+)?)\s*м/i)?.[1]) ??
    num(name.match(/(\d+(?:[.,]\d+)?)\s*м\s*$/)?.[1]);
  const cct =
    name.match(/(\d{4}-\d{4})\s*K?К?/i)?.[1] ??
    // Кириллическая «К» не входит в \w, поэтому \b после неё не срабатывает —
    // границу проверяем отрицательным просмотром вперёд.
    name.match(/(\d{4})\s*[КK](?![А-Яа-яA-Za-z])/)?.[1] ??
    null;
  const series = name.match(/(СТАНДАРТ|ПРО|ПРОФИ)\s*\d+/i)?.[0] ?? null;
  const wattsPerReel = w !== null && reel !== null ? Math.round(w * reel * 10) / 10 : null;
  const ampsPerReel =
    wattsPerReel !== null && voltage ? Math.round((wattsPerReel / voltage) * 100) / 100 : null;
  return {
    voltage,
    wPerMeter: w,
    ledsPerMeter: leds ? Number(leds) : null,
    kind: stripKindOf(name),
    reelMeters: reel,
    wattsPerReel,
    ampsPerReel,
    cct,
    series,
  };
}

export function parsePsuSpec(name: string): PsuSpec | null {
  if (!/блок питания/i.test(name)) return null;
  return {
    voltage: voltageOf(name),
    watts: num(name.match(/(\d+(?:[.,]\d+)?)\s*W/i)?.[1]),
    series: name.match(/(СТАНДАРТ|ПРО|ПРОФИ|МИНИ)/i)?.[0] ?? null,
  };
}

export function parseControllerSpec(name: string): ControllerSpec | null {
  if (!CONTROLLER_NAME.test(name)) return null;
  const voltage = name.match(/(\d{2})\s*-\s*(\d{2})\s*[ВV]/i);
  return {
    controlKind: controlKindOf(name) ?? "mono",
    amps: num(name.match(/(\d+(?:[.,]\d+)?)\s*A\b/i)?.[1]),
    wifi: /WIFI|WI-FI|ВАЙ-ФАЙ/i.test(name),
    voltageRange: voltage ? `${voltage[1]}-${voltage[2]}` : null,
    // «RF» — необязательный суффикс (C01, C02, C03 — Wi-Fi; C01RF, C02RF, C03RF — RF).
    model: name.match(/\b(C\d{2}(?:RF)?|LM\d{3}|WB\d+)\b/i)?.[1] ?? null,
  };
}

/** Набор «пульт + контроллер»: ток из названия (6 А), каналы уточняются по паспорту. */
export function parseControllerRemoteKit(name: string): { amps: number | null; channels: number | null } | null {
  if (!KIT_NAME.test(name) && !(CONTROLLER_NAME.test(name) && /пульт/i.test(name))) return null;
  return {
    amps: num(name.match(/(\d+(?:[.,]\d+)?)\s*A\b/i)?.[1]),
    channels: num(name.match(/(\d+)\s*канал/i)?.[1]),
  };
}

export function parseRemoteSpec(name: string): RemoteSpec | null {
  if (!/пульт/i.test(name) || KIT_NAME.test(name)) return null;
  return {
    controlKind: controlKindOf(name) ?? "mono",
    channels: num(name.match(/(\d+)\s*канал/i)?.[1]),
    model: name.match(/\b(RC\d{2}RF)\b/i)?.[1] ?? null,
  };
}

/**
 * Роль позиции внутри LED-группы.
 *
 * Порядок важен: набор «пульт с контроллером» — это управление целиком, а не
 * лента и не отдельный пульт; пульт и контроллер идут до блока питания и ленты.
 */
/** В фиде встречается и «контроллер», и «контролер» — учитываем оба написания. */
const KIT_NAME = /пульт\s+с\s+контрол+ер/i;
const CONTROLLER_NAME = /контрол+ер/i;

export function ledRoleOf(product: LedIdentity): LedRole | null {
  const name = String(product.name ?? "");
  // Границы группы. В витрине вся категория «Светодиодная лента» помечена как
  // LED_STRIP — включая блоки питания, контроллеры и пульты. Но у `kind=PSU` и
  // `kind=CONTROL` есть позиции и в других разделах (закладные, треки): считать
  // их комплектующими подсветки нельзя, иначе в «Питание» попадут чужие блоки.
  const inLedGroup = product.kind === "LED_STRIP" || /светодиодная лента/i.test(product.categoryPath ?? "");
  if (!inLedGroup) return null;
  if (KIT_NAME.test(name)) return "controller-remote-kit";
  if (CONTROLLER_NAME.test(name) && /пульт/i.test(name)) return "controller-remote-kit";
  if (/пульт/i.test(name)) return "remote";
  if (CONTROLLER_NAME.test(name)) return "controller";
  if (/блок питания/i.test(name)) return "psu";
  if (/светодиодная лента/i.test(name)) return "strip";
  return null;
}

/** Wi-Fi-контроллеры управляются со смартфона; работа с Алисой подтверждена владельцем на его комплекте. */
export function isAliceCapable(spec: ControllerSpec): boolean {
  return spec.wifi;
}

/**
 * 5-в-1 — универсальный контроллер: один и тот же работает с монохромом, CCT,
 * RGB, RGBW и RGB+CCT. Владелец подтвердил 16.10.2026, что Wi-Fi 5-в-1 (WB5)
 * работает со всеми лентами его ассортимента.
 *
 * Это подтверждение про **поддержку режимов**, а не про мощность: ток, полную
 * нагрузку и белый канал сверяем по паспорту.
 */
export const UNIVERSAL_CONTROL_KIND: ControlKind = "rgb-cct";

export function isUniversalController(spec: ControllerSpec): boolean {
  return spec.controlKind === UNIVERSAL_CONTROL_KIND;
}

export type PowerPlanOption<T> = { product: FeedCatalogProduct; spec: T };

export type PowerPlan = {
  meters: number;
  loadW: number;
  requiredW: number;
  currentA: number;
  marginPercent: number;
  psu: PowerPlanOption<PsuSpec> | null;
  controller: PowerPlanOption<ControllerSpec> | null;
  /** Универсальная модель (5-в-1), если она есть в каталоге: подходит любой ленте. */
  universalController: PowerPlanOption<ControllerSpec> | null;
  /** Подобранный контроллер под конкретный тип ленты или универсальный. */
  controllerScope: "kind" | "universal" | null;
  remote: PowerPlanOption<RemoteSpec> | null;
  status: "ok" | "needs_review";
  warnings: string[];
};

/** Запас по мощности блока питания. Значение утверждено владельцем 16.10.2026. */
export const PSU_MARGIN_PERCENT = 30;

/**
 * Расчёт питания по метражу: мощность нагрузки → требуемая мощность БП с запасом
 * → минимальный подходящий БП → контроллер по типу ленты → пульт для RF.
 *
 * Ничего не «добавляет в корзину»: это предварительная оценка, у неё всегда
 * есть пометка о проверке. Если данных не хватает (нет Вт/м, нет подходящего
 * БП или контроллера), статус `needs_review`, а не выдуманная позиция.
 */
export function planLedPower(input: {
  strip: StripSpec;
  meters: number;
  products: readonly FeedCatalogProduct[];
}): PowerPlan {
  const { strip, meters, products } = input;
  const warnings: string[] = [];

  const wPerMeter = strip.wPerMeter;
  const voltage = strip.voltage;
  const loadW = wPerMeter !== null ? Math.round(wPerMeter * meters * 10) / 10 : 0;
  const requiredW = wPerMeter !== null ? Math.round(loadW * (1 + PSU_MARGIN_PERCENT / 100) * 10) / 10 : 0;
  const currentA = wPerMeter !== null && voltage ? Math.round((loadW / voltage) * 100) / 100 : 0;

  if (wPerMeter === null || voltage === null) {
    warnings.push("Мощность или напряжение ленты не подтверждены — расчёт невозможен без паспорта.");
  }

  const psuOptions: Array<PowerPlanOption<PsuSpec>> = [];
  const controllerOptions: Array<PowerPlanOption<ControllerSpec>> = [];
  const remoteOptions: Array<PowerPlanOption<RemoteSpec>> = [];

  for (const product of products) {
    const role = ledRoleOf(product);
    if (role === "psu") {
      const spec = parsePsuSpec(product.name);
      if (spec?.watts !== null && spec?.watts !== undefined) {
        if (voltage === null || spec.voltage === null || spec.voltage === voltage) {
          psuOptions.push({ product, spec });
        }
      }
    } else if (role === "controller") {
      const spec = parseControllerSpec(product.name);
      if (spec) controllerOptions.push({ product, spec });
    } else if (role === "remote") {
      const spec = parseRemoteSpec(product.name);
      if (spec) remoteOptions.push({ product, spec });
    }
  }

  /*
   * Порядок: сначала по мощности, затем по цене. Сначала находим минимальную
   * мощность, которой хватает, и только внутри неё выбираем дешёвую серию —
   * иначе «СТАНДАРТ 200» и «ПРО 200» решались бы порядком в фиде.
   */
  const enough = psuOptions.filter((option) => (option.spec.watts ?? 0) >= requiredW);
  enough.sort(
    (a, b) => (a.spec.watts ?? 0) - (b.spec.watts ?? 0) || a.product.priceRub - b.product.priceRub
  );
  // Без метража нагрузки нет: подставлять «самый дешёвый БП» было бы выдумкой.
  const psu = wPerMeter === null || wPerMeter <= 0 || !(meters > 0) ? null : enough[0] ?? null;
  if (wPerMeter !== null && !psu) {
    warnings.push(
      `Среди доступных блоков питания нет позиции на ${requiredW} Вт и выше — нужен расчёт по нескольким БП или уточнение нагрузки.`
    );
  }

  const wantedControl: ControlKind | null =
    strip.kind === "mono" ? "mono" : strip.kind === "cct" ? "cct" : strip.kind === "rgb" ? "rgb" : "rgb-cct";

  /*
   * Порядок выбора: сначала модель под конкретный тип ленты, потом универсальный
   * 5-в-1. Внутри каждой группы — по току, при равном токе Wi-Fi (ей не нужен
   * пульт, и владелец подтвердил работу Wi-Fi-контроллеров с Алисой), затем по
   * цене. Для RGBW и RGB+CCT точного соответствия нет: их тип и есть 5-в-1.
   */
  const bySuitability = (a: PowerPlanOption<ControllerSpec>, b: PowerPlanOption<ControllerSpec>) =>
    (b.spec.amps ?? 0) - (a.spec.amps ?? 0) ||
    Number(b.spec.wifi) - Number(a.spec.wifi) ||
    a.product.priceRub - b.product.priceRub;

  const exactMatches = controllerOptions
    .filter((option) => option.spec.controlKind === wantedControl && !isUniversalController(option.spec))
    .sort(bySuitability);
  const universalOptions = controllerOptions.filter((option) => isUniversalController(option.spec)).sort(bySuitability);
  const controller = exactMatches[0] ?? universalOptions[0] ?? null;
  const universalController = universalOptions[0] ?? null;
  const controllerScope: "kind" | "universal" | null =
    controller === null ? null : isUniversalController(controller.spec) ? "universal" : "kind";

  if (!controller) {
    warnings.push(
      strip.kind === "rgbw" || strip.kind === "rgb-cct"
        ? "Для RGBW/RGB+CCT нужен 5-в-1 контроллер: соответствующей позиции в текущем наборе нет, подбор по паспорту."
        : "Контроллер под тип ленты в текущем наборе не найден — подбор по паспорту."
    );
  } else if (currentA > 0 && controller.spec.amps !== null && currentA > controller.spec.amps) {
    warnings.push(
      `Ток нагрузки ${currentA} А превышает заявленный ток контроллера ${controller.spec.amps} А — нужен расчёт по каналам или несколько контроллеров.`
    );
  }

  const remote = controller && !controller.spec.wifi
    ? remoteOptions.filter((option) => option.spec.controlKind === wantedControl)[0] ?? null
    : null;
  if (controller && !controller.spec.wifi && !remote) {
    warnings.push("Для RF-контроллера пульт соответствующего типа в наборе не найден.");
  }

  if (strip.kind === "rgbw" || strip.kind === "rgb-cct") {
    warnings.push("Каналы W белого и полная нагрузка проверяются по паспорту: 5-в-1 по названию этого не доказывает.");
  }

  return {
    meters,
    loadW,
    requiredW,
    currentA,
    marginPercent: PSU_MARGIN_PERCENT,
    psu,
    controller,
    universalController,
    controllerScope,
    remote,
    status: warnings.length === 0 ? "ok" : "needs_review",
    warnings,
  };
}
