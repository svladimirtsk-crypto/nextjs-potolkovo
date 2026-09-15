/**
 * PT-018 (B-F104, T-324) · чистые селекторы Шага 1 «Свет».
 *
 * Всё, что здесь лежит, раньше было `useMemo`-обёртками внутри
 * `wizard-step1-lighting.tsx`: файл дорос до 1395 строк, и прочитать правило
 * «какие товары показывать на этом экране» в нём было нельзя — правила были
 * перемешаны с состоянием мастера, корзиной и разметкой.
 *
 * Модуль намеренно без React: функции не знают про хуки, поэтому их можно
 * вызвать из теста и получить тот же результат, что и на экране. Поведение
 * перенесено 1:1 — это перенос кода, а не перепроектирование (отдельные
 * отступления помечены в комментариях).
 */
import {
  CLARUS_PSU_VENDOR_CODES,
  POINT_TO_MOUNT_VENDOR_CODE,
  TRACK_PROFILE_WHITELIST,
  TRACK_SYSTEMS,
  type CatalogSectionId,
  type LampSocket,
  type PointSubtypeId,
  type TrackGroupId,
  type TrackSystemId,
} from "@/lib/catalog-ui-config";
import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";
import { detectSocket } from "@/lib/feed2-products";
import { toNumber, toText } from "@/lib/feed2-snapshot-normalize";
import {
  LIGHTING_ONLY_DISCOUNT_PERCENT,
  LIGHTING_WITH_CEILING_DISCOUNT_PERCENT,
  applyLightingOnlyDiscount,
  applyLightingWithCeilingDiscount,
} from "@/lib/lighting-formulas";
import { isTrackSystemId } from "@/lib/lighting/kit-rules";
import {
  isLamp,
  isMountsOrGrilles,
  isPanelProduct,
  matchesPointSubtype,
} from "@/lib/lighting/product-predicates";
import { pointsOfKind, type PointKindId } from "@/lib/lighting/popular-points";
import type { CartEntry } from "@/lib/lighting/cart-derived";
import type { ResolveInitialStepInput } from "@/lib/lighting/resolve-initial-step";
import { inferPieceLengthMeters } from "@/lib/product-length-meters";
import { ART_TRACK_PROFILE_VENDOR_WHITELIST } from "@/lib/vendor-code-overrides";

/** Как монтировать трек — ответ Шага 0, от него зависит набор систем. */
export type TrackMountType = "built-in" | "surface" | "none";

/** Человеккое название системы: то же, что в чипах фильтра (`TRACK_SYSTEMS`). */
const SYSTEM_LABELS = Object.fromEntries(
  TRACK_SYSTEMS.map((item) => [item.id, item.label]),
) as Record<TrackSystemId, string>;

export function systemLabelOf(id: TrackSystemId): string {
  return SYSTEM_LABELS[id] ?? id;
}

/**
 * Артикулы профилей, которые вообще показываются клиенту.
 *
 * ART (TRACK_220) исторически дополняется вторым списком из
 * `vendor-code-overrides`; раньше это условие было продублировано в трёх
 * местах файла, и добавление системы означало правку всех трёх.
 */
export function allowedTrackProfileVendors(system: TrackSystemId): Set<string> {
  const base = TRACK_PROFILE_WHITELIST[system] ?? [];
  return system === "TRACK_220"
    ? new Set([...base, ...ART_TRACK_PROFILE_VENDOR_WHITELIST])
    : new Set(base);
}

/** Профили одной системы: только из белого списка, только с ценой. */
export function selectTrackProfilesOfSystem(
  products: readonly FeedCatalogProduct[],
  system: TrackSystemId,
): FeedCatalogProduct[] {
  const allowed = allowedTrackProfileVendors(system);
  return products.filter(
    (p) =>
      p.kind === "TRACK_PROFILE" &&
      p.system === system &&
      p.priceRub > 0 &&
      allowed.has(toText(p.vendorCode)),
  );
}

/** Набор систем под способ монтажа: встроенный, накладной или ещё не выбран. */
export function systemsForMountType(mountType: TrackMountType): TrackSystemId[] {
  if (mountType === "built-in") return ["COLIBRI_220", "CLARUS_48"];
  if (mountType === "surface") return ["TRACK_220"];
  return ["COLIBRI_220", "CLARUS_48", "TRACK_220"];
}

