import type { FeedCatalogParam, FeedCatalogProduct } from "@/lib/eks-feed2-catalog";
import { ledUnitOf } from "@/lib/lighting/led-hardware";
import {
  hasMoscowObservation, moscowQuantityOf, moscowStockStateOf, supplierAvailableOf,
} from "@/lib/lighting/moscow-stock";

export function toText(value: unknown): string {
  return String(value ?? "").trim();
}

export function toNumber(value: unknown): number {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

export function toNumberOrNull(value: unknown): number | null {
  const num = Number(value ?? NaN);
  return Number.isFinite(num) ? num : null;
}

function toParams(input: unknown): FeedCatalogParam[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((item) => {
      if (!item || typeof item !== "object") {
        return { label: "", value: "" };
      }

      const record = item as Record<string, unknown>;
      return {
        label: toText(record.label),
        value: toText(record.value),
      };
    })
    .filter((item) => item.label.length > 0 && item.value.length > 0);
}

export function normalizeFeedCatalogProduct(raw: unknown, sourceUpdatedAt?: string): FeedCatalogProduct | null {
  if (!raw || typeof raw !== "object") return null;

  const product = raw as Record<string, unknown>;

  const vendorCode = toText(product.vendorCode);
  const offerId = toText(product.offerId);
  const name = toText(product.name);

  if (!name || (!vendorCode && !offerId)) return null;

  const productIdRaw = toText(product.productId);
  const productId = productIdRaw || `feed2-${vendorCode || offerId || name}`;

  const images = Array.isArray(product.images)
    ? product.images.map((item) => toText(item)).filter(Boolean)
    : [];
  const warehouseParam = (param: FeedCatalogParam) =>
    ["остатки мск", "остатки брн"].includes(param.label.toLowerCase().replace(/\s+/g, " "));
  const stockByWarehouse = hasMoscowObservation(product)
    ? { moscow: moscowQuantityOf(product) } : undefined;
  const available = supplierAvailableOf(product.available) === true;
  const packQty = product.packQty === undefined || product.packQty === null || product.packQty === ""
    ? null : Number(product.packQty);

  const normalized: FeedCatalogProduct = {
    productId: toText(productId),
    vendorCode,
    offerId,
    name,
    url: toText(product.url),
    categoryId: toText(product.categoryId),
    categoryPath: toText(product.categoryPath),
    images,
    coverImage: toText(product.coverImage) || images[0] || "",
    priceRub: toNumber(product.priceRub),
    available,
    stockByWarehouse,
    availabilityState: moscowStockStateOf({ available, stockByWarehouse }),
    stockObservedAt: stockByWarehouse ? toText(product.stockObservedAt) || sourceUpdatedAt || null : null,
    packQty: packQty !== null && Number.isFinite(packQty) && packQty > 0 ? packQty : null,
    catalogVersion: toText(product.catalogVersion) || undefined,
    params: toParams(product.params).filter((param) => !warehouseParam(param)),
    keyAttributes: toParams(product.keyAttributes).filter((param) => !warehouseParam(param)),
    system: (toText(product.system) || "UNKNOWN") as FeedCatalogProduct["system"],
    kind: (toText(product.kind) || "OTHER") as FeedCatalogProduct["kind"],
    unit: (toText(product.unit) === "m" ? "m" : "pcs") as FeedCatalogProduct["unit"],
    lengthMeters: toNumberOrNull(product.lengthMeters),
    pieceLengthMeters: toNumberOrNull(product.pieceLengthMeters),
  };

  // LED-группа: пульты, контроллеры и блоки питания — штуки, хотя витрина
  // отдаёт всю категорию в метрах. Иначе «пульт × 1 м» уезжает в корзину.
  normalized.unit = ledUnitOf(normalized);

  return normalized;
}

export function normalizeFeedCatalogProducts(rawProducts: unknown[], sourceUpdatedAt?: string): FeedCatalogProduct[] {
  return rawProducts
    .map((item) => normalizeFeedCatalogProduct(item, sourceUpdatedAt))
    .filter((item): item is FeedCatalogProduct => Boolean(item));
}
