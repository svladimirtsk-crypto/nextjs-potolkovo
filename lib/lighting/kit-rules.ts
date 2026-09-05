/**
 * T-031/T-032 · Правила комплектации света.
 *
 * Единственная реализация вещей, которые раньше были продублированы в модалке
 * и на странице каталога: совместимость систем, вычистка несовместимых позиций
 * и автосборка профиля под нужную длину трека.
 */
import { CLARUS_PSU_VENDOR_CODES } from "@/lib/catalog-ui-config";
import type { FeedCatalogKind, FeedCatalogProduct } from "@/lib/eks-feed2-catalog";
import { toNumber, toText } from "@/lib/feed2-snapshot-normalize";
import { inferPieceLengthMeters } from "@/lib/product-length-meters";

export type TrackSystemId = "COLIBRI_220" | "CLARUS_48" | "TRACK_220";

const TRACK_SYSTEM_IDS = new Set<string>(["COLIBRI_220", "CLARUS_48", "TRACK_220"]);

export function isTrackSystemId(value: string): value is TrackSystemId {
  return TRACK_SYSTEM_IDS.has(value);
}

/** Корзина: productId → количество. */
export type Cart = Record<string, number>;

/** Позиции, привязанные к конкретной трековой системе. */
function isSystemBoundProduct(product: FeedCatalogProduct): boolean {
  return (
    product.kind === "TRACK_PROFILE" ||
    product.kind === "TRACK_FIXTURE" ||
    product.kind === "TRACK_ACCESSORY"
  );
}

/** Блоки питания CLARUS не подходят другим системам. */
function isClarusPsu(product: FeedCatalogProduct): boolean {
  return new Set<string>(CLARUS_PSU_VENDOR_CODES).has(toText(product.vendorCode));
}

function isIncompatible(product: FeedCatalogProduct, targetSystem: TrackSystemId): boolean {
  if (isSystemBoundProduct(product) && product.system !== targetSystem) return true;
  if (isClarusPsu(product) && targetSystem !== "CLARUS_48") return true;
  return false;
}

/** Длина одного куска профиля в метрах (штучный товар) либо 1 м для метражного. */
function pieceMetersOf(product: FeedCatalogProduct): number {
  if (product.unit === "m") return 1;
  return toNumber(inferPieceLengthMeters(product));
}

export type CartConflict = {
  /** Система, которая уже набрана в корзине. */
  currentSystem: TrackSystemId;
  /** Система добавляемого товара. */
  targetSystem: TrackSystemId;
  /** Сколько позиций будет убрано. */
  count: number;
  /** На какую сумму. */
  totalRub: number;
  /** Текст для showConfirmDialog. */
  message: string;
};

/**
 * Проверяет, конфликтует ли добавляемый товар с содержимым корзины.
 * Возвращает `null`, когда конфликта нет и подтверждение не нужно.
 */
export function conflicts(
  cart: Cart,
  product: FeedCatalogProduct,
  resolveProduct: (productId: string) => FeedCatalogProduct | undefined
): CartConflict | null {
  const targetSystem = toText(product.system);
  if (!isTrackSystemId(targetSystem)) return null;
  // Конфликт создают только позиции, привязанные к системе.
  if (!isSystemBoundProduct(product)) return null;

  let count = 0;
  let totalRub = 0;
  let currentSystem: TrackSystemId | null = null;

  for (const [productId, qty] of Object.entries(cart)) {
    if (toNumber(qty) <= 0) continue;
    const item = resolveProduct(productId);
    if (!item) continue;
    if (!isIncompatible(item, targetSystem)) continue;

    count += 1;
    totalRub += toNumber(item.priceRub) * toNumber(qty);

    const system = toText(item.system);
    if (!currentSystem && isTrackSystemId(system)) currentSystem = system;
  }

  if (count === 0) return null;

  const label = (system: TrackSystemId) => system.split("_")[0];
  const resolvedCurrent = currentSystem ?? targetSystem;

  return {
    currentSystem: resolvedCurrent,
    targetSystem,
    count,
    totalRub,
    message: `Заменить систему ${label(resolvedCurrent)} на ${label(targetSystem)}? Будут убраны ${count} ${
      count === 1 ? "позиция" : "позиции"
    } на ${Math.round(totalRub).toLocaleString("ru-RU")} ₽`,
  };
}

/**
 * Убирает из корзины позиции, несовместимые с выбранной системой.
 * Возвращает новую корзину — исходная не мутируется.
 */