/** Какие системы предлагать на экране выбора: без метража трека предлагать нечего. */
export function wizardSystemOptionsFor(input: {
  requiredTrackMeters: number;
  trackMountType: TrackMountType;
}): TrackSystemId[] {
  if (input.requiredTrackMeters <= 0) return [];
  return systemsForMountType(input.trackMountType);
}

export type TrackProfileRecommendation = {
  product: FeedCatalogProduct;
  system: TrackSystemId;
  qty: number;
  totalMeters: number;
};

/**
 * Готовое предложение «профиль под ваш метраж»: самый дешёвый подходящий
 * профиль каждой системы и количество кусков.
 */
export function buildTrackProfileRecommendations(input: {
  showCeiling: boolean;
  requiredTrackMeters: number;
  trackMountType: TrackMountType;
  products: readonly FeedCatalogProduct[];
}): TrackProfileRecommendation[] {
  const { showCeiling, requiredTrackMeters, trackMountType, products } = input;
  if (!showCeiling || requiredTrackMeters <= 0) return [];

  const targetSystems: TrackSystemId[] =
    trackMountType === "built-in"
      ? ["COLIBRI_220", "CLARUS_48"]
      : trackMountType === "surface"
        ? ["TRACK_220"]
        : [];

  return targetSystems
    .map((system) => {
      const profiles = selectTrackProfilesOfSystem(products, system);
      if (!profiles.length) return null;
      profiles.sort((a, b) => a.priceRub - b.priceRub);

      const best = profiles[0];
      const pieceM = inferPieceLengthMeters(best);
      if (!pieceM || pieceM <= 0) return null;

      const qty = Math.ceil(requiredTrackMeters / pieceM);
      return { product: best, system, qty, totalMeters: qty * pieceM };
    })
    .filter((item): item is TrackProfileRecommendation => item !== null);
}

/**
 * Профили для экрана «Трековый профиль» в мастере.
 *
 * Порядок систем: выбранная → предложенные → по способу монтажа. Внутри —
 * сортировка по названию системы и цене, чтобы COLIBRI и CLARUS не
 * перемешивались в одну кашу.
 */
export function selectWizardTrackProfiles(input: {
  products: readonly FeedCatalogProduct[];
  selectedSystem: TrackSystemId | null;
  recommendedSystems: readonly TrackSystemId[];
  trackMountType: TrackMountType;
}): FeedCatalogProduct[] {
  const { products, selectedSystem, recommendedSystems, trackMountType } = input;

  const systems: TrackSystemId[] = selectedSystem
    ? [selectedSystem]
    : recommendedSystems.length > 0
      ? [...recommendedSystems]
      : systemsForMountType(trackMountType);

  const uniqueSystems = Array.from(new Set(systems));
  const result: FeedCatalogProduct[] = [];

  for (const system of uniqueSystems) {
    result.push(...selectTrackProfilesOfSystem(products, system));
  }

  return result.sort((a, b) => {
    const systemDiff = systemLabelOf(a.system as TrackSystemId).localeCompare(
      systemLabelOf(b.system as TrackSystemId),
      "ru",
    );
    return systemDiff || a.priceRub - b.priceRub;
  });
}

/** Светильники выбранной трековой системы, от дешёвых к дорогим. */
export function selectTrackFixtures(
  products: readonly FeedCatalogProduct[],
  system: TrackSystemId | null,
): FeedCatalogProduct[] {
  if (!system) return [];
  return products
    .filter((p) => p.kind === "TRACK_FIXTURE" && p.system === system && p.priceRub > 0)
    .sort((a, b) => a.priceRub - b.priceRub);
}

/** Люстры (экран T-043). */
export function selectChandeliers(
  products: readonly FeedCatalogProduct[],
): FeedCatalogProduct[] {
  return products.filter((p) => p.kind === "CHANDELIER");
}

/** Подсветка карниза: лента, питание и управление ею (экран T-043). */
export function selectCorniceLighting(
  products: readonly FeedCatalogProduct[],
): FeedCatalogProduct[] {
  return products.filter(
    (p) => p.kind === "LED_STRIP" || p.kind === "PSU" || p.kind === "CONTROL",
  );
}

/**
 * Точечные светильники: сетка следует за выбранным типом (N-021), а цоколь
 * сужает её только когда человек сам открыл ручной выбор.
 */
