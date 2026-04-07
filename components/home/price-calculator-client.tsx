"use client";

import { useMemo, useState, ChangeEvent } from "react";
import { homepage } from "@/content/homepage";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils"; // Стандартная утилита в Next.js/Shadcn для объединения классов

const calculator = homepage.price.calculator;

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

export function PriceCalculatorClient() {
  // ИСПРАВЛЕНИЕ: Явно указываем <number>, чтобы TS не ограничивал состояние одним числом-константой
  const [area, setArea] = useState<number>(calculator.areaDefault);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);

  const toggleOption = (slug: string) => {
    setSelectedOptions((prev) =>
      prev.includes(slug) 
        ? prev.filter((item) => item !== slug) 
        : [...prev, slug]
    );
  };

  const selectedRate = useMemo(() => {
    return calculator.options
      .filter((option) => selectedOptions.includes(option.slug))
      .reduce((sum, option) => sum + option.ratePerSqm, 0);
  }, [selectedOptions]);

  const totalRate = calculator.baseRatePerSqm + selectedRate;
  const totalPrice = totalRate * area;

  // Обработчик изменения ползунка
  const handleAreaChange = (e: ChangeEvent<HTMLInputElement>) => {
    setArea(Number(e.target.value));
  };

  return (
    <div className="grid gap-8 rounded-[2rem] border border-slate-200 bg-white p-6 sm:p-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-10 lg:p-10">
      <div>
        <p className="text-sm font-medium text-slate-500">{calculator.baseDescription}</p>

        <div className="mt-8">
          <div className="flex items-center justify-between gap-4">
            <label htmlFor="area-range" className="text-sm font-semibold text-slate-950">
              Площадь помещения
            </label>
            <span className="font-mono text-sm font-semibold text-slate-950">
              {area} м²
            </span>
          </div>

          <input
            id="area-range"
            type="range"
            min={calculator.areaMin}
            max={calculator.areaMax}
            step={calculator.areaStep}
            value={area}
            onChange={handleAreaChange}
            className="mt-4 w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-950"
          />

          <div className="mt-2 flex justify-between text-xs text-slate-500">
            <span>{calculator.areaMin} м²</span>
            <span>{calculator.areaMax} м²</span>
          </div>
        </div>

        <div className="mt-8">
          <p className="text-sm font-semibold text-slate-950">Дополнительные параметры</p>

          <div className="mt-4 flex flex-wrap gap-3">
            {calculator.options.map((option) => {
              const isActive = selectedOptions.includes(option.slug);

              return (
                <button
                  key={option.slug}
                  type="button"
                  onClick={() => toggleOption(option.slug)}
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm font-medium transition-all",
                    isActive
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-300 bg-white text-slate-950 hover:border-slate-950"
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-8 space-y-2 rounded-2xl bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-4 text-sm text-slate-600">
            <span>{calculator.baseLabel}</span>
            <span>{formatCurrency(calculator.baseRatePerSqm)} ₽ / м²</span>
          </div>

          {calculator.options
            .filter((option) => selectedOptions.includes(option.slug))
            .map((option) => (
              <div
                key={option.slug}
                className="flex items-center justify-between gap-4 text-sm text-slate-600 animate-in fade-in slide-in-from-top-1"
              >
                <span>{option.label}</span>
                <span>+{formatCurrency(option.ratePerSqm)} ₽ / м²</span>
              </div>
            ))}

          <div className="border-t border-slate-200 pt-3 mt-2 text-sm font-semibold text-slate-950">
            <div className="flex items-center justify-between gap-4">
              <span>Итого за 1 м²</span>
              <span>{formatCurrency(totalRate)} ₽ / м²</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col justify-between rounded-[1.75rem] bg-slate-950 p-6 text-white sm:p-8">
        <div>
          <p className="text-sm text-white/65">Ориентировочная стоимость</p>

          <div className="mt-4 flex items-end gap-2">
            <p className="text-5xl font-bold tracking-tight sm:text-6xl">
              {formatCurrency(totalPrice)}
            </p>
            <span className="pb-2 text-lg font-medium text-white/70">₽</span>
          </div>

          <p className="mt-3 text-sm leading-6 text-white/70">
            При площади {area} м² и выбранных параметрах.
          </p>

          <div className="mt-8 space-y-3 text-sm leading-6 text-white/70">
            <p>{homepage.price.includedLine}</p>
            <p>{homepage.price.fixedPriceNote}</p>
          </div>
        </div>

        <div className="mt-10">
          <Button href="#action" variant="secondary" className="w-full justify-center py-6 text-base">
            {homepage.price.primaryCtaLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