export function clearIncompatibleSystem(
  cart: Cart,
  targetSystem: string,
  resolveProduct: (productId: string) => FeedCatalogProduct | undefined
): Cart {
  if (!isTrackSystemId(targetSystem)) return cart;

  const next: Cart = {};
  for (const [productId, qty] of Object.entries(cart)) {
    const product = resolveProduct(productId);
    if (product && isIncompatible(product, targetSystem)) continue;
    next[productId] = qty;
  }
  return next;
}

/* ------------------------------------------------------------------ *
 * T-032 · Автосборка профиля
 * ------------------------------------------------------------------ */

/** Типовая длина куска профиля. */
export type ProfileLength = 1000 | 2000 | 3000;

export type ProfileEntry = {
  sku: string;
  lengthMm: ProfileLength;
  priceRub: number | null;
};

export type ProfilePiece = ProfileEntry & {
  qty: number;
  name: string;
};

/**
 * Подбирает набор профилей под нужную длину трека: сначала длинные куски,
 * остаток добивается самым коротким.
 *
 * T-060: алгоритм переехал сюда из `lib/lighting-kits.ts` — тот модуль нёс
 * захардкоженные прайсы COLIBRI/CLARUS, разъезжавшиеся с фидом, и удалён.
 * Цены теперь всегда приходят из каталога вместе с `ProfileEntry`.
 */
export function profilesForMeters(
  meters: number,
  profiles: readonly ProfileEntry[]
): ProfilePiece[] {
  const trackLengthMm = Math.round(meters * 1000);
  if (trackLengthMm <= 0 || profiles.length === 0) return [];

  const sorted = [...profiles].sort((a, b) => b.lengthMm - a.lengthMm);
  const result = new Map<string, ProfilePiece>();
  let remaining = trackLengthMm;

  for (const profile of sorted) {
    if (remaining <= 0) break;
    const count = Math.floor(remaining / profile.lengthMm);
    if (count > 0) {
      result.set(profile.sku, {
        ...profile,
        qty: count,
        name: `Профиль ${profile.lengthMm} мм`,
      });
      remaining -= count * profile.lengthMm;
    }
  }

  // Хвост короче самого мелкого куска всё равно требует ещё одного профиля.
  if (remaining > 0) {
    const smallest = sorted[sorted.length - 1];
    const existing = result.get(smallest.sku);
    result.set(
      smallest.sku,
      existing
        ? { ...existing, qty: existing.qty + 1 }
        : { ...smallest, qty: 1, name: `Профиль ${smallest.lengthMm} мм` }
    );
  }

  return Array.from(result.values());
}

/** Подобранный кусок профиля из реального каталога. */
export type AutoProfilePiece = {
  product: FeedCatalogProduct;
  qty: number;
  /** Длина одного куска в метрах. */
  pieceMeters: number;
  totalRub: number;
};

export type AutoProfilePlan = {
  pieces: AutoProfilePiece[];
  totalMeters: number;
  totalRub: number;
};

/**
 * Автосборка профиля из товаров каталога: сначала длинные куски, остаток
 * добивается самым коротким подходящим. В отличие от `profilesForMeters`,
 * работает с реальным фидом, поэтому результат можно положить в корзину.
 */
export function autoAssembleProfiles(
  meters: number,
  products: readonly FeedCatalogProduct[]
): AutoProfilePlan | null {
  if (!Number.isFinite(meters) || meters <= 0) return null;

  const candidates = products
    .map((product) => ({ product, pieceMeters: pieceMetersOf(product) }))
    .filter((entry) => entry.pieceMeters > 0 && toNumber(entry.product.priceRub) > 0)
    .sort((a, b) => b.pieceMeters - a.pieceMeters);

  if (candidates.length === 0) return null;

  const picked = new Map<string, AutoProfilePiece>();
  let remaining = meters;

  const addPiece = (entry: { product: FeedCatalogProduct; pieceMeters: number }, qty: number) => {
    if (qty <= 0) return;
    const id = toText(entry.product.productId);
    const existing = picked.get(id);
    const nextQty = (existing?.qty ?? 0) + qty;
    picked.set(id, {
      product: entry.product,
      qty: nextQty,
      pieceMeters: entry.pieceMeters,
      totalRub: toNumber(entry.product.priceRub) * nextQty,
    });
    remaining -= entry.pieceMeters * qty;
  };

  for (const entry of candidates) {
    if (remaining <= 0.001) break;
    const count = Math.floor((remaining + 0.001) / entry.pieceMeters);
    if (count > 0) addPiece(entry, count);
  }

  // Остаток добираем самым коротким куском — длину округляем вверх.
  if (remaining > 0.001) {
    const shortest = candidates[candidates.length - 1];
    addPiece(shortest, Math.ceil(remaining / shortest.pieceMeters));
  }

  const pieces = [...picked.values()].sort((a, b) => b.pieceMeters - a.pieceMeters);

  return {
    pieces,
    totalMeters: pieces.reduce((sum, piece) => sum + piece.pieceMeters * piece.qty, 0),
    totalRub: pieces.reduce((sum, piece) => sum + piece.totalRub, 0),
  };
}

