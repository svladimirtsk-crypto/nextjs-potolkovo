/**
 * T-030 · Селекторы калькулятора — единственный источник производных величин.
 *
 * Правило из ТЗ (2.1): `totals`, `requirements`, `derivedInputs`, `grandTotal`
 * не являются полями состояния. Их считают чистые функции этого модуля, а UI
 * (PriceStrip, сводка Шага 0, футер Шага 1, Шаг 2, стики-бар и письмо лида)
 * читает результат отсюда — так все места показывают одну и ту же сумму.
 */
import { pricing } from "@/content/pricing";
import { calcRoomsTotal, type V2RoomConfig } from "@/lib/calculator/room-snapshot";
import { getParamConfirmLabel, type Step0Screen } from "./fsm";
import { calcRecommendedTrackSpots } from "@/lib/lighting-formulas";
import type { CalculatorRoomBreakdown } from "@/lib/calculator/snapshot-types";

/** Комната в терминах стора; структурно совпадает с V2RoomConfig. */
export type SelectorRoom = V2RoomConfig;

export type LightingSelection = {
  regularTotalRub: number;
  effectiveTotalRub: number;
  itemsCount: number;
  /** Сколько корпусов светильников выбрано — нужно для досчёта монтажа. */
  selectedPointsQty: number;
  /** Сколько метров профиля выбрано в корзине. */
  selectedTrackMeters: number;
  discountMode: "none" | "lighting-only" | "with-ceiling";
};

const EMPTY_LIGHTING: LightingSelection = {
  regularTotalRub: 0,
  effectiveTotalRub: 0,
  itemsCount: 0,
  selectedPointsQty: 0,
  selectedTrackMeters: 0,
  discountMode: "none",
};

/* ------------------------------------------------------------------ *
 * Требования к свету, вытекающие из потолка (Шаг 0)
 * ------------------------------------------------------------------ */

export type RoomRequirement = {
  roomId: string;
  label: string;
  trackMeters: number;
  points: number;
  trackType: "none" | "built-in" | "surface";
};

export type Requirements = {
  /** Суммарная длина трека по всем комнатам, м.п. */
  trackMeters: number;
  /** Ориентир по числу трековых светильников — диапазон, а не точное число. */
  trackFixtures: { min: number; max: number };
  /** Сколько точечных светильников заложено в монтаж. */
  points: number;
  /** Сколько ламп понадобится минимум (по одной на корпус). */
  lamps: number;
  /** Тип монтажа трека, агрегированный по объекту. */
  trackMountType: "none" | "built-in" | "surface";
  /** Разбивка по комнатам — для подсказок в мастере света. */
  rooms: RoomRequirement[];
};

export function selectRequirements(rooms: readonly SelectorRoom[]): Requirements {
  const perRoom: RoomRequirement[] = rooms.map((room) => ({
    roomId: room.id,
    label: room.label,
    trackMeters: room.trackType !== "none" ? Math.max(0, room.trackLength) : 0,
    points: room.lightsEnabled ? Math.max(0, room.lightsCount) : 0,
    trackType: room.trackType,
  }));

  const trackMeters = perRoom.reduce((sum, room) => sum + room.trackMeters, 0);
  const points = perRoom.reduce((sum, room) => sum + room.points, 0);

  // Тип монтажа: встроенный «сильнее» накладного — он диктует подготовку потолка.
  const trackMountType = perRoom.some((room) => room.trackType === "built-in")
    ? "built-in"
    : perRoom.some((room) => room.trackType === "surface")
      ? "surface"
      : "none";

  const recommended = trackMeters > 0 ? calcRecommendedTrackSpots(trackMeters) : 0;

  return {
    trackMeters,
    // Ориентир-диапазон: плотность света — вопрос вкуса, точное число не навязываем.
    trackFixtures:
      recommended > 0
        ? { min: Math.max(1, Math.floor(recommended * 0.75)), max: Math.ceil(recommended * 1.25) }
        : { min: 0, max: 0 },
    points,
    lamps: points,
    trackMountType,
    rooms: perRoom,
  };
}

