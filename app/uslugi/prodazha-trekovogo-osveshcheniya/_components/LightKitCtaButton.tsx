"use client";

import { Button } from "@/components/ui/button";
import type { LightingItem, LightingSnapshot } from "@/lib/calculator-modal-types";
import { applyLightingDiscount } from "@/lib/lighting-formulas";
import { useCalculatorModal } from "@/components/calculator-modal/calculator-modal-context";

type LightKitCtaButtonProps = {
  title: string;
  items: LightingItem[];
  source?: string;
};

export function LightKitCtaButton({ title, items, source }: LightKitCtaButtonProps) {
  const { openCalculator } = useCalculatorModal();

  const handleClick = () => {
    const totalRub = items.reduce((sum, i) => sum + i.qty * i.priceRub, 0);
    const discountedTotalRub = applyLightingDiscount(totalRub);

    const lighting: LightingSnapshot = {
      mode: "catalog",
      kitBaseName: title,
      items: items.map((i) => ({ ...i })),
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
