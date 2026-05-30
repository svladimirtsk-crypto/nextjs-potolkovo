"use client";

import type { ServiceCalculatorPreset } from "@/content/services";
import { Button } from "@/components/ui/button";
import { trackCalculatorOpen } from "@/lib/analytics";
import { useCalculatorModal } from "./calculator-modal-context";

type CalculatorTeaserButtonProps = {
  preset?: ServiceCalculatorPreset;
  source: string;
  label?: string;
};

function shouldOpenLightingFirst(label: string): boolean {
  const text = String(label ?? "").toLowerCase();
  return text.includes("каталог");
}

export function CalculatorTeaserButton({
  preset,
  source,
  label = "Рассчитать стоимость",
}: CalculatorTeaserButtonProps) {
  const { openCalculator } = useCalculatorModal();

  return (
    <Button
      type="button"
      className="w-full justify-center py-6 text-base"
      onClick={() => {
        const safeSource = String(source ?? "");
        const safeLabel = String(label ?? "");

        trackCalculatorOpen(safeSource);

        if (shouldOpenLightingFirst(safeLabel)) {
          openCalculator({
            initialStep: 1,
            initialLightingTab: "catalog",
            initialLightingView: "browse",
            entryMode: "lighting-first",
            source: safeSource,
          });
          return;
        }

        openCalculator({ preset, source: safeSource });
      }}
    >
      {label}
    </Button>
  );
}