/* ------------------------------------------------------------------ *
 * Итоговые суммы
 * ------------------------------------------------------------------ */

export type Totals = {
  /** Потолок и работы до применения минимального заказа. */
  ceilingRaw: number;
  /** Потолок после минимального заказа — то, что показываем клиенту. */
  ceilingApplied: number;
  minimumApplied: boolean;
  /** Досчёт монтажа за позиции, которых нет в расчёте потолка. */
  extraInstallRub: number;
  extraInstallLines: string[];
  lightingRegular: number;
  lightingEffective: number;
  discountPct: number;
  /** Единственная «большая» сумма во всём приложении. */
  grand: number;
};

/**
 * Досчёт монтажа: если в корзине света корпусов или метров трека больше, чем
 * заложено в потолке, разницу нужно оплатить отдельно. Меньше — не вычитаем:
 * монтаж уже посчитан в потолке (S2-02, «уже в потолке»).
 */
export function selectExtraInstall(
  requirements: Requirements,
  lighting: LightingSelection
): { rub: number; lines: string[] } {
  const lines: string[] = [];

  const extraPoints = Math.max(0, lighting.selectedPointsQty - requirements.points);
  const extraMeters = Math.max(0, lighting.selectedTrackMeters - requirements.trackMeters);

  const pointsRub = extraPoints * pricing.spotInstall;

  // Досчитываем по той же ставке, что и в потолке: встроенный дороже накладного.
  const trackRate =
    requirements.trackMountType === "surface"
      ? pricing.track.surfacePerM
      : pricing.track.builtInPerM;
  const metersRub = Math.round(extraMeters * trackRate);

  if (extraPoints > 0) {
    lines.push(`Монтаж ещё ${extraPoints} точек — ${pointsRub.toLocaleString("ru-RU")} ₽`);
  }
  if (extraMeters > 0) {
    lines.push(
      `Монтаж ещё ${extraMeters.toLocaleString("ru-RU")} м трека — ${metersRub.toLocaleString("ru-RU")} ₽`
    );
  }

  return { rub: pointsRub + metersRub, lines };
}

export function selectTotals(
  rooms: readonly SelectorRoom[],
  lighting: LightingSelection = EMPTY_LIGHTING
): Totals {
  const roomsTotal =
    rooms.length > 0
      ? calcRoomsTotal(rooms as V2RoomConfig[])
      : { raw: 0, applied: 0, minimumApplied: false };

  const requirements = selectRequirements(rooms);
  const extra = selectExtraInstall(requirements, lighting);

  const discountPct =
    lighting.discountMode === "with-ceiling"
      ? pricing.lightingDiscount.withCeilingPct
      : lighting.discountMode === "lighting-only"
        ? pricing.lightingDiscount.lightingOnlyPct
        : 0;

  return {
    ceilingRaw: roomsTotal.raw,
    ceilingApplied: roomsTotal.applied,
    minimumApplied: roomsTotal.minimumApplied,
    extraInstallRub: extra.rub,
    extraInstallLines: extra.lines,
    lightingRegular: lighting.regularTotalRub,
    lightingEffective: lighting.effectiveTotalRub,
    discountPct,
    grand: roomsTotal.applied + extra.rub + lighting.effectiveTotalRub,
  };
}

/* ------------------------------------------------------------------ *
 * Готовность и подписи
 * ------------------------------------------------------------------ */

/** Шаг 2 имеет смысл показывать, когда есть хоть что-то посчитанное. */
export function selectSummaryReady(rooms: readonly SelectorRoom[], lighting: LightingSelection) {
  return rooms.length > 0 || lighting.itemsCount > 0;
}

