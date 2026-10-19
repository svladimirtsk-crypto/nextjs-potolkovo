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
import { resolvePriceBasis, stripSaleUnit } from "@/lib/lighting/led-price-basis";

export type LedRole = "strip" | "psu" | "controller" | "remote" | "controller-remote-kit";
/** Неизвестный режим не равен монохромному: одна температура К в названии не доказывает схему каналов. */
export type StripKind = "mono" | "cct" | "rgb" | "rgbw" | "rgb-cct" | "unknown";
export type ControlKind = "mono" | "cct" | "rgb" | "rgb-cct";

/** Совместимость режимов требует известного типа ленты; даже 5-в-1 не доказывает ток/каналы. */
export function controlKindForStrip(kind: StripKind): ControlKind | null {
  if (kind === "unknown") return null;
  if (kind === "rgbw" || kind === "rgb-cct") return "rgb-cct";
  return kind;
}

export type StripSpec = {
  voltage: number | null;
  wPerMeter: number | null;
  ledsPerMeter: number | null;
  kind: StripKind;
  /** Режим прочитан из заголовка или из настоящего паспорта; отсутствие поля у ручного spec не является доказательством. */
  modeEvidence?: "title_only" | "datasheet_verified" | "unknown";
  reelMeters: number | null;
  wattsPerReel: number | null;
  ampsPerReel: number | null;
  /** Световая температура из названия: «2700», «4200», «6500», «2700-6500». */
  cct: string | null;
  series: string | null;
};

export type PsuSpec = { voltage: number | null; watts: number | null; series: string | null };

export type ControllerSpec = {
  controlKind: ControlKind | null;
  /** Ток по названию (канал или суммарный — это зависит от модели и требует паспорта). */
  amps: number | null;
  /** Wi-Fi в названии (TUYA). RF-модели без него управляются только пультом. */
  wifi: boolean;
  /** Только явно заявленный 5-в-1/WB5/LM051; RGB+CCT как режим ещё не универсальность. */
  universal: boolean;
  voltageRange: string | null;
  model: string | null;
};

export type RemoteSpec = { controlKind: ControlKind | null; channels: number | null; model: string | null };

/** Отдельный продаваемый SKU: комплектность, pairing и лимиты доступны только после паспорта/стенда. */
export type ControlKitSpec = {
  controlKind: ControlKind | null;
  voltageRange: string | null;
  /** Число A из заголовка — порог консервативного отказа, НЕ подтверждённый общий/поканальный предел. */
  amps: number | null;
  /** «1 канал» в названии набора может означать RF-зону, НЕ число выходов ленты. */
  channels: number | null;
};

/**
 * Единица измерения позиции LED-группы.
 *
 * Фид не отдаёт `unit` вообще, и в витрине вся категория «Светодиодная лента»
 * пришла в метрах — включая пульты, контроллеры и блоки питания. Пульт за
 * «1 м» в корзине это ошибка: лента считается метражом, остальное — штуками.
 * Для ленты единица зависит от признака ценового базиса: `m` или целая катушка
 * (`pcs`). Сам фид не сообщает `priceUnit`; трактовка требует ответа EKS.
 */
export function ledUnitOf(product: LedIdentity): "m" | "pcs" {
  const role = ledRoleOf(product);
  if (role === "strip") {
    /*
     * T8-010 · Катушка — штука, а не метр. В фиде у лент стоит цена катушки
     * («…катушка 5 м ЧЗ» за 970 ₽), и если пометить её метрами, корзина
     * умножит цену катушки на метраж — ровно сценарий 02 приёмочной матрицы.
     */
    return stripSaleUnit(resolvePriceBasis(product as LedIdentity & { unit?: "m" | "pcs" }));
  }
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
  if (/5\s*[ВV]\s*1/.test(upper)) return "rgb-cct";
  if (upper.includes("RGB+CCT") || upper.includes("RGB + CCT")) return "rgb-cct";
  if (upper.includes("RGBW")) return "rgb-cct";
  if (upper.includes("RGB")) return "rgb";
  if (upper.includes("CCT")) return "cct";
  if (/МОНОХРОМ|МОНО(?![А-ЯA-Z])/.test(upper)) return "mono";
  return null;
}

