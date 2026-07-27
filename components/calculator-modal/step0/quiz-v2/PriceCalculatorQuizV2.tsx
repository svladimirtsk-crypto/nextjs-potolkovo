"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ServiceCalculatorPreset } from "@/content/services";
import type { SolutionScenario, CalculatorFooterAction, CalculatorFooterBackAction } from "@/lib/calculator-modal-types";
import { useCeilingCalculatorEngine } from "@/lib/calculator-v2/use-ceiling-calculator-engine";
import type { Step0Screen, ParamId } from "@/lib/step0-fsm";
import { getParamConfirmLabel, getEnabledParams as getEnabledParamsFsm } from "@/lib/step0-fsm";

import { ScenarioScreen } from "./screens/ScenarioScreen";
import { CalcModeScreen } from "./screens/CalcModeScreen";
import { RoomPickerScreen } from "./screens/RoomPickerScreen";
import { ParamScreen } from "./screens/ParamScreen";
import { RoomEditScreen } from "./screens/RoomEditScreen";
import { SummaryScreen } from "./screens/SummaryScreen";
import { useCalculatorModal } from "../../calculator-modal-context";

type Props = {
  preset?: ServiceCalculatorPreset;
  initialSolutionScenario?: SolutionScenario;
  onStep0ProgressChange?: (p: {done:number; total:number} | null) => void;
  onIsStep0SummaryReadyChange?: (ready: boolean) => void;
  onStep0FooterActionChange?: (a: CalculatorFooterAction | null) => void;
  onStep0BackActionChange?: (a: CalculatorFooterBackAction) => void;
  onPrimaryCtaClick?: () => void;
  onSecondaryCtaClick?: () => void;
  summaryPrimaryLabel?: string;
  summarySecondaryLabel?: string;
  prefillFromLighting?: {
    trackProfileMeters: number;
    pointSpotsQty: number;
    preferredTrackType?: "built-in" | "surface" | null;
  } | null;
  prefillFromLightingTrigger?: number;
};