/** Интент заказа по составу расчёта — им же определяется копирайт Шага 2. */
export function selectOrderIntent(
  rooms: readonly SelectorRoom[],
  lighting: LightingSelection
): "ceiling_only" | "lighting_with_ceiling" | "lighting_only" | "advanced" {
  const hasCeiling = rooms.length > 0;
  const hasLighting = lighting.itemsCount > 0;

  if (hasCeiling && hasLighting) return "lighting_with_ceiling";
  if (hasLighting) return "lighting_only";
  return "ceiling_only";
}

/* ------------------------------------------------------------------ *
 * Футер и прогресс Шага 0
 * ------------------------------------------------------------------ */

/** Описание кнопки футера без обработчика: onClick навешивает UI. */
export type FooterActionSpec = {
  label: string;
  disabled: boolean;
};

/**
 * T-030: подпись и доступность основной кнопки Шага 0 — чистая функция экрана.
 * Раньше это жило в useEffect внутри квиза и «выталкивалось» в контекст сеттером.
 */
export function selectFooterAction(
  screen: Step0Screen,
  ctx: { scope: "room" | "object" | null }
): FooterActionSpec | null {
  switch (screen.t) {
    case "summary":
      // На сводке кнопки задаёт сам экран (CTA «Перейти к свету» / «К заявке»).
      return null;
    case "scenario":
      return { label: "Выберите вариант выше", disabled: false };
    case "roomPicker":
      return { label: "Выберите помещение выше", disabled: true };
    case "param":
      return { label: getParamConfirmLabel(screen.param), disabled: false };
    case "roomEdit":
      return { label: "Готово →", disabled: false };
  }
}

/**
 * Видимость кнопки «Назад». Скрыта на экране сценария, а также на первом
 * экране после автопропуска сценария (страница услуги уже выбрала его —
 * возвращаться некуда, вместо «назад» показывается бейдж «изменить»).
 */
export function selectBackVisible(
  screen: Step0Screen,
  ctx: { historyLength: number; scenarioPreselected: boolean }
): boolean {
  if (screen.t === "scenario") return false;
  if (ctx.historyLength <= 1 && ctx.scenarioPreselected) return false;
  return true;
}

/* ------------------------------------------------------------------ *
 * Требования из снапшота (переходный слой)
 * ------------------------------------------------------------------ */

/**
 * T-030: пока Шаг 1 и футер живут на bridge-снапшоте, требования считаем из
 * `roomBreakdown` — той же разбивки по комнатам, что уходит в письмо. Так у
 * мастера света, футерного прогресса и Шага 2 один источник, и никто не парсит
 * фид и `derivedInputs` самостоятельно.
 */
export function selectRequirementsFromBreakdown(
  rooms: readonly CalculatorRoomBreakdown[] | undefined
): Requirements {
  const perRoom: RoomRequirement[] = (rooms ?? []).map((room) => {
    const trackLabel = String(room.trackLabel ?? "").toLowerCase();
    const trackType: RoomRequirement["trackType"] = !room.trackLabel
      ? "none"
      : trackLabel.includes("накладн")
        ? "surface"
        : "built-in";

    return {
      roomId: String(room.id ?? ""),
      label: String(room.label ?? ""),
      trackMeters: trackType === "none" ? 0 : Math.max(0, Number(room.trackLength) || 0),
      points: Math.max(0, Number(room.lightsCount) || 0),
      trackType,
    };
  });

  const trackMeters = perRoom.reduce((sum, room) => sum + room.trackMeters, 0);
  const points = perRoom.reduce((sum, room) => sum + room.points, 0);
  const recommended = trackMeters > 0 ? calcRecommendedTrackSpots(trackMeters) : 0;

  return {
    trackMeters,
    trackFixtures:
      recommended > 0
        ? { min: Math.max(1, Math.floor(recommended * 0.75)), max: Math.ceil(recommended * 1.25) }
        : { min: 0, max: 0 },
    points,
    lamps: points,
    trackMountType: perRoom.some((room) => room.trackType === "built-in")
      ? "built-in"
      : perRoom.some((room) => room.trackType === "surface")
        ? "surface"
        : "none",
    rooms: perRoom,
  };
}