function stripKindOf(name: string): StripKind {
  const upper = name.toUpperCase();
  if (upper.includes("RGBW")) return "rgbw";
  if (upper.includes("RGB+CCT") || upper.includes("RGB + CCT")) return "rgb-cct";
  if (upper.includes("RGB")) return "rgb";
  if (upper.includes("CCT")) return "cct";
  if (/МОНОХРОМ|МОНО(?![А-ЯA-Z])/.test(upper)) return "mono";
  // «2700К» — одна температура в названии, а не паспорт режима или распиновки.
  return "unknown";
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
  const kind = stripKindOf(name);
  const wattsPerReel = w !== null && reel !== null ? Math.round(w * reel * 10) / 10 : null;
  const ampsPerReel =
    wattsPerReel !== null && voltage ? Math.round((wattsPerReel / voltage) * 100) / 100 : null;
  return {
    voltage,
    wPerMeter: w,
    ledsPerMeter: leds ? Number(leds) : null,
    kind,
    modeEvidence: kind === "unknown" ? "unknown" : "title_only",
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
  const model = name.match(/\b(C\d{2}(?:RF)?|LM\d{3}|WB\d+)\b/i)?.[1] ?? null;
  return {
    controlKind: controlKindOf(name) ?? (/^(WB5|LM051)$/i.test(model ?? "") ? "rgb-cct" : null),
    amps: num(name.match(/(\d+(?:[.,]\d+)?)\s*A\b/i)?.[1]),
    wifi: /WIFI|WI-FI|ВАЙ-ФАЙ/i.test(name),
    universal: /5\s*[вv]\s*1/i.test(name) || /^(WB5|LM051)$/i.test(model ?? ""),
    voltageRange: voltage ? `${voltage[1]}-${voltage[2]}` : null,
    // «RF» — необязательный суффикс (C01, C02, C03 — Wi-Fi; C01RF, C02RF, C03RF — RF).
    model,
  };
}

/** Набор «пульт + контроллер»: всё ниже прочитано из названия, включая предполагаемый режим. */
export function parseControllerRemoteKit(name: string): ControlKitSpec | null {
  if (!KIT_NAME.test(name) && !(CONTROLLER_NAME.test(name) && /пульт/i.test(name))) return null;
  const voltage = name.match(/(\d{2})\s*-\s*(\d{2})\s*[ВV]/i);
  return {
    controlKind: controlKindOf(name),
    voltageRange: voltage ? `${voltage[1]}-${voltage[2]}` : null,
    amps: num(name.match(/(\d+(?:[.,]\d+)?)\s*A\b/i)?.[1]),
    channels: num(name.match(/(\d+)\s*канал/i)?.[1]),
  };
}

/**
 * Комплект выбирается только как ОДИН предварительный SKU, если по заголовку
 * нет явного противоречия. Не извлекаем из «6A*2» сумму 12 А или состав набора.
 */
export function checkControlKitForLoad(input: {
  spec: ControlKitSpec;
  kind: StripKind;
  voltage: number | null;
  currentA: number;
}): { ok: boolean; reason: string | null } {
  const { spec, kind, voltage, currentA } = input;
  const wanted = controlKindForStrip(kind);
  if (!wanted) return { ok: false, reason: "неизвестен режим/число каналов ленты" };
  if (wanted === "rgb-cct") return { ok: false, reason: "набор RGBW/RGB+CCT без доказанного 5-в-1 и распиновки не назначается" };
  if (!spec.controlKind || spec.controlKind !== wanted) return { ok: false, reason: "режим набора не совпадает с лентой или неизвестен" };
  if (voltage === null || !spec.voltageRange) return { ok: false, reason: "напряжение ленты или набора неизвестно" };
  const [from, to] = spec.voltageRange.split("-").map(Number);
  if (!Number.isFinite(from) || !Number.isFinite(to) || voltage < from || voltage > to) {
    return { ok: false, reason: `набор рассчитан на ${spec.voltageRange} В, лента ${voltage} В` };
  }
  if (!(spec.amps && spec.amps > 0 && currentA > 0)) return { ok: false, reason: "неизвестен ток ленты или набора" };
  if (currentA > spec.amps) return { ok: false, reason: `${currentA} А превышает консервативный порог ${spec.amps} А из названия набора` };
  return { ok: true, reason: null }; // не паспортная совместимость, а лишь отсутствие явного противоречия.
}

export function parseRemoteSpec(name: string): RemoteSpec | null {
  if (!/пульт/i.test(name) || KIT_NAME.test(name)) return null;
  return {
    controlKind: controlKindOf(name),
    channels: num(name.match(/(\d+)\s*канал/i)?.[1]),
    model: name.match(/\b(RC\d{2}RF)\b/i)?.[1] ?? null,
  };
}

/**
 * LED-13 · Только предварительный кандидат по НАЗВАНИЮ семейства, не pairing.
 * Совпадение C01RF ↔ RC01RF (и 02/03) не доказывает частоту/протокол/ревизию.
 * В BOM и UI такую пару помечаем `needs_review` до паспорта или стенда.
 */
export function rfRemoteTitleCandidate(controller: ControllerSpec, remote: RemoteSpec): boolean {
  const family = controller.model?.toUpperCase().match(/^C(0[123])RF$/);
  return !controller.wifi && Boolean(family) && controller.controlKind !== null &&
    remote.model?.toUpperCase() === `RC${family?.[1]}RF` && controller.controlKind === remote.controlKind;
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
  return spec.universal && spec.controlKind === UNIVERSAL_CONTROL_KIND;
}

/**
 * Пределы контроллера, которые известны не из названия, а с этикетки/фото
 * изделия. Название даёт только суммарный ток («C01RF 12A»), а инженеру нужен
 * предел КАЖДОГО канала и ограничение используемого входа — при общем запасе
 * один канал или круглый разъём легко перегрузить.
 *
 * Статус данных — `label_observed`: это прочитанное на корпусе, а не паспорт
 * партии. Поэтому такие цифры дают право отклонить заведомо негодную пару, но
 * не заменяют паспортную библиотеку (T8-010/011/012).
 */
export type ControllerLimit = {
  /** Предел одного канала; `null` — неизвестен, проверять нечем. */
  channelAmps: number | null;
  /** Суммарный предел выходов; `null` — берём из названия. */
  totalAmps: number | null;
  /** Ограничение круглого входа (у C01RF — 5 А при 12 А по выходам). */
  inputRoundAmps: number | null;
  evidence: "label_observed" | "name_only";
  source: string | null;
};

export const CONTROLLER_LIMITS: Record<string, ControllerLimit> = {
  // WB5: DC12-24 В, 6 А на канал, 15 А суммарно (фото этикетки EKS).
  WB5: {
    channelAmps: 6,
    totalAmps: 15,
    inputRoundAmps: null,
    evidence: "label_observed",
    source: "https://eksmarket.ru/upload/iblock/9cd/kz1vnfnfhkisikl1fhyw2u0nrtbjb081.png",
  },
  // C01RF: 12 А по выходам, но 6 А на канал и 5 А на круглом входе.
  C01RF: {
    channelAmps: 6,
    totalAmps: 12,
    inputRoundAmps: 5,
    evidence: "label_observed",
    source: "https://eksmarket.ru/upload/iblock/086/risssu9u24wvgggs1e6bk1td18yxb36l.png",
  },
};

/** Сколько независимых каналов занимает лента данного типа. */
export function activeChannelsOf(kind: StripKind | ControlKind): number {
  switch (kind) {
    case "mono":
      return 1;
    case "cct":
      return 2;
    case "rgb":
      return 3;
    case "rgbw":
      return 4;
    case "rgb-cct":
      return 5;
    case "unknown":
      return 0; // неизвестность не является нулём каналов: checkControllerForLoad отклонит такой вызов.
  }
}

/** Пределы модели: известные с этикетки либо выведенные из названия. */
export function controllerLimitOf(spec: ControllerSpec): ControllerLimit {
  const known = spec.model ? CONTROLLER_LIMITS[spec.model.toUpperCase()] : undefined;
  if (known) return known;
  return {
    channelAmps: null,
    totalAmps: spec.amps,
    inputRoundAmps: null,
    evidence: "name_only",
    source: null,
  };
}

/**
 * Почему контроллер не годится для этой нагрузки.
 *
 * Проверки идут от жёстких к мягким: несовпадение напряжения, перегруз выхода,
 * гарантированный перегруз канала. «Мягкое» ограничение круглого входа
 * возвращается отдельно как предупреждение — у той же модели есть винтовой вход.
 */
export type ControllerCheck = {
  ok: boolean;
  /** Причина отказа для человека; `null`, если контроллер проходит. */
  reason: string | null;
  warnings: string[];
};

export function checkControllerForLoad(input: {
  spec: ControllerSpec;
  voltage: number | null;
  currentA: number;
  channels: number;
}): ControllerCheck {
  const { spec, voltage, currentA, channels } = input;
  const limit = controllerLimitOf(spec);
  const warnings: string[] = [];
  if (!(channels > 0)) return { ok: false, reason: "неизвестен режим/число каналов ленты", warnings };

  if (voltage !== null && spec.voltageRange) {
    const [from, to] = spec.voltageRange.split("-").map(Number);
    if (Number.isFinite(from) && Number.isFinite(to) && (voltage < from || voltage > to)) {
      return {
        ok: false,
        reason: `рассчитан на ${spec.voltageRange} В, а лента ${voltage} В`,
        warnings,
      };
    }
  }

  const total = limit.totalAmps;
  if (total !== null && currentA > total) {
    return {
      ok: false,
      reason: `ток ${Math.round(currentA * 100) / 100} А больше суммарного предела ${total} А`,
      warnings,
    };
  }

  /*
   * Поканальная проверка: при равномерном распределении на канал приходится
   * `I / N`. Если даже эта величина превышает предел канала, значит хотя бы
   * один канал перегружен при любом распределении — отказ безусловный.
   * Неравномерную раскладку без паспорта не додумываем.
   */
  const channel = limit.channelAmps;
  if (channel !== null && channels > 0) {
    const perChannel = currentA / channels;
    if (perChannel > channel) {
      return {
        ok: false,
        reason: `на канал приходится ${Math.round(perChannel * 100) / 100} А при пределе ${channel} А`,
        warnings,
      };
    }
  }

  if (limit.inputRoundAmps !== null && currentA > limit.inputRoundAmps) {
    warnings.push(
      `Ток ${Math.round(currentA * 100) / 100} А больше ${limit.inputRoundAmps} А, допустимых для круглого входа: нужен винтовой вход или другая модель.`
    );
  }
  if (limit.evidence === "label_observed") {
    warnings.push("Пределы каналов взяты с этикетки изделия, а не из паспорта партии.");
  }

  return { ok: true, reason: null, warnings };
}

export type PowerPlanOption<T> = { product: FeedCatalogProduct; spec: T };

export type PowerPlan = {
  /** Геометрия конструкции (без рядов). */
  meters: number;
  /** Число рядов ленты: 6 м линии в два ряда — это 12 м нагрузки. */
  rows: number;
  /** Установленная длина ленты: `meters × rows`. */
  installedMeters: number;
  loadW: number;
  requiredW: number;
  currentA: number;
  marginPercent: number;
  psu: PowerPlanOption<PsuSpec> | null;
  controller: PowerPlanOption<ControllerSpec> | null;
  /** Один kit SKU вместо отдельного контроллера и пульта: состав по названию НЕ проверен. */
  controlKit: PowerPlanOption<ControlKitSpec> | null;
  /** Универсальная модель (5-в-1), если режим известен; по току и каналам нужен паспорт. */
  universalController: PowerPlanOption<ControllerSpec> | null;
  /** Подобранный контроллер под конкретный тип ленты или универсальный. */
  controllerScope: "kind" | "universal" | null;
  remote: PowerPlanOption<RemoteSpec> | null;
  status: "ok" | "needs_review" | "incompatible";
  warnings: string[];
  /** Кандидаты, отклонённые по инженерным пределам, — с причиной для человека. */
  rejectedControllers: { name: string; reason: string }[];
  rejectedKits: { name: string; reason: string }[];
  rejectedPsus: { name: string; reason: string }[];
};

/** Запас по мощности блока питания. Значение утверждено владельцем 16.10.2026. */
export const PSU_MARGIN_PERCENT = 30;

/** Нагрузку, требуемую мощность и ток округляем ВВЕРХ до сотых при подборе. */
export function roundUpHundredth(value: number): number {
  if (value === 0) return 0; // не отдавать -0 для неизвестной нагрузки
  return Math.ceil(value * 100 - 1e-9) / 100;
}

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
  /** Длина конструкции в метрах (без рядов). */
  meters: number;
  /** Число рядов ленты; по умолчанию 1. 6 м в два ряда = 12 м нагрузки. */
  rows?: number;
  products: readonly FeedCatalogProduct[];
}): PowerPlan {
  const { strip, meters, products } = input;
  const rows = Number.isFinite(input.rows) && (input.rows ?? 0) > 0 ? Math.floor(input.rows as number) : 1;
  const warnings: string[] = [];
  const rejectedControllers: { name: string; reason: string }[] = [];
  const rejectedKits: { name: string; reason: string }[] = [];
  const rejectedPsus: { name: string; reason: string }[] = [];

  const wPerMeter = strip.wPerMeter;
  const voltage = strip.voltage;
  /*
   * Нагрузка считается по УСТАНОВЛЕННОЙ длине: два ряда по 6 м — это 12 м
   * ленты, а не 6. Закупочные катушки и остатки в нагрузку не входят.
   */
  const installedMeters = Number.isFinite(meters) && meters > 0 ? meters * rows : 0;
  const rawLoadW = wPerMeter !== null ? wPerMeter * installedMeters : 0;
  const loadW = roundUpHundredth(rawLoadW);
  // LED-08: сравнение с номиналом не должно выбрать БП на 100 Вт при
  // истинной границе 100,02 Вт из-за округления до 0,1 Вт вниз.
  const requiredW = roundUpHundredth(rawLoadW * (1 + PSU_MARGIN_PERCENT / 100));
  const currentA = wPerMeter !== null && voltage ? roundUpHundredth(rawLoadW / voltage) : 0;

  if (wPerMeter === null || voltage === null) {
    warnings.push("Мощность или напряжение ленты не подтверждены — расчёт невозможен без паспорта.");
  }

  const psuOptions: Array<PowerPlanOption<PsuSpec>> = [];
  const controllerOptions: Array<PowerPlanOption<ControllerSpec>> = [];
  const remoteOptions: Array<PowerPlanOption<RemoteSpec>> = [];
  const kitOptions: Array<PowerPlanOption<ControlKitSpec>> = [];

  for (const product of products) {
    const role = ledRoleOf(product);
    if (role === "psu") {
      const spec = parsePsuSpec(product.name);
      if (spec) psuOptions.push({ product, spec }); // без W модель нельзя выбрать, но её U учитывается в причине отказа.
    } else if (role === "controller") {
      const spec = parseControllerSpec(product.name);
      if (spec) controllerOptions.push({ product, spec });
    } else if (role === "remote") {
      const spec = parseRemoteSpec(product.name);
      if (spec) remoteOptions.push({ product, spec });
    } else if (role === "controller-remote-kit") {
      const spec = parseControllerRemoteKit(product.name);
      if (spec) kitOptions.push({ product, spec });
    }
  }

  /*
   * Блок питания обязан совпасть по напряжению: 24 В лента не питается от 48 В
   * блока (и наоборот). Раньше несовпадающие просто отбрасывались молча —
   * теперь причина попадает в список отказов, чтобы её можно было объяснить.
   */
  const suitablePsus = psuOptions.filter((option) => {
    if (voltage !== null && option.spec.voltage === voltage) return true;
    rejectedPsus.push({
      name: option.product.name,
      reason: voltage === null || option.spec.voltage === null
        ? "напряжение ленты или БП не указано — совпадение не доказано"
        : `выход ${option.spec.voltage} В не совпадает с лентой ${voltage} В`,
    });
    return false;
  });
  const wrongVoltageOnly = voltage !== null && psuOptions.length > 0 &&
    psuOptions.every((option) => option.spec.voltage !== null && option.spec.voltage !== voltage);

  /*
   * Порядок: сначала по мощности, затем по цене. Сначала находим минимальную
   * мощность, которой хватает, и только внутри неё выбираем дешёвую серию —
   * иначе «СТАНДАРТ 200» и «ПРО 200» решались бы порядком в фиде.
   */
  const enough = suitablePsus.filter((option) => (option.spec.watts ?? 0) >= requiredW);
  enough.sort(
    (a, b) => (a.spec.watts ?? 0) - (b.spec.watts ?? 0) || a.product.priceRub - b.product.priceRub
  );
  // Без метража нагрузки нет: подставлять «самый дешёвый БП» было бы выдумкой.
  const psu = wPerMeter === null || wPerMeter <= 0 || !(installedMeters > 0) ? null : enough[0] ?? null;
  if (wPerMeter !== null && installedMeters > 0 && !psu) {
    warnings.push(wrongVoltageOnly
      ? `Все БП каталога имеют напряжение, несовместимое с лентой ${voltage} В: эту цепь нельзя собирать из данных позиций.`
      : `Среди БП нет позиции на ${requiredW} Вт с подтверждённым совпадением напряжения — требуется подбор по паспорту/другая схема.`);
    for (const item of rejectedPsus) warnings.push(`Отклонён ${item.name}: ${item.reason}.`);
  }

  const wantedControl = controlKindForStrip(strip.kind);
  const channels = activeChannelsOf(strip.kind);

  /*
   * Каждый кандидат проходит инженерную проверку: напряжение, суммарный ток,
   * гарантированный перегруз канала. Отклонённые не исчезают — их причина
   * сохраняется для объяснения человеку («C01RF отклонён: 8.33 А на канале»).
   */
  const viable: Array<{ option: PowerPlanOption<ControllerSpec>; warnings: string[] }> = [];
  if (wantedControl && currentA > 0 && voltage !== null) {
    for (const option of controllerOptions) {
      const check = checkControllerForLoad({ spec: option.spec, voltage, currentA, channels });
      if (check.ok) viable.push({ option, warnings: check.warnings });
      else rejectedControllers.push({ name: option.product.name, reason: check.reason ?? "не подходит" });
    }
  }

  const bySuitability = (
    a: PowerPlanOption<ControllerSpec>,
    b: PowerPlanOption<ControllerSpec>
  ) =>
    (b.spec.amps ?? 0) - (a.spec.amps ?? 0) ||
    Number(b.spec.wifi) - Number(a.spec.wifi) ||
    a.product.priceRub - b.product.priceRub;

  const exactMatches = viable
    .map((entry) => ({ option: entry.option, warnings: entry.warnings }))
    .filter((entry) => wantedControl !== "rgb-cct" && entry.option.spec.controlKind === wantedControl && !isUniversalController(entry.option.spec))
    .sort((a, b) => bySuitability(a.option, b.option));
  const universalOptions = viable
    .map((entry) => ({ option: entry.option, warnings: entry.warnings }))
    .filter((entry) => isUniversalController(entry.option.spec))
    .sort((a, b) => bySuitability(a.option, b.option));

  const chosen = exactMatches[0] ?? universalOptions[0] ?? null;
  const controller = chosen?.option ?? null;
  const universalController = universalOptions[0]?.option ?? null;
  const controllerScope: "kind" | "universal" | null =
    controller === null ? null : isUniversalController(controller.spec) ? "universal" : "kind";

  if (chosen) {
    for (const warning of chosen.warnings) if (!warnings.includes(warning)) warnings.push(warning);
  }

  let controlKit: PowerPlanOption<ControlKitSpec> | null = null;
  if (!controller && wantedControl && currentA > 0 && voltage !== null) {
    for (const option of kitOptions) {
      const check = checkControlKitForLoad({ spec: option.spec, kind: strip.kind, voltage, currentA });
      if (check.ok && !controlKit) controlKit = option;
      else if (!check.ok) rejectedKits.push({ name: option.product.name, reason: check.reason ?? "не подходит" });
    }
  }

  if (strip.kind === "unknown") {
    warnings.push("Режим/число каналов ленты не указаны: ни монохром, ни 5-в-1, ни набор автоматически не назначаются. Нужен паспорт ленты.");
  } else if (!controller && !controlKit) {
    warnings.push(
      strip.kind === "rgbw" || strip.kind === "rgb-cct"
        ? "Для RGBW/RGB+CCT нужен 5-в-1 контроллер: подходящей по пределам позиции в текущем наборе нет, подбор по паспорту."
        : "Контроллер или набор, который проходит предварительные ограничения по току и напряжению, не найден — подбор по паспорту."
    );
    for (const item of rejectedKits) warnings.push(`Набор ${item.name} отклонён: ${item.reason}.`);
  }
  if (controlKit) {
    warnings.push(`Набор ${controlKit.product.name} — один кандидат по заголовку, не доказанный состав: паспорт/стенд нужны для содержимого, токов каналов и сопряжения; отдельный пульт не добавлен.`);
  }

  const remote =
    controller && !controller.spec.wifi
      ? remoteOptions.find((option) => rfRemoteTitleCandidate(controller.spec, option.spec)) ?? null
      : null;
  if (controller && !controller.spec.wifi) {
    warnings.push(remote
      ? `Пульт ${remote.spec.model ?? "?"} — кандидат по номеру семейства ${controller.spec.model ?? "?"}; совместимость и сопряжение не подтверждены паспортом/стендом.`
      : `Для RF-контроллера ${controller.spec.model ?? "?"} нет пульта с совпадающим семейством; подбирать по одному типу ленты нельзя.`);
  }

  if (strip.kind === "rgbw" || strip.kind === "rgb-cct") {
    warnings.push("Каналы W белого и полная нагрузка проверяются по паспорту: 5-в-1 по названию этого не доказывает.");
  }
  if (psu || controller) {
    warnings.push(`${psu && controller ? "БП и управление выбраны" : psu ? "БП выбран" : "Управление выбрано"} предварительно по названиям: паспорт, схема и реальные токи требуются перед заказом.`);
  }

  return {
    meters,
    rows,
    installedMeters,
    loadW,
    requiredW,
    currentA,
    marginPercent: PSU_MARGIN_PERCENT,
    psu,
    controller,
    controlKit,
    universalController,
    controllerScope,
    remote,
    status: wrongVoltageOnly && !psu && requiredW > 0 ? "incompatible" : warnings.length === 0 ? "ok" : "needs_review",
    warnings,
    rejectedControllers,
    rejectedKits,
    rejectedPsus,
  };
}
