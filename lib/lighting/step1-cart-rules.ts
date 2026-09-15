/**
 * PT-018 (B-F104, T-324) · правила изменения корзины Шага 1 «Свет».
 *
 * Это денежный путь: шесть способов положить товар в корзину, и каждый тянет
 * за собой правило совместимости систем (нельзя смешать COLIBRI и CLARUS),
 * округление количества и снятие конкурирующих блоков питания. До переноса
 * правила жили в замыканиях `useCallback` внутри компонента, то есть проверить
 * их можно было только кликом в браузере.
 *
 * Здесь — чистые переходы `корзина → корзина` (как `lib/calculator/reducer.ts`
 * для Шага 0): хук `use-step1-cart` только передаёт им факты и отправляет
 * событие аналитики. Никакого React, никакого состояния.
 */
import {
  CLARUS_PSU_VENDOR_CODES,
  POINT_TO_MOUNT_VENDOR_CODE,
  type LampSocket,
  type TrackSystemId,
} from "@/lib/catalog-ui-config";
import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";
import { toNumber, toText } from "@/lib/feed2-snapshot-normalize";
import {
  clearIncompatibleSystem,
  isTrackSystemId,
  type Cart,
} from "@/lib/lighting/kit-rules";
import type { CartEntry } from "@/lib/lighting/cart-derived";

export type ResolveProduct = (productId: string) => FeedCatalogProduct | undefined;

/** Система товара, если она трековая и известна; иначе `null`. */
export function trackSystemOfProduct(product: FeedCatalogProduct): TrackSystemId | null {
  return isTrackSystemId(product.system) ? product.system : null;
}

/**
 * Убирает из корзины позиции чужой системы. Правит объект на месте: вызывающий
 * уже собирает следующую корзину и возвращать её из вложенной функции нельзя.
 */
function dropIncompatibleInPlace(
  cart: Cart,
  targetSystem: string,
  resolveProduct: ResolveProduct
): void {
  const cleaned = clearIncompatibleSystem(cart, targetSystem, resolveProduct);
  for (const key of Object.keys(cart)) {
    if (!(key in cleaned)) delete cart[key];
  }
}

const CLARUS_PSU_VENDOR_CODE_SET = new Set<string>(CLARUS_PSU_VENDOR_CODES);

/**
 * Количество товара в корзине.
 *
 * `nextQty <= 0` — позиция снимается. Иначе сначала вычищается чужая трековая
 * система (и блоки CLARUS, если товар — их блок питания), затем ставится
 * количество: система определяется товаром, а не порядком кликов.
 */
export function applyProductQty(
  prev: Cart,
  input: { product: FeedCatalogProduct; nextQty: number; resolveProduct: ResolveProduct }
): Cart {
  const id = toText(input.product.productId);
  const next = { ...prev };

  if (input.nextQty <= 0) {
    delete next[id];
    return next;
  }

  const system = input.product.system;
  if (system && isTrackSystemId(system)) {
    dropIncompatibleInPlace(next, system, input.resolveProduct);
  }
  if (CLARUS_PSU_VENDOR_CODE_SET.has(toText(input.product.vendorCode))) {
    dropIncompatibleInPlace(next, "CLARUS_48", input.resolveProduct);
  }

  next[id] = input.nextQty;
  return next;
}

/**
 * Количество профиля. Профиль выбирает систему: чужие трековые позиции
 * снимаются, свои остаются. Товар без известной системы корзину не меняет.
 */
export function applyTrackProfileQty(
  prev: Cart,
  input: { product: FeedCatalogProduct; nextQty: number; resolveProduct: ResolveProduct }
): Cart {
  const system = trackSystemOfProduct(input.product);
  if (!system) return prev;

  const id = toText(input.product.productId);
  const next = clearIncompatibleSystem(prev, system, input.resolveProduct);

  if (input.nextQty <= 0) delete next[id];
  else next[id] = input.nextQty;

  return next;
}

/** Что добавить в корзину: позиция и количество. */
export type CartAddition = { productId: string; qty: number };

/**
 * Закладные/решётки под точки — один к одному.
 *
 * `null` — добавлять нечего: у точки нет закладной в справочнике, закладной нет
 * в каталоге или она уже посчитана нулём. Корзину в этом случае трогать нельзя:
 * апдейтер помечает черновик как «изменённый пользователем» (T-031), а пустой
 * клик таким не был.
 */
