"use client";

import type { ServiceCalculatorPreset } from "@/content/services";
import { Button } from "@/components/ui/button";
import { useCalculatorModal } from "./calculator-modal-context";

type CalculatorTeaserButtonProps = {
  preset?: ServiceCalculatorPreset;
  source: string;
  label?: string;
};

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
      onClick={() => openCalculator({ preset, source })}
    >
      {label}
    </Button>
  );
}
