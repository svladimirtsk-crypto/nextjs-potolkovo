import {
  CLARUS_PSU_VENDOR_CODES,
  LAMP_SOCKETS,
  POINT_TO_MOUNT_VENDOR_CODE,
  type LampSocket,
} from "@/lib/catalog-ui-config";
import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";
import { detectSocket, getRequiredLampSocket } from "@/lib/feed2-products";
import { toNumber, toText } from "@/lib/feed2-snapshot-normalize";

/**
 * N-051 · Чего не хватает корзине каталога, чтобы комплект собрался.
 *
 * Вынесено из `CatalogSectionClient` как чистые функции: правила
 * совместимости — это бизнес-логика, а не разметка, и её нужно проверять
 * тестами, а не кликами по странице.
 */

export type CartEntry = { product: FeedCatalogProduct; qty: number };
export type CartItems = Record<string, number>;

export type MissingMount = {
  fixtureVendorCode: string;
  mountVendorCode: string;
  requiredQty: number;
  currentQty: number;
  mountName?: string;
};

export type MissingLamp = {
  socket: LampSocket;
  requiredQty: number;
  currentQty: number;
  cheapestLampId: string | null;
};

export type LampsBySocket = Record<LampSocket, FeedCatalogProduct[]>;

const emptyBySocket = (): Record<LampSocket, number> => ({ GX53: 0, MR16: 0, GU10: 0 });

/**
 * Сколько закладных каждого артикула требуется под выбранные светильники.
 * Нужна кнопке «Добавить 1:1»: она проставляет ровно это количество.
 */
export function calcMountRequiredByVendor(entries: readonly CartEntry[]): Record<string, number> {
  const required: Record<string, number> = {};
  for (const entry of entries) {
    const mountVendor = POINT_TO_MOUNT_VENDOR_CODE[toText(entry.product.vendorCode)];
    if (!mountVendor) continue;
    required[mountVendor] = (required[mountVendor] ?? 0) + entry.qty;
  }
  return required;
}

/** Закладные 1:1 — на каждый светильник своя, иначе его некуда монтировать. */
export function calcMissingMounts(
  cartItems: CartItems,
  productIdByVendorCode: Map<string, string>,
  byProductId: Map<string, FeedCatalogProduct>,
): MissingMount[] {
  const out: MissingMount[] = [];

  for (const [fixtureVendor, mountVendor] of Object.entries(POINT_TO_MOUNT_VENDOR_CODE)) {
    const fixtureId = productIdByVendorCode.get(fixtureVendor);
    const mountId = productIdByVendorCode.get(mountVendor);
    if (!fixtureId || !mountId) continue;

    const fixtureQty = toNumber(cartItems[fixtureId]);
    if (fixtureQty <= 0) continue;

    const mountQty = toNumber(cartItems[mountId]);
    if (mountQty < fixtureQty) {
      out.push({
        fixtureVendorCode: fixtureVendor,
        mountVendorCode: mountVendor,
        requiredQty: fixtureQty,
        currentQty: mountQty,
        mountName: byProductId.get(mountId)?.name,
      });
    }
  }

  return out;
}

/** Доступные лампы по цоколям, от дешёвых к дорогим — первая и есть «самая доступная». */
export function groupLampsBySocket(products: readonly FeedCatalogProduct[]): LampsBySocket {
  const base = products
    .filter((p) => p.kind === "LAMP" && p.available !== false && toNumber(p.priceRub) > 0)
    .sort((a, b) => toNumber(a.priceRub) - toNumber(b.priceRub));

  const bySocket: LampsBySocket = { GX53: [], MR16: [], GU10: [] };
  for (const socket of LAMP_SOCKETS) {
    bySocket[socket] = base.filter((p) => detectSocket(p) === socket);
  }
  return bySocket;
}

/** Сколько ламп каждого цоколя требуют выбранные светильники. */
export function calcLampRequiredBySocket(entries: readonly CartEntry[]): Record<LampSocket, number> {
  const required = emptyBySocket();
  for (const entry of entries) {
    const socket = getRequiredLampSocket(entry.product);
    if (!socket) continue;
    required[socket] += entry.qty;
  }
  return required;
}

/**
 * Сколько ламп каждого цоколя уже лежит в корзине.
 *
 * Раньше здесь перебирались только GX53 и MR16, а GU10 молча пропускался,
 * хотя `LAMP_SOCKETS` знает про три цоколя. Купленные лампы GU10 не
 * засчитывались, и предупреждение «не хватает ламп» не гасло никогда.
 */
export function calcLampCurrentBySocket(
  cartItems: CartItems,
  lampsBySocket: LampsBySocket,
): Record<LampSocket, number> {
  const current = emptyBySocket();
  for (const socket of LAMP_SOCKETS) {
    for (const lamp of lampsBySocket[socket]) {
      current[socket] += toNumber(cartItems[toText(lamp.productId)]);
    }
  }
  return current;
}

export function calcMissingLamps(
  requiredBySocket: Record<LampSocket, number>,
  currentBySocket: Record<LampSocket, number>,
  lampsBySocket: LampsBySocket,
): MissingLamp[] {
  const out: MissingLamp[] = [];

  for (const socket of LAMP_SOCKETS) {
    const required = toNumber(requiredBySocket[socket]);
    if (required <= 0) continue;

    const current = toNumber(currentBySocket[socket]);
    if (current >= required) continue;

    const cheapest = lampsBySocket[socket][0];
    out.push({
      socket,
      requiredQty: required,
      currentQty: current,
      cheapestLampId: cheapest ? toText(cheapest.productId) : null,
    });
  }

  return out;
}

export function hasClarusFixtures(entries: readonly CartEntry[]): boolean {
  return entries.some((e) => e.product.system === "CLARUS_48" && e.product.kind === "TRACK_FIXTURE");
}

export function calcClarusPsuQty(entries: readonly CartEntry[]): number {
  return entries
    .filter((entry) => CLARUS_PSU_VENDOR_CODES.some((code) => code === toText(entry.product.vendorCode)))
    .reduce((sum, entry) => sum + entry.qty, 0);
}

/**
 * Варианты БП для предупреждения: пусто, когда блок питания уже есть или
 * система не CLARUS. Список строится из каталога, а не из констант —
 * артикул без карточки в фиде показывать нечем.
 */
export function calcClarusPsuOptions(
  entries: readonly CartEntry[],
  productIdByVendorCode: Map<string, string>,
  byProductId: Map<string, FeedCatalogProduct>,
): Array<{ vendorCode: string; productId: string; name: string }> {
  if (!hasClarusFixtures(entries) || calcClarusPsuQty(entries) >= 1) return [];

  return CLARUS_PSU_VENDOR_CODES.flatMap((vendorCode) => {
    const productId = productIdByVendorCode.get(vendorCode);
    if (!productId) return [];
    const product = byProductId.get(productId);
    if (!product) return [];

    return [{ vendorCode, productId, name: toText(product.name) }];
  });
}