export function mountOneToOneTarget(input: {
  fixtureVendorCode: string;
  mountRequiredByVendor: Readonly<Record<string, number>>;
  productIdByVendorCode: ReadonlyMap<string, string>;
}): CartAddition | null {
  const mountVendorCode = POINT_TO_MOUNT_VENDOR_CODE[toText(input.fixtureVendorCode)];
  if (!mountVendorCode) return null;

  const productId = input.productIdByVendorCode.get(mountVendorCode);
  if (!productId) return null;

  const qty = toNumber(input.mountRequiredByVendor[mountVendorCode]);
  if (qty <= 0) return null;

  return { productId, qty };
}

/**
 * Что доложить, чтобы закрыть цоколь: самый дешёвый вариант из каталога и
 * ровно недостача — уже лежащие в корзине лампы не пересчитываются.
 * `null` — lamps не нужны или цоколь закрыт.
 */
export function cheapestLampsAddition(input: {
  socket: LampSocket;
  lampRequiredBySocket: Readonly<Record<string, number>>;
  lampCurrentBySocket: Readonly<Record<string, number>>;
  lampOptionsBySocket: Readonly<Record<string, readonly FeedCatalogProduct[]>>;
}): CartAddition | null {
  const requiredQty = toNumber(input.lampRequiredBySocket[input.socket]);
  if (requiredQty <= 0) return null;

  const qty = Math.max(0, requiredQty - toNumber(input.lampCurrentBySocket[input.socket]));
  if (qty <= 0) return null;

  const cheapest = input.lampOptionsBySocket[input.socket][0];
  if (!cheapest) return null;

  const productId = toText(cheapest.productId);
  if (!productId) return null;

  return { productId, qty };
}

/** Блок питания CLARUS — ровно один: конкурирующие блоки снимаются. */
export function applyClarusPsu(
  prev: Cart,
  input: { productId: string; productIdByVendorCode: ReadonlyMap<string, string> }
): Cart {
  const next = { ...prev };

  for (const vendorCode of CLARUS_PSU_VENDOR_CODES) {
    const id = input.productIdByVendorCode.get(vendorCode);
    if (id && id !== input.productId) delete next[id];
  }

  next[input.productId] = Math.max(1, toNumber(next[input.productId]));
  return next;
}

/**
 * Снять «осиротевшие» трековые позиции (T-024). Если менять нечего,
 * возвращается тот же объект — иначе корзина «изменилась» бы впустую и
 * перерисовала всё, что от неё зависит.
 */
export function dropOrphanTrackItems(prev: Cart, orphanEntries: readonly CartEntry[]): Cart {
  const ids = new Set(orphanEntries.map((entry) => toText(entry.product.productId)));
  if (ids.size === 0) return prev;

  const next = { ...prev };
  let changed = false;
  for (const id of Object.keys(prev)) {
    if (ids.has(id)) {
      delete next[id];
      changed = true;
    }
  }

  return changed ? next : prev;
}

/**
 * Куски автосборки профиля (T-032) кладутся в корзину как есть: количество
 * задаёт план, а не складывается с уже лежащим — иначе повторное нажатие
 * «Собрать автоматически» удваивало бы метраж.
 */
export function applyProfilePlan(
  prev: Cart,
  pieces: readonly { product: FeedCatalogProduct; qty: number }[]
): Cart {
  const next = { ...prev };
  for (const piece of pieces) {
    next[toText(piece.product.productId)] = piece.qty;
  }
  return next;
}

/**
 * «Добавить всё» из дособирания комплекта (T-042): количества СКЛАДЫВАЮТСЯ с
 * уже лежащими в корзине — человек добирает питание и стыки к тому, что есть.
 */
export function applyKitSuggestions(
  prev: Cart,
  suggestions: readonly { product: FeedCatalogProduct; qty: number }[]
): Cart {
  const next = { ...prev };
  for (const suggestion of suggestions) {
    const id = toText(suggestion.product.productId);
    next[id] = (next[id] ?? 0) + suggestion.qty;
  }
  return next;
}

export type CartChangeAction = "add" | "remove" | "change";

export type CartChangeEvent = {
  action: CartChangeAction;
  sku: string;
  productKind: string;
  qty: number;
  source: string;
};

/**
 * Событие аналитики об изменении корзины. `null` — количество не изменилось,
 * сообщать не о чем (клик по «+», который ничего не сделал, событием не был и
 * раньше).
 */
export function describeCartChange(input: {
  product: FeedCatalogProduct;
  prevQty: number;
  nextQty: number;
  source?: string;
}): CartChangeEvent | null {
  if (input.prevQty === input.nextQty) return null;

  const action: CartChangeAction =
    input.prevQty <= 0 && input.nextQty > 0
      ? "add"
      : input.prevQty > 0 && input.nextQty <= 0
        ? "remove"
        : "change";

  return {
    action,
    sku: toText(input.product.productId),
    productKind: String(input.product.kind),
    qty: input.nextQty,
    source: String(input.source ?? "unknown"),
  };
}
