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

function shouldOpenLightingFirst(label: string, source: string): boolean {
  const labelText = String(label ?? "").toLowerCase();
  const sourceText = String(source ?? "").toLowerCase();

  if (labelText.includes("открыть каталог")) return true;
  if (labelText.includes("каталог в калькуляторе")) return true;
  if (sourceText.includes("track-sale-custom")) return true;

  return false;
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

        if (shouldOpenLightingFirst(safeLabel, safeSource)) {
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
