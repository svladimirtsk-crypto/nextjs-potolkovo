import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";
import { detectSocket, getRequiredLampSocket } from "@/lib/feed2-products";
import { toNumber, toText } from "@/lib/feed2-snapshot-normalize";
import {
  CLARUS_PSU_VENDOR_CODES,
  LAMP_SOCKETS,
  POINT_TO_MOUNT_VENDOR_CODE,
  REMOVED_COLIBRI_VENDOR_CODES,
  type LampSocket,
} from "@/lib/catalog-ui-config";
import { isLamp, isPanelProduct } from "@/lib/lighting/product-predicates";
import { calcTrackProfileMeters } from "@/lib/product-length-meters";

/**
 * N-051 · Производные корзины Шага 1.
 *
 * Полтора десятка `useMemo` в `wizard-step1-lighting.tsx` считали, чего в
 * корзине не хватает: ламп под цоколь, креплений под точечные светильники,
 * блоков питания. Это чистая арифметика над списком позиций, но проверить её
 * можно было только прокликав каталог в браузере.
 *
 * Здесь те же вычисления как обычные функции. Комплектность — не косметика:
 * если клиент увезёт светильники без ламп или треки без креплений, монтаж
 * встанет, поэтому логика заслуживает тестов.
 */

export type CartEntry = {
  productId: string;
  product: FeedCatalogProduct;
  qty: number;
};

export type LampSocketCounts = Record<LampSocket, number>;

const emptySocketCounts = (): LampSocketCounts => ({ GX53: 0, MR16: 0, GU10: 0 });

/**
 * Позиции корзины: только положительные количества и только товары, которые
 * ещё существуют в фиде (снятые с продажи COLIBRI молча выпадают).
 */
export function buildCartEntries(
  cartItems: Record<string, number>,
  resolveProduct: (id: string) => FeedCatalogProduct | null | undefined
): CartEntry[] {
  return Object.entries(cartItems)
    .filter(([, qty]) => qty > 0)
    .map(([productId, qty]) => ({ productId, product: resolveProduct(productId), qty }))
    .filter((e): e is CartEntry => Boolean(e.product))
    .filter((e) => !REMOVED_COLIBRI_VENDOR_CODES.has(toText(e.product.vendorCode)));
}

/** Суммарная длина трековых профилей в корзине, метры. */
export function calcSelectedTrackMeters(entries: CartEntry[]): number {
  return entries.reduce(
    (sum, e) =>
      e.product.kind === "TRACK_PROFILE" ? sum + calcTrackProfileMeters(e.product, e.qty) : sum,
    0
  );
}

/** Сколько точек света выбрано: споты и панели. */
export function calcSelectedPointQty(entries: CartEntry[]): number {
  return entries.reduce(
    (sum, e) =>
      e.product.kind === "SPOT_FIXTURE" || isPanelProduct(e.product) ? sum + e.qty : sum,
    0
  );
}

/** Лампы каталога, разложенные по цоколю и отсортированные по цене. */
export function groupLampOptionsBySocket(
  products: FeedCatalogProduct[]
): Record<LampSocket, FeedCatalogProduct[]> {
  const lamps = products.filter(isLamp);
  const byPrice = (a: FeedCatalogProduct, b: FeedCatalogProduct) =>
    toNumber(a.priceRub) - toNumber(b.priceRub);

  const bySocket: Record<LampSocket, FeedCatalogProduct[]> = { GX53: [], MR16: [], GU10: [] };
  for (const socket of LAMP_SOCKETS) {
    bySocket[socket] = lamps.filter((lamp) => detectSocket(lamp) === socket).sort(byPrice);
  }
  return bySocket;
}

/** Сколько ламп каждого цоколя требуют выбранные светильники. */
export function calcLampRequiredBySocket(entries: CartEntry[]): LampSocketCounts {
  const required = emptySocketCounts();
  for (const entry of entries) {
    if (entry.product.kind === "LAMP") continue;
    const socket = getRequiredLampSocket(entry.product);
    if (socket) required[socket] += entry.qty;
  }
  return required;
}

/** Сколько ламп каждого цоколя уже лежит в корзине. */
export function calcLampCurrentBySocket(
  cartItems: Record<string, number>,
  lampOptionsBySocket: Record<LampSocket, FeedCatalogProduct[]>
): LampSocketCounts {
  const current = emptySocketCounts();
  for (const socket of LAMP_SOCKETS) {
    current[socket] = lampOptionsBySocket[socket].reduce(
      (sum, lamp) => sum + toNumber(cartItems[toText(lamp.productId)]),
      0
    );
  }
  return current;
}

export type MissingLamp = { socket: LampSocket; requiredQty: number; currentQty: number };

/** Цоколи, по которым ламп меньше, чем светильников. */
export function calcMissingLamps(
  required: LampSocketCounts,
  current: LampSocketCounts
): MissingLamp[] {
  const missing: MissingLamp[] = [];
  for (const socket of LAMP_SOCKETS) {
    const requiredQty = toNumber(required[socket]);
    if (requiredQty <= 0) continue;
    const currentQty = toNumber(current[socket]);
    if (currentQty < requiredQty) missing.push({ socket, requiredQty, currentQty });
  }
  return missing;
}

/** Всего требуется ламп по всем цоколям. */
export function calcLampRequiredTotal(required: LampSocketCounts): number {
  return LAMP_SOCKETS.reduce((sum, socket) => sum + toNumber(required[socket]), 0);
}

