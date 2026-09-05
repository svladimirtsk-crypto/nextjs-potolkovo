// V2 Engine — headless state
// Этап 1: тонкая обёртка над существующим PriceCalculatorBridge + локальным Room State
// Постепенно будем выносить сюда всю логику из PriceCalculatorClient (4400 строк)

"use client";

import { useCallback, useMemo, useReducer, useState, useEffect } from "react";
import { usePriceCalculatorBridge } from "@/components/home/price-calculator-context";
import type { SolutionScenario } from "@/lib/calculator-modal-types";
import { buildRoomBreakdown, calcRoomsTotal, calcRoomSnapshotV2, type V2RoomConfig } from "./room-snapshot";
import { applyMinimumOrder, pricing } from "@/content/pricing";
import { PREFILL_HINT, defaultPerimeterMeters, presetToRoom } from "@/lib/calculator/presets";
import type { ServiceCalculatorPreset } from "@/content/services";
import {
  calculatorReducer,
  createInitialState,
  selectActiveRoom,
  type CalculationScope as ReducerScope,
} from "@/lib/calculator/reducer";

// Типы — копируем из price-calculator-client.tsx (упрощённо для V2 старта)
export type CeilingType = "standard" | "shadow" | "floating" | "shadow-floating";
export type CorniceType = "none" | "built-in" | "hidden-niche" | "surface";
export type TrackType = "none" | "built-in" | "surface";
export type CalculationScope = "room" | "object";

export type RoomConfig = {
  id: string;
  label: string;
  area: number;
  ceilingType: CeilingType;
  shadowEnabled: boolean;
  shadowLength: number;
  floatingEnabled: boolean;
  floatingLength: number;
  lightLinesEnabled: boolean;
  lightLinesLength: number;
  corniceType: CorniceType;
  corniceLength: number;
  corniceLightingEnabled: boolean;
  corniceLightingLength: number;
  corniceLightingPowerSupplies: number;
  trackType: TrackType;
  trackLength: number;
  chandeliersEnabled: boolean;
  chandeliersCount: number;
  lightsEnabled: boolean;
  lightsCount: number;
};

/** T-024: метрики набора, пришедшего из каталога освещения (lighting-first). */
export type LightingPrefill = {
  trackProfileMeters?: number;
  pointSpotsQty?: number;
  preferredTrackType?: TrackType | null;
};

/** Патч комнаты по набору света; не трогает параметры, которые клиент уже правил. */
function buildLightingPatch(
  prefill: LightingPrefill,
  touched: { lights: boolean; trackLength: boolean; trackType: boolean }
): Partial<RoomConfig> {
  const patch: Partial<RoomConfig> = {};

  const points = Math.max(0, Math.round(Number(prefill.pointSpotsQty ?? 0)));
  if (!touched.lights) {
    if (points > 0) {
      patch.lightsEnabled = true;
      patch.lightsCount = points;
    } else {
      patch.lightsEnabled = false;
    }
  }

  const meters = Number(prefill.trackProfileMeters ?? 0);
  if (meters > 0 && !touched.trackLength) {
    patch.trackLength = Math.min(50, Math.max(1, meters));
  }
  if (prefill.preferredTrackType && !touched.trackType) {
    patch.trackType = prefill.preferredTrackType;
  } else if (meters > 0 && !touched.trackType) {
    patch.trackType = "built-in";
  }

  return patch;
}

/** Экспорт для unit-тестов T-024 (в UI используется внутри движка). */
export const buildLightingPatchForTest = buildLightingPatch;

// T-041: дефолт комнаты — 18 м² (объект — 60 м², см. chooseCalcMode).
const DEFAULT_AREA = pricing.defaults.roomArea;

function newRoom(id: string, label: string): RoomConfig {
  return {
    id,
    label,
    area: DEFAULT_AREA,
    ceilingType: "standard",
    shadowEnabled: false,
    // Периметр по умолчанию round(4·√area), а не 1:1 к площади.
    shadowLength: defaultPerimeterMeters(DEFAULT_AREA),
    floatingEnabled: false,
    floatingLength: defaultPerimeterMeters(DEFAULT_AREA),
    lightLinesEnabled: false,
    lightLinesLength: 2,
    corniceType: "none",
    corniceLength: 2,
    corniceLightingEnabled: false,
    corniceLightingLength: 2,
    corniceLightingPowerSupplies: 1,
    trackType: "none",
    trackLength: 2,
    chandeliersEnabled: false,
    chandeliersCount: 1,
    lightsEnabled: false,
    lightsCount: 6,
  };
}

