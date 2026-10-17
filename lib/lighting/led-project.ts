/**
 * Часть C · Инженерная модель проекта: `Room → Feature → StripRun` и отдельно
 * `ControlZone` / `PowerCircuit` с объяснимым составом (BOM).
 *
 * Зачем отдельный слой. В каталоге уже есть подбор по метражу, но он считает
 * один отрезок ленты. Реальный объект состоит из нескольких участков (парящий
 * контур, световые линии, карниз), у каждого может быть несколько рядов ленты,
 * участки объединяются в независимо управляемые зоны, а зоны питаются от
 * цепей с блоками питания. Пока эта структура не выражена в данных, нельзя ни
 * проверить пределы контроллера по зоне, ни объяснить, откуда взялась каждая
 * позиция.
 *
 * Что здесь соблюдается из ТЗ (`docs/current/CATALOG-LED-TZ.md`, §5–§6):
 *  - нагрузка считается по УСТАНОВЛЕННОЙ длине: 6 м линии в два ряда — это
 *    12 м ленты, а не 6; закупочные катушки и остатки в нагрузку не входят;
 *  - `P_led = Σ(L × rows × p_max)`, `P_required = P_led × (1 + K)`, где
 *    `K = 30 %` — запас, утверждённый владельцем 16.10.2026;
 *  - блок питания проверяется по напряжению и нагрузке, контроллер — по
 *    суммарному току, по гарантированному току канала и по ограничению входа;
 *  - зоны и цепи не смешиваются: одна зона — один контроллер; цепь 24 В и
 *    цепь 48 В не делят блок питания; несколько зон на одном БП помечаются
 *    как требующие подтверждённой схемы;
 *  - неизвестные данные не додумываются: `needs_review` и вопрос инженеру.
 *
 * Модуль НИЧЕГО не продаёт: в BOM нет цен и скидок (это часть D), нет
 * автоматического добавления в корзину. Пределы контроллеров — с этикеток
 * (`label_observed`), а не из паспортной библиотеки, поэтому итог всегда
 * предварительный до T8-010/011/012.
 */
import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";

import {
  PSU_MARGIN_PERCENT,
  activeChannelsOf,
  checkControllerForLoad,
  controllerLimitOf,
  isUniversalController,
  ledRoleOf,
  parseControllerSpec,
  parsePsuSpec,
  parseRemoteSpec,
  type ControlKind,
  type ControllerSpec,
  type PsuSpec,
  type RemoteSpec,
  type StripSpec,
} from "@/lib/lighting/led-hardware";

/** Версия правил: попадает в заявку, чтобы расчёт можно было воспроизвести. */
export const LED_RULES_VERSION = "led-rules-1";

export type LedFeature = "floating" | "light-lines" | "cornice" | "custom";
export type LedRunSource = "task" | "manual" | "unknown";

/** Участок ленты: одна физическая намотка/отрезок в конструкции. */
export type LedRun = {
  id: string;
  roomId: string;
  roomLabel: string;
  feature: LedFeature;
  /** Геометрия конструкции в метрах — без умножения на ряды. */
  meters: number | null;
  /** Рядов ленты в конструкции; 1 — обычный случай. */
  rows: number;
  strip: StripSpec;
  stripProductId: string | null;
  stripName: string;
  /** Откуда метраж: из задачи света, введён человеком или неизвестен. */
  source: LedRunSource;
  /** Метраж подтверждён человеком, а не только предзаполнен. */
  confirmed: boolean;
};

/** Независимо управляемая группа участков. Одна зона — один контроллер. */
export type LedZone = {
  id: string;
  roomId: string;
  runIds: string[];
};

export type BomRole = "strip" | "psu" | "controller" | "remote";
export type BomStatus = "ok" | "needs_review" | "incompatible";

export type BomLine = {
  id: string;
  role: BomRole;
  productId: string | null;
  name: string;
  /** Метраж для ленты, штуки для питания и управления. Дробных штук не бывает. */
  qty: number;
  unit: "m" | "pcs";
  /** Человеческое объяснение, почему позиция здесь и в таком количестве. */
  reason: string;
  status: BomStatus;
  /** К какой зоне или цепи относится позиция. */
  refId: string | null;
};

