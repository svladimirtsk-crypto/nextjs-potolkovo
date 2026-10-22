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
  checkControlKitForLoad,
  checkControllerForLoad,
  controlKindForStrip,
  controllerLimitOf,
  isUniversalController,
  ledRoleOf,
  parseControllerRemoteKit,
  parseControllerSpec,
  parsePsuSpec,
  parseRemoteSpec,
  rfRemoteTitleCandidate,
  roundUpHundredth,
  type ControlKitSpec,
  type ControllerSpec,
  type PsuSpec,
  type RemoteSpec,
  type StripSpec,
} from "@/lib/lighting/led-hardware";
import { resolvePriceBasis, stripPurchaseQty } from "@/lib/lighting/led-price-basis";
import { moscowCandidateAllowed, moscowStockMessage } from "@/lib/lighting/moscow-stock";

/** Версия правил: попадает в заявку, чтобы расчёт можно было воспроизвести. */
export const LED_RULES_VERSION = "led-rules-2"; // поведение unknown, voltage-mismatch и kit BOM изменено

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

export type BomRole = "strip" | "psu" | "controller" | "remote" | "controller-remote-kit";
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
  /** Одна строка SKU вместо двух предполагаемых компонентов; состав не подтверждён. */
  controlKit: { productId: string; name: string } | null;
  remote: { productId: string; name: string } | null;
  status: BomStatus;
  warnings: string[];
  /** Отклонённые кандидаты — чтобы объяснить выбор, а не просто показать итог. */
  rejectedControllers: { name: string; reason: string }[];
  rejectedKits: { name: string; reason: string }[];
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
    /** Самостоятельные SKU контроллеров; внутренности kit сюда не включаем. */
    controllers: number;
    /** Кандидаты kit отдельно от standalone-контроллеров, без выдуманного внутреннего состава. */
    controlKits: number;
    psus: number;
  };
};

const round2 = (value: number) => Math.round(value * 100) / 100;
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
  return roundUpHundredth(meters * rows);
}

function normalizeRows(rows: number): number {
  return Number.isFinite(rows) && rows >= 1 ? Math.floor(rows) : 1;
}

type CatalogPsu = { product: FeedCatalogProduct; spec: PsuSpec };
type CatalogController = { product: FeedCatalogProduct; spec: ControllerSpec };
type CatalogRemote = { product: FeedCatalogProduct; spec: RemoteSpec };
type CatalogKit = { product: FeedCatalogProduct; spec: ControlKitSpec };

function catalogOf(products: readonly FeedCatalogProduct[]) {
  const psus: CatalogPsu[] = [];
  const controllers: CatalogController[] = [];
  const remotes: CatalogRemote[] = [];
  const kits: CatalogKit[] = [];
  for (const product of products) {
    const role = ledRoleOf(product);
    if (!moscowCandidateAllowed(product)) continue;
    if (role === "psu") {
      const spec = parsePsuSpec(product.name);
      if (spec) psus.push({ product, spec }); // W может быть unknown: нельзя считать, что в каталоге только БП чужого напряжения.
    } else if (role === "controller") {
      const spec = parseControllerSpec(product.name);
      if (spec) controllers.push({ product, spec });
    } else if (role === "remote") {
      const spec = parseRemoteSpec(product.name);
      if (spec) remotes.push({ product, spec });
    } else if (role === "controller-remote-kit") {
      const spec = parseControllerRemoteKit(product.name);
      if (spec) kits.push({ product, spec });
    }
  }
  return { psus, controllers, remotes, kits };
}

/**
 * Блок питания для цепи: минимальная подходящая мощность, при равенстве —
 * дешевле. Несовпадающее напряжение отбрасывается с причиной, а не молча.
 */
