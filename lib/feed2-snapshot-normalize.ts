import type { FeedCatalogParam, FeedCatalogProduct } from "@/lib/eks-feed2-catalog";

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

export function normalizeFeedCatalogProduct(raw: unknown): FeedCatalogProduct | null {
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

  return {
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
    available: Boolean(product.available ?? true),
    params: toParams(product.params),
    keyAttributes: toParams(product.keyAttributes),
    system: (toText(product.system) || "UNKNOWN") as FeedCatalogProduct["system"],
    kind: (toText(product.kind) || "OTHER") as FeedCatalogProduct["kind"],
    unit: (toText(product.unit) === "m" ? "m" : "pcs") as FeedCatalogProduct["unit"],
    lengthMeters: toNumberOrNull(product.lengthMeters),
    pieceLengthMeters: toNumberOrNull(product.pieceLengthMeters),
  };
}

export function normalizeFeedCatalogProducts(rawProducts: unknown[]): FeedCatalogProduct[] {
  return rawProducts
    .map((item) => normalizeFeedCatalogProduct(item))
    .filter((item): item is FeedCatalogProduct => Boolean(item));
}
