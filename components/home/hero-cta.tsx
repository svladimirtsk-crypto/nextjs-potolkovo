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
import { useCalculatorPageContext } from "@/components/calculator-modal/page-context";

export type HeroCtaProps = {
  label: string;
  secondaryLabel: string;
};

export function HeroCta({ label, secondaryLabel }: HeroCtaProps) {
  const { openCalculator } = useCalculatorModal();
  // PT-008: источник, путь страницы и пресет — из общего контекста входа.
  const page = useCalculatorPageContext();

  return (
    <div className="pk-hero-actions">
      <Button
        type="button"
        className="w-full sm:w-auto"
        data-testid="hero-entry"
        onClick={() => openCalculator(page.optionsFor("hero"))}
      >
        {label}
      </Button>

      {/* Вторичное действие — текстовая ссылка, чтобы primary в первом экране был один. */}
      <a
        href="#action"
        className="pk-text-link"
      >
        {secondaryLabel}
      </a>
    </div>
  );
}
