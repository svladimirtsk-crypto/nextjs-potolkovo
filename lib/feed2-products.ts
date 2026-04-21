import type { FeedCatalogKind, FeedCatalogProduct, FeedCatalogSystem } from "@/lib/eks-feed2-catalog";

export type UiCatalogSystem = "COLIBRI_220" | "CLARUS_48" | "ART_220" | "NONE";
export type UiCatalogKind =
  | "TRACK_FIXTURE"
  | "TRACK_PROFILE"
  | "TRACK_ACCESSORY"
  | "POINT_FIXTURE"
  | "LAMP"
  | "OTHER";

function getText(product: FeedCatalogProduct): string {
  const attrs = (product.keyAttributes ?? [])
    .map((a) => `${a.label} ${a.value}`)
    .join(" ");
  const params = (product.params ?? []).map((p) => `${p.label} ${p.value}`).join(" ");
  return `${product.name} ${product.vendorCode} ${attrs} ${params}`.toLowerCase();
}

export function buildProductsIndex(products: FeedCatalogProduct[]): Map<string, FeedCatalogProduct> {
  return new Map(products.map((product) => [product.productId, product]));
}

export function getDiscountedPrice(priceRub: number, discountPercent = 15): number {
  const value = Number(priceRub ?? 0);
  const discount = Number(discountPercent ?? 15);
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (!Number.isFinite(discount) || discount <= 0) return Math.round(value);
  return Math.round(value * (1 - discount / 100));
}

export function computeBenefit(priceRub: number, discounted: number): number {
  const full = Number(priceRub ?? 0);
  const disc = Number(discounted ?? 0);
  if (!Number.isFinite(full) || !Number.isFinite(disc)) return 0;
  return Math.max(0, Math.round(full - disc));
}

export function detectSmart(product: FeedCatalogProduct): boolean {
  const text = getText(product);
  return (
    text.includes("smart") ||
    text.includes("умн") ||
    text.includes("wifi") ||
    text.includes("zigbee") ||
    text.includes("bluetooth") ||
    text.includes("tuya")
  );
}

export function detectSocket(product: FeedCatalogProduct): "GX53" | "MR16" | null {
  const text = getText(product);
  if (text.includes("gx53")) return "GX53";
  if (text.includes("mr16") || text.includes("gu5.3")) return "MR16";
  return null;
}

export function normalizeSystem(system: FeedCatalogSystem): UiCatalogSystem {
  if (system === "COLIBRI_220") return "COLIBRI_220";
  if (system === "CLARUS_48") return "CLARUS_48";
  if (system === "TRACK_220") return "ART_220";
  return "NONE";
}

export function normalizeKind(kind: FeedCatalogKind): UiCatalogKind {
  if (kind === "TRACK_FIXTURE") return "TRACK_FIXTURE";
  if (kind === "TRACK_PROFILE") return "TRACK_PROFILE";
  if (kind === "TRACK_ACCESSORY") return "TRACK_ACCESSORY";
  if (kind === "SPOT_FIXTURE") return "POINT_FIXTURE";
  if (kind === "LAMP") return "LAMP";
  return "OTHER";
}

export function classifyProduct(product: FeedCatalogProduct): {
  system: UiCatalogSystem;
  kind: UiCatalogKind;
} {
  return {
    system: normalizeSystem(product.system),
    kind: normalizeKind(product.kind),
  };
}
