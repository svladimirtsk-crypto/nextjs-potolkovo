/**
 * LED-раздел каталога: группы комплектующих и подбор питания по метражу.
 *
 * Раньше все 72 позиции группы «Светодиодная лента» лежали одной сеткой: лента,
 * блоки питания, контроллеры, пульты и наборы вперемешку, все с единицей «м».
 * Лиду приходилось самому соображать, что к чему, а подбор питания по метражу
 * был невозможен — метраж относился к пульту.
 *
 * Здесь три группы («Ленты», «Питание», «Управление»), вход по задаче из
 * помещений (метраж из задачи света) и предварительный расчёт питания с запасом
 * 30 %, утверждённым владельцем 16.10.2026. Расчёт ничего не добавляет в
 * корзину сам: он показывает, что подходит, и помечается как требующий проверки.
 */
import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";
import {
  PSU_MARGIN_PERCENT,
  isAliceCapable,
  isUniversalController,
  ledRoleOf,
  parseStripSpec,
  planLedPower,
  type ControllerSpec,
  type PowerPlan,
  type PsuSpec,
  type RemoteSpec,
  type StripKind,
  type StripSpec,
} from "@/lib/lighting/led-hardware";
import { applyPassportToSpec, findPassport, type StripPassport } from "@/lib/lighting/led-passports";

export type LedGroupId = "strips" | "power" | "control";

export const LED_GROUPS: { id: LedGroupId; label: string; hint: string }[] = [
  { id: "strips", label: "Ленты", hint: "Лента выбранного типа и мощности — метраж считается по катушкам." },
  { id: "power", label: "Питание", hint: "Блоки питания 24 В: подбираются по нагрузке с запасом 30 %." },
  { id: "control", label: "Управление", hint: "Контроллеры, пульты и готовые наборы «пульт + контроллер»." },
];

/** Группа, в которой позиция показывается человеку. */
export function ledGroupOfProduct(product: FeedCatalogProduct): LedGroupId | null {
  const role = ledRoleOf(product);
  if (role === null) return null;
  if (role === "strip") return "strips";
  if (role === "psu") return "power";
  return "control";
}

export function ledProductsOfGroup(
  products: readonly FeedCatalogProduct[],
  group: LedGroupId
): FeedCatalogProduct[] {
  return products.filter((product) => ledGroupOfProduct(product) === group);
}

/** Ленты, по которым можно считать: нужен подтверждённый Вт/м и напряжение. */
export function ledStripOptions(
  products: readonly FeedCatalogProduct[],
  /**
   * T8-011 · Паспорта, если они уже есть. Значения берутся только из
   * `datasheet_verified` полей; название остаётся названием до паспорта.
   */
  passports?: readonly StripPassport[] | null
): { product: FeedCatalogProduct; spec: StripSpec }[] {
  const options: { product: FeedCatalogProduct; spec: StripSpec }[] = [];
  for (const product of products) {
    if (ledRoleOf(product) !== "strip") continue;
    const parsed = parseStripSpec(product.name);
    if (!parsed) continue;
    const passport = findPassport(passports, parsed.series) ?? findPassport(passports, product.name);
    const spec = applyPassportToSpec(parsed, passport).spec;
    if (spec.wPerMeter !== null && spec.wPerMeter !== undefined) options.push({ product, spec });
  }
  return options.sort((a, b) => (a.spec.wPerMeter ?? 0) - (b.spec.wPerMeter ?? 0));
}

export type LedPlan = PowerPlan & {
  /** Сколько катушек закрывает установленная длина (катушка не режется на части). */
  reels: number | null;
  marginPercent: number;
  /** Независимых зон управления: каждая получает свой контроллер. */
  zones: number;
};

/**
 * Предварительный подбор комплекта: нагрузка по метражу, БП с запасом, контроллер
 * по типу ленты, пульт для RF-моделей.
 */
export function ledPlanFor(input: {
  products: readonly FeedCatalogProduct[];
  strip: StripSpec | null;
  /** Длина конструкции в метрах (без рядов). */
  meters: number;
  /** Рядов ленты; 6 м в два ряда — это 12 м нагрузки. */
  rows?: number;
  /** Независимых зон управления; каждая требует своего контроллера. */
  zones?: number;
  /** Паспорт выбранной ленты: может уточнить мощность/напряжение/катушку. */
  passport?: StripPassport | null;
}): LedPlan | null {
  const { products, meters } = input;
  if (!input.strip) return null;
  const strip = (applyPassportToSpec(input.strip, input.passport ?? null).spec);
  const rows = Number.isFinite(input.rows) && (input.rows ?? 0) > 0 ? Math.floor(input.rows as number) : 1;
  const zones = Number.isFinite(input.zones) && (input.zones ?? 0) > 0 ? Math.floor(input.zones as number) : 1;
  const plan = planLedPower({ strip, meters, rows, products });
  const reels =
    strip.reelMeters && strip.reelMeters > 0 && plan.installedMeters > 0
      ? Math.ceil(plan.installedMeters / strip.reelMeters)
      : null;

  /*
   * Без метража расчёт «сойтись» не может: нагрузка нулевая, и зелёная плашка
   * здесь читалась бы как проверенный комплект. Добавляем это как предупреждение
   * (оно же переводит статус в `needs_review`).
   */
  if (!(meters > 0)) {
    return {
      ...plan,
      reels,
      marginPercent: PSU_MARGIN_PERCENT,
      zones,
      status: "needs_review",
      warnings: ["Укажите метраж подсветки — без него не считается ни нагрузка, ни мощность блока питания.", ...plan.warnings],
    };
  }

  /*
   * Несколько зон на одном БП. По ваттам блок может хватать, но схема
   * включения, клеммы и сечения без инженера не подтверждаются — поэтому
   * статус понижается, а не остаётся зелёным.
   */
  if (zones > 1) {
    return {
      ...plan,
      reels,
      marginPercent: PSU_MARGIN_PERCENT,
      zones,
      status: "needs_review",
      warnings: [
        `От одного блока питания питаются ${zones} зоны — схему включения и клеммы подтверждает инженер.`,
        ...plan.warnings,
      ],
    };
  }
  return { ...plan, reels, marginPercent: PSU_MARGIN_PERCENT, zones };
}

