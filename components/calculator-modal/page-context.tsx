"use client";

/**
 * T-021 · Контекст страницы для калькулятора.
 * Любой вход в калькулятор (hero, стики, хедер, тизер) берёт пресет отсюда,
 * чтобы `source` и стартовые параметры были одинаковыми.
 */
import { createContext, useContext, useMemo, type ReactNode } from "react";

import type { ServiceCalculatorPreset } from "@/content/services";
import type { SolutionScenario } from "@/lib/calculator-modal-types";
import { DISABLED_PRESET_SLUGS, resolvePresetScenario } from "@/lib/calculator/presets";

export type CalculatorPlacement =
  | "hero"
  | "sticky"
  | "header"
  | "teaser"
  | "price"
  | "proof"
  | "action";

export type CalculatorPageContextValue = {
  preset: ServiceCalculatorPreset | null;
  scenario: SolutionScenario;
  sourceSlug: string;
  presetDisabled: boolean;
  /** "<slug>:<placement>" — единый формат источника лида. */
  sourceFor: (placement: CalculatorPlacement) => string;
};

const FALLBACK: CalculatorPageContextValue = {
  preset: null,
  scenario: "standard",
  sourceSlug: "home",
  presetDisabled: false,
  sourceFor: (placement) => `home:${placement}`,
};

const CalculatorPageContext = createContext<CalculatorPageContextValue | null>(null);

export function CalculatorPageContextProvider({
  preset,
  scenario,
  sourceSlug,
  children,
}: {
  preset: ServiceCalculatorPreset | null;
  scenario?: SolutionScenario;
  sourceSlug: string;
  children: ReactNode;
}) {
  const value = useMemo<CalculatorPageContextValue>(() => {
    const resolvedScenario = scenario ?? resolvePresetScenario(preset);
    const presetDisabled = DISABLED_PRESET_SLUGS.has(sourceSlug);
    return {
      preset: presetDisabled ? null : preset,
      scenario: resolvedScenario,
      sourceSlug,
      presetDisabled,
      sourceFor: (placement: CalculatorPlacement) => `${sourceSlug}:${placement}`,
    };
  }, [preset, scenario, sourceSlug]);

  return (
    <CalculatorPageContext.Provider value={value}>{children}</CalculatorPageContext.Provider>
  );
}

/** Не бросает — на главной и вне провайдера отдаёт значения по умолчанию. */
export function useCalculatorPageContext(): CalculatorPageContextValue {
  return useContext(CalculatorPageContext) ?? FALLBACK;
}
