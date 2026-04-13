"use client";

import type { LightingKit } from "@/lib/lighting-kits";
import type { LightingSnapshot } from "@/lib/calculator-modal-types";
import { Button } from "@/components/ui/button";
import { useCalculatorModal } from "@/components/calculator-modal/calculator-modal-context";

type LightKitCtaButtonProps = {
  kit: LightingKit;
};

export function LightKitCtaButton({ kit }: LightKitCtaButtonProps) {
  const { openCalculator } = useCalculatorModal();

  const handleClick = () => {
    const lighting: LightingSnapshot = {
      mode: "kit",
      kitId: kit.kitId,
      kitName: kit.kitName,
      items: kit.items.map((i) => ({ ...i })),
      totalRub: kit.totalRub,
    };

    openCalculator({
      initialLighting: lighting,
      initialStep: 2,
      source: "track-sale-landing",
    });
  };

  return (
    <Button
      type="button"
      className="w-full justify-center"
      onClick={handleClick}
    >
      Хочу такой
    </Button>
  );
}
