"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { usePriceCalculatorBridge } from "./price-calculator-context";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

export function MobileStickyCta() {
  const { snapshot, hasInteracted } = usePriceCalculatorBridge();

  const [isPriceVisible, setIsPriceVisible] = useState(false);
  const [isActionVisible, setIsActionVisible] = useState(false);

  useEffect(() => {
    const priceSection = document.getElementById("price");
    const actionSection = document.getElementById("action");

    const observers: IntersectionObserver[] = [];

    if (priceSection) {
      const priceObserver = new IntersectionObserver(
        ([entry]) => {
          setIsPriceVisible(entry.isIntersecting);
        },
        {
          threshold: 0.15,
          rootMargin: "0px 0px -10% 0px",
        }
      );

      priceObserver.observe(priceSection);
      observers.push(priceObserver);
    }

    if (actionSection) {
      const actionObserver = new IntersectionObserver(
        ([entry]) => {
          setIsActionVisible(entry.isIntersecting);
        },
        {
          threshold: 0.2,
        }
      );

      actionObserver.observe(actionSection);
      observers.push(actionObserver);
    }

    return () => {
      observers.forEach((observer) => observer.disconnect());
    };
  }, []);

  if (isActionVisible) {
    return null;
  }

  const showCalculatedState = isPriceVisible || (hasInteracted && !!snapshot);

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 lg:hidden">
      <div className="border-t border-white/10 bg-slate-950/98 text-white backdrop-blur">
        <div
          className="mx-auto flex min-h-[76px] max-w-screen-sm items-center justify-between gap-3 px-4 py-3"
          style={{
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
          }}
        >
          {showCalculatedState && snapshot ? (
            <>
              <div className="min-w-0">
                <p className="text-xs text-white/60">
                  {isPriceVisible ? "Ваш расчёт" : "Последний расчёт"}
                </p>
                <p className="mt-1 truncate text-2xl font-bold tracking-tight">
                  {formatCurrency(snapshot.total)} ₽
                </p>
              </div>

              <Button
                href="#action"
                variant="secondary"
                className="shrink-0 justify-center px-5 py-3 text-sm"
              >
                На замер
              </Button>
            </>
          ) : (
            <>
              <div className="min-w-0">
                <p className="text-xs text-white/60">Быстрый расчёт</p>
                <p className="mt-1 text-sm font-semibold text-white">
                  Подберите параметры и узнайте ориентир по цене
                </p>
              </div>

              <Button
                href="#price"
                variant="secondary"
                className="shrink-0 justify-center px-5 py-3 text-sm"
              >
                Калькулятор
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
