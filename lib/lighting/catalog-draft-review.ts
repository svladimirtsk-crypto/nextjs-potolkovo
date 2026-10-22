import type { LightingItem, LightingSnapshot } from "@/lib/calculator-modal-types";
import type { CatalogIndex, CatalogIndexProduct } from "./catalog-index";
import {
  applyLightingOnlyDiscount, applyLightingWithCeilingDiscount, calcLightingDiscountAmount,
} from "@/lib/lighting-formulas";

/** LED-20 · Compare immutable draft values to a content-versioned index.
 * offerId/name similarity is NOT permission to migrate a removed productId.
 */
export type DraftField = "missing" | "identity" | "priceRub" | "vendorCode" | "unit" | "packQty" | "moscowStock";
export type DraftChange = {
  sku: string;
  name: string;
  field: DraftField;
  before: string | number | null;
  after: string | number | null;
};
export type CatalogDraftComparison = {
  fromVersion: string | null;
  toVersion: string | null;
  changes: DraftChange[];
  requiresReview: boolean;
  canApply: boolean;
};

type ProductLookup = { byId: Map<string, CatalogIndexProduct>; byVendor: Map<string, CatalogIndexProduct> };
function lookupOf(index: CatalogIndex): ProductLookup {
  const byId = new Map<string, CatalogIndexProduct>();
  const byVendor = new Map<string, CatalogIndexProduct>();
  for (const product of index.products) {
    byId.set(product.productId, product);
    if (product.vendorCode) byVendor.set(product.vendorCode, product);
  }
  return { byId, byVendor };
}

function currentProduct(item: LightingItem, lookup: ProductLookup): CatalogIndexProduct | undefined {
  return lookup.byId.get(item.sku) ?? lookup.byVendor.get(item.sku);
}

export function compareCatalogDraft(cart: LightingSnapshot | null, index: CatalogIndex): CatalogDraftComparison {
  const fromVersion = cart?.catalogVersion || null;
  const toVersion = index.catalogVersion || null;
  const items = cart?.mode === "catalog" ? cart.items ?? [] : [];
  const lookup = lookupOf(index);
  const changes: DraftChange[] = [];
  let canApply = Boolean(toVersion);
  const visited = new Set<string>();

  for (const item of items) {
    const add = (field: DraftField, before: DraftChange["before"], after: DraftChange["after"]) => {
      if (before !== after) changes.push({ sku: item.sku, name: item.name, field, before, after });
    };
    if (!item.sku || visited.has(item.sku) || !(item.qty > 0) || !Number.isFinite(item.qty)) {
      canApply = false;
      add("identity", item.sku || null, null);
      continue;
    }
    visited.add(item.sku);
    const product = currentProduct(item, lookup);
    if (!product) {
      canApply = false;
      add("missing", item.sku, null);
      continue;
    }
    if (!product.available) {
      canApply = false;
      add("missing", item.sku, "поставщик отметил недоступным");
      continue;
    }
    if (!Number.isFinite(product.priceRub) || product.priceRub <= 0) canApply = false;
    add("identity", item.sku, product.productId);
    add("priceRub", Number.isFinite(item.priceRub) ? item.priceRub : null, product.priceRub);
    add("vendorCode", item.vendorCode || null, product.vendorCode || null);
    const oldUnit = item.unit || null;
    const newUnit = product.unit || null;
    add("unit", oldUnit, newUnit);
    if (oldUnit !== newUnit) canApply = false; // qty could have a different meaning
    const oldPack = item.packQty ?? null;
    const newPack = product.packQty ?? null;
    add("packQty", oldPack, newPack);
    if (oldPack !== newPack) canApply = false; // no silent metres/reels/MOQ migration
    add("moscowStock", item.moscowStock ?? null, product.stockByWarehouse?.moscow ?? null);
  }

  return {
    fromVersion,
    toVersion,
    changes,
    requiresReview: items.length > 0 && (fromVersion !== toVersion || changes.length > 0),
    canApply,
  };
}

/** Only the explicit acknowledgement path may reprice a changed draft. Fail
 * closed if the index changed since comparison, or if an item/pack disappeared.
 * Even after acknowledgement, stock and commercial terms remain unverified. */
export function acceptCatalogDraftReview(
  cart: LightingSnapshot,
  index: CatalogIndex,
  checked: CatalogDraftComparison,
  acceptedAt?: string,
): LightingSnapshot | null {
  const current = compareCatalogDraft(cart, index);
  if (JSON.stringify(current) !== JSON.stringify(checked) || !current.canApply || !current.toVersion) return null;
  if (current.requiresReview && (!acceptedAt || Number.isNaN(Date.parse(acceptedAt)))) return null;

  const lookup = lookupOf(index);
  const items = (cart.items ?? []).map((item): LightingItem => {
    const product = currentProduct(item, lookup);
    if (!product) throw new Error("Catalog changed during draft review");
    return {
      ...item,
      sku: product.productId,
      name: product.name,
      vendorCode: product.vendorCode,
      priceRub: product.priceRub,
      unit: product.unit,
      packQty: product.packQty ?? null,
      moscowStock: product.stockByWarehouse?.moscow ?? null,
      stockObservedAt: product.stockObservedAt ?? null,
    };
  });
  const totalRub = items.reduce((sum, item) => sum + item.qty * item.priceRub, 0);
  const standalone = applyLightingOnlyDiscount(totalRub);
  const withCeiling = applyLightingWithCeilingDiscount(totalRub);
  const discounted = cart.discountMode === "with-ceiling" ? withCeiling
    : cart.discountMode === "none" ? totalRub : standalone;
  return {
    ...cart,
    catalogVersion: current.toVersion,
    ...(current.requiresReview ? {
      catalogReview: {
        fromVersion: current.fromVersion,
        toVersion: current.toVersion,
        acceptedAt: acceptedAt!,
        fields: [...new Set(current.changes.map(change => change.field))],
      },
    } : {}),
    items,
    totalRub,
    discountedTotalRub: discounted,
    standaloneDiscountedTotalRub: standalone,
    withCeilingDiscountedTotalRub: withCeiling,
    discountAmountRub: calcLightingDiscountAmount(totalRub, discounted),
  };
}
