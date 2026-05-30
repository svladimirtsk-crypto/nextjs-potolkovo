"use client";

import type { ServiceCalculatorPreset } from "@/content/services";
import { PriceCalculatorClient } from "@/components/home/price-calculator-client";
import { useCalculatorModal } from "./calculator-modal-context";

type WizardStep0CalculatorProps = {
  preset?: ServiceCalculatorPreset;
};

export function WizardStep0Calculator({ preset }: WizardStep0CalculatorProps) {
  const { markStep0SessionInteracted } = useCalculatorModal();

  const resolvedPreset: ServiceCalculatorPreset = {
    ceilingType: String(preset?.ceilingType ?? "standard") as ServiceCalculatorPreset["ceilingType"],
    areaDefault: Number(preset?.areaDefault ?? 10),
    corniceType: preset?.corniceType,
    trackType: preset?.trackType,
    lightsEnabled: preset?.lightsEnabled,
    lightsCount: preset?.lightsCount,
    introNote: preset?.introNote,
    lightingDefault: preset?.lightingDefault,
  };

  return (
    <div
      onPointerDown={markStep0SessionInteracted}
      onKeyDown={markStep0SessionInteracted}
      onChangeCapture={markStep0SessionInteracted}
    >
      <PriceCalculatorClient preset={resolvedPreset} compactSections />
    </div>
  );
}
