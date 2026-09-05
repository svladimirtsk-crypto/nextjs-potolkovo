"use client";

import { Button } from "@/components/ui/button";
import type { LightingItem, LightingSnapshot } from "@/lib/calculator-modal-types";
import {
  LIGHTING_ONLY_DISCOUNT_PERCENT,
  applyLightingOnlyDiscount,
  applyLightingWithCeilingDiscount,
  calcLightingDiscountAmount,
} from "@/lib/lighting-formulas";
import { useCalculatorModal } from "@/components/calculator-modal/calculator-modal-context";
import { useCatalogProducts } from "@/lib/lighting/use-catalog-products";
import { useLightingCart } from "@/lib/lighting/use-lighting-cart";
import { REMOVED_COLIBRI_VENDOR_CODES } from "@/lib/catalog-ui-config";
import { trackKitClicked } from "@/lib/analytics";
import { useCallback, useMemo } from "react";
import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";

type LightKitCtaButtonProps = {
  title: string;
  items: LightingItem[];
  source?: string;
};

function toText(value: unknown): string {
  return String(value ?? "").trim();
}

function shouldDropRemovedItem(item: LightingItem): boolean {
  const sku = toText(item.sku);
  const name = toText(item.name);

  if (REMOVED_COLIBRI_VENDOR_CODES.has(sku)) return true;

  for (const vendorCode of REMOVED_COLIBRI_VENDOR_CODES) {
    if (name.includes(vendorCode)) return true;
  }

  return false;
}

export function LightKitCtaButton({ title, items, source }: LightKitCtaButtonProps) {
  const { openCalculator } = useCalculatorModal();

  /**
   * T-031: комплект кладётся в ту же корзину, что и каталог страницы,
   * поэтому счётчики страницы и модалки всегда совпадают.
   */
  const { products } = useCatalogProducts();
  const bySku = useMemo(() => {
    const map = new Map<string, FeedCatalogProduct>();
    for (const product of products) {
      const id = toText(product.productId);
      const vendor = toText(product.vendorCode);
      if (id) map.set(id, product);
      if (vendor) map.set(vendor, product);
    }
    return map;
  }, [products]);

  const resolveProduct = useCallback((sku: string) => bySku.get(sku), [bySku]);
  const lightingCart = useLightingCart(resolveProduct);

  const buildLighting = (): LightingSnapshot | null => {
    const filteredItems = items.filter((item) => !shouldDropRemovedItem(item));
    if (filteredItems.length === 0) return null;

    const totalRub = filteredItems.reduce((sum, i) => sum + i.qty * i.priceRub, 0);
    const discountedTotalRub = applyLightingOnlyDiscount(totalRub);
    const withCeilingDiscountedTotalRub = applyLightingWithCeilingDiscount(totalRub);

    trackKitClicked({
      kitBaseName: title,
      itemsCount: filteredItems.length,
      totalRub,
      source: String(source ?? "track-sale-ready-set"),
    });

    return {
      mode: "catalog",
      kitBaseName: title,
      items: filteredItems.map((i) => ({ ...i })),
      totalRub,
      discountedTotalRub,
      standaloneDiscountedTotalRub: discountedTotalRub,
      withCeilingDiscountedTotalRub,
      discountMode: "lighting-only",
      discountPercentApplied: LIGHTING_ONLY_DISCOUNT_PERCENT,
      discountAmountRub: calcLightingDiscountAmount(totalRub, discountedTotalRub),
      userCustomizedLighting: true,
    };
  };

  const openLightingOnly = () => {
    const lighting = buildLighting();
    if (!lighting) return;

    lightingCart.applyKitItems(lighting.items ?? []);

    openCalculator({
      initialStep: 2,
      initialLightingTab: "catalog",
      initialLightingView: "selected",
      entryMode: "lighting-first",
      initialLighting: lighting,
      source: String(source ?? "track-sale-ready-set"),
    });
  };

  const openWithCeiling = () => {
    const lighting = buildLighting();
    if (!lighting) return;

    lightingCart.applyKitItems(lighting.items ?? []);

    openCalculator({
      initialStep: 0,
      initialLightingTab: "catalog",
      initialLightingView: "selected",
      entryMode: "lighting-first",
      initialLighting: lighting,
      source: String(source ?? "track-sale-ready-set-add-ceiling"),
    });
  };

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
      <Button type="button" className="w-full justify-center" onClick={openLightingOnly}>
        Оформить только свет −10%
      </Button>
      <Button type="button" variant="secondary" className="w-full justify-center" onClick={openWithCeiling}>
        Добавить потолок и получить −25% на свет
      </Button>
    </div>
  );
}
