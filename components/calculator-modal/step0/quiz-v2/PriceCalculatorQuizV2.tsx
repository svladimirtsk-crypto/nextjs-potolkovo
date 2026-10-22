"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ServiceCalculatorPreset } from "@/content/services";
import type { SolutionScenario, CalculatorFooterAction, LightingSnapshot } from "@/lib/calculator-modal-types";
import { useCeilingCalculatorEngine } from "@/lib/calculator/use-calculator-engine";
import type { Step0Screen, ParamId } from "@/lib/step0-fsm";
import { roomQuestionPlan, scenarioFromRooms } from "@/lib/calculator/room-features";
import { calcProgress } from "@/lib/calculator/fsm";
import { selectBackVisible, selectFooterAction } from "@/lib/calculator/selectors";
import { paramConfirmValue, quizRoomIndex, resolveQuizRoom } from "@/lib/step0-param-value";

import { useRoomWorkspace } from "./use-room-workspace";
import { RoomContext } from "./room-context";
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
import { DraftCatalogReview } from "./DraftCatalogReview";
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
const FALLBACK_SCREEN: Step0Screen = { t: "roomPicker", mode: "first" };

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
  const { lightingDraft, setLightingDraft, goToStep, resetCeilingAfterLastRoom, markStep0SessionInteracted } = useCalculatorModal();

  // T-022: сводочные CTA считаем от текущего сценария движка,
  // а не от сценария, «застрявшего» в bridge-снапшоте.
  const hasLightingInCart = Boolean(
    lightingDraft && lightingDraft.mode !== "none" && (lightingDraft.items?.length ?? 0) > 0
  );

  // --- FSM ---
  // UX-R2: уровням «стандартный/современный» больше не нужен отдельный экран.
  // Решения выбираются внутри карточки помещения, поэтому вход всегда в список комнат.
  const startScreen: Step0Screen = { t: "roomPicker", mode: "first" };
  const { setStep0, setHasInteracted } = useCalculatorStore();
  const [history, setHistory] = useState<Step0Screen[]>([startScreen]);
  const screen = history[history.length - 1] ?? FALLBACK_SCREEN;

  const pushScreen = useCallback((s: Step0Screen) => setHistory(h => [...h, s]), []);
  const popScreen = useCallback(() => setHistory(h => h.length > 1 ? h.slice(0, -1) : h), []);

  const workspace = useRoomWorkspace(engine, setHistory, lightingDraft, resetCeilingAfterLastRoom);
  const { confirmed: confirmedMap, markConfirmed, edit } = workspace;
  const viewEngine = workspace.viewEngine;
  const isEditing = edit !== null;
  const hasPending = workspace.pending !== null;

  // enabled params – dynamic per room state
  const currentRoom = screen.t === "param" || screen.t === "roomEdit" ? viewEngine.rooms.find(r => r.id === screen.roomId) ?? null : engine.activeRoom;
  const enabledParams: ParamId[] = useMemo(() => currentRoom
    ? roomQuestionPlan(currentRoom, screen.t === "param" ? screen.param : undefined) : [],
    [currentRoom, screen]);

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
  const [reviewingDraft, setReviewingDraft] = useState(false);
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
      confirmed: workspace.confirmationsForDraft,
    });
  }, [
    draftSettled,
    engine.rooms,
    engine.solutionScenario,
    engine.calculationScope,
    engine.totalArea,
    engine.totalRub,
    lightingDraft,
    workspace.confirmationsForDraft,
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
    /**
     * PT-008: id комнаты берём из `initFromPreset`, а не из состояния движка.
     *
     * `engine.activeRoomId ?? engine.rooms[0]?.id ?? "object"` читал состояние
     * ДО диспатча (пустой `createInitialState`: rooms=[], activeRoomId=null) и
     * поэтому всегда давал `"object"`. История экранов расходилась с реальной
     * комнатой `"room-1"`, `enabledParams` не находил комнату по
     * `screen.roomId` и считал `shadowEnabled`/`floatingEnabled` ложными —
     * экраны «Длина теневого профиля» и «Длина парящего профиля» не
     * включались вовсе. Метры профиля при этом молча попадали в сумму: на
     * странице «Теневой профиль» и в кейсе «18 м² / 19 м теневого / 10 м трека»
     * человек не мог ни увидеть, ни поправить длину профиля.
     */
    const presetRoomId =
      engine.initFromPreset(preset, presetOrigin === "default" ? null : undefined) ??
      engine.activeRoomId ??
      "object";
    setHistory([{ t: "param", roomId: presetRoomId, param: "area" }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, draftSettled]);

  // prefill from lighting — uses engine.applyPrefillFromLighting (respects touched flags)
  useEffect(() => {
    if (!prefillFromLighting) return;
    if (!prefillFromLightingTrigger) return;
    engine.applyPrefillFromLighting(null, prefillFromLighting);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillFromLightingTrigger]);

  // next
  const goNext = (fromParam?: ParamId, fromRoomId?: string) => {
    if (screen.t === "param") markStep0SessionInteracted();
    if (edit) { workspace.save(); return; }
    // mark confirmed if param screen
    /**
     * PT-024 · В событие уходит значение именно того параметра, который
     * подтвердили. Раньше во всех случаях отправлялась площадь комнаты, а для
     * виртуального объекта (`roomId = "object"`) — пустая строка.
     */
    const confirmed: { param: ParamId; roomId: string } | null =
      screen.t === "param"
        ? { param: screen.param, roomId: screen.roomId }
        : fromParam !== undefined && fromRoomId !== undefined
          ? { param: fromParam, roomId: fromRoomId }
          : null;
    if (confirmed) {
      const room = resolveQuizRoom(engine.rooms, confirmed.roomId, engine.activeRoomId);
      markConfirmed(confirmed.roomId, confirmed.param, true);
      trackQuizParamConfirm({
        param: confirmed.param,
        value: room ? paramConfirmValue(room, confirmed.param) : false,
        roomIndex: quizRoomIndex(engine.rooms, room),
      });
    }

    if (screen.t === "scenario") {
      // T-041: сразу к выбору помещения, дефолтный режим — «комната».
      pushScreen({ t: "roomPicker", mode: engine.roomsCount === 0 ? "first" : "add" });
      return;
    }
    if (screen.t === "param") {
      const idx = enabledParams.indexOf(screen.param);
      const nextParam = workspace.reviewRoom === screen.roomId
        ? enabledParams.find(p => p !== screen.param && !confirmedMap[screen.roomId]?.[p])
        : idx >= 0 ? enabledParams[idx + 1] : null;
      if (nextParam) {
        pushScreen({ t: "param", roomId: screen.roomId, param: nextParam });
      } else {
        workspace.finishReview();
        setHistory([{ t: "summary" }]);
      }
      return;
    }
    if (screen.t === "roomEdit") {
      pushScreen({ t: "summary" });
      return;
    }
  };

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
  const hasLightingTasks = engine.rooms.some(room => room.floatingEnabled || room.lightLinesEnabled
    || (room.corniceType !== "none" && room.corniceLightingEnabled) || room.trackType !== "none");
  const routing = resolveStep0SummaryActions({ hasLighting: hasLightingInCart, hasLightingTasks });
  const runSummaryPrimary = () => {
    if (workspace.pending) { workspace.resume(workspace.pending.roomId, workspace.pending.param); return; }
    if (!engine.rooms.length) return;
    onPrimaryCtaClick?.(); goToStep(routing.primary.destination);
  };

  /**
   * UX-R2: сценарий — производная решений комнат, а не остаток от снятого
   * экрана. Считаем мемо, чтобы эффект аналитики не зависел от всего массива
   * комнат (иначе он перезапускался бы на каждом пересчёте).
   */
  const trackedScenario = useMemo(
    () => scenarioFromRooms(engine.rooms, engine.solutionScenario),
    [engine.rooms, engine.solutionScenario]
  );

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
      scenario: trackedScenario,
      minimumApplied: engine.minimumApplied,
    });
  }, [isSummary, engine.totalRub, engine.roomsCount, trackedScenario, engine.minimumApplied]);

  const progress = useMemo(() => {
    const value = calcProgress(screen, { scenario: viewEngine.solutionScenario, enabledParams });
    const caption = isEditing ? "Редактирование параметра"
      : isSummary ? (hasPending ? "Проверьте параметры помещений" : "Параметры потолка заполнены")
      : screen.t === "roomEdit" ? "Карточка помещения"
      : screen.t === "roomPicker" ? (engine.rooms.length ? "Добавление помещения" : "Добавьте первое помещение")
      : `Потолок · вопрос ${value.done} из ${value.total}`;
    return { ...value, caption };
  }, [screen, viewEngine.solutionScenario, enabledParams, isEditing, isSummary, hasPending, engine.rooms.length]);

  /**
   * T-030: подпись кнопки и видимость «назад» считают селекторы — чистые
   * функции экрана, без обращения к DOM и без ветвлений в разметке.
   */
  const footerSpec = useMemo(() => isEditing ? { label: "Сохранить изменения", disabled: false }
    : isSummary ? { label: hasPending ? "Продолжить заполнение →" : summaryPrimaryLabel ?? routing.primary.label, disabled: !engine.rooms.length }
    : selectFooterAction(screen, { scope: engine.calculationScope }),
    [isEditing, isSummary, hasPending, summaryPrimaryLabel, routing.primary.label, engine.rooms.length, screen, engine.calculationScope]);
  const backVisible = isEditing || (screen.t !== "roomEdit" && selectBackVisible(screen, { historyLength: history.length, scenarioPreselected: false }));

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
  const nextRef = useRef({ screen, goNext, setHistory, runSummaryPrimary });
  nextRef.current = { screen, goNext, setHistory, runSummaryPrimary };

  const backRef = useRef(goBack);
  backRef.current = edit ? workspace.cancel : goBack;
  const runGoBack = useCallback(() => backRef.current(), []);

  const runFooterAction = useCallback(() => {
    const current = nextRef.current;
    if (current.screen.t === "summary") { current.runSummaryPrimary(); return; }
    if (current.screen.t === "roomEdit") {
      current.setHistory([{ t: "summary" }]);
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
      editing: isEditing,
      discardEdit: workspace.cancel,
      footerAction,
      backAction: { visible: backVisible, onClick: runGoBack },
    });
  }, [setStep0, progress, isSummary, footerAction, backVisible, runGoBack, isEditing, workspace.cancel]);

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

  const restoreDraft = (draft: CalcDraft, cart: LightingSnapshot | null) => {
    engine.restoreFromDraft({
      scenario: draft.scenario,
      scope: draft.scope,
      rooms: draft.rooms as unknown as Parameters<typeof engine.restoreFromDraft>[0]["rooms"],
    });
    workspace.restore(draft.rooms, draft.confirmed);
    setLightingDraft(cart);
    if (hasLightingItems(cart)) setHasInteracted(true);
    setHistory([{ t: "summary" }]);
    // PT-007: a restored draft wins over the page preset only after explicit choice.
    presetAppliedRef.current = true;
    setPendingDraft(null);
    setDraftSettled(true);
  };
  const startNewDraft = () => {
    // An unreadable/changed draft is erased only after this explicit choice.
    clearCalcDraft();
    setPendingDraft(null);
    setDraftSettled(true);
  };

  if (pendingDraft && !draftSettled) {
    const offer = pendingDraft.kind === "offer" ? pendingDraft : null;
    return (
      <div data-quiz-v2 data-active-screen="draft" className="step0-quiz-v2 max-w-3xl mx-auto">
        {offer && reviewingDraft && hasLightingItems(offer.draft.cart) ? (
          <DraftCatalogReview
            cart={offer.draft.cart!}
            onAccepted={(reviewed) => restoreDraft(offer.draft, reviewed)}
            onBack={() => setReviewingDraft(false)}
            onStartNew={startNewDraft}
          />
        ) : (
          <DraftRestoreChoice
            variant={pendingDraft.kind}
            origin={presetOrigin ?? "default"}
            summary={offer ? describeCalcDraft(offer.draft) : undefined}
            lightingItemsCount={offer ? (offer.draft.cart?.items?.length ?? 0) : 0}
            onContinue={offer ? () => {
              if (hasLightingItems(offer.draft.cart)) setReviewingDraft(true);
              else restoreDraft(offer.draft, offer.draft.cart);
            } : undefined}
            onStartNew={startNewDraft}
          />
        )}
      </div>
    );
  }

  return (
    <div data-quiz-v2 data-active-screen={screen.t} className="step0-quiz-v2 max-w-3xl mx-auto">
      {(screen.t === "param" || screen.t === "roomEdit") && <RoomContext rooms={engine.rooms} roomId={screen.roomId}
        status={isEditing ? "Изменения не сохранены" : currentRoom ? workspace.roomStatus(currentRoom) : undefined} editing={isEditing}
        onSelect={workspace.openRoom} onOverview={screen.t === "param" ? () => setHistory([{ t: "summary" }]) : undefined} />}
      {edit && <p className="pk-room-edit-note" role="status">Изменения и сумма обновятся после сохранения. «Отмена правки» оставит прежний расчёт.</p>}
      {screen.t === "roomPicker" && engine.rooms.length === 0 && hasLightingInCart && <div className="pk-room-edit-note">
        <p>Помещений пока нет. Оборудование сохранено в текущей вкладке.</p>
        <button type="button" className="min-h-11 underline" onClick={() => { resetCeilingAfterLastRoom(); goToStep(2); }}>Продолжить только со светом</button>
      </div>}
      {screen.t === "roomPicker" && (
        <RoomPickerScreen
          rooms={engine.rooms}
          mode={screen.mode}
          onAdd={label => { const id = engine.addRoom(label); pushScreen({ t: "param", roomId: id, param: "area" }); }}
          onSelect={workspace.openRoom}
        />
      )}
      {screen.t === "param" && (
        <ParamScreen
          key={`${screen.roomId}:${screen.param}:${edit ? "edit" : "flow"}`}
          roomId={screen.roomId}
          param={screen.param}
          engine={viewEngine}
          editing={isEditing}
          onConfirm={() => goNext(screen.param, screen.roomId)}
        />
      )}
      {screen.t === "roomEdit" && (
        <RoomEditScreen
          roomId={screen.roomId}
          engine={engine}
          onEditParam={param => workspace.begin(screen.roomId, param)}
          onDelete={() => { void workspace.remove(screen.roomId); }}
        />
      )}
      {screen.t === "summary" && <SummaryScreen engine={engine} roomStatus={workspace.roomStatus}
        pending={Boolean(workspace.pending)} showPrimary={false}
        onEditRoom={workspace.openRoom}
        onAddRoom={() => pushScreen({ t: "roomPicker", mode: "add" })}
        onPrimaryCta={runSummaryPrimary}
        onSecondaryCta={!workspace.pending && routing.secondary ? () => {
          onSecondaryCtaClick?.(); goToStep(routing.secondary!.destination);
        } : undefined}
        primaryLabel={summaryPrimaryLabel ?? routing.primary.label}
        secondaryLabel={summarySecondaryLabel ?? routing.secondary?.label} />}
    </div>
  );
}
