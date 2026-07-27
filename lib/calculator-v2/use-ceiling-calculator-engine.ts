// V2 Engine — headless state
// Этап 1: тонкая обёртка над существующим PriceCalculatorBridge + локальным Room State
// Постепенно будем выносить сюда всю логику из PriceCalculatorClient (4400 строк)

"use client";

import { useCallback, useMemo, useState, useRef, useEffect } from "react";
import { usePriceCalculatorBridge } from "@/components/home/price-calculator-context";
import type { SolutionScenario } from "@/lib/calculator-modal-types";
import type { ParamId } from "@/lib/step0-fsm";
import { calcRoomsTotal, calcRoomSnapshotV2 } from "./room-snapshot";

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

const DEFAULT_AREA = 10;

function newRoom(id: string, label: string): RoomConfig {
  return {
    id,
    label,
    area: DEFAULT_AREA,
    ceilingType: "standard",
    shadowEnabled: false,
    shadowLength: DEFAULT_AREA,
    floatingEnabled: false,
    floatingLength: DEFAULT_AREA,
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

  // --- V2 state (пока минимальный, будет расширяться переносом из PriceCalculatorClient) ---
  const [solutionScenario, setSolutionScenario] = useState<SolutionScenario>(initialScenario);
  const [calculationScope, setCalculationScope] = useState<CalculationScope | null>(null);
  const [rooms, setRooms] = useState<RoomConfig[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const roomSeq = useRef(1);

  // touched flags to protect prefill
  const [touched, setTouched] = useState({
    trackType: false,
    trackLength: false,
    lights: false,
    chandeliers: false,
  });

  const markTouched = useCallback((key: keyof typeof touched) => {
    setTouched(prev => prev[key] ? prev : { ...prev, [key]: true });
  }, []);

  // derived
  const activeRoom = useMemo(
    () => rooms.find(r => r.id === activeRoomId) ?? null,
    [rooms, activeRoomId]
  );

  // actions
  const chooseScenario = useCallback((s: SolutionScenario) => {
    setSolutionScenario(s);
  }, []);

  const chooseCalcMode = useCallback((mode: CalculationScope) => {
    setCalculationScope(mode);
    if (mode === "object") {
      // object-scope = одна виртуальная комната
      const objId = "object-1";
      setRooms(prev => prev.length ? prev : [{ ...newRoom(objId, "Весь объект"), area: 30 }]);
      setActiveRoomId(objId);
    } else {
      // room mode – очищаем, ждем выбора комнаты
      // не трогаем если уже есть комнаты
    }
  }, []);

  const addRoom = useCallback((label: string) => {
    const id = `room-${roomSeq.current++}`;
    const room = newRoom(id, label);
    setRooms(prev => [...prev, room]);
    setActiveRoomId(id);
    return id;
  }, []);

  const updateRoom = useCallback((roomId: string, patch: Partial<RoomConfig>) => {
    // auto-mark touched
    setTouched(prev => {
      let changed = false;
      const next = { ...prev };
      if (patch.trackType !== undefined && !prev.trackType) { next.trackType = true; changed = true; }
      if (patch.trackLength !== undefined && !prev.trackLength) { next.trackLength = true; changed = true; }
      if ((patch.lightsEnabled !== undefined || patch.lightsCount !== undefined) && !prev.lights) { next.lights = true; changed = true; }
      if ((patch.chandeliersEnabled !== undefined || patch.chandeliersCount !== undefined) && !prev.chandeliers) { next.chandeliers = true; changed = true; }
      return changed ? next : prev;
    });
    setRooms(prev => prev.map(r => r.id === roomId ? { ...r, ...patch } : r));
  }, []);

  const removeRoom = useCallback((roomId: string) => {
    setRooms(prev => prev.filter(r => r.id !== roomId));
    setActiveRoomId(prev => prev === roomId ? null : prev);
  }, []);

  const switchRoom = useCallback((roomId: string) => {
    setActiveRoomId(roomId);
  }, []);

  // prefill from lighting – respects touched flags
  const applyPrefillFromLighting = useCallback((targetRoomId: string | null, prefill: {
    trackProfileMeters?: number;
    pointSpotsQty?: number;
    preferredTrackType?: TrackType | null;
  }) => {
    const rid = targetRoomId ?? activeRoomId ?? rooms[0]?.id;
    if (!rid) return;
    setRooms(prev => prev.map(r => {
      if (r.id !== rid) return r;
      const patch: Partial<RoomConfig> = {};
      const points = Math.max(0, Math.round(Number(prefill.pointSpotsQty ?? 0)));
      if (!touched.lights) {
        if (points > 0) { patch.lightsEnabled = true; patch.lightsCount = points; }
        else { patch.lightsEnabled = false; }
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
      return Object.keys(patch).length ? { ...r, ...patch } : r;
    }));
  }, [activeRoomId, rooms, touched.lights, touched.trackLength, touched.trackType]);

  // reset touched on room change / new session
  const resetTouched = useCallback(() => {
    setTouched({ trackType: false, trackLength: false, lights: false, chandeliers: false });
  }, []);
  const totalArea = useMemo(() => rooms.reduce((s, r) => s + r.area, 0), [rooms]);
  const totalRub = useMemo(() => {
    if (rooms.length === 0) return 0;
    try {
      return calcRoomsTotal(rooms as any);
    } catch {
      return totalArea * 1000;
    }
  }, [rooms, totalArea]);

  // push to bridge snapshot so Step1/Step2 see totals
  useEffect(() => {
    if (rooms.length === 0) return;
    // build aggregate snapshot (simplified)
    const firstRoom = rooms[0];
    try {
      const { snapshot: s } = calcRoomSnapshotV2(firstRoom as any);
      // aggregate totals
      const aggTotal = calcRoomsTotal(rooms as any);
      setSnapshot(prev => ({
        ...(prev ?? s),
        ...s,
        area: totalArea,
        total: aggTotal,
        roomBreakdown: rooms.map(r => {
          const { total } = calcRoomSnapshotV2(r as any);
          return {
            id: r.id,
            label: r.label,
            area: r.area,
            totalRub: total,
            ceilingTypeLabel: r.shadowEnabled ? "Теневой" : r.floatingEnabled ? "Парящий" : "Простой потолок",
          };
        }),
      }));
    } catch {}
  }, [rooms, totalArea, setSnapshot]);

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
    // derived flags
    hasRooms: rooms.length > 0,
    roomsCount: rooms.length,
    // touched
    touched,
    markTouched,
    resetTouched,
    applyPrefillFromLighting,
    // actions
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