export function selectPointProducts(input: {
  products: FeedCatalogProduct[];
  manualOpen: boolean;
  socketTab: PointSubtypeId;
  pointKind: PointKindId;
}): FeedCatalogProduct[] {
  if (input.manualOpen) {
    return input.products
      .filter((p) => matchesPointSubtype(p, input.socketTab) && p.priceRub > 0)
      .sort((a, b) => a.priceRub - b.priceRub);
  }
  return pointsOfKind(input.products, input.pointKind);
}

const TRACK_KINDS: FeedCatalogProduct["kind"][] = ["TRACK_PROFILE", "TRACK_FIXTURE"];
const TRACK_KINDS_WITH_ACCESSORY: FeedCatalogProduct["kind"][] = [
  "TRACK_PROFILE",
  "TRACK_FIXTURE",
  "TRACK_ACCESSORY",
];

/**
 * Система трека, вычитанная из корзины: чем человек уже начал комплектоваться.
 *
 * `withAccessory` включает аксессуары — так система определяется на экране
 * выбора светильников, где профиля в корзине может ещё не быть, а соединитель
 * или ввод питания уже есть.
 */
export function detectCartTrackSystem(
  entries: readonly CartEntry[],
  options: { withAccessory?: boolean } = {},
): TrackSystemId | null {
  const kinds = options.withAccessory ? TRACK_KINDS_WITH_ACCESSORY : TRACK_KINDS;
  const trackEntry = entries.find((e) => kinds.includes(e.product.kind));
  const system = trackEntry?.product.system ?? "";
  return isTrackSystemId(system) ? (system as TrackSystemId) : null;
}

/** Сколько закладных/решёток нужно под выбранные светильники — по артикулам. */
export function calcMountRequiredByVendor(
  entries: readonly CartEntry[],
): Record<string, number> {
  const required: Record<string, number> = {};

  for (const entry of entries) {
    const mountVendor = POINT_TO_MOUNT_VENDOR_CODE[toText(entry.product.vendorCode)];
    if (mountVendor) required[mountVendor] = (required[mountVendor] ?? 0) + entry.qty;
  }

  return required;
}

export type ClarusPsuOption = { productId: string; name: string };

/** Варианты БП для CLARUS; пусто — если блок уже выбран или CLARUS нет. */
export function buildClarusPsuOptions(input: {
  hasClarusInCart: boolean;
  clarusPsuQty: number;
  productIdByVendorCode: ReadonlyMap<string, string>;
  productsById: ReadonlyMap<string, FeedCatalogProduct>;
}): ClarusPsuOption[] {
  if (!input.hasClarusInCart || input.clarusPsuQty >= 1) return [];

  return CLARUS_PSU_VENDOR_CODES.map((vendorCode) => {
    const productId = input.productIdByVendorCode.get(vendorCode);
    const product = productId ? input.productsById.get(productId) : undefined;
    return productId && product ? { productId, name: toText(product.name) } : null;
  }).filter((option): option is ClarusPsuOption => option !== null);
}

/** Сводка корзины для резолвера стартового экрана (`resolveInitialLightingStep`). */
export function summarizeCartForStep(
  entries: readonly CartEntry[],
  missingLampsCount: number,
): ResolveInitialStepInput["cart"] {
  return {
    hasTrackProfile: entries.some((e) => e.product.kind === "TRACK_PROFILE"),
    hasTrackFixture: entries.some((e) => e.product.kind === "TRACK_FIXTURE"),
    hasPoints: entries.some(
      (e) => e.product.kind === "SPOT_FIXTURE" || isPanelProduct(e.product),
    ),
    hasMissingLamps: missingLampsCount > 0,
    isEmpty: entries.length === 0,
  };
}

export type SelectedViewItem = {
  product: FeedCatalogProduct;
  item: { sku: string; name: string; qty: number; priceRub: number };
};

/** Позиции для вкладки «Выбранное». */
export function buildSelectedViewItems(
  entries: readonly CartEntry[],
): SelectedViewItem[] {
  return entries.map((e) => ({
    product: e.product,
    item: {
      sku: toText(e.productId),
      name: toText(e.product.name),
      qty: e.qty,
      priceRub: toNumber(e.product.priceRub),
    },
  }));
}

/** Режим скидки на карточках: с потолком −25 %, без −10 %. */
export function cardDiscountPercentFor(hasCeilingContext: boolean): number {
  return hasCeilingContext
    ? LIGHTING_WITH_CEILING_DISCOUNT_PERCENT
    : LIGHTING_ONLY_DISCOUNT_PERCENT;
}

