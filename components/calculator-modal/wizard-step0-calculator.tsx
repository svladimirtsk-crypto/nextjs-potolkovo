"use client";

import type { ServiceCalculatorPreset } from "@/content/services";
import { PriceCalculatorClient } from "@/components/home/price-calculator-client";
import { useCalculatorModal } from "./calculator-modal-context";

type WizardStep0CalculatorProps = {
  preset?: ServiceCalculatorPreset;
};

export function WizardStep0Calculator({ preset }: WizardStep0CalculatorProps) {
  const { markStep0SessionInteracted } = useCalculatorModal();

  return (
    <div
      onPointerDown={markStep0SessionInteracted}
      onKeyDown={markStep0SessionInteracted}
      onChangeCapture={markStep0SessionInteracted}
    >
      <PriceCalculatorClient preset={preset} compactSections />
    </div>
  );
}
