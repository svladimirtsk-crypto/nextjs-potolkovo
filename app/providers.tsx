"use client";

import { type ReactNode } from "react";
import dynamic from "next/dynamic";

import { PriceCalculatorProvider } from "@/components/home/price-calculator-context";
import { CalculatorModalProvider } from "@/components/calculator-modal/calculator-modal-context";

const CalculatorModal = dynamic(
  () =>
    import("@/components/calculator-modal/calculator-modal").then(
      (m) => m.CalculatorModal
    ),
  { ssr: false }
);

export function Providers({ children }: { children: ReactNode }) {
  return (
    <PriceCalculatorProvider>
      <CalculatorModalProvider>
        {children}
        <CalculatorModal />
      </CalculatorModalProvider>
    </PriceCalculatorProvider>
  );
}
