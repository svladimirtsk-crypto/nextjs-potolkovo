"use client";

import { useEffect, useSyncExternalStore } from "react";
import { getCatalogIndex } from "./catalog-index";
import { createCatalogProductsResource, type CatalogProductsState } from "./catalog-products-resource";
export type { CatalogProductsState } from "./catalog-products-resource";

// T-029: the same lazy local index, never the full feed in the initial bundle.
// Shared recovery also updates footer/summary consumers after a failed load.
const resource = createCatalogProductsResource(getCatalogIndex);

export function useCatalogProducts(): CatalogProductsState & { retry: () => Promise<void> } {
  const state = useSyncExternalStore(resource.subscribe, resource.getSnapshot, resource.getServerSnapshot);
  useEffect(() => { void resource.ensureLoaded(); }, []);
  return { ...state, retry: resource.retry };
}