export type LedCircuitPlan = {
  id: string;
  roomId: string;
  voltage: number | null;
  zoneIds: string[];
  installedMeters: number;
  loadW: number;
  requiredW: number;
  currentA: number;
  psu: { productId: string; name: string; watts: number | null } | null;
  status: BomStatus;
  warnings: string[];
};

export type LedZonePlan = {
  id: string;
  roomId: string;
  runIds: string[];
  installedMeters: number;
  loadW: number;
  currentA: number;
  controller: { productId: string; name: string; model: string | null; wifi: boolean } | null;
  remote: { productId: string; name: string } | null;
  status: BomStatus;
  warnings: string[];
  /** Отклонённые кандидаты — чтобы объяснить выбор, а не просто показать итог. */
  rejectedControllers: { name: string; reason: string }[];
};

export type LedProjectPlan = {
  rulesVersion: string;
  zones: LedZonePlan[];
  circuits: LedCircuitPlan[];
  bom: BomLine[];
  status: BomStatus;
  /** Вопросы инженеру: то, что нельзя решить данными каталога. */
  questions: string[];
  warnings: string[];
  totals: {
    installedMeters: number;
    loadW: number;
    requiredW: number;
    controllers: number;
    psus: number;
  };
};

const round2 = (value: number) => Math.round(value * 100) / 100;
const round1 = (value: number) => Math.round(value * 10) / 10;
const METER = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });

/** Статус-максимум: несовместимость важнее «нужна проверка», та важнее «ок». */
export function worstStatus(statuses: readonly BomStatus[]): BomStatus {
  if (statuses.includes("incompatible")) return "incompatible";
  if (statuses.includes("needs_review")) return "needs_review";
  return "ok";
}

/** Установленная длина участка: геометрия × ряды. Неизвестный метраж — 0. */
export function installedMetersOf(run: Pick<LedRun, "meters" | "rows">): number {
  const meters = typeof run.meters === "number" && Number.isFinite(run.meters) && run.meters > 0 ? run.meters : 0;
  const rows = Number.isFinite(run.rows) && run.rows >= 1 ? Math.floor(run.rows) : 1;
  return round2(meters * rows);
}

function normalizeRows(rows: number): number {
  return Number.isFinite(rows) && rows >= 1 ? Math.floor(rows) : 1;
}

/** Тип управления, который требует зона: у всех участков он должен совпадать. */
function controlKindOfStripKind(kind: StripSpec["kind"]): ControlKind {
  if (kind === "mono") return "mono";
  if (kind === "cct") return "cct";
  if (kind === "rgb") return "rgb";
  return "rgb-cct";
}

type CatalogPsu = { product: FeedCatalogProduct; spec: PsuSpec };
type CatalogController = { product: FeedCatalogProduct; spec: ControllerSpec };
type CatalogRemote = { product: FeedCatalogProduct; spec: RemoteSpec };

function catalogOf(products: readonly FeedCatalogProduct[]) {
  const psus: CatalogPsu[] = [];
  const controllers: CatalogController[] = [];
  const remotes: CatalogRemote[] = [];
  for (const product of products) {
    const role = ledRoleOf(product);
    if (role === "psu") {
      const spec = parsePsuSpec(product.name);
      if (spec?.watts !== null && spec?.watts !== undefined) psus.push({ product, spec });
    } else if (role === "controller") {
      const spec = parseControllerSpec(product.name);
      if (spec) controllers.push({ product, spec });
    } else if (role === "remote") {
      const spec = parseRemoteSpec(product.name);
      if (spec) remotes.push({ product, spec });
    }
  }
  return { psus, controllers, remotes };
}

/**
 * Блок питания для цепи: минимальная подходящая мощность, при равенстве —
 * дешевле. Несовпадающее напряжение отбрасывается с причиной, а не молча.
 */
