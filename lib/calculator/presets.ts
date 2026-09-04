/**
 * T-021 · Пресеты страниц услуг и кейсов → стартовая конфигурация комнаты V2.
 * Единственное место, где `ServiceCalculatorPreset` превращается в состояние движка.
 */
import type { ServiceCalculatorPreset } from "@/content/services";
import type { SolutionScenario } from "@/lib/calculator-modal-types";
import type {
  CalculationScope,
  RoomConfig,
} from "@/lib/calculator-v2/use-ceiling-calculator-engine";
import { pricing } from "@/content/pricing";

/** Параметры комнаты, которые может задать пресет. */
export type PresetParamId =
  | "area"
  | "ceiling"
  | "cornice"
  | "track"
  | "lightLines"
  | "lights";

export type PresetResult = {
  room: Partial<RoomConfig>;
  scenario: SolutionScenario;
  scope: CalculationScope;
  /** Параметры, предзаполненные пресетом (показываем, но не считаем подтверждёнными). */
  prefilled: PresetParamId[];
  roomLabel: string;
  introNote?: string;
  /** Пресет отключён — калькулятор для страницы не предлагаем. */
  disabled: boolean;
};

/** Периметр по площади: round(4·√area). */
export function defaultPerimeterMeters(area: number): number {
  const safeArea = Number.isFinite(area) && area > 0 ? area : pricing.defaults.roomArea;
  return Math.max(1, Math.round(4 * Math.sqrt(safeArea)));
}

/** Страницы, для которых калькулятор пока не считает (нет типа полотна в прайсе). */
export const DISABLED_PRESET_SLUGS = new Set(["svetoprozrachnye-potolki"]);

export function resolvePresetScenario(preset: ServiceCalculatorPreset | null | undefined): SolutionScenario {
  if (!preset) return "standard";
  if (preset.ceilingType === "shadow" || preset.ceilingType === "floating") return "modern";
  if (preset.trackType && preset.trackType !== "none") return "modern";
  if (preset.lightLinesEnabled) return "modern";
  if (preset.corniceType && preset.corniceType !== "none") return "modern";
  return "standard";
}

/**
 * Маппинг всех полей пресета в конфиг комнаты.
 */
export function presetToRoom(
  preset: ServiceCalculatorPreset | null | undefined,
  options: { slug?: string } = {}
): PresetResult {
  const scope: CalculationScope = preset?.calculationScopeDefault ?? "room";
  const area =
    Number(preset?.areaDefault ?? 0) > 0
      ? Number(preset?.areaDefault)
      : scope === "object"
        ? pricing.defaults.objectArea
        : pricing.defaults.roomArea;

  const perimeter = defaultPerimeterMeters(area);
  const prefilled: PresetParamId[] = [];
  const room: Partial<RoomConfig> = { area };

  if (preset) prefilled.push("area");

  const shadowEnabled = preset?.ceilingType === "shadow";
  const floatingEnabled = preset?.ceilingType === "floating";

  if (shadowEnabled || floatingEnabled) {
    room.ceilingType = shadowEnabled ? "shadow" : "floating";
    room.shadowEnabled = shadowEnabled;
    room.floatingEnabled = floatingEnabled;
    room.shadowLength = Number(preset?.shadowLengthDefault ?? 0) || (shadowEnabled ? perimeter : 0);
    room.floatingLength =
      Number(preset?.floatingLengthDefault ?? 0) || (floatingEnabled ? perimeter : 0);
    prefilled.push("ceiling");
  } else if (preset) {
    room.ceilingType = "standard";
    room.shadowEnabled = false;
    room.floatingEnabled = false;
  }

  if (preset?.lightLinesEnabled) {
    room.lightLinesEnabled = true;
    room.lightLinesLength = Number(preset.lightLinesLengthDefault ?? 0) || 4;
    prefilled.push("lightLines");
  }

  if (preset?.corniceType && preset.corniceType !== "none") {
    room.corniceType = preset.corniceType;
    room.corniceLength = Number(preset.corniceLengthDefault ?? 0) || Math.max(2, Math.round(perimeter / 4));
    room.corniceLightingEnabled = Boolean(preset.corniceLightingEnabled);
    room.corniceLightingLength =
      Number(preset.corniceLightingLengthDefault ?? 0) || room.corniceLength;
    room.corniceLightingPowerSupplies = Number(preset.corniceLightingPowerSuppliesDefault ?? 0) || 1;
    prefilled.push("cornice");
  }

  if (preset?.trackType && preset.trackType !== "none") {
    room.trackType = preset.trackType;
    room.trackLength = Number(preset.trackLengthDefault ?? 0) || Math.max(2, Math.round(perimeter / 4));
    prefilled.push("track");
  }

  if (preset?.lightsEnabled) {
    room.lightsEnabled = true;
    room.lightsCount = Number(preset.lightsCount ?? 0) || 6;
    prefilled.push("lights");
  } else if (preset?.lightsEnabled === false) {
    room.lightsEnabled = false;
  }

  return {
    room,
    scenario: resolvePresetScenario(preset),
    scope,
    prefilled,
    roomLabel: preset?.roomLabelDefault ?? (scope === "object" ? "Весь объект" : "Помещение"),
    introNote: preset?.introNote,
    disabled: options.slug ? DISABLED_PRESET_SLUGS.has(options.slug) : false,
  };
}

export const PREFILL_HINT = "Стартовое значение со страницы — измените под свой объект";

export function caseHint(caseTitle: string): string {
  return `Стартовые параметры по кейсу «${caseTitle}»`;
}