/**
 * Ориентир по числу трековых светильников: ±20 % от плотности
 * `pricing.trackSpotsPerMeter`, чтобы не навязывать точное число.
 */
export function fixturesHintForMeters(
  meters: number,
  spotsPerMeter: number
): { min: number; max: number; suggested: number } | null {
  if (!Number.isFinite(meters) || meters <= 0) return null;

  const suggested = Math.max(1, Math.round(meters * spotsPerMeter));
  return {
    min: Math.max(1, Math.floor(suggested * 0.8)),
    max: Math.ceil(suggested * 1.2),
    suggested,
  };
}

/* ------------------------------------------------------------------ *
 * T-042 · Дособирание комплекта: питание, соединители, БП, лампы
 * ------------------------------------------------------------------ */

/** Мощность светильника из названия: «... 18W», «12 Вт». */
export function powerWattsOf(product: FeedCatalogProduct): number {
  const name = toText(product.name);
  const match = /(\d+(?:[.,]\d+)?)\s*(?:W|Вт)\b/i.exec(name);
  if (!match) return 0;
  const value = Number(match[1].replace(",", "."));
  return Number.isFinite(value) ? value : 0;
}

/** Цоколь лампы из названия: GU10, GX53, E27, E14, G9. */
export function socketOf(product: FeedCatalogProduct): string | null {
  const match = /\b(GU10|GX53|GU5\.3|E27|E14|G9|G4)\b/i.exec(toText(product.name));
  return match ? match[1].toUpperCase() : null;
}

export type KitRequirement = {
  /** Сколько независимых трасс трека — на каждую нужен свой ввод питания. */
  runs?: number;
  /** Число углов/поворотов трассы. */
  corners?: number;
};

export type KitSuggestion = {
  product: FeedCatalogProduct;
  qty: number;
  /** Почему позиция предложена — показываем прямо в списке. */
  reason: string;
};

export type CompleteKitResult = {
  /** Без этих позиций комплект не соберётся. */
  mandatory: KitSuggestion[];
  /** Полезно, но можно отказаться. */
  recommended: KitSuggestion[];
  /** CLARUS без блока питания — «К итогу» блокируется до решения. */
  psuMissing: boolean;
};

const PSU_UTILISATION = 1.2;
const PSU_NOMINAL_WATTS = 200;

/** Сколько блоков питания нужно на суммарную мощность: ceil(ΣW × 1.2 / 200). */
export function psuCountForWatts(totalWatts: number): number {
  if (!Number.isFinite(totalWatts) || totalWatts <= 0) return 0;
  return Math.ceil((totalWatts * PSU_UTILISATION) / PSU_NOMINAL_WATTS);
}

/**
 * Число прямых соединителей: куски профиля стыкуются последовательно,
 * каждый угол уже является стыком, плюс один стык не нужен на конце трассы.
 */
export function straightConnectorsFor(pieces: number, corners: number): number {
  return Math.max(0, pieces - corners - 1);
}

/**
 * T-042 · Что добавить к выбранному свету, чтобы он заработал.
 *
 * Правила намеренно живут здесь, а не в UI: их проверяет vitest, и одна и та же
 * логика нужна и мастеру Шага 1, и витрине готовых комплектов.
 */
