"use client";

import { CatalogSectionClient } from "./CatalogSectionClient";

import snapshotData from "@/data/eks-feed2-snapshot.json";
import type { FeedCatalogProduct, FeedCatalogResult } from "@/lib/eks-feed2-catalog";
import { pricing } from "@/content/pricing";

const snapshotCatalogData: FeedCatalogResult = {
  ok: true,
  updatedAt: String((snapshotData as { updatedAt?: unknown }).updatedAt ?? new Date().toISOString()),
  source: "snapshot",
  discountPercentForCeilingOrder: pricing.lightingDiscount.withCeilingPct,
  categories: [],
  products: ((snapshotData as { products?: unknown[] }).products ?? []) as FeedCatalogProduct[],
};

export function CatalogSection() {
  return <CatalogSectionClient data={snapshotCatalogData} />;
}
