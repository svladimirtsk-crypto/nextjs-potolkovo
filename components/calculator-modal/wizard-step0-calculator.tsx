"use client";

import type { ServiceCalculatorPreset } from "@/content/services";
import { PriceCalculatorClient } from "@/components/home/price-calculator-client";

type WizardStep0CalculatorProps = {
  preset?: ServiceCalculatorPreset;
};

export function WizardStep0Calculator({ preset }: WizardStep0CalculatorProps) {
  return <PriceCalculatorClient preset={preset} compactSections />;
}
