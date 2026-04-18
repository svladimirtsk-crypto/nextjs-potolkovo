"use client";

import { useEffect, useRef, useState } from "react";

import { usePriceCalculatorBridge } from "@/components/home/price-calculator-context";
import { useCalculatorModal } from "@/components/calculator-modal/calculator-modal-context";
import { scrollToAnchorTarget } from "@/lib/scroll-to-anchor";
import { Button } from "@/components/ui/button";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

export function MobileStickyCta() {
  const { snapshot, hasInteracted }        = usePriceCalculatorBridge();
  const { openCalculator, closeCalculator } = useCalculatorModal();

  const [isVisible, setIsVisible]             = useState(false);
  const [isActionVisible, setIsActionVisible] = useState(false);
  const [isPriceVisible, setIsPriceVisible]   = useState(false);

  const priceObserverRef  = useRef<IntersectionObserver | null>(null);
  const actionObserverRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const priceSection  = document.getElementById("price");
    const actionSection = document.getElementById("action");

    const observerOptions: IntersectionObserverInit = {
      root:       null,
      rootMargin: "0px 0px -10% 0px",
      threshold:  0,
    };

    if (priceSection) {
      priceObserverRef.current = new IntersectionObserver(([entry]) => {
        setIsPriceVisible(entry.isIntersecting);
      }, observerOptions);
      priceObserverRef.current.observe(priceSection);
    }

    if (actionSection) {
      actionObserverRef.current = new IntersectionObserver(([entry]) => {
        setIsActionVisible(entry.isIntersecting);
      }, observerOptions);
      actionObserverRef.current.observe(actionSection);
    }

    return () => {
      priceObserverRef.current?.disconnect();
      actionObserverRef.current?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (isActionVisible) { setIsVisible(false); return; }
    const scrolled = typeof window !== "undefined" && window.scrollY > 300;
    setIsVisible(isPriceVisible || scrolled);
  }, [isActionVisible, isPriceVisible]);

  const showCalculatedState = isPriceVisible || (hasInteracted && !!snapshot);

  // Единая логика "главной цифры":
  // grandTotal (если записан при подтверждении wizard) → snapshot.total
  const hasLightingInSnapshot =
    snapshot?.lighting &&
    snapshot.lighting.mode !== "none" &&
    (snapshot.lighting.items?.length ?? 0) > 0 &&
    (snapshot.lighting.discountedTotalRub ?? 0) > 0;

  const displayTotal = snapshot
    ? (snapshot.grandTotal ?? (
        hasLightingInSnapshot
          ? snapshot.total + (snapshot.lighting!.discountedTotalRub ?? 0)
          : snapshot.total
      ))
    : 0;

  const hasLightingDisplay = displayTotal > (snapshot?.total ?? 0);

  const handleCalculatorClick = () => openCalculator({ source: "mobile-sticky" });
  const handleActionClick = () => {
    closeCalculator();
    scrollToAnchorTarget("#action", { focus: true, highlight: true });
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 lg:hidden">
      <div
        className="border-t border-slate-200 bg-white/95 backdrop-blur px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
      >
        {showCalculatedState && snapshot ? (
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-500">
                {hasLightingDisplay ? "Ориентир с освещением" : "Ориентир"}
              </p>
              <p className="text-lg font-bold text-slate-950 truncate">
                ~{formatCurrency(displayTotal)} ₽
              </p>
            </div>
            <Button
              type="button"
              onClick={handleActionClick}
              className="shrink-0 justify-center"
            >
              На замер
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            onClick={handleCalculatorClick}
            className="w-full justify-center"
          >
            Рассчитать стоимость
          </Button>
        )}
      </div>
    </div>
  );
}
