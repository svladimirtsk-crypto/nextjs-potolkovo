import policy from "@/content/catalog-retired.json";

export const RETIRED_VENDOR_CODES = new Set(policy.map(item => item.vendorCode));

/** A withdrawn physical item stays withdrawn if its supplier code changes. */
export function isRetiredCatalogProduct(product: { vendorCode?: string; offerId?: string; productId?: string }): boolean {
  return policy.some(item => item.vendorCode === String(product.vendorCode ?? "").trim()
    || (item.offerId && item.offerId === String(product.offerId ?? "").trim())
    || (item.productId && item.productId === String(product.productId ?? "").trim()));
}
