"use client";

/**
 * T-046 · PT-008 · Primary героя страницы услуги.
 *
 * Открывает калькулятор сразу с пресетом этой услуги: пресет, источник и
 * происхождение берутся из `EntryContext` страницы, а не собираются руками.
 *
 * Для услуг из `DISABLED_PRESET_SLUGS` калькулятор не открывается вовсе —
 * кнопка ведёт в форму «Обсудить проект»: типовой расчёт по таким услугам
 * даёт обманчиво точную смету.
 */
import { Button } from "@/components/ui/button";
import { useCalculatorModal } from "@/components/calculator-modal/calculator-modal-context";
import { useCalculatorPageContext } from "@/components/calculator-modal/page-context";

export function ServiceHeroCta({ label }: { label: string }) {
  const { openCalculator } = useCalculatorModal();
  const page = useCalculatorPageContext();

  if (page.presetDisabled) {
    return (
      <Button href="#action" className="justify-center" data-testid="hero-entry">
        {page.projectCtaLabel}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      className="justify-center"
      data-testid="hero-entry"
      onClick={() => openCalculator(page.optionsFor("hero"))}
    >
      {label}
    </Button>
  );
}
