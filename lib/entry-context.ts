/**
 * PT-008 · EntryContext — контекст входа в квиз (раздел 3.1 ТЗ).
 *
 * До этой задачи источник входа распознавался двумя способами одновременно:
 * типизированным `presetOrigin` и разбором произвольной строки `source`
 * (`src.includes("tenevoy-profil")`, `startsWith("track-sale")`,
 * `endsWith(":proof")`). Пресет при этом собирался вручную в
 * `wizard-step0-calculator.tsx` и терял 11 из 19 полей: длины профилей, трека,
 * карниза, световые линии, метку помещения и область расчёта.
 *
 * Здесь — один типизированный объект входа и чистые функции, которые из него
 * получают параметры калькулятора. Компоненты не собирают `source` и пресет
 * руками.
 */
import type { ServiceCalculatorPreset } from "@/content/services";
import { DEFAULT_CALCULATOR_AREA } from "@/lib/catalog-ui-config";
import { resolveStep2Copy, type Step2Intent } from "@/lib/calculator-flow";
import type { CalculatorEntryMode, OpenCalculatorOptions } from "@/lib/calculator-modal-types";

/** Откуда взялся пресет — раздел 3.1 ТЗ. */
export type PresetOrigin = "default" | "page" | "explicit";

/** Точка входа, из которой открыт калькулятор. */
export type EntryPlacement =
  | "header"
  | "hero"
  | "mid"
  | "sticky"
  | "teaser"
  | "price"
  | "proof"
  | "action"
  | "example"
  | "catalog";

/**
 * Контекст входа целиком.
 *
 * `pagePath` и `serviceSlug` описывают, где человек был; `placement` — чем
 * именно он нажал; `entryMode`, `intent`, `presetOrigin` и `preset` — что
 * калькулятору делать с этим входом.
 */
export type EntryContext = {
  pagePath: string;
  serviceSlug: string | null;
  placement: EntryPlacement;
  entryMode: CalculatorEntryMode;
  /** Интент заказа, если он известен уже на входе (например, «advanced»). */
  intent: Step2Intent | null;
  presetOrigin: PresetOrigin;
  preset: ServiceCalculatorPreset | null;
};

/** На главной и вне провайдера страницы источник — `home`. */
export const HOME_ENTRY_SLUG = "home";

/**
 * `"<slug>:<placement>"` — формат источника, который уже читают аналитика,
 * заявка и `wizard-step0-calculator.tsx`. PT-008 не меняет формат: он нужен
 * прежним заявкам и отчётам, — но собирает его в одном месте.
 */
export function buildEntrySource(
  entry: Pick<EntryContext, "serviceSlug" | "placement">
): string {
  return `${entry.serviceSlug ?? HOME_ENTRY_SLUG}:${entry.placement}`;
}

/**
 * Пресет входа → пресет калькулятора.
 *
 * Правило раздела 3.1: полный пресет переносится целиком, точечные overrides —
 * только для явно предусмотренных полей. Единственное такое поле сегодня —
 * площадь при обычном входе (`presetOrigin: "default"`): там пресет фабрикует
 * сам контекст модалки, и площадь в нём — дефолт прайса, а не данные страницы.
 *
 * Раньше здесь копировались восемь полей из девятнадцати, и потому:
 * - `lightLinesEnabled` страницы «Световые линии» терялся — калькулятор
 *   открывался без световых линий;
 * - `shadowLengthDefault: 19` и `trackLengthDefault: 10` кейса
 *   `shadow-track-apartment` терялись, и движок считал профиль по периметру
 *   (17 м) и трек как периметр/4 (4 м);
 * - `roomLabelDefault` и `calculationScopeDefault` терялись вместе с ними.
 */
export function resolveEntryPreset(
  preset: ServiceCalculatorPreset | null | undefined,
  input: { presetOrigin?: PresetOrigin; forcePreset?: boolean } = {}
): ServiceCalculatorPreset {
  if (!preset) {
    return { ceilingType: "standard", areaDefault: DEFAULT_CALCULATOR_AREA };
  }

  const origin = input.presetOrigin ?? "default";
  const keepPresetArea = origin !== "default" || input.forcePreset === true;

  return keepPresetArea
    ? { ...preset }
    : { ...preset, areaDefault: DEFAULT_CALCULATOR_AREA };
}

/**
 * EntryContext → параметры `openCalculator`.
 *
 * Пресет здесь намеренно не «разрешается»: это делает
 * `wizard-step0-calculator.tsx` через `resolveEntryPreset`, чтобы правило
 * площади жило в одном месте и не применялось дважды.
 */
export function entryToCalculatorOptions(
  entry: EntryContext,
  overrides: Partial<OpenCalculatorOptions> = {}
): OpenCalculatorOptions {
  return {
    preset: entry.preset ?? undefined,
    presetOrigin: entry.presetOrigin,
    // `explicit` — полный пресет кейса: площадь и метки переносим как есть.
    forcePreset: entry.presetOrigin === "explicit",
    entryMode: entry.entryMode === "default" ? undefined : entry.entryMode,
    source: buildEntrySource(entry),
    serviceSlug: entry.serviceSlug,
    pagePath: entry.pagePath,
    ...overrides,
  };
}

/**
 * Подпись входа для страниц, где калькулятор не считает честно
 * (`DISABLED_PRESET_SLUGS`).
 *
 * Текст берётся из того же источника, что и форма Шага 2 для интента
 * `advanced` — «Обсудить проект». Отдельная строка здесь разошлась бы с
 * копирайтом формы.
 */
export const PROJECT_ENTRY_INTENT: Step2Intent = "advanced";

export function projectEntryCtaLabel(): string {
  return resolveStep2Copy(PROJECT_ENTRY_INTENT).submitLabel;
}
