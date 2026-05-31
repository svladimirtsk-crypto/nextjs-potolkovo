"use client";

import type { ServiceCalculatorPreset } from "@/content/services";

import { PriceCalculatorClient } from "@/components/home/price-calculator-client";
import { DEFAULT_CALCULATOR_AREA } from "@/lib/catalog-ui-config";
import { useCalculatorModal } from "./calculator-modal-context";

type WizardStep0CalculatorProps = {
  preset?: ServiceCalculatorPreset;
};

export function WizardStep0Calculator({ preset }: WizardStep0CalculatorProps) {
  const { markStep0SessionInteracted, options } = useCalculatorModal();

  const forcePreset = Boolean(options?.forcePreset);

  const resolvedPreset: ServiceCalculatorPreset = {
    ceilingType: String(preset?.ceilingType ?? "standard") as ServiceCalculatorPreset["ceilingType"],

    // ТЗ: первый запуск в модалке = 10 м² (если не forcePreset)
    areaDefault: forcePreset
      ? Number(preset?.areaDefault ?? DEFAULT_CALCULATOR_AREA)
      : DEFAULT_CALCULATOR_AREA,

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
      onChange={markStep0SessionInteracted}
    >
      <PriceCalculatorClient preset={resolvedPreset} compactSections />
    </div>
  );
}
