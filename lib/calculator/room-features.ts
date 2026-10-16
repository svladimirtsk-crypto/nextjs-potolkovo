import type { RoomConfig } from "./use-calculator-engine";
import { getEnabledParams, type ParamId } from "@/lib/step0-fsm";

/** Actual choices in this room, never a marketing tier for the whole project. */
export function roomQuestionPlan(
  room: Pick<RoomConfig, "shadowEnabled" | "floatingEnabled" | "lightLinesEnabled" | "trackType"> & Pick<Partial<RoomConfig>, "trackFromEntry">,
  inFlight?: ParamId
): ParamId[] {
  return getEnabledParams({ scenario: "standard", shadowEnabled: room.shadowEnabled, floatingEnabled: room.floatingEnabled,
    showModernOptions: false, lightLinesEnabled: room.lightLinesEnabled || inFlight === "lightLines",
    /**
     * Трек из готового комплекта уже определён страницей света: метраж и монтаж
     * пришли с товаром, и T-091 требует не спрашивать их заново. Как только
     * человек сам трогает трек в карточке (`setTrackFeature`), признак снимается
     * и вопрос возвращается.
     */
    trackEnabled: (room.trackType !== "none" && room.trackFromEntry !== true) || inFlight === "track" });
}

/**
 * Уровень проекта выводится из фактических решений комнат, а не из экрана,
 * который их больше не спрашивает. В сохранённых данных поле `scenario`
 * остаётся обязательным, поэтому оно должно описывать реальный проект.
 */
export function scenarioFromRooms(
  rooms: readonly (Pick<Partial<RoomConfig>, "shadowEnabled" | "floatingEnabled" | "lightLinesEnabled" | "corniceType" | "trackType">)[],
  fallback?: string
): "standard" | "modern" | "advanced" {
  if (fallback === "advanced") return "advanced";
  const modern = rooms.some(room => Boolean(room.shadowEnabled || room.floatingEnabled || room.lightLinesEnabled
    || (room.corniceType && room.corniceType !== "none") || (room.trackType && room.trackType !== "none")));
  return modern ? "modern" : "standard";
}

export function effectiveCeilingType(room: Pick<RoomConfig, "shadowEnabled" | "floatingEnabled">): RoomConfig["ceilingType"] {
  return room.shadowEnabled && room.floatingEnabled ? "shadow-floating" : room.shadowEnabled ? "shadow" : room.floatingEnabled ? "floating" : "standard";
}

export function setCeilingFeature(room: RoomConfig, feature: "shadow" | "floating", enabled: boolean): Partial<RoomConfig> {
  const shadow = feature === "shadow" ? enabled : room.shadowEnabled;
  const floating = feature === "floating" ? enabled : room.floatingEnabled;
  return { shadowEnabled: shadow, floatingEnabled: floating, ceilingType: effectiveCeilingType({ shadowEnabled: shadow, floatingEnabled: floating }) };
}

export function setTrackFeature(room: RoomConfig, enabled: boolean): Partial<RoomConfig> {
  const remembered = room.trackType !== "none" ? room.trackType : room.lastTrackType ?? "built-in";
  /* Явный выбор человека снимает признак «трек пришёл с комплекта»: вопрос вернётся. */
  return { trackType: enabled ? remembered : "none", lastTrackType: remembered, trackFromEntry: false };
}