export function completeKit(
  cart: Cart,
  resolveProduct: (productId: string) => FeedCatalogProduct | null | undefined,
  catalog: readonly FeedCatalogProduct[],
  required: KitRequirement = {}
): CompleteKitResult {
  const entries = Object.entries(cart)
    .map(([productId, qty]) => ({ product: resolveProduct(productId), qty: toNumber(qty) }))
    .filter((e): e is { product: FeedCatalogProduct; qty: number } => Boolean(e.product) && e.qty > 0);

  const mandatory: KitSuggestion[] = [];
  const recommended: KitSuggestion[] = [];

  const profiles = entries.filter((e) => e.product.kind === "TRACK_PROFILE");
  const fixtures = entries.filter((e) => e.product.kind === "TRACK_FIXTURE");
  const system = profiles[0]?.product.system ?? fixtures[0]?.product.system ?? null;

  const has = (kind: FeedCatalogKind, predicate?: (p: FeedCatalogProduct) => boolean) =>
    entries.some((e) => e.product.kind === kind && (!predicate || predicate(e.product)));

  const pick = (predicate: (p: FeedCatalogProduct) => boolean) =>
    catalog.find(
      (p) =>
        predicate(p) &&
        toNumber(p.priceRub) > 0 &&
        (system === null || p.system === system || p.kind === "PSU")
    ) ?? null;

  const nameMatches = (p: FeedCatalogProduct, re: RegExp) => re.test(toText(p.name));

  const pieces = profiles.reduce((sum, e) => sum + e.qty, 0);
  const corners = Math.max(0, toNumber(required.corners));
  const runs = Math.max(pieces > 0 ? 1 : 0, toNumber(required.runs));

  // 1. Ввод питания — по одному на трассу.
  if (runs > 0 && !has("TRACK_ACCESSORY", (p) => nameMatches(p, /ввод|питани|feed/i))) {
    const feed = pick((p) => p.kind === "TRACK_ACCESSORY" && nameMatches(p, /ввод|питани|feed/i));
    if (feed) {
      mandatory.push({
        product: feed,
        qty: runs,
        reason: runs > 1 ? `По одному вводу питания на каждую из ${runs} трасс` : "Ввод питания — без него трек не подключить",
      });
    }
  }

  // 2. Прямые соединители между кусками профиля.
  const straight = straightConnectorsFor(pieces, corners);
  if (straight > 0 && !has("TRACK_ACCESSORY", (p) => nameMatches(p, /прям|соединит/i))) {
    const connector = pick((p) => p.kind === "TRACK_ACCESSORY" && nameMatches(p, /прям|соединит/i));
    if (connector) {
      mandatory.push({
        product: connector,
        qty: straight,
        reason: `${pieces} отрезка профиля стыкуются между собой: ${pieces} − ${corners} угл. − 1`,
      });
    }
  }

  // 3. Блок питания по суммарной мощности — только для низковольтных систем.
  const needsPsu = system === "CLARUS_48";
  const totalWatts = fixtures.reduce((sum, e) => sum + powerWattsOf(e.product) * e.qty, 0);
  const psuNeeded = needsPsu ? psuCountForWatts(totalWatts) : 0;
  const psuInCart = entries
    .filter((e) => e.product.kind === "PSU")
    .reduce((sum, e) => sum + e.qty, 0);

  if (psuNeeded > psuInCart) {
    const psu = pick((p) => p.kind === "PSU");
    if (psu) {
      mandatory.push({
        product: psu,
        qty: psuNeeded - psuInCart,
        reason: `Суммарно ${totalWatts} Вт с запасом 20 % — нужно ${psuNeeded} БП по ${PSU_NOMINAL_WATTS} Вт`,
      });
    }
  }

  // 4. Лампы 1:1 к светильникам «под лампу».
  const lampSockets = new Map<string, number>();
  for (const entry of entries) {
    if (entry.product.kind !== "SPOT_FIXTURE" && entry.product.kind !== "TRACK_FIXTURE") continue;
    const socket = socketOf(entry.product);
    if (!socket) continue;
    lampSockets.set(socket, (lampSockets.get(socket) ?? 0) + entry.qty);
  }
  for (const [socket, qty] of lampSockets) {
    const inCart = entries
      .filter((e) => e.product.kind === "LAMP" && socketOf(e.product) === socket)
      .reduce((sum, e) => sum + e.qty, 0);
    if (inCart >= qty) continue;
    const lamp = catalog.find(
      (p) => p.kind === "LAMP" && socketOf(p) === socket && toNumber(p.priceRub) > 0
    );
    if (lamp) {
      mandatory.push({
        product: lamp,
        qty: qty - inCart,
        reason: `Светильники с цоколем ${socket} продаются без ламп`,
      });
    }
  }

  // 5. Платформы для ZOOM — рекомендация, а не блокер.
  const zoomQty = entries
    .filter((e) => nameMatches(e.product, /zoom/i))
    .reduce((sum, e) => sum + e.qty, 0);
  if (zoomQty > 0 && !has("TRACK_ACCESSORY", (p) => nameMatches(p, /платформ/i))) {
    const platform = pick((p) => nameMatches(p, /платформ/i));
    if (platform) {
      recommended.push({
        product: platform,
        qty: zoomQty,
        reason: "Светильники ZOOM ставятся на монтажную платформу",
      });
    }
  }

  return {
    mandatory,
    recommended,
    psuMissing: needsPsu && psuNeeded > 0 && psuInCart === 0,
  };
}
