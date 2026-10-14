import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";
import type { CatalogIndex } from "./catalog-index";
import { buildCatalogProducts } from "./catalog-products";

export type CatalogProductsState = {
  products: FeedCatalogProduct[];
  isLoading: boolean;
  error: Error | null;
};

/** B8-005: one loading/recovery state for every mounted catalog consumer.
 * No new transport, prices or cart storage: the existing index loader is reused.
 * Failure is retried only on explicit action, not on render or remount.
 */
export function createCatalogProductsResource(load: () => Promise<CatalogIndex>) {
  const initial: CatalogProductsState = { products: [], isLoading: true, error: null };
  let state = initial;
  let pending: Promise<void> | null = null;
  const listeners = new Set<() => void>();
  const publish = (next: CatalogProductsState) => {
    state = next;
    for (const listener of listeners) listener();
  };
  const start = (retry = false): Promise<void> => {
    if (pending) return pending;
    if (!state.isLoading && (!state.error || !retry)) return Promise.resolve();
    if (state !== initial) publish(initial);
    pending = Promise.resolve().then(load).then(index => {
      publish({ products: buildCatalogProducts(index), isLoading: false, error: null });
    }).catch((cause: unknown) => {
      publish({ products: [], isLoading: false, error: cause instanceof Error ? cause : new Error(String(cause)) });
    }).finally(() => { pending = null; });
    return pending;
  };
  return {
    getSnapshot: () => state,
    getServerSnapshot: () => initial,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    ensureLoaded: () => start(),
    retry: () => start(true),
  };
}