function pickPsu(
  psus: readonly CatalogPsu[],
  voltage: number | null,
  requiredW: number
): { psu: CatalogPsu | null; rejected: { name: string; reason: string }[] } {
  const rejected: { name: string; reason: string }[] = [];
  if (!(requiredW > 0)) return { psu: null, rejected };

  const suitable = psus.filter((option) => {
    if (voltage !== null && option.spec.voltage !== null && option.spec.voltage !== voltage) {
      rejected.push({
        name: option.product.name,
        reason: `выход ${option.spec.voltage} В не совпадает с лентой ${voltage} В`,
      });
      return false;
    }
    return true;
  });

  const enough = suitable
    .filter((option) => (option.spec.watts ?? 0) >= requiredW)
    .sort((a, b) => (a.spec.watts ?? 0) - (b.spec.watts ?? 0) || a.product.priceRub - b.product.priceRub);

  if (enough.length > 0) return { psu: enough[0], rejected };

  for (const option of suitable) {
    rejected.push({
      name: option.product.name,
      reason: `${option.spec.watts} Вт меньше требуемых ${round1(requiredW)} Вт с запасом ${PSU_MARGIN_PERCENT} %`,
    });
  }
  return { psu: null, rejected };
}

/**
 * Контроллер для зоны. Сначала модель под тип ленты, затем универсальный
 * 5-в-1; внутри группы — по току, потом Wi-Fi (не нужен пульт), потом цена.
 * Кандидаты, не прошедшие инженерные пределы, попадают в `rejected` с причиной.
 */
function pickController(input: {
  controllers: readonly CatalogController[];
  voltage: number | null;
  currentA: number;
  kind: StripSpec["kind"];
}): { controller: CatalogController | null; rejected: { name: string; reason: string }[] } {
  const { controllers, voltage, currentA, kind } = input;
  const wanted = controlKindOfStripKind(kind);
  const channels = activeChannelsOf(kind);
  const rejected: { name: string; reason: string }[] = [];
  const viable: CatalogController[] = [];

  for (const option of controllers) {
    const check = checkControllerForLoad({ spec: option.spec, voltage, currentA, channels });
    if (check.ok) viable.push(option);
    else rejected.push({ name: option.product.name, reason: check.reason ?? "не подходит" });
  }

  const bySuitability = (a: CatalogController, b: CatalogController) =>
    (b.spec.amps ?? 0) - (a.spec.amps ?? 0) ||
    Number(b.spec.wifi) - Number(a.spec.wifi) ||
    a.product.priceRub - b.product.priceRub;

  const exact = viable
    .filter((option) => option.spec.controlKind === wanted && !isUniversalController(option.spec))
    .sort(bySuitability);
  const universal = viable.filter((option) => isUniversalController(option.spec)).sort(bySuitability);

  return { controller: exact[0] ?? universal[0] ?? null, rejected };
}

/**
 * Сборка плана проекта.
 *
 * `zones` можно не передавать — тогда каждая комната становится одной зоной со
 * всеми своими участками. Участок, не попавший ни в одну явную зону, получает
 * собственную зону с предупреждением: молча «приклеить» его к чужой зоне
 * значило бы соврать о том, чем он управляется.
 */
