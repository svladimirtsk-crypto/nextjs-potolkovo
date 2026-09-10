"use client";

/**
 * T-040 · Primary CTA героя главной.
 *
 * Раньше кнопка вела якорем на `#price`, то есть до калькулятора нужно было
 * доскроллить и нажать ещё раз. Теперь `openCalculator` вызывается напрямую —
 * модалка открывается без промежуточного скролла.
 */
import { Button } from "@/components/ui/button";
import { useCalculatorModal } from "@/components/calculator-modal/calculator-modal-context";

export type HeroCtaProps = {
  label: string;
  secondaryLabel: string;
};

export function HeroCta({ label, secondaryLabel }: HeroCtaProps) {
  const { openCalculator } = useCalculatorModal();

  return (
    <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
      <Button
        type="button"
        className="w-full sm:w-auto"
        onClick={() => openCalculator({ source: "home:hero" })}
      >
        {label}
      </Button>

      {/* Вторичное действие — текстовая ссылка, чтобы primary в первом экране был один. */}
      <a
        href="#action"
        className="text-center text-sm font-semibold text-white/80 underline decoration-white/30 underline-offset-4 transition-colors hover:text-white hover:decoration-white sm:text-left"
      >
        {secondaryLabel}
      </a>
    </div>
  );
}
