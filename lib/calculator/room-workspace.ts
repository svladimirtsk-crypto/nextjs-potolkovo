import type { RoomConfig } from "./use-calculator-engine";
import type { SolutionScenario, LightingSnapshot } from "@/lib/calculator-modal-types";
import type { CalculatorLeadSnapshot } from "./snapshot-types";
import { ALL_PARAMS, getEnabledParams, type ParamId } from "@/lib/step0-fsm";
import { createLightingOnlySnapshot } from "@/lib/lighting/track-sale-snapshot";

export type RoomConfirmations = Record<string, Partial<Record<ParamId, boolean>>>;
export type RoomEditDraft = { roomId: string; param: ParamId; before: RoomConfig; draft: RoomConfig; beforeScenario: SolutionScenario; scenario: SolutionScenario };

export function paramsForRoom(room: RoomConfig, scenario: SolutionScenario): ParamId[] {
  return getEnabledParams({ scenario, shadowEnabled: room.shadowEnabled, floatingEnabled: room.floatingEnabled, showModernOptions: scenario !== "standard" });
}
export function createRoomEdit(room: RoomConfig, param: ParamId, scenario: SolutionScenario): RoomEditDraft {
  return { roomId: room.id, param, before: { ...room }, draft: { ...room }, beforeScenario: scenario, scenario };
}
export function patchRoomEdit(edit: RoomEditDraft, patch: Partial<RoomConfig>): RoomEditDraft {
  return { ...edit, draft: { ...edit.draft, ...patch, id: edit.roomId } };
}
/** Commit only changed inputs; do not mark untouched fields or overwrite another room. */
export function changedRoomFields(edit: RoomEditDraft): Partial<RoomConfig> {
  return Object.fromEntries(Object.entries(edit.draft).filter(([key, value]) => key !== "id" && value !== edit.before[key as keyof RoomConfig])) as Partial<RoomConfig>;
}
export function confirmationsAfterEdit(edit: RoomEditDraft, before: Partial<Record<ParamId, boolean>>): Partial<Record<ParamId, boolean>> {
  const next = { ...before, [edit.param]: true };
  if (edit.before.shadowEnabled !== edit.draft.shadowEnabled || edit.before.floatingEnabled !== edit.draft.floatingEnabled) {
    delete next.shadowProfile; delete next.floatingProfile;
  }
  return next;
}
/** Optional v2 addition. Legacy drafts remain readable; no truthy coercion of untrusted flags. */
export function parseRoomConfirmations(value: unknown): RoomConfirmations | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v && typeof v === "object" && !Array.isArray(v)).map(([id, v]) => [id,
    Object.fromEntries(ALL_PARAMS.filter(p => (v as Record<string, unknown>)[p] === true).map(p => [p, true])),
  ]));
}
export function firstRoomPending(rooms: readonly RoomConfig[], scenario: SolutionScenario, confirmed: RoomConfirmations, legacyRestored: ReadonlySet<string>) {
  for (const room of rooms) {
    if (legacyRestored.has(room.id)) continue;
    const param = paramsForRoom(room, scenario).find(p => !confirmed[room.id]?.[p]);
    if (param) return { roomId: room.id, label: room.label, param };
  }
  return null;
}
/** Only for explicit deletion of the last room, never for initial lighting-first mount. */
export function snapshotAfterLastRoom(prev: CalculatorLeadSnapshot | null, lighting: LightingSnapshot | null): CalculatorLeadSnapshot {
  return { ...createLightingOnlySnapshot(), roomBreakdown: [], totalRawRub: 0, minimumOrderApplied: false,
    lighting: lighting ?? undefined, leadSource: prev?.leadSource, calculationScope: "room" };
}