export function planLedProject(input: {
  products: readonly FeedCatalogProduct[];
  runs: readonly LedRun[];
  zones?: readonly LedZone[];
}): LedProjectPlan {
  const { products, runs } = input;
  const catalog = catalogOf(products);
  const warnings: string[] = [];
  const questions: string[] = [];
  const bom: BomLine[] = [];

  const normalizedRuns = runs.map((run) => ({ ...run, rows: normalizeRows(run.rows) }));
  const runById = new Map(normalizedRuns.map((run) => [run.id, run]));

  /* --- Зоны: явные + автоматические для неразмеченных участков --- */
  const zoneOfRun = new Map<string, string>();
  const zones: LedZone[] = [];
  for (const zone of input.zones ?? []) {
    const runIds = zone.runIds.filter((id) => runById.has(id));
    for (const id of runIds) {
      if (zoneOfRun.has(id)) {
        warnings.push(`Участок ${id} попал в две зоны: оставлена первая (${zoneOfRun.get(id)}).`);
        continue;
      }
      zoneOfRun.set(id, zone.id);
    }
    if (runIds.length > 0) zones.push({ ...zone, runIds });
  }

  for (const run of normalizedRuns) {
    if (zoneOfRun.has(run.id)) continue;
    const autoId = `${run.roomId}:zone:${run.id}`;
    zones.push({ id: autoId, roomId: run.roomId, runIds: [run.id] });
    zoneOfRun.set(run.id, autoId);
    if ((input.zones ?? []).length > 0) {
      warnings.push(`Участок ${run.id} не входил ни в одну зону — создана отдельная зона.`);
    }
  }

  /* --- Зоны: проверки и контроллер --- */
  const zonePlans: LedZonePlan[] = [];
  for (const zone of zones) {
    const zoneRuns = zone.runIds.map((id) => runById.get(id)).filter((run): run is LedRun => Boolean(run));
    const zoneWarnings: string[] = [];

    let installedMeters = 0;
    let loadW = 0;
    let voltage: number | null = null;
    let kind: StripSpec["kind"] | null = null;
    let kindConflict: string | null = null;
    let unknownStrip = false;

    for (const run of zoneRuns) {
      const installed = installedMetersOf(run);
      installedMeters += installed;
      if (run.strip.wPerMeter === null || run.strip.voltage === null) {
        unknownStrip = true;
        continue;
      }
      loadW += run.strip.wPerMeter * installed;

      if (voltage === null) voltage = run.strip.voltage;
      else if (voltage !== run.strip.voltage) {
        kindConflict = `в одной зоне ленты ${voltage} В и ${run.strip.voltage} В`;
      }
      if (kind === null) kind = run.strip.kind;
      else if (kind !== run.strip.kind) {
        kindConflict = "в одной зоне разные типы лент (моно/CCT/RGB/RGBW)";
      }
    }

    installedMeters = round2(installedMeters);
    loadW = round1(loadW);
    const currentA = voltage !== null && voltage > 0 ? round2(loadW / voltage) : 0;

    if (unknownStrip) {
      zoneWarnings.push("У одной из лент не подтверждены Вт/м или напряжение — расчёт по зоне неполный.");
      questions.push(`Зона ${zone.id}: нужен паспорт ленты (Вт/м, напряжение) для точного расчёта.`);
    }
    if (!(installedMeters > 0)) {
      /*
       * Нулевая длина — это не «ноль ватт и всё хорошо», а отсутствие данных:
       * без метража зелёный статус читался бы как проверенный комплект.
       */
      zoneWarnings.push("Метраж участков не указан — нагрузка и подбор не считаются.");
      questions.push(`Зона ${zone.id}: уточнить длину конструкций в метрах.`);
    }
    if (kindConflict) {
      zoneWarnings.push(`Одна зона не может управляться одним контроллером: ${kindConflict}.`);
      questions.push(`Зона ${zone.id}: разделить на отдельные зоны управления (${kindConflict}).`);
    }

    let controller: LedZonePlan["controller"] = null;
    let rejected: { name: string; reason: string }[] = [];
    let status: BomStatus = zoneWarnings.length > 0 || unknownStrip ? "needs_review" : "ok";

    if (kind && !kindConflict && loadW > 0) {
      const picked = pickController({
        controllers: catalog.controllers,
        voltage,
        currentA,
        kind,
      });
      rejected = picked.rejected;
      if (picked.controller) {
        controller = {
          productId: picked.controller.product.productId,
          name: picked.controller.product.name,
          model: picked.controller.spec.model,
          wifi: picked.controller.spec.wifi,
        };
        /*
         * Этикеточные пределы — не паспорт: даже прошедший по току контроллер
         * остаётся предварительным, и об этом говорится прямо.
         */
        const limit = controllerLimitOf(picked.controller.spec);
        if (limit.evidence === "label_observed") status = "needs_review";
      } else {
        /*
         * Кандидаты были, но все отклонены по жёстким пределам — это нехватка
         * данных каталога, а не приговор схеме: нужен усилитель/несколько зон.
         */
        status = "incompatible";
        zoneWarnings.push(
          "Ни один контроллер каталога не проходит по току для этой зоны — нужен усилитель или разделение зоны."
        );
        questions.push(
          `Зона ${zone.id}: ${currentA} А при ${loadW} Вт — подобрать контроллер по паспорту, усилитель или разделить зону.`
        );
      }
    } else if (loadW > 0 && kindConflict) {
      status = "incompatible";
    }

    /* --- Пульт: только для RF, по одному на зону --- */
    let remote: LedZonePlan["remote"] = null;
    if (controller && !controller.wifi && kind) {
      const wanted = controlKindOfStripKind(kind);
      const match = catalog.remotes.find((option) => option.spec.controlKind === wanted);
      if (match) {
        remote = { productId: match.product.productId, name: match.product.name };
      } else {
        status = worstStatus([status, "needs_review"]);
        zoneWarnings.push("Для RF-контроллера пульт соответствующего типа в наборе не найден.");
      }
    }

    zonePlans.push({
      id: zone.id,
      roomId: zone.roomId,
      runIds: zone.runIds,
      installedMeters,
      loadW,
      currentA,
      controller,
      remote,
      status,
      warnings: zoneWarnings,
      rejectedControllers: rejected,
    });

    /* --- BOM зоны --- */
    for (const run of zoneRuns) {
      const installed = installedMetersOf(run);
      if (installed <= 0) {
        bom.push({
          id: `strip:${run.id}`,
          role: "strip",
          productId: run.stripProductId,
          name: run.stripName,
          qty: 0,
          unit: "m",
          reason: "Метраж не указан — количество ленты не рассчитывается.",
          status: "needs_review",
          refId: zone.id,
        });
        continue;
      }
      const reel = run.strip.reelMeters;
      const qty = reel && reel > 0 ? Math.ceil(installed / reel) * reel : Math.ceil(installed);
      const rowsNote = run.rows > 1 ? ` × ${run.rows} ряда = ${METER.format(installed)} м` : "";
      const reelNote =
        reel && reel > 0
          ? `; катушка ${reel} м → ${Math.ceil(installed / reel)} шт (${METER.format(qty)} м)`
          : "; длина катушки неизвестна — метраж округлён вверх до метра";
      bom.push({
        id: `strip:${run.id}`,
        role: "strip",
        productId: run.stripProductId,
        name: run.stripName,
        qty: round2(qty),
        unit: "m",
        reason: `${METER.format(run.meters ?? 0)} м конструкции${rowsNote}${reelNote}.`,
        status: run.strip.wPerMeter === null ? "needs_review" : "ok",
        refId: zone.id,
      });
    }

    if (controller) {
      bom.push({
        id: `controller:${zone.id}`,
        role: "controller",
        productId: controller.productId,
        name: controller.name,
        qty: 1,
        unit: "pcs",
        reason: `Зона ${zone.id}: ${METER.format(loadW)} Вт ÷ ${voltage ?? "?"} В = ${METER.format(currentA)} А; одна зона — один контроллер.`,
        // Пределы модели известны с этикетки, а не из паспорта партии: позиция предварительная.
        status: "needs_review",
        refId: zone.id,
      });
    }
    if (remote) {
      bom.push({
        id: `remote:${zone.id}`,
        role: "remote",
        productId: remote.productId,
        name: remote.name,
        qty: 1,
        unit: "pcs",
        reason: "RF-контроллер работает только с пультом — один пульт на зону.",
        status: "ok",
        refId: zone.id,
      });
    }
  }

  /* --- Цепи: комната + напряжение --- */
  const circuits: LedCircuitPlan[] = [];
  const byCircuit = new Map<string, { roomId: string; voltage: number | null; zones: LedZonePlan[] }>();
  for (const zone of zonePlans) {
    const zoneRuns = zone.runIds.map((id) => runById.get(id)).filter((run): run is LedRun => Boolean(run));
    const voltage = zoneRuns.find((run) => run.strip.voltage !== null)?.strip.voltage ?? null;
    const key = `${zone.roomId}::${voltage ?? "unknown"}`;
    const bucket = byCircuit.get(key) ?? { roomId: zone.roomId, voltage, zones: [] };
    bucket.zones.push(zone);
    byCircuit.set(key, bucket);
  }

  for (const [key, bucket] of byCircuit) {
    const loadW = round1(bucket.zones.reduce((sum, zone) => sum + zone.loadW, 0));
    const requiredW = round1(loadW * (1 + PSU_MARGIN_PERCENT / 100));
    const currentA = bucket.voltage && bucket.voltage > 0 ? round2(loadW / bucket.voltage) : 0;
    const installedMeters = round2(bucket.zones.reduce((sum, zone) => sum + zone.installedMeters, 0));
    const circuitWarnings: string[] = [];

    const { psu, rejected } = pickPsu(catalog.psus, bucket.voltage, requiredW);
    let status: BomStatus = "ok";

    if (!psu && requiredW > 0) {
      status = "needs_review";
      circuitWarnings.push(
        `Ни один БП каталога не покрывает ${METER.format(requiredW)} Вт — нужна схема из нескольких цепей.`
      );
      questions.push(
        `Цепь ${key}: нагрузка ${METER.format(loadW)} Вт требует ${METER.format(requiredW)} Вт с запасом — разделить на цепи по паспорту.`
      );
    }

    /*
     * Несколько зон на одном БП — не запрещено, но требует подтверждённой
     * схемы включения. Молча считать, что «раз БП хватает по ваттам, значит
     * можно», нельзя: важны клеммы, сечения и разводка.
     */
    if (bucket.zones.length > 1) {
      status = worstStatus([status, "needs_review"]);
      circuitWarnings.push(
        `От одного БП питаются ${bucket.zones.length} зоны — схему включения и клеммы подтверждает инженер.`
      );
      questions.push(
        `Цепь ${key}: ${bucket.zones.length} зоны на одном БП — подтвердить схему подключения и клеммы.`
      );
    }
    if (rejected.length > 0 && !psu) {
      for (const item of rejected) circuitWarnings.push(`Отклонён ${item.name}: ${item.reason}.`);
    }

    circuits.push({
      id: key,
      roomId: bucket.roomId,
      voltage: bucket.voltage ?? null,
      zoneIds: bucket.zones.map((zone) => zone.id),
      installedMeters,
      loadW,
      requiredW,
      currentA,
      psu: psu
        ? { productId: psu.product.productId, name: psu.product.name, watts: psu.spec.watts }
        : null,
      status,
      warnings: circuitWarnings,
    });

    if (psu) {
      const zonesNote =
        bucket.zones.length > 1 ? `, обслуживает ${bucket.zones.length} зоны` : "";
      bom.push({
        id: `psu:${key}`,
        role: "psu",
        productId: psu.product.productId,
        name: psu.product.name,
        qty: 1,
        unit: "pcs",
        reason: `Нагрузка ${METER.format(loadW)} Вт × ${PSU_MARGIN_PERCENT} % = ${METER.format(requiredW)} Вт; выбран минимальный подходящий ${psu.spec.watts} Вт${zonesNote}.`,
        status,
        refId: key,
      });
    }
  }

  const totals = {
    installedMeters: round2(zonePlans.reduce((sum, zone) => sum + zone.installedMeters, 0)),
    loadW: round1(zonePlans.reduce((sum, zone) => sum + zone.loadW, 0)),
    requiredW: round1(circuits.reduce((sum, circuit) => sum + circuit.requiredW, 0)),
    controllers: zonePlans.filter((zone) => zone.controller !== null).length,
    psus: circuits.filter((circuit) => circuit.psu !== null).length,
  };

  if (normalizedRuns.length === 0) {
    questions.push("Нет ни одного участка подсветки — подбирать нечего, нужны длины конструкций.");
  }

  const status = worstStatus([
    ...zonePlans.map((zone) => zone.status),
    ...circuits.map((circuit) => circuit.status),
    ...bom.map((line) => line.status),
  ]);

  return {
    rulesVersion: LED_RULES_VERSION,
    zones: zonePlans,
    circuits,
    bom,
    status,
    questions: [...new Set(questions)],
    warnings: [...new Set(warnings)],
    totals,
  };
}
