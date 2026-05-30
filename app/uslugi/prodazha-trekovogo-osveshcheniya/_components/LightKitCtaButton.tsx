"use client";

import { Button } from "@/components/ui/button";
import type { LightingItem, LightingSnapshot } from "@/lib/calculator-modal-types";
import { applyLightingDiscount } from "@/lib/lighting-formulas";
import { useCalculatorModal } from "@/components/calculator-modal/calculator-modal-context";
import { REMOVED_COLIBRI_VENDOR_CODES } from "@/lib/catalog-ui-config";

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

  const handleClick = () => {
    const filteredItems = items.filter((item) => !shouldDropRemovedItem(item));

    if (filteredItems.length === 0) {
      return;
    }

    const totalRub = filteredItems.reduce((sum, i) => sum + i.qty * i.priceRub, 0);
    const discountedTotalRub = applyLightingDiscount(totalRub);

    const lighting: LightingSnapshot = {
      mode: "catalog",
      kitBaseName: title,
      items: filteredItems.map((i) => ({ ...i })),
      totalRub,
      discountedTotalRub,
      userCustomizedLighting: true,
    };

    openCalculator({
      initialStep: 1,
      initialLightingTab: "catalog",
      initialLightingView: "selected",
      entryMode: "lighting-first",
      initialLighting: lighting,
      source: String(source ?? "track-sale-ready-set"),
    });
  };

  return (
    <Button type="button" className="w-full justify-center" onClick={handleClick}>
      Хочу такой
    </Button>
  );
}