export function PriceCalculatorQuizV2({
  preset,
  initialSolutionScenario = "standard",
  onStep0ProgressChange,
  onIsStep0SummaryReadyChange,
  onStep0FooterActionChange,
  onStep0BackActionChange,
  onPrimaryCtaClick,
  onSecondaryCtaClick,
  summaryPrimaryLabel,
  summarySecondaryLabel,
  prefillFromLighting = null,
  prefillFromLightingTrigger = 0,
}: Props) {
  const engine = useCeilingCalculatorEngine(initialSolutionScenario);
  const { lightingDraft } = useCalculatorModal();

  // --- FSM ---
  // Auto-skip scenario screen when coming from service page with non-standard scenario
  const startScreen: Step0Screen = initialSolutionScenario !== "standard"
    ? { t: "calcMode" }
    : { t: "scenario" };
  const [history, setHistory] = useState<Step0Screen[]>([startScreen]);
  const screen = history[history.length - 1] ?? { t: "scenario" } as Step0Screen;

  const pushScreen = useCallback((s: Step0Screen) => setHistory(h => [...h, s]), []);
  const popScreen = useCallback(() => setHistory(h => h.length > 1 ? h.slice(0, -1) : h), []);
  const replaceScreen = useCallback((s: Step0Screen) => setHistory(h => [...h.slice(0, -1), s]), []);

  // confirmed map per room/object
  const [confirmedMap, setConfirmedMap] = useState<Record<string, Partial<Record<ParamId, boolean>>>>({});
  const getRoomKey = (roomId: string | "object") => roomId;
  const isParamConfirmed = (roomId: string, param: ParamId) => !!confirmedMap[getRoomKey(roomId)]?.[param];
  const markConfirmed = useCallback((roomId: string, param: ParamId, value: boolean = true) => {
    setConfirmedMap(prev => ({
      ...prev,
      [getRoomKey(roomId)]: { ...(prev[getRoomKey(roomId)] ?? {}), [param]: value }
    }));
  }, []);

  // enabled params – dynamic per room state
  const currentRoom = screen.t === "param" ? engine.rooms.find(r => r.id === screen.roomId) ?? null : engine.activeRoom;
  const showModern = engine.solutionScenario !== "standard";
  const enabledParams: ParamId[] = useMemo(() => {
    const shadow = currentRoom?.shadowEnabled ?? false;
    const floating = currentRoom?.floatingEnabled ?? false;
    return getEnabledParamsFsm({
      scenario: engine.solutionScenario,
      shadowEnabled: shadow,
      floatingEnabled: floating,
      showModernOptions: showModern,
    });
  }, [engine.solutionScenario, showModern, currentRoom?.shadowEnabled, currentRoom?.floatingEnabled]);

  // object-scope auto room — engine.chooseCalcMode already creates "object-1"
  // keep as safety net only if rooms empty after mode switch
  useEffect(() => {
    if (engine.calculationScope !== "object") return;
    if (engine.rooms.length > 0) return;
    // fallback: engine should have created room in chooseCalcMode, if not — do it here
    try { (engine as any).addRoom?.("Весь объект"); } catch {}
  }, [engine.calculationScope, engine.rooms.length]);

  // prefill from lighting — uses engine.applyPrefillFromLighting (respects touched flags)
  useEffect(() => {
    if (!prefillFromLighting) return;
    if (!prefillFromLightingTrigger) return;
    engine.applyPrefillFromLighting(null, prefillFromLighting);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillFromLightingTrigger]);

  // next
  const goNext = useCallback((fromParam?: ParamId, fromRoomId?: string) => {
    // mark confirmed if param screen
    if (screen.t === "param") {
      markConfirmed(screen.roomId, screen.param, true);
    } else if (fromParam && fromRoomId) {
      markConfirmed(fromRoomId, fromParam, true);
    }

    if (screen.t === "scenario") {
      pushScreen({ t: "calcMode" });
      return;
    }
    if (screen.t === "calcMode") {
      if (engine.calculationScope === "room") {
        pushScreen({ t: "roomPicker", mode: engine.roomsCount === 0 ? "first" : "add" });
      } else if (engine.calculationScope === "object") {
        // ensure object room exists
        const objRoomId = engine.activeRoomId ?? engine.rooms[0]?.id;
        if (!objRoomId) {
          // fallback – try again next tick after engine creates room
          setTimeout(() => {
            const rid = engine.activeRoomId ?? engine.rooms[0]?.id;
            if (rid) pushScreen({ t: "param", roomId: rid, param: enabledParams[0] ?? "area" });
          }, 0);
          return;
        }
        const first = enabledParams[0] ?? "area";
        pushScreen({ t: "param", roomId: objRoomId, param: first });
      }
      return;
    }
    if (screen.t === "param") {
      const idx = enabledParams.indexOf(screen.param);
      const nextParam = idx >= 0 ? enabledParams[idx + 1] : null;
      if (nextParam) {
        pushScreen({ t: "param", roomId: screen.roomId, param: nextParam });
      } else {
        pushScreen({ t: "summary" });
      }
      return;
    }
    if (screen.t === "roomEdit") {
      pushScreen({ t: "summary" });
      return;
    }
  }, [screen, engine.calculationScope, engine.roomsCount, enabledParams, pushScreen, markConfirmed]);

  const goBack = useCallback(() => {
    if (history.length > 1) {
      // unconfirm current param when going back
      const curr = history[history.length - 1];
      if (curr.t === "param") {
        markConfirmed(curr.roomId, curr.param, false);
      }
      popScreen();
      return;
    }
  }, [history, popScreen, markConfirmed]);

  const isSummary = screen.t === "summary";

  // progress
  useEffect(() => {
    const roomKey = screen.t === "param" ? screen.roomId : engine.activeRoomId ?? "object";
    const confirmed = confirmedMap[roomKey] ?? {};
    const done = enabledParams.filter(p => confirmed[p]).length + (screen.t === "summary" ? enabledParams.length : 0) + (["calcMode","roomPicker","roomEdit"].includes(screen.t) ? 2 : screen.t==="param" ? 2 : screen.t==="scenario" ? 0 : 1);
    const total = enabledParams.length + 3; // scenario + calcMode + summary
    onStep0ProgressChange?.({ done: Math.min(done, total), total });
    onIsStep0SummaryReadyChange?.(isSummary);
  }, [screen, enabledParams, confirmedMap, engine.activeRoomId, isSummary, onStep0ProgressChange, onIsStep0SummaryReadyChange]);

  // footer
  useEffect(() => {
    if (isSummary) {
      onStep0FooterActionChange?.(null);
      onStep0BackActionChange?.({ visible: true, onClick: goBack });
      return;
    }
    let label = "Подтвердить →";
    let disabled = false;
    if (screen.t === "scenario") { label = "Выберите вариант выше"; disabled = false; }
    else if (screen.t === "calcMode") { label = engine.calculationScope ? "Продолжить →" : "Выберите режим выше"; disabled = !engine.calculationScope; }
    else if (screen.t === "roomPicker") { label = "Выберите помещение выше"; disabled = true; }
    else if (screen.t === "param") { label = getParamConfirmLabel(screen.param); disabled = false; }
    else if (screen.t === "roomEdit") { label = "Готово →"; disabled = false; }

    const action: CalculatorFooterAction = {
      label, disabled,
      onClick: () => {
        if (screen.t === "roomEdit") { pushScreen({ t: "summary" }); return; }
        goNext();
      }
    };
    onStep0FooterActionChange?.(action);
    // hide back on scenario screen, and on the initial auto-skipped calcMode (has "изменить" badge instead)
    const showBack = screen.t !== "scenario" && !(screen.t === "calcMode" && history.length <= 1 && initialSolutionScenario !== "standard");
    onStep0BackActionChange?.({ visible: showBack, onClick: goBack });
    return () => {
      onStep0FooterActionChange?.(null);
      onStep0BackActionChange?.({ visible: false });
    };
  }, [screen, engine.calculationScope, goNext, goBack, isSummary, onStep0FooterActionChange, onStep0BackActionChange, pushScreen]);

  return (
    <div data-quiz-v2 data-active-screen={screen.t} className="step0-quiz-v2 max-w-3xl mx-auto">
      {screen.t === "scenario" && (
        <>
          {initialSolutionScenario !== "standard" && history.length > 1 && (
            <div className="mb-3">
              <button type="button" onClick={popScreen} className="text-sm text-slate-600 hover:text-slate-900">← Назад</button>
            </div>
          )}
          <ScenarioScreen
            value={engine.solutionScenario}
            onChoose={s => { engine.chooseScenario(s); goNext(); }}
          />
        </>
      )}
      {screen.t === "calcMode" && (
        <>
          {initialSolutionScenario !== "standard" && (
            <div className="mb-3 flex items-center gap-2 text-xs">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
                {initialSolutionScenario === "modern" ? "Современный" : initialSolutionScenario === "advanced" ? "Продвинутый" : "Стандартный"}
              </span>
              <button type="button" onClick={() => pushScreen({ t: "scenario" })} className="text-slate-500 underline-offset-2 hover:underline">
                изменить
              </button>
            </div>
          )}
          <CalcModeScreen
            value={engine.calculationScope}
            onChoose={m => { engine.chooseCalcMode(m); goNext(); }}
            onBack={initialSolutionScenario !== "standard" && history.length <= 1 ? undefined : goBack}
          />
        </>
      )}
      {screen.t === "roomPicker" && (
        <RoomPickerScreen
          rooms={engine.rooms}
          mode={screen.mode}
          onAdd={label => { const id = engine.addRoom(label); pushScreen({ t: "param", roomId: id, param: "area" }); }}
          onSelect={roomId => { engine.switchRoom(roomId); pushScreen({ t: "param", roomId, param: "area" }); }}
          onBack={goBack}
        />
      )}
      {screen.t === "param" && (
        <ParamScreen
          roomId={screen.roomId}
          param={screen.param}
          engine={engine}
          onConfirm={() => goNext(screen.param, screen.roomId)}
          onBack={goBack}
        />
      )}
      {screen.t === "roomEdit" && (
        <RoomEditScreen
          roomId={screen.roomId}
          engine={engine}
          onEditParam={param => pushScreen({ t: "param", roomId: screen.roomId, param })}
          onBack={goBack}
          onDelete={() => { engine.removeRoom(screen.roomId); popScreen(); }}
        />
      )}
      {screen.t === "summary" && (
        <SummaryScreen
          engine={engine}
          onEditRoom={roomId => pushScreen({ t: "roomEdit", roomId })}
          onAddRoom={() => pushScreen({ t: "roomPicker", mode: "add" })}
          onPrimaryCta={onPrimaryCtaClick}
          onSecondaryCta={onSecondaryCtaClick}
          primaryLabel={summaryPrimaryLabel}
          secondaryLabel={summarySecondaryLabel}
        />
      )}
    </div>
  );
}
