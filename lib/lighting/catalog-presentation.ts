import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";
import { sortByPhoto } from "@/lib/catalog-photo";
import { toNumber, toText } from "@/lib/feed2-snapshot-normalize";
import { filterCatalogProducts, searchHaystack, sectionOfProduct, type CatalogFilters } from "./catalog-filters";
import { isSmartProduct } from "./product-predicates";

export type CatalogSort = "photo" | "price-asc" | "price-desc" | "name";

/** Search covers the entire active section, not just the default system/type.
 * A profile SKU must remain findable while the fixture subfilter is selected.
 * Other sections are offered by searchMatchesBySection. No pricing/BOM changes.
 */
export function catalogViewProducts(products: readonly FeedCatalogProduct[], filters: CatalogFilters) {
  const query = toText(filters.query).toLowerCase();
  if (!query) return filterCatalogProducts(products, filters);
  return sortByPhoto(products.filter((product) =>
    sectionOfProduct(product) === filters.section &&
    (!filters.smartOnly || isSmartProduct(product)) && searchHaystack(product).includes(query)
  ));
}

/** Presentation only: never mutates the feed or the shopping cart. */
export function sortCatalogProducts(products: readonly FeedCatalogProduct[], sort: CatalogSort) {
  const copy = [...products];
  if (sort === "photo") return copy;
  if (sort === "name") return copy.sort((a, b) => toText(a.name).localeCompare(toText(b.name), "ru"));
  return copy.sort((a, b) => {
    const ap = toNumber(a.priceRub), bp = toNumber(b.priceRub);
    const aKnown = Number.isFinite(ap) && ap > 0, bKnown = Number.isFinite(bp) && bp > 0;
    if (aKnown !== bKnown) return aKnown ? -1 : 1;
    if (!aKnown) return 0;
    return sort === "price-asc" ? ap - bp : bp - ap;
  });
}