function pickPsu(
  psus: readonly CatalogPsu[],
  voltage: number | null,
  requiredW: number
): { psu: CatalogPsu | null; rejected: { name: string; reason: string }[]; wrongVoltageOnly: boolean } {
  const rejected: { name: string; reason: string }[] = [];
  if (!(requiredW > 0)) return { psu: null, rejected, wrongVoltageOnly: false };

  const wrongVoltageOnly = voltage !== null && psus.length > 0 &&
    psus.every((option) => option.spec.voltage !== null && option.spec.voltage !== voltage);
  const suitable = psus.filter((option) => {
    if (voltage !== null && option.spec.voltage === voltage) return true;
    rejected.push({
      name: option.product.name,
      reason: voltage === null || option.spec.voltage === null
        ? "напряжение ленты или БП не указано — совпадение не доказано"
        : `выход ${option.spec.voltage} В не совпадает с лентой ${voltage} В`,
    });
    return false;
  });

  const enough = suitable
    .filter((option) => (option.spec.watts ?? 0) >= requiredW)
    .sort((a, b) => (a.spec.watts ?? 0) - (b.spec.watts ?? 0) || a.product.priceRub - b.product.priceRub);

  if (enough.length > 0) return { psu: enough[0], rejected, wrongVoltageOnly };

  for (const option of suitable) {
    rejected.push({
      name: option.product.name,
      reason: option.spec.watts === null
        ? "номинальная мощность не указана — кандидат требует паспорта"
        : `${option.spec.watts} Вт меньше требуемых ${METER.format(requiredW)} Вт с запасом ${PSU_MARGIN_PERCENT} %`,
    });
  }
  return { psu: null, rejected, wrongVoltageOnly };
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
}): { controller: CatalogController | null; warnings: string[]; rejected: { name: string; reason: string }[] } {
  const { controllers, voltage, currentA, kind } = input;
  const wanted = controlKindForStrip(kind);
  const channels = activeChannelsOf(kind);
  const rejected: { name: string; reason: string }[] = [];
  const viable: { option: CatalogController; warnings: string[] }[] = [];
  if (!wanted || voltage === null || !(currentA > 0)) return { controller: null, warnings: [], rejected };

  for (const option of controllers) {
    const check = checkControllerForLoad({ spec: option.spec, voltage, currentA, channels });
    if (check.ok) viable.push({ option, warnings: check.warnings });
    else rejected.push({ name: option.product.name, reason: check.reason ?? "не подходит" });
  }

  const bySuitability = (a: CatalogController, b: CatalogController) =>
    (b.spec.amps ?? 0) - (a.spec.amps ?? 0) ||
    Number(b.spec.wifi) - Number(a.spec.wifi) ||
    a.product.priceRub - b.product.priceRub;

  const exact = viable
    .filter((entry) => wanted !== "rgb-cct" && entry.option.spec.controlKind === wanted && !isUniversalController(entry.option.spec))
    .sort((a, b) => bySuitability(a.option, b.option));
  const universal = viable
    .filter((entry) => isUniversalController(entry.option.spec))
    .sort((a, b) => bySuitability(a.option, b.option));
  const chosen = exact[0] ?? universal[0];

  return { controller: chosen?.option ?? null, warnings: chosen?.warnings ?? [], rejected };
}

