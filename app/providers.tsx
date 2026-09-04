"use client";

import { type ReactNode, useEffect } from "react";

import { PriceCalculatorProvider } from "@/components/home/price-calculator-context";
import { CalculatorModalProvider } from "@/components/calculator-modal/calculator-modal-context";
import { ConfirmDialogPortal } from "@/components/ui/confirm-dialog";
import { CalculatorModalGate } from "@/components/calculator-modal/calculator-modal-gate";

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
      // FIRST CLICK ATTRIBUTION: only set if NOT already present in sessionStorage!
      if (value && !sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, value);
      }
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
        <CalculatorModalGate />
        <ConfirmDialogPortal />
      </CalculatorModalProvider>
    </PriceCalculatorProvider>
  );
}
