"use client";

import { type ReactNode, useEffect } from "react";
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
    useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);

    const keys = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
      "yclid",
      "gclid",
      "_openstat",
      "fbclid",
    ] as const;

    for (const key of keys) {
      const value = params.get(key);
      if (value) sessionStorage.setItem(key, value);
    }

    if (!sessionStorage.getItem("first_landing")) {
      sessionStorage.setItem(
        "first_landing",
        `${window.location.pathname}${window.location.search}`
      );
    }

    if (!sessionStorage.getItem("first_referrer") && document.referrer) {
      sessionStorage.setItem("first_referrer", document.referrer);
    }
  }, []);
  return (
    <PriceCalculatorProvider>
      <CalculatorModalProvider>
        {children}
        <CalculatorModal />
      </CalculatorModalProvider>
    </PriceCalculatorProvider>
  );
}
