"use client";
import { useCallback, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { CeilingEngine, RoomConfig } from "@/lib/calculator/use-calculator-engine";
import type { LightingSnapshot } from "@/lib/calculator-modal-types";
import type { ParamId, Step0Screen } from "@/lib/step0-fsm";
import { pricing } from "@/content/pricing";
import { clearCalcDraft } from "@/lib/calculator/draft";
import { showConfirmDialog } from "@/components/ui/confirm-dialog";
import { changedRoomFields, confirmationsAfterEdit, createRoomEdit, firstRoomPending, paramsForRoom, patchRoomEdit, type RoomConfirmations, type RoomEditDraft } from "@/lib/calculator/room-workspace";

export function useRoomWorkspace(engine: CeilingEngine, setHistory: Dispatch<SetStateAction<Step0Screen[]>>, lighting: LightingSnapshot | null, resetCeiling: () => void) {
  const [confirmed, setConfirmed] = useState<RoomConfirmations>({});
  const [legacyRestored, setLegacyRestored] = useState<Set<string>>(new Set());
  const [edit, setEdit] = useState<RoomEditDraft | null>(null);
  const [reviewRoom, setReviewRoom] = useState<string | null>(null);
  const deleting = useRef(false);
  const latest = useRef({ engine, resetCeiling }); latest.current = { engine, resetCeiling };
  const cancel = useCallback(() => {
    setEdit(null);
    setHistory(history => history.length > 1 ? history.slice(0, -1) : history);
  }, [setHistory]);
  const markConfirmed = useCallback((id: string, param: ParamId, value = true) => {
    setConfirmed(prev => ({ ...prev, [id]: { ...prev[id], [param]: value } }));
  }, []);
  function begin(roomId: string, param: ParamId) {
    const room = engine.rooms.find(r => r.id === roomId); if (!room) return;
    setEdit(createRoomEdit(room, param, engine.solutionScenario));
    setHistory(h => [...h, { t: "param", roomId, param }]);
  }
  function save() {
    if (!edit || !engine.rooms.some(r => r.id === edit.roomId)) return;
    const patch = changedRoomFields(edit);
    if (Object.keys(patch).length) engine.updateRoom(edit.roomId, patch);
    if (edit.scenario !== engine.solutionScenario) engine.chooseScenario(edit.scenario);
    const saved = legacyRestored.has(edit.roomId)
      ? Object.fromEntries(paramsForRoom(edit.before, edit.beforeScenario).map(p => [p, true]))
      : confirmed[edit.roomId] ?? {};
    setConfirmed(prev => ({ ...prev, [edit.roomId]: confirmationsAfterEdit(edit, saved) }));
    setLegacyRestored(prev => new Set([...prev].filter(id => id !== edit.roomId)));
    setEdit(null); setHistory(h => h.slice(0, -1));
  }
  function openRoom(id: string) {
    engine.switchRoom(id); setReviewRoom(null);
    setHistory([{ t: "summary" }, { t: "roomEdit", roomId: id }]);
  }
  function resume(roomId: string, param: ParamId) {
    engine.switchRoom(roomId); setReviewRoom(roomId);
    setHistory([{ t: "summary" }, { t: "param", roomId, param }]);
  }
  async function remove(roomId: string) {
    if (deleting.current) return;
    const room = engine.rooms.find(r => r.id === roomId); if (!room) return;
    deleting.current = true;
    try {
      const yes = await showConfirmDialog({
        title: `Удалить помещение «${room.label}»?`,
        message: `${room.area} м² и параметры этого помещения будут удалены. ` +
          (engine.rooms.length === 1 ? "Это последнее помещение: черновик потолка тоже будет удалён. " : "Сумма потолочной части будет пересчитана. ") +
          (lighting?.items?.length ? (engine.rooms.length === 1 ? `Товары останутся в текущей вкладке. Без потолка применяется скидка на оборудование ${pricing.lightingDiscount.lightingOnlyPct}%; скидка ${pricing.lightingDiscount.withCeilingPct}% действует только с потолком. Состав нужно проверить.` : "Оборудование останется в текущей вкладке — его состав нужно проверить отдельно.") : (engine.rooms.length === 1 ? "Затем можно будет добавить новое помещение." : "Остальные помещения не изменятся.")),
        confirmLabel: "Удалить помещение", cancelLabel: "Оставить помещение", variant: "danger",
      });
      if (yes !== true) return;
      const { engine: current, resetCeiling: clearCeiling } = latest.current;
      if (!current.rooms.some(r => r.id === roomId)) return;
      const last = current.rooms.length === 1;
      current.removeRoom(roomId);
      setConfirmed(prev => Object.fromEntries(Object.entries(prev).filter(([id]) => id !== roomId)));
      setLegacyRestored(prev => new Set([...prev].filter(id => id !== roomId)));
      setReviewRoom(null);
      if (last) {
        clearCalcDraft(); clearCeiling();
        setHistory([{ t: "roomPicker", mode: "first" }]);
      } else setHistory([{ t: "summary" }]);
    } finally { deleting.current = false; }
  }
  const pending = firstRoomPending(engine.rooms, engine.solutionScenario, confirmed, legacyRestored);
  const roomStatus = (room: RoomConfig): string => {
    if (legacyRestored.has(room.id)) return "Сохранённые параметры · проверьте";
    const params = paramsForRoom(room, engine.solutionScenario);
    const done = params.filter(p => confirmed[room.id]?.[p]).length;
    return done === params.length ? "Параметры заполнены" : `Заполнено ${done} из ${params.length}`;
  };
  const viewEngine: CeilingEngine = edit ? {
    ...engine, rooms: engine.rooms.map(r => r.id === edit.roomId ? edit.draft : r), activeRoom: edit.draft,
    solutionScenario: edit.scenario, prefilled: {}, presetNote: null,
    updateRoom: (id, patch) => setEdit(prev => prev && prev.roomId === id ? patchRoomEdit(prev, patch) : prev),
    chooseScenario: scenario => setEdit(prev => prev ? { ...prev, scenario } : prev),
  } : engine;
  const confirmationsForDraft = useMemo(() => Object.fromEntries(engine.rooms.map(r => [r.id, confirmed[r.id] ?? {}])), [engine.rooms, confirmed]);
  return { confirmed, markConfirmed, edit, begin, save, cancel, openRoom, resume, remove, pending, roomStatus, viewEngine, reviewRoom,
    finishReview: () => setReviewRoom(null),
    restore: (rooms: readonly RoomConfig[], flags: RoomConfirmations | undefined, scenario = engine.solutionScenario) => {
      setConfirmed(flags ?? Object.fromEntries(rooms.map(r => [r.id, Object.fromEntries(paramsForRoom(r, scenario).map(p => [p, true]))]))); setLegacyRestored(new Set(flags ? [] : rooms.map(r => r.id)));
    },
    confirmationsForDraft,
  };
}