/**
 * Метраж из задачи света, пришедший ссылкой (`?led=1&meters=12`).
 *
 * Принимаем только положительное число до 300 м: мусор в параметре не должен
 * превращаться в расчёт. Читается на клиенте, чтобы страница каталога осталась
 * статической (через `searchParams` она стала бы динамической).
 */
export function ledMetersFromQuery(search: string): number | null {
  const params = new URLSearchParams(search.replace(/^\?/, ""));
  if (params.get("led") !== "1") return null;
  const raw = params.get("meters") ?? params.get("ledMeters");
  const value = Number(String(raw ?? "").replace(",", "."));
  if (!Number.isFinite(value) || value <= 0 || value > 300) return null;
  return Math.round(value * 100) / 100;
}

/** Метраж задачи света из помещений — то, что человек уже ввёл, не спрашиваем снова. */
export function ledMetersFromTasks(tasks: readonly { geometryMeters: number | null }[]): number | null {
  const values = tasks
    .map((task) => task.geometryMeters)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);
  if (values.length === 0) return null;
  const sum = values.reduce((acc, value) => acc + value, 0);
  return Math.round(sum * 100) / 100;
}

/** Тип управления по выбранной ленте — для подписи «что подойдёт». */
export function controlKindOfStrip(kind: StripKind): "mono" | "cct" | "rgb" | "rgb-cct" {
  if (kind === "mono") return "mono";
  if (kind === "cct") return "cct";
  if (kind === "rgb") return "rgb";
  return "rgb-cct";
}

/**
 * Как позиция управления работает с домом.
 *
 * Wi-Fi-контроллеры (C01/C02/C03, WB5, LM051) — работа с Алисой подтверждена
 * владельцем на его комплекте, это не паспортная совместимость всего
 * ассортимента. RF-модели живут только на пульте; готовый набор — это
 * управление целиком, без расчёта мощности.
 */
export type ControlStatus = {
  title: string;
  detail: string;
  alice: "owner-verified" | "no" | "unknown";
};

export function controlStatusOf(input: {
  role: "controller" | "remote" | "controller-remote-kit";
  controller?: ControllerSpec | null;
  remote?: RemoteSpec | null;
}): ControlStatus {
  const { role, controller = null, remote = null } = input;

  if (role === "controller-remote-kit") {
    return {
      title: "Набор «пульт + контроллер»",
      detail: "Готовое управление на 6 А: подходит для коротких участков, мощность проверяется по паспорту.",
      alice: "unknown",
    };
  }
  if (role === "remote") {
    return {
      title: "Пульт",
      detail: `${remote?.channels ? `${remote.channels} канала` : "Каналы уточняются"}: работает в паре с RF-контроллером, в умный дом не выходит.`,
      alice: "no",
    };
  }
  if (controller?.wifi) {
    /*
     * 5-в-1 — универсальный: владелец подтвердил 16.10.2026, что Wi-Fi 5-в-1
     * (WB5) работает со всеми лентами его ассортимента. Формулировка держится
     * про поддержку режимов и не превращается в обещание мощности.
     */
    if (isUniversalController(controller)) {
      return {
        title: "Wi-Fi 5-в-1 контроллер",
        detail:
          "Один контроллер на все типы лент: монохром, CCT, RGB, RGBW и RGB+CCT — работает со всеми лентами, подтверждено владельцем на его комплекте. Управление со смартфона и голосом.",
        alice: "owner-verified",
      };
    }
    return {
      title: "Wi-Fi-контроллер",
      detail: isAliceCapable(controller)
        ? "Управление со смартфона и голосом — работа с Алисой подтверждена владельцем на его комплекте."
        : "Управление со смартфона.",
      alice: "owner-verified",
    };
  }
  if (controller && isUniversalController(controller)) {
    return {
      title: "RF 5-в-1 контроллер",
      detail: "Один контроллер на все типы лент, но управляется только пультом: Алиса и умный дом не поддерживаются.",
      alice: "no",
    };
  }
  return {
    title: "RF-контроллер",
    detail: "Управляется только пультом: Алиса и сценарии умного дома не поддерживаются.",
    alice: "no",
  };
}

/**
 * Подписи для расчёта питания: что показать рядом с цифрами.
 * NaN и отрицательные метры не «превращаются» в ноль молча.
 */
export function ledMetersNote(meters: number): string {
  if (!Number.isFinite(meters) || meters <= 0) return "Укажите метраж: длину карниза, линии или контура в метрах.";
  return `Метраж ${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(meters)} м.`;
}

/** Мощность блока питания из плана — для карточки. */
export function psuWattsOf(plan: LedPlan): number | null {
  return plan.psu?.spec.watts ?? null;
}

export type { ControllerSpec, PsuSpec, RemoteSpec, StripSpec };