/** Kit остаётся одним продаваемым кандидатом, не двумя вымышленными дочерними SKU. */
function pickControlKit(input: {
  kits: readonly CatalogKit[];
  kind: StripSpec["kind"];
  voltage: number | null;
  currentA: number;
}): { kit: CatalogKit | null; rejected: { name: string; reason: string }[] } {
  let kit: CatalogKit | null = null;
  const rejected: { name: string; reason: string }[] = [];
  for (const option of input.kits) {
    const check = checkControlKitForLoad({ spec: option.spec, kind: input.kind, voltage: input.voltage, currentA: input.currentA });
    if (check.ok && !kit) kit = option;
    else if (!check.ok) rejected.push({ name: option.product.name, reason: check.reason ?? "не подходит" });
  }
  return { kit, rejected };
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
  // A zero in Moscow cannot be rescued by another warehouse. Keep the item
  // visible to the specialist, but never auto-select it for a project BOM.
  const withheld = products.filter((product) => ledRoleOf(product) !== null && !moscowCandidateAllowed(product));

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
    let unknownMode = false;

    for (const run of zoneRuns) {
      const stripProduct = products.find((product) => product.productId === run.stripProductId);
      if (stripProduct && !moscowCandidateAllowed(stripProduct)) {
        zoneWarnings.push(`${run.stripName}: ${moscowStockMessage(stripProduct)} Лента не считается доступной для комплекта.`);
        questions.push(`Зона ${zone.id}: уточнить московский остаток ленты ${stripProduct.vendorCode} или подобрать другую.`);
      }
      const installed = installedMetersOf(run);
      installedMeters += installed;
      if (run.strip.kind === "unknown") unknownMode = true;
      if (run.strip.wPerMeter === null || run.strip.voltage === null) {
        unknownStrip = true;
        continue;
      }
      loadW += run.strip.wPerMeter * installed;

      if (voltage === null) voltage = run.strip.voltage;
      else if (voltage !== run.strip.voltage) {
        kindConflict = `в одной зоне ленты ${voltage} В и ${run.strip.voltage} В`;
      }
      if (run.strip.kind !== "unknown") {
        if (kind === null) kind = run.strip.kind;
        else if (kind !== run.strip.kind) {
          kindConflict = "в одной зоне разные типы лент (моно/CCT/RGB/RGBW)";
        }
      }
    }

    installedMeters = round2(installedMeters);
    loadW = roundUpHundredth(loadW);
    const currentA = voltage !== null && voltage > 0 ? roundUpHundredth(loadW / voltage) : 0;

    if (unknownStrip) {
      zoneWarnings.push("У одной из лент не подтверждены Вт/м или напряжение — расчёт по зоне неполный.");
      questions.push(`Зона ${zone.id}: нужен паспорт ленты (Вт/м, напряжение) для точного расчёта.`);
    }
    if (unknownMode) {
      zoneWarnings.push("Режим/каналы одной из лент неизвестны — нельзя назначить ни монохромный, ни универсальный контроллер/набор.");
      questions.push(`Зона ${zone.id}: запросить паспорт режима и распиновки ленты, прежде чем подбирать управление.`);
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
    let controlKit: LedZonePlan["controlKit"] = null;
    let controllerSpec: ControllerSpec | null = null;
    let rejected: { name: string; reason: string }[] = [];
    let rejectedKits: { name: string; reason: string }[] = [];
    let status: BomStatus = zoneWarnings.length > 0 || unknownStrip ? "needs_review" : "ok";

    if (kind && !kindConflict && !unknownMode && !unknownStrip && loadW > 0) {
      const picked = pickController({
        controllers: catalog.controllers,
        voltage,
        currentA,
        kind,
      });
      rejected = picked.rejected;
      if (picked.controller) {
        controllerSpec = picked.controller.spec;
        controller = {
          productId: picked.controller.product.productId,
          name: picked.controller.product.name,
          model: controllerSpec.model,
          wifi: controllerSpec.wifi,
        };
        /*
         * LED-07 · Не теряем предупреждение о 5 А на круглом входе C01RF:
         * вход в модели не выбран, поэтому согласование винтового подключения
         * должно дойти до зоны/вопроса инженеру, а не исчезнуть при сортировке.
         */
        for (const warning of picked.warnings) {
          zoneWarnings.push(warning);
          status = worstStatus([status, "needs_review"]);
          if (warning.includes("круглого входа")) {
            questions.push(`Зона ${zone.id}: уточнить способ подключения ${controllerSpec.model ?? "контроллера"} — круглый вход ограничен по току.`);
          }
        }
        /* Этикеточные пределы — не паспорт: даже прошедшая модель предварительная. */
        const limit = controllerLimitOf(controllerSpec);
        if (limit.evidence === "label_observed") status = "needs_review";
      } else {
        const pickedKit = pickControlKit({ kits: catalog.kits, kind, voltage, currentA });
        rejectedKits = pickedKit.rejected;
        if (pickedKit.kit) {
          controlKit = { productId: pickedKit.kit.product.productId, name: pickedKit.kit.product.name };
          status = "needs_review";
          zoneWarnings.push("Набор «пульт + контроллер» — один SKU-кандидат по заголовку; внутренний состав, ток каналов и сопряжение не подтверждены. Отдельный пульт не добавлен.");
          questions.push(`Зона ${zone.id}: запросить паспорт состава набора ${controlKit.name}, режим/токи и проверить на стенде; не добавлять отдельный пульт без схемы.`);
        } else {
          /* Все готовые модели/наборы отклонены — нужна другая схема или каталог. */
          status = "incompatible";
          zoneWarnings.push("Ни один контроллер или набор каталога не проходит по току/режиму для этой зоны — нужен усилитель или разделение зоны.");
          for (const item of rejectedKits) zoneWarnings.push(`Набор ${item.name} отклонён: ${item.reason}.`);
          questions.push(`Зона ${zone.id}: ${currentA} А при ${loadW} Вт — подобрать управление по паспорту, усилитель или разделить зону.`);
        }
      }
    } else if (loadW > 0 && kindConflict) {
      status = "incompatible";
    }

    /* --- Пульт: название семейства — кандидат, НЕ подтверждённая RF-пара --- */
    let remote: LedZonePlan["remote"] = null;
    if (controllerSpec && !controllerSpec.wifi) {
      const rfController = controllerSpec;
      const match = catalog.remotes.find((option) => rfRemoteTitleCandidate(rfController, option.spec));
      status = worstStatus([status, "needs_review"]);
      if (match) {
        remote = { productId: match.product.productId, name: match.product.name };
        zoneWarnings.push(`Пульт ${match.spec.model ?? "?"} — только кандидат по названию семейства ${controllerSpec.model ?? "?"}; совместимость и сопряжение не подтверждены.`);
        questions.push(`Зона ${zone.id}: подтвердить по паспорту/стенду RF-пару ${controllerSpec.model ?? "?"} и ${match.spec.model ?? "?"}.`);
      } else {
        zoneWarnings.push(`Для RF-контроллера ${controllerSpec.model ?? "?"} нет пульта с совпадающим семейством; выбирать только по типу ленты нельзя.`);
        questions.push(`Зона ${zone.id}: подобрать и подтвердить RF-пару для ${controllerSpec.model ?? "?"}.`);
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
      controlKit,
      remote,
      status,
      warnings: zoneWarnings,
      rejectedControllers: rejected,
      rejectedKits,
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
      /*
       * T8-010 · Закупка зависит от того, за что цена: катушка продаётся целой,
       * метраж можно взять точный. Неизвестный базис округляем вверх до метра —
       * консервативно и без ложной точности.
       */
      const product = products.find((item) => item.productId === run.stripProductId);
      const basis = resolvePriceBasis({
        name: product?.name ?? run.stripName,
        unit: product?.unit,
        priceRub: product?.priceRub,
      });
      const purchase = stripPurchaseQty({ installedMeters: installed, basis });
      const rowsNote = run.rows > 1 ? ` × ${run.rows} ряда = ${METER.format(installed)} м` : "";
      const reelNote =
        purchase.unit === "pcs"
          ? `; катушка ${reel ?? basis.reelMeters ?? "?"} м → ${purchase.qty} шт (${METER.format(purchase.roundedMeters ?? installed)} м)`
          : basis.basis === "per_meter"
            ? "; цена за метр — установленный метраж покупается как есть"
            : "; единица продажи не подтверждена — метраж округлён вверх до метра";
      bom.push({
        id: `strip:${run.id}`,
        role: "strip",
        productId: run.stripProductId,
        name: run.stripName,
        qty: purchase.qty,
        unit: purchase.unit,
        reason: `${METER.format(run.meters ?? 0)} м конструкции${rowsNote}${reelNote}. Вт/м, режим, длина питания и продажная единица требуют проверки по паспорту/поставщику.`,
        status: "needs_review", // даже известная из заголовка мощность не является паспортной.
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
    if (controlKit) {
      bom.push({
        id: `kit:${zone.id}`,
        role: "controller-remote-kit",
        productId: controlKit.productId,
        name: controlKit.name,
        qty: 1,
        unit: "pcs",
        reason: `Зона ${zone.id}: ${METER.format(currentA)} А по ленте. Один продаваемый набор-кандидат по названию; состав, лимиты каналов и наличие пульта внутри требуют паспорта/стенда. Контроллер и пульт отдельно не добавлены.`,
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
        reason: `RF-контроллеру нужен пульт: ${controller?.model ?? "?"} и кандидат ${remote.name} совпадают по названию семейства, но сопряжение и совместимость не подтверждены.`,
        status: "needs_review",
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
    const loadW = roundUpHundredth(bucket.zones.reduce((sum, zone) => sum + zone.loadW, 0));
    const requiredW = roundUpHundredth(loadW * (1 + PSU_MARGIN_PERCENT / 100));
    const currentA = bucket.voltage && bucket.voltage > 0 ? roundUpHundredth(loadW / bucket.voltage) : 0;
    const installedMeters = round2(bucket.zones.reduce((sum, zone) => sum + zone.installedMeters, 0));
    const circuitWarnings: string[] = [];
    const incompleteLoad = bucket.zones.some((zone) => zone.runIds.some((id) => {
      const run = runById.get(id);
      return !run || run.strip.wPerMeter === null || run.strip.voltage === null || installedMetersOf(run) <= 0;
    }));
    // Сумма известной части недостаточна для выбора БП, если хоть один участок не рассчитан.
    const { psu, rejected, wrongVoltageOnly } = incompleteLoad
      ? { psu: null, rejected: [], wrongVoltageOnly: false }
      : pickPsu(catalog.psus, bucket.voltage, requiredW);
    let status: BomStatus = "ok";
    if (incompleteLoad) {
      status = "needs_review";
      circuitWarnings.push("Мощность одного из участков неизвестна — номинал БП по частичной нагрузке выбирать нельзя.");
      questions.push(`Цепь ${key}: запросить полную мощность и длину всех участков перед выбором БП.`);
    }

    if (!psu && requiredW > 0 && !incompleteLoad) {
      let excludedMatchingPsu = false;
      for (const product of withheld.filter((item) => ledRoleOf(item) === "psu")) {
        const spec = parsePsuSpec(product.name);
        if (spec?.voltage === bucket.voltage && (spec.watts ?? 0) >= requiredW) {
          excludedMatchingPsu = true;
          circuitWarnings.push(`${product.name}: ${moscowStockMessage(product)} В подбор автоматически не включён.`);
          questions.push(`Цепь ${key}: уточнить остаток Москвы для ${product.vendorCode} или подобрать другой БП.`);
        }
      }
      const voltageIncompatible = wrongVoltageOnly && !excludedMatchingPsu;
      status = voltageIncompatible ? "incompatible" : "needs_review";
      circuitWarnings.push(voltageIncompatible
        ? `Все БП каталога имеют несовместимое с лентой ${bucket.voltage} В напряжение: эту цепь из них собирать нельзя.`
        : `Ни один БП с подтверждённым совпадением напряжения не покрывает ${METER.format(requiredW)} Вт — нужна другая схема/паспорт или актуальный остаток Москвы.`);
      questions.push(voltageIncompatible
        ? `Цепь ${key}: подобрать БП строго под ${bucket.voltage} В; имеющиеся БП другого напряжения запрещены.`
        : `Цепь ${key}: нагрузка ${METER.format(loadW)} Вт требует ${METER.format(requiredW)} Вт с запасом — подобрать БП/разделить цепи по паспорту.`);
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
    if (psu) {
      status = worstStatus([status, "needs_review"]);
      circuitWarnings.push("Выбранный БП — кандидат по номиналу/напряжению из названия, а не проверка CV, derating и условий монтажа по паспорту.");
      questions.push(`Цепь ${key}: подтвердить паспорт БП, режим CV, нагрузку, derating и схему.`);
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
        reason: `Нагрузка ${METER.format(loadW)} Вт × (1 + ${PSU_MARGIN_PERCENT} %) = ${METER.format(requiredW)} Вт; выбран минимальный подходящий ${psu.spec.watts} Вт${zonesNote}.`,
        status,
        refId: key,
      });
    }
  }

  const totals = {
    installedMeters: round2(zonePlans.reduce((sum, zone) => sum + zone.installedMeters, 0)),
    loadW: roundUpHundredth(zonePlans.reduce((sum, zone) => sum + zone.loadW, 0)),
    requiredW: roundUpHundredth(circuits.reduce((sum, circuit) => sum + circuit.requiredW, 0)),
    controllers: zonePlans.filter((zone) => zone.controller !== null).length,
    controlKits: zonePlans.filter((zone) => zone.controlKit !== null).length,
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