/**
 * Всего ламп в корзине — но считаем только те цоколи, которые реально нужны:
 * лампа «про запас» под неиспользуемый цоколь не должна изображать прогресс.
 */
export function calcLampCurrentTotal(
  required: LampSocketCounts,
  current: LampSocketCounts
): number {
  return LAMP_SOCKETS.reduce(
    (sum, socket) =>
      toNumber(required[socket]) > 0 ? sum + toNumber(current[socket]) : sum,
    0
  );
}

/** Цоколи, которые вообще стоит показать на экране ламп. */
export function calcLampSocketsToShow(
  required: LampSocketCounts,
  current: LampSocketCounts
): LampSocket[] {
  return LAMP_SOCKETS.filter(
    (socket) => toNumber(required[socket]) > 0 || toNumber(current[socket]) > 0
  );
}

export type MissingMount = {
  fixtureVendorCode: string;
  mountVendorCode: string;
  fixtureName: string;
  mountName: string;
  requiredQty: number;
  currentQty: number;
};

/**
 * Светильники, для которых не хватает монтажных комплектов. Пары
 * «светильник → крепление» заданы в `POINT_TO_MOUNT_VENDOR_CODE`.
 */
export function calcMissingMounts(input: {
  cartItems: Record<string, number>;
  productIdByVendorCode: Map<string, string>;
  productsById: Map<string, FeedCatalogProduct>;
}): MissingMount[] {
  const { cartItems, productIdByVendorCode, productsById } = input;
  const missing: MissingMount[] = [];

  for (const [fixtureVendorCode, mountVendorCode] of Object.entries(POINT_TO_MOUNT_VENDOR_CODE)) {
    const fixtureId = productIdByVendorCode.get(fixtureVendorCode);
    const mountId = productIdByVendorCode.get(mountVendorCode);
    if (!fixtureId || !mountId) continue;

    const fixture = productsById.get(fixtureId);
    const mount = productsById.get(mountId);
    if (!fixture || !mount) continue;

    const requiredQty = toNumber(cartItems[fixtureId]);
    if (requiredQty <= 0) continue;

    const currentQty = toNumber(cartItems[mountId]);
    if (currentQty >= requiredQty) continue;

    missing.push({
      fixtureVendorCode,
      mountVendorCode,
      fixtureName: toText(fixture.name),
      mountName: toText(mount.name),
      requiredQty,
      currentQty,
    });
  }
  return missing;
}

/** Есть ли в корзине позиции системы CLARUS_48 (у неё свои блоки питания). */
export function hasClarusInCart(entries: CartEntry[]): boolean {
  return entries.some((entry) => entry.product.system === "CLARUS_48");
}

/** Сколько блоков питания CLARUS уже выбрано. */
export function calcClarusPsuQty(entries: CartEntry[]): number {
  return entries
    .filter((entry) =>
      CLARUS_PSU_VENDOR_CODES.some((code) => code === toText(entry.product.vendorCode))
    )
    .reduce((sum, entry) => sum + entry.qty, 0);
}

export type AccessorySuggestion = {
  key: string;
  title: string;
  priceRub: number;
  /** Что и сколько положить в корзину, если клиент согласится. */
  productId: string;
  qty: number;
};

/**
 * T-012 · Подсказки по комплектующим — предложение, а не принуждение.
 *
 * Считаем, чего не хватает, и во что это обойдётся. Само добавление в корзину
 * остаётся за компонентом: здесь только данные, поэтому формулировки и суммы
 * можно проверить тестом.
 */
export function buildAccessorySuggestions(input: {
  lampRequiredBySocket: LampSocketCounts;
  lampCurrentBySocket: LampSocketCounts;
  lampOptionsBySocket: Record<LampSocket, FeedCatalogProduct[]>;
  missingMounts: MissingMount[];
  productIdByVendorCode: Map<string, string>;
  productsById: Map<string, FeedCatalogProduct>;
}): AccessorySuggestion[] {
  const suggestions: AccessorySuggestion[] = [];

  for (const socket of LAMP_SOCKETS) {
    const required = toNumber(input.lampRequiredBySocket[socket]);
    const missingQty = required - toNumber(input.lampCurrentBySocket[socket]);
    if (missingQty <= 0) continue;

    // Предлагаем самую доступную лампу: список уже отсортирован по цене.
    const cheapest = input.lampOptionsBySocket[socket]?.[0];
    if (!cheapest) continue;

    suggestions.push({
      key: `lamp-${socket}`,
      title: `К ${required} светильникам нужно ${missingQty} ламп ${socket} — добавить самые доступные`,
      priceRub: toNumber(cheapest.priceRub) * missingQty,
      productId: toText(cheapest.productId),
      qty: missingQty,
    });
  }

  for (const mount of input.missingMounts) {
    const mountId = input.productIdByVendorCode.get(mount.mountVendorCode);
    if (!mountId) continue;
    const product = input.productsById.get(mountId);
    if (!product) continue;

    const missingQty = mount.requiredQty - mount.currentQty;
    if (missingQty <= 0) continue;

    suggestions.push({
      key: `mount-${mount.mountVendorCode}`,
      title: `К «${mount.fixtureName}» нужно ${missingQty} платформ — добавить`,
      priceRub: toNumber(product.priceRub) * missingQty,
      productId: mountId,
      qty: missingQty,
    });
  }

  return suggestions;
}
