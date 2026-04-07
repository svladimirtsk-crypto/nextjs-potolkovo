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

    if (!priceSection && !actionSection) {
      return;
    }

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
    <div className="fixed inset-x-4 bottom-4 z-40 lg:hidden">
      <div className="rounded-2xl border border-white/10 bg-slate-950/95 p-4 text-white shadow-2xl backdrop-blur">
        {showCalculatedState && snapshot ? (
          <div className="flex items-end justify-between gap-3">
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
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
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
          </div>
        )}
      </div>
    </div>
  );
}