export function useCeilingCalculatorEngine(initialScenario: SolutionScenario = "standard") {
  const { snapshot, setSnapshot } = usePriceCalculatorBridge();

  /**
   * T-030: состояние Шага 0 живёт в редьюсере (`lib/calculator/reducer.ts`).
   * Движок остаётся тонким хуком: он собирает объекты комнат и диспатчит
   * действия, а вся логика переходов — чистая и покрыта тестами.
   */
  const [state, dispatch] = useReducer(calculatorReducer, initialScenario, (scenario) =>
    createInitialState(scenario)
  );

  const solutionScenario = state.scenario;
  const calculationScope = state.scope;
  const rooms = state.rooms;
  const activeRoomId = state.activeRoomId;
  const prefilled = state.prefilled;
  const presetNote = state.presetNote;
  const touched = state.touched;

  // T-024: набор из lighting-first ждёт комнату, к которой его применить
  const [pendingLightingPrefill, setPendingLightingPrefill] =
    useState<LightingPrefill | null>(null);

  const markTouched = useCallback((key: keyof typeof touched) => {
    dispatch({ type: "touched/mark", key });
  }, []);

  // derived
  const activeRoom = useMemo(() => selectActiveRoom(state), [state]);

  // actions
  const chooseScenario = useCallback((scenario: SolutionScenario) => {
    dispatch({ type: "scenario/choose", scenario });
  }, []);

  const chooseCalcMode = useCallback((mode: CalculationScope) => {
    const patch = pendingLightingPrefill
      ? buildLightingPatch(pendingLightingPrefill, touched)
      : {};
    dispatch({
      type: "scope/choose",
      scope: mode as ReducerScope,
      // Для «всего объекта» редьюсер создаст единственную комнату сам.
      room:
        mode === "object"
          ? {
              ...newRoom("object-1", "Весь объект"),
              area: pricing.defaults.objectArea,
              shadowLength: defaultPerimeterMeters(pricing.defaults.objectArea),
              floatingLength: defaultPerimeterMeters(pricing.defaults.objectArea),
              ...patch,
            }
          : undefined,
    });
  }, [pendingLightingPrefill, touched]);

  /**
   * T-021: старт сессии из пресета страницы услуги или кейса главной.
   * Значения помечаются `prefilled` — квиз показывает экран с выбранным значением
   * и подписью, но не считает параметр подтверждённым.
   */
  const initFromPreset = useCallback(
    (preset: ServiceCalculatorPreset | null | undefined, note?: string | null) => {
      const resolved = presetToRoom(preset);
      if (resolved.disabled) return;

      const id = "room-1";
      const base = newRoom(id, resolved.roomLabel);

      dispatch({
        type: "preset/apply",
        rooms: [{ ...base, ...resolved.room }],
        scenario: resolved.scenario,
        scope: resolved.scope,
        prefilled: resolved.prefilled,
        note: note ?? resolved.introNote ?? (preset ? PREFILL_HINT : null),
      });
    },
    []
  );

  /** T-023: восстановление сохранённого черновика сессии. */
  const restoreFromDraft = useCallback(
    (draft: { scenario: SolutionScenario; scope: "room" | "object"; rooms: RoomConfig[] }) => {
      if (!draft.rooms.length) return;
      dispatch({
        type: "rooms/replace",
        rooms: draft.rooms,
        scenario: draft.scenario,
        scope: draft.scope,
      });
    },
    []
  );

  const addRoom = useCallback((label: string) => {
    const id = `room-${state.roomSeq}`;
    const base = newRoom(id, label);
    // T-024: набор из lighting-first применяем к только что созданной комнате
    const room = pendingLightingPrefill
      ? { ...base, ...buildLightingPatch(pendingLightingPrefill, touched) }
      : base;
    dispatch({ type: "room/add", room });
    return id;
  }, [pendingLightingPrefill, touched, state.roomSeq]);

  // touched-флаги проставляет сам редьюсер по составу патча.
  const updateRoom = useCallback((roomId: string, patch: Partial<RoomConfig>) => {
    dispatch({ type: "room/update", roomId, patch });
  }, []);

  const removeRoom = useCallback((roomId: string) => {
    dispatch({ type: "room/remove", roomId });
  }, []);

  const switchRoom = useCallback((roomId: string) => {
    dispatch({ type: "room/switch", roomId });
  }, []);

  // T-024: prefill из lighting-first. Если комнаты ещё нет — запоминаем набор
  // и применяем его позже, при addRoom / chooseCalcMode.
  const applyPrefillFromLighting = useCallback(
    (targetRoomId: string | null, prefill: LightingPrefill) => {
      const rid = targetRoomId ?? activeRoomId ?? rooms[0]?.id;
      if (!rid) {
        setPendingLightingPrefill(prefill);
        return;
      }
      setPendingLightingPrefill(prefill);
      const patch = buildLightingPatch(prefill, touched);
      if (!Object.keys(patch).length) return;
      dispatch({ type: "room/update", roomId: rid, patch });
    },
    [activeRoomId, rooms, touched]
  );

  // reset touched on room change / new session
  const resetTouched = useCallback(() => {
    dispatch({ type: "touched/reset" });
  }, []);
  const totalArea = useMemo(() => rooms.reduce((s, r) => s + r.area, 0), [rooms]);
  // T-004: единый источник итоговой суммы Шага 0 (с минимальным заказом)
  const roomsTotal = useMemo(() => {
    if (rooms.length === 0) return { raw: 0, applied: 0, minimumApplied: false };
    try {
      return calcRoomsTotal(rooms as unknown as V2RoomConfig[]);
    } catch {
      return applyMinimumOrder(totalArea * pricing.ceiling.standard);
    }
  }, [rooms, totalArea]);

  const totalRub = roomsTotal.applied;
  const minimumApplied = roomsTotal.minimumApplied;

  // push to bridge snapshot so Step1/Step2 see totals
  useEffect(() => {
    if (rooms.length === 0) return;
    // build aggregate snapshot (simplified)
    const firstRoom = rooms[0];
    try {
      const { snapshot: s } = calcRoomSnapshotV2(firstRoom as unknown as V2RoomConfig);
      // aggregate totals
      const aggTotal = calcRoomsTotal(rooms as unknown as V2RoomConfig[]);
      setSnapshot(prev => ({
        ...(prev ?? s),
        ...s,
        area: totalArea,
        total: aggTotal.applied,
        totalRawRub: aggTotal.raw,
        minimumOrderApplied: aggTotal.minimumApplied,
        // T-008: устаревшее поле больше не используется
        grandTotal: undefined,
        // T-022: полный состав каждой комнаты (все длины/количества/суммы)
        roomBreakdown: rooms.map(r => buildRoomBreakdown(r as unknown as V2RoomConfig)),
        solutionScenario,
        calculationScope: calculationScope ?? "room",
      }));
    } catch {}
  }, [rooms, totalArea, setSnapshot, solutionScenario, calculationScope]);

  // мост в старый snapshot — чтобы не ломать WizardStep1/2
  // Пишем обратно в bridge только итоговые агрегаты
  // (полная миграция — этап 2)
  // useEffect(() => { setSnapshot(...) }, [totalRub, ...])

  return {
    // state
    solutionScenario,
    calculationScope,
    rooms,
    activeRoomId,
    activeRoom,
    totalArea,
    totalRub,
    totalRawRub: roomsTotal.raw,
    minimumApplied,
    // derived flags
    hasRooms: rooms.length > 0,
    roomsCount: rooms.length,
    // touched
    touched,
    markTouched,
    resetTouched,
    applyPrefillFromLighting,
    pendingLightingPrefill,
    // actions
    prefilled,
    presetNote,
    initFromPreset,
    restoreFromDraft,
    chooseScenario,
    chooseCalcMode,
    addRoom,
    updateRoom,
    removeRoom,
    switchRoom,
    // compat
    snapshot, // читаем старый snapshot для совместимости
  };
}

export type CeilingEngine = ReturnType<typeof useCeilingCalculatorEngine>;