export type SelectedTotals = {
  regular: number;
  standalone: number;
  withCeiling: number;
  effective: number;
  effectivePercent: number;
  effectiveBenefit: number;
  withCeilingBenefit: number;
};

/** Итоги вкладки «Выбранное» во всех режимах — считает вызывающий, что показать. */
export function calcSelectedTotals(
  items: readonly SelectedViewItem[],
  hasCeilingContext: boolean,
): SelectedTotals {
  const regular = items.reduce((sum, x) => sum + x.item.qty * x.item.priceRub, 0);
  const standalone = applyLightingOnlyDiscount(regular);
  const withCeiling = applyLightingWithCeilingDiscount(regular);
  const effective = hasCeilingContext ? withCeiling : standalone;

  return {
    regular,
    standalone,
    withCeiling,
    effective,
    effectivePercent: cardDiscountPercentFor(hasCeilingContext),
    effectiveBenefit: Math.max(0, regular - effective),
    withCeilingBenefit: Math.max(0, regular - withCeiling),
  };
}

/** Атрибуты карточки — они же участвуют в поиске по каталогу мастера. */
export function pickProductAttrs(
  p: FeedCatalogProduct,
): { label: string; value: string }[] {
  const a = p.keyAttributes?.length ? p.keyAttributes : p.params;
  return (a ?? []).slice(0, 4).map((x) => ({ label: toText(x.label), value: toText(x.value) }));
}

export type ScopeCatalogInput = {
  products: readonly FeedCatalogProduct[];
  /** «Выбранное» показывает позиции корзины, а не каталог. */
  selectedMode: boolean;
  selectedProducts: readonly FeedCatalogProduct[];
  section: CatalogSectionId;
  trackSystem: TrackSystemId;
  trackGroup: TrackGroupId;
  pointSubtype: PointSubtypeId;
  lampSocket: LampSocket;
  query: string;
};

/**
 * Выдача каталога внутри мастера: раздел → группа/цоколь → поиск.
 *
 * ВНИМАНИЕ (PT-018): это НЕ `filterCatalogProducts` из `lib/lighting/catalog-filters`.
 * Правила похожи, но не совпадают — здесь нет фильтра по наличию и цене в
 * большинстве разделов, а поиск дополнительно учитывает атрибуты карточки.
 * Перенесено 1:1, чтобы не менять поведение; сведение двух версий в одну —
 * отдельная задача с собственными тестами (записана в отчёт по PT-018).
 */
export function scopeCatalogProducts(input: ScopeCatalogInput): FeedCatalogProduct[] {
  const { products, section, trackSystem, trackGroup, pointSubtype, lampSocket } = input;

  let scoped: FeedCatalogProduct[] = [];

  if (input.selectedMode) {
    scoped = [...input.selectedProducts];
  } else if (section === "track-systems") {
    if (trackGroup === "TRACK_PROFILE") {
      // Без фильтра по цене: на вкладке каталога показываются все профили
      // белого списка, а на экране мастера — только те, у которых есть цена
      // (там из них строится предложение «профиль под метраж»).
      const allowed = allowedTrackProfileVendors(trackSystem);
      scoped = products.filter(
        (p) =>
          p.kind === "TRACK_PROFILE" &&
          p.system === trackSystem &&
          allowed.has(toText(p.vendorCode)),
      );
    } else {
      scoped = products.filter((p) => p.system === trackSystem && p.kind === trackGroup);
    }
  } else if (section === "point-fixtures") {
    scoped = products.filter((p) => matchesPointSubtype(p, pointSubtype));
  } else if (section === "chandeliers") {
    scoped = selectChandeliers(products);
  } else if (section === "cornice-lighting") {
    scoped = selectCorniceLighting(products);
  } else if (section === "lamps") {
    scoped = products.filter((p) => isLamp(p) && detectSocket(p) === lampSocket);
  } else {
    scoped = products.filter(isMountsOrGrilles);
  }

  const q = toText(input.query).toLowerCase();
  if (!q) return scoped;

  return scoped.filter((p) => {
    const haystack = `${toText(p.name)} ${toText(p.vendorCode)} ${toText(p.categoryPath)} ${pickProductAttrs(p)
      .map((a) => `${a.label} ${a.value}`)
      .join(" ")}`.toLowerCase();
    return haystack.includes(q);
  });
}
