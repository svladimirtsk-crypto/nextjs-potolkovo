"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  inspectCalcDraft,
  saveCalcDraft,
  type CalcDraft,
} from "@/lib/calculator/draft";
import { hasLightingItems } from "@/lib/calculator/snapshot-merge";
import { DraftRestoreChoice } from "./DraftRestoreChoice";
import { useCalculatorModal } from "../../calculator-modal-context";
import { EMPTY_STEP0_STATE, useCalculatorStore } from "@/lib/calculator/store";

type Props = {
  preset?: ServiceCalculatorPreset;
  /** PT-007 (раздел 3.1 ТЗ): "default" — пресет фабрикует контекст, а не страница. */
  presetOrigin?: "default" | "page" | "explicit";
  initialSolutionScenario?: SolutionScenario;
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

/**
 * PT-007: что показать до решения пользователя по сохранённому черновику.
 * `offer` — черновик прочитан и его можно продолжить; `unreadable` — запись
 * есть, но не читается, и молча затирать её нельзя (раздел 3.2 ТЗ).
 */
type PendingDraft =
  | { kind: "offer"; draft: CalcDraft }
  | { kind: "unreadable"; reason: "unknown-version" | "corrupt" };

export function PriceCalculatorQuizV2({
  preset,
  presetOrigin,
  initialSolutionScenario = "standard",
  onPrimaryCtaClick,
  onSecondaryCtaClick,
  summaryPrimaryLabel,
  summarySecondaryLabel,
  prefillFromLighting = null,
  prefillFromLightingTrigger = 0,
}: Props) {
  const engine = useCeilingCalculatorEngine(initialSolutionScenario);
  const { lightingDraft, setLightingDraft, goToStep } = useCalculatorModal();

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
  const { setStep0, setHasInteracted } = useCalculatorStore();
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

  /**
   * T-023 · PT-007: черновик прошлого расчёта — предлагаем продолжить.
   *
   * Прежняя версия читала черновик только при `!preset` («пресет страницы
   * важнее черновика»). Но обёртка Step0 (`wizard-step0-calculator.tsx`)
   * формирует `resolvedPreset` всегда, а контекст подставляет заглушку
   * `{ ceilingType: "standard", areaDefault }` даже при обычном входе с главной.
   * То есть `preset` был истиной на любом входе, черновик не читался никогда, а
   * экран выбора ниже был мёртвым кодом.
   *
   * Теперь происхождение пресета различается типизированным `presetOrigin`
   * (раздел 3.1), а не наличием объекта, и решение всегда остаётся за
   * пользователем: пока `draftSettled` не установлен, не применяется ни пресет,
   * ни сохранение нового черновика.
   */
  const [pendingDraft, setPendingDraft] = useState<PendingDraft | null>(null);
  const [draftSettled, setDraftSettled] = useState(false);
  const draftCheckedRef = useRef(false);
  useEffect(() => {
    if (draftCheckedRef.current) return;
    draftCheckedRef.current = true;
    const result = inspectCalcDraft();
    if (result.status === "ok") {
      setPendingDraft({ kind: "offer", draft: result.draft });
    } else if (result.status === "unreadable") {
      setPendingDraft({ kind: "unreadable", reason: result.reason });
    } else {
      setDraftSettled(true);
    }
  }, []);

  // T-023: сохраняем черновик при изменениях расчёта.
  // PT-007 (раздел 3.2): не раньше явного решения пользователя. Иначе пресет
  // страницы, применённый до выбора, успевал создать комнату — и первый же
  // пересчёт затирал сохранённые комнаты и корзину света.
  useEffect(() => {
    if (!draftSettled) return;
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
    draftSettled,
    engine.rooms,
    engine.solutionScenario,
    engine.calculationScope,
    engine.totalArea,
    engine.totalRub,
    lightingDraft,
  ]);

  // T-021: применяем пресет страницы один раз при старте сессии.
  // PT-007: и только после решения по черновику — явный `entryPreset` со
  // страницы услуги/кейса подменяет черновик лишь после подтверждения.
  const presetAppliedRef = useRef(false);
  useEffect(() => {
    if (presetAppliedRef.current) return;
    if (!draftSettled) return;
    if (!preset) return;
    presetAppliedRef.current = true;
    // N-013 (F-10): у заглушки нет источника — и подписи «со страницы» тоже.
    engine.initFromPreset(preset, presetOrigin === "default" ? null : undefined);
    // Пресет уже задал сценарий и комнату — начинаем сразу с площади.
    const presetRoomId = engine.activeRoomId ?? engine.rooms[0]?.id ?? "object";
    setHistory([{ t: "param", roomId: presetRoomId, param: "area" }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, draftSettled]);

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

  /**
   * T-030: подпись кнопки и видимость «назад» считают селекторы — чистые
   * функции экрана, без обращения к DOM и без ветвлений в разметке.
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

  /**
   * N-050 · Публикация состояния Шага 0 в стор.
   *
   * Кнопки футера рисует модалка, а знает про экран только квиз. Раньше связь
   * шла через четыре сеттер-колбэка, каждый со своим `useEffect`; теперь это
   * одна запись готового объекта. Логики здесь нет — всё посчитано
   * селекторами выше, эффект только доставляет результат.
   */
  /**
   * Команды кнопок держим в ref: подпись публикуется синхронно
   * (useLayoutEffect ниже), но сами замыкания пересоздаются на каждом рендере,
   * и без ref каждая смена экрана порождала бы новый объект footerAction —
   * то есть лишнюю запись в стор и лишний рендер модалки.
   */
  const nextRef = useRef({ screen, goNext, pushScreen });
  nextRef.current = { screen, goNext, pushScreen };

  const backRef = useRef(goBack);
  backRef.current = goBack;
  const runGoBack = useCallback(() => backRef.current(), []);

  const runFooterAction = useCallback(() => {
    const current = nextRef.current;
    if (current.screen.t === "roomEdit") {
      current.pushScreen({ t: "summary" });
      return;
    }
    current.goNext();
  }, []);

  const footerAction = useMemo<CalculatorFooterAction | null>(
    () =>
      footerSpec
        ? {
            label: footerSpec.label,
            disabled: footerSpec.disabled,
            onClick: runFooterAction,
          }
        : null,
    [footerSpec, runFooterAction]
  );

  /**
   * Публикация — в useLayoutEffect, а не useEffect.
   *
   * useEffect выполняется ПОСЛЕ отрисовки, поэтому кадр между сменой экрана и
   * доставкой новой подписи успевал попасть на экран: заголовок уже «Карнизы»,
   * а кнопка ещё «Подтвердить тип». Вручную это мелькание почти незаметно, но
   * быстрый клик попадал в него и подтверждал предыдущий шаг повторно —
   * сценарий 6 стабильно проваливался.
   *
   * useLayoutEffect отрабатывает до отрисовки: модалка получает подпись в том
   * же кадре, в котором сменился экран.
   */
  useLayoutEffect(() => {
    setStep0({
      progress,
      isSummaryReady: isSummary,
      footerAction,
      backAction: { visible: backVisible, onClick: runGoBack },
    });
  }, [setStep0, progress, isSummary, footerAction, backVisible, runGoBack]);

  /**
   * Сброс — отдельным эффектом с пустыми зависимостями.
   *
   * Держать его как cleanup публикующего эффекта нельзя: React вызывает
   * cleanup перед КАЖДЫМ повторным запуском, а не только при размонтировании.
   * Из-за этого на каждой смене экрана футер успевал обнулиться до записи
   * нового значения — кнопка «Подтвердить» на миг исчезала, и клик по ней
   * промахивался.
   */
  useEffect(() => () => setStep0(EMPTY_STEP0_STATE), [setStep0]);

  if (pendingDraft && !draftSettled) {
    const offer = pendingDraft.kind === "offer" ? pendingDraft : null;
    return (
      <div data-quiz-v2 data-active-screen="draft" className="step0-quiz-v2 max-w-3xl mx-auto">
        <DraftRestoreChoice
          variant={pendingDraft.kind}
          origin={presetOrigin ?? "default"}
          summary={offer ? describeCalcDraft(offer.draft) : undefined}
          lightingItemsCount={offer ? (offer.draft.cart?.items?.length ?? 0) : 0}
          onContinue={
            offer
              ? () => {
                  const draft = offer.draft;
                  engine.restoreFromDraft({
                    scenario: draft.scenario,
                    scope: draft.scope,
                    rooms: draft.rooms as unknown as Parameters<
                      typeof engine.restoreFromDraft
                    >[0]["rooms"],
                  });
                  /**
                   * PT-007: восстанавливаем корзину света целиком — SKU,
                   * количества и режим скидки (`discountMode` лежит в том же
                   * снапшоте), а не только параметры комнат.
                   */
                  setLightingDraft(draft.cart);
                  /**
                   * N-050: без этого флага ActionForm не прикладывает снапшот к
                   * заявке — мастер получил бы имя с телефоном без состава
                   * корзины и без суммы. Тот же флаг контекст ставит при входе
                   * с готовым набором света.
                   */
                  if (hasLightingItems(draft.cart)) setHasInteracted(true);
                  setHistory([{ t: "summary" }]);
                  // Пользователь выбрал черновик — пресет страницы применять нельзя.
                  presetAppliedRef.current = true;
                  setPendingDraft(null);
                  setDraftSettled(true);
                }
              : undefined
          }
          onStartNew={() => {
            // PT-007 (раздел 3.2): неудаляемый до этого момента черновик
            // снимается только явным выбором, включая нечитаемую запись.
            clearCalcDraft();
            setPendingDraft(null);
            setDraftSettled(true);
          }}
        />
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
