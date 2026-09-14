"use client";

/**
 * T-021 · PT-008 · Контекст входа в квиз (раздел 3.1 ТЗ).
 *
 * Любой вход в калькулятор (хедер, hero, mid-CTA, стики, тизер, карточка
 * примера) берёт страницу, пресет и источник отсюда, а не собирает их руками.
 *
 * До PT-008 провайдер отдавал только `preset`, `scenario` и `sourceFor`, а
 * общий хедер сайта вообще не читал контекст: на странице услуги он открывал
 * калькулятор с `source: "home:header"` и типовым пресетом. Специальные услуги
 * (светопрозрачные потолки, индивидуальные проекты) получали смету, которая
 * выглядит точной, но не считается для них честно.
 */
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import type { ServiceCalculatorPreset } from "@/content/services";
import type {
  CalculatorEntryMode,
  OpenCalculatorOptions,
} from "@/lib/calculator-modal-types";
import { DISABLED_PRESET_SLUGS } from "@/lib/calculator/presets";
import {
  HOME_ENTRY_SLUG,
  PROJECT_ENTRY_INTENT,
  buildEntrySource,
  entryToCalculatorOptions,
  projectEntryCtaLabel,
  type EntryContext,
  type EntryPlacement,
  type PresetOrigin,
} from "@/lib/entry-context";
import type { Step2Intent } from "@/lib/calculator-flow";

/** Точка входа — прежнее имя типа оставлено алиасом, чтобы не переписывать вызовы. */
export type CalculatorPlacement = EntryPlacement;

/** Контекст страницы без `placement`: он подставляется на каждом клике. */
export type PageEntryContext = Omit<EntryContext, "placement">;

export type CalculatorPageContextValue = {
  /** Данные страницы: путь, слаг, режим входа, интент, происхождение пресета. */
  entry: PageEntryContext;
  /** Пресет страницы; `null` на главной и для услуг без честного расчёта. */
  preset: ServiceCalculatorPreset | null;
  sourceSlug: string;
  /** Услуга, для которой типовой калькулятор не предлагается вовсе. */
  presetDisabled: boolean;
  /** Полный EntryContext конкретной точки входа. */
  entryFor: (placement: EntryPlacement) => EntryContext;
  /** Параметры `openCalculator` для точки входа. */
  optionsFor: (
    placement: EntryPlacement,
    overrides?: Partial<OpenCalculatorOptions>
  ) => OpenCalculatorOptions;
  /** `"<slug>:<placement>"` — единый формат источника лида и аналитики. */
  sourceFor: (placement: EntryPlacement) => string;
  /** «Обсудить проект» — подпись входа для страниц с `presetDisabled`. */
  projectCtaLabel: string;
};

type PageEntryInput = {
  preset: ServiceCalculatorPreset | null;
  sourceSlug: string | null;
  entryMode?: CalculatorEntryMode;
  intent?: Step2Intent | null;
  presetOrigin?: PresetOrigin;
};

/** Вход по умолчанию: главная или любая страница вне провайдера. */
const FALLBACK_INPUT: PageEntryInput = { preset: null, sourceSlug: null };

function buildPageValue(input: PageEntryInput, pagePath: string): CalculatorPageContextValue {
  const sourceSlug = input.sourceSlug ?? HOME_ENTRY_SLUG;
  const presetDisabled = DISABLED_PRESET_SLUGS.has(sourceSlug);

  /**
   * PT-008: для услуг из `DISABLED_PRESET_SLUGS` пресет не отдаётся ни одной
   * точке входа — иначе хедер или стики открывали бы типовой расчёт с
   * обманчиво точной суммой. Интент такой страницы — «обсудить проект».
   */
  const preset = presetDisabled ? null : input.preset;
  const presetOrigin: PresetOrigin = presetDisabled
    ? "default"
    : (input.presetOrigin ?? (preset ? "page" : "default"));

  const page: PageEntryContext = {
    pagePath,
    serviceSlug: input.sourceSlug,
    entryMode: input.entryMode ?? "default",
    intent: presetDisabled ? PROJECT_ENTRY_INTENT : (input.intent ?? null),
    presetOrigin,
    preset,
  };

  const entryFor = (placement: EntryPlacement): EntryContext => ({ ...page, placement });

  return {
    entry: page,
    preset,
    sourceSlug,
    presetDisabled,
    entryFor,
    optionsFor: (placement, overrides) => entryToCalculatorOptions(entryFor(placement), overrides),
    sourceFor: (placement) => buildEntrySource(entryFor(placement)),
    projectCtaLabel: projectEntryCtaLabel(),
  };
}

const CalculatorPageContext = createContext<CalculatorPageContextValue | null>(null);

export function CalculatorPageContextProvider({
  preset,
  sourceSlug,
  entryMode,
  intent,
  presetOrigin,
  children,
}: PageEntryInput & { children: ReactNode }) {
  const pathname = usePathname();

  const value = useMemo(
    () => buildPageValue({ preset, sourceSlug, entryMode, intent, presetOrigin }, pathname || "/"),
    [preset, sourceSlug, entryMode, intent, presetOrigin, pathname]
  );

  return (
    <CalculatorPageContext.Provider value={value}>{children}</CalculatorPageContext.Provider>
  );
}

/** Не бросает — на главной и вне провайдера отдаёт значения по умолчанию. */
export function useCalculatorPageContext(): CalculatorPageContextValue {
  const fromProvider = useContext(CalculatorPageContext);
  const pathname = usePathname();

  const fallback = useMemo(() => buildPageValue(FALLBACK_INPUT, pathname || "/"), [pathname]);

  return fromProvider ?? fallback;
}
