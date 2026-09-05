"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ServiceCalculatorPreset } from "@/content/services";
import type { SolutionScenario, CalculatorFooterAction, CalculatorFooterBackAction } from "@/lib/calculator-modal-types";
import { useCeilingCalculatorEngine } from "@/lib/calculator/use-calculator-engine";
import type { Step0Screen, ParamId } from "@/lib/step0-fsm";
import { getEnabledParams as getEnabledParamsFsm } from "@/lib/step0-fsm";
import { calcProgress } from "@/lib/calculator/fsm";
import { selectBackVisible, selectFooterAction } from "@/lib/calculator/selectors";

import { ScenarioScreen } from "./screens/ScenarioScreen";
import { RoomPickerScreen } from "./screens/RoomPickerScreen";
import { ParamScreen } from "./screens/ParamScreen";
import { RoomEditScreen } from "./screens/RoomEditScreen";
import { SummaryScreen } from "./screens/SummaryScreen";
import {
  trackQuizBack,
  trackQuizParamConfirm,
  trackQuizScreenView,
  trackQuizSummary,
} from "@/lib/analytics";
import { resolveStep0SummaryActions } from "@/lib/calculator-flow";
import {
  clearCalcDraft,
  describeCalcDraft,
  readCalcDraft,
  saveCalcDraft,
  type CalcDraft,
} from "@/lib/calculator/draft";
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
  const { lightingDraft, goToStep } = useCalculatorModal();

  // T-022: сводочные CTA считаем от текущего сценария движка,
  // а не от сценария, «застрявшего» в bridge-снапшоте.
  const hasLightingInCart = Boolean(
    lightingDraft && lightingDraft.mode !== "none" && (lightingDraft.items?.length ?? 0) > 0
  );

  // --- FSM ---
  // Auto-skip scenario screen when coming from service page with non-standard scenario
  // T-041: экрана «что считаем» больше нет — режим переключается на экране площади.
  const startScreen: Step0Screen = initialSolutionScenario !== "standard"
    ? { t: "roomPicker", mode: "first" }
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

  // T-023: черновик прошлого расчёта — предлагаем продолжить
  const [draft, setDraft] = useState<CalcDraft | null>(null);
  const [draftDecided, setDraftDecided] = useState(false);
  const draftCheckedRef = useRef(false);
  useEffect(() => {
    if (draftCheckedRef.current) return;
    draftCheckedRef.current = true;
    if (preset) return; // пресет страницы важнее черновика
    const saved = readCalcDraft();
    if (saved) setDraft(saved);
    else setDraftDecided(true);
  }, [preset]);

  // T-023: сохраняем черновик при изменениях расчёта
  useEffect(() => {
    if (engine.rooms.length === 0) return;
    saveCalcDraft({
      scenario: engine.solutionScenario,
      scope: engine.calculationScope ?? "room",
      rooms: engine.rooms as unknown as CalcDraft["rooms"],
      cart: lightingDraft,
      totalArea: engine.totalArea,
      totalRub: engine.totalRub,
    });
  }, [
    engine.rooms,
    engine.solutionScenario,
    engine.calculationScope,
    engine.totalArea,
    engine.totalRub,
    lightingDraft,
  ]);

  // T-021: применяем пресет страницы один раз при старте сессии
  const presetAppliedRef = useRef(false);
  useEffect(() => {
    if (presetAppliedRef.current) return;
    if (!preset) return;
    presetAppliedRef.current = true;
    engine.initFromPreset(preset);
    // Пресет уже задал сценарий и комнату — начинаем сразу с площади.
    const presetRoomId = engine.activeRoomId ?? engine.rooms[0]?.id ?? "object";
    setHistory([{ t: "param", roomId: presetRoomId, param: "area" }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);

  // object-scope auto room — engine.chooseCalcMode already creates "object-1"
  // keep as safety net only if rooms empty after mode switch
  useEffect(() => {
    if (engine.calculationScope !== "object") return;
    if (engine.rooms.length > 0) return;
    // fallback: engine should have created room in chooseCalcMode, if not — do it here
    try { engine.addRoom("Весь объект"); } catch {}
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
      // T-025
      trackQuizParamConfirm({
        param: screen.param,
        value: String(engine.rooms.find(r => r.id === screen.roomId)?.area ?? ""),
        roomIndex: Math.max(0, engine.rooms.findIndex(r => r.id === screen.roomId)),
      });
    } else if (fromParam && fromRoomId) {
      markConfirmed(fromRoomId, fromParam, true);
      trackQuizParamConfirm({
        param: fromParam,
        value: "",
        roomIndex: Math.max(0, engine.rooms.findIndex(r => r.id === fromRoomId)),
      });
    }

    if (screen.t === "scenario") {
      // T-041: сразу к выбору помещения, дефолтный режим — «комната».
      pushScreen({ t: "roomPicker", mode: engine.roomsCount === 0 ? "first" : "add" });
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
      trackQuizBack({ from: curr.t }); // T-025
      popScreen();
      return;
    }
  }, [history, popScreen, markConfirmed]);

  // T-025: экран квиза при каждом push/pop
  const lastTrackedScreenRef = useRef<string>("");
  useEffect(() => {
    const key = JSON.stringify(screen);
    if (lastTrackedScreenRef.current === key) return;
    lastTrackedScreenRef.current = key;
    trackQuizScreenView({
      screen: screen.t,
      param: screen.t === "param" ? screen.param : null,
      index: history.length,
      total: enabledParams.length,
      scenario: engine.solutionScenario,
    });
  }, [screen, history.length, enabledParams.length, engine.solutionScenario]);

  const isSummary = screen.t === "summary";

  // T-025: сводка Шага 0 + параметр визита calc_total
  const summaryTrackedRef = useRef(false);
  useEffect(() => {
    if (!isSummary) {
      summaryTrackedRef.current = false;
      return;
    }
    if (summaryTrackedRef.current) return;
    summaryTrackedRef.current = true;
    trackQuizSummary({
      total: engine.totalRub,
      rooms: engine.roomsCount,
      scenario: engine.solutionScenario,
      minimumApplied: engine.minimumApplied,
    });
  }, [isSummary, engine.totalRub, engine.roomsCount, engine.solutionScenario, engine.minimumApplied]);

  // T-030: прогресс — чистый селектор с фиксированным знаменателем.
  const progress = useMemo(
    () => calcProgress(screen, { scenario: engine.solutionScenario, enabledParams }),
    [screen, engine.solutionScenario, enabledParams]
  );

  useEffect(() => {
    onStep0ProgressChange?.(progress);
    onIsStep0SummaryReadyChange?.(isSummary);
  }, [progress, isSummary, onStep0ProgressChange, onIsStep0SummaryReadyChange]);

  /**
   * T-030: подпись кнопки и видимость «назад» считают селекторы, а эффект лишь
   * публикует готовый результат в контекст модалки — никакой логики в эффекте.
   */
  const footerSpec = useMemo(
    () => selectFooterAction(screen, { scope: engine.calculationScope }),
    [screen, engine.calculationScope]
  );
  const backVisible = useMemo(
    () =>
      selectBackVisible(screen, {
        historyLength: history.length,
        scenarioPreselected: initialSolutionScenario !== "standard",
      }),
    [screen, history.length, initialSolutionScenario]
  );

  useEffect(() => {
    const action: CalculatorFooterAction | null = footerSpec
      ? {
          label: footerSpec.label,
          disabled: footerSpec.disabled,
          onClick: () => {
            if (screen.t === "roomEdit") {
              pushScreen({ t: "summary" });
              return;
            }
            goNext();
          },
        }
      : null;

    onStep0FooterActionChange?.(action);
    onStep0BackActionChange?.({ visible: backVisible, onClick: goBack });

    return () => {
      onStep0FooterActionChange?.(null);
      onStep0BackActionChange?.({ visible: false });
    };
  }, [
    footerSpec,
    backVisible,
    screen,
    goNext,
    goBack,
    pushScreen,
    onStep0FooterActionChange,
    onStep0BackActionChange,
  ]);

  if (draft && !draftDecided) {
    return (
      <div data-quiz-v2 data-active-screen="draft" className="step0-quiz-v2 max-w-3xl mx-auto">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-base font-semibold text-slate-950">
            Продолжить прошлый расчёт ({describeCalcDraft(draft)})?
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Мы сохранили параметры, которые вы уже указали в этой вкладке.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                engine.restoreFromDraft({
                  scenario: draft.scenario,
                  scope: draft.scope,
                  rooms: draft.rooms as unknown as Parameters<typeof engine.restoreFromDraft>[0]["rooms"],
                });
                setHistory([{ t: "summary" }]);
                setDraftDecided(true);
              }}
              className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Продолжить
            </button>
            <button
              type="button"
              onClick={() => {
                clearCalcDraft();
                setDraft(null);
                setDraftDecided(true);
              }}
              className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Начать заново
            </button>
          </div>
        </div>
      </div>
    );
  }

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
      {screen.t === "roomPicker" && initialSolutionScenario !== "standard" && history.length <= 1 ? (
        <div className="mb-3 flex items-center gap-2 text-xs">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
            {initialSolutionScenario === "modern" ? "Современный" : initialSolutionScenario === "advanced" ? "Продвинутый" : "Стандартный"}
          </span>
          <button type="button" onClick={() => pushScreen({ t: "scenario" })} className="text-slate-600 underline-offset-2 hover:underline">
            изменить
          </button>
        </div>
      ) : null}
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
      {screen.t === "summary" && (() => {
        const routing = resolveStep0SummaryActions({
          scenario: engine.solutionScenario,
          hasLighting: hasLightingInCart,
        });
        return (
          <SummaryScreen
            engine={engine}
            onEditRoom={roomId => pushScreen({ t: "roomEdit", roomId })}
            onAddRoom={() => pushScreen({ t: "roomPicker", mode: "add" })}
            onPrimaryCta={() => {
              onPrimaryCtaClick?.();
              goToStep(routing.primary.destination);
            }}
            onSecondaryCta={
              routing.secondary
                ? () => {
                    onSecondaryCtaClick?.();
                    goToStep(routing.secondary!.destination);
                  }
                : undefined
            }
            primaryLabel={summaryPrimaryLabel ?? routing.primary.label}
            secondaryLabel={summarySecondaryLabel ?? routing.secondary?.label}
          />
        );
      })()}
    </div>
  );
}
