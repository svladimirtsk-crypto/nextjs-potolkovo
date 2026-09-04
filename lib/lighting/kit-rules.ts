/**
 * T-031/T-032 · Правила комплектации света.
 *
 * Единственная реализация вещей, которые раньше были продублированы в модалке
 * и на странице каталога: совместимость систем, вычистка несовместимых позиций
 * и автосборка профиля под нужную длину трека.
 */
import { CLARUS_PSU_VENDOR_CODES } from "@/lib/catalog-ui-config";
import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";
import { toNumber, toText } from "@/lib/feed2-snapshot-normalize";
import { calcProfilesForTrackMeters, type ProfileEntry, type ProfilePiece } from "@/lib/lighting-kits";

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

export type { ProfileEntry, ProfilePiece };

/**
 * Подбирает набор профилей под нужную длину трека: сначала длинные куски,
 * остаток добивается самым коротким. Перенос `calcProfilesForTrackLength`
 * в общие правила — теперь это единственная точка автосборки.
 */
export function profilesForMeters(
  meters: number,
  profiles: readonly ProfileEntry[]
): ProfilePiece[] {
  return calcProfilesForTrackMeters(meters, profiles);
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
