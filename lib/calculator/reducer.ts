/**
 * T-030 · Редьюсер квиза Шага 0.
 *
 * Первый этап переноса состояния из россыпи `useState` в движке
 * (`use-ceiling-calculator-engine.ts`) и в `PriceCalculatorQuizV2` в один
 * предсказуемый переход. Здесь живёт только состояние — все производные
 * величины считают `selectors.ts`, а переходы экранов — `fsm.ts`.
 *
 * Редьюсер чистый и не зависит от React: его целиком покрывают unit-тесты.
 */
import type { SolutionScenario } from "@/lib/calculator-modal-types";
import type { RoomConfig } from "@/lib/calculator-v2/use-ceiling-calculator-engine";
import type { ParamId, Step0Screen } from "./fsm";

export type CalculationScope = "room" | "object";

/** Параметры, которые пользователь правил руками: их не перетирает префилл. */
export type TouchedFlags = {
  trackType: boolean;
  trackLength: boolean;
  lights: boolean;
  chandeliers: boolean;
};

export const NO_TOUCHED: TouchedFlags = {
  trackType: false,
  trackLength: false,
  lights: false,
  chandeliers: false,
};

export type CalculatorState = {
  sessionId: number;
  scenario: SolutionScenario;
  scope: CalculationScope | null;
  rooms: RoomConfig[];
  activeRoomId: string | null;
  /** Счётчик для генерации id комнат; в состоянии, чтобы редьюсер был чистым. */
  roomSeq: number;
  screenHistory: Step0Screen[];
  /** roomId → параметр → подтверждён пользователем. */
  confirmed: Record<string, Partial<Record<ParamId, boolean>>>;
  /** Параметры, предзаполненные пресетом: показываем значение, но не считаем ответом. */
  prefilled: Record<string, boolean>;
  presetNote: string | null;
  touched: TouchedFlags;
};

export function createInitialState(
  scenario: SolutionScenario = "standard",
  sessionId = 1
): CalculatorState {
  return {
    sessionId,
    scenario,
    scope: null,
    rooms: [],
    activeRoomId: null,
    roomSeq: 1,
    // Непустой сценарий приходит со страницы услуги — экран выбора пропускаем
    // и сразу спрашиваем помещение (режим расчёта живёт на экране площади).
    screenHistory: [
      scenario !== "standard" ? { t: "roomPicker", mode: "first" } : { t: "scenario" },
    ],
    confirmed: {},
    prefilled: {},
    presetNote: null,
    touched: NO_TOUCHED,
  };
}

export type CalculatorAction =
  | { type: "session/reset"; scenario?: SolutionScenario }
  | { type: "scenario/choose"; scenario: SolutionScenario }
  | { type: "scope/choose"; scope: CalculationScope; room?: RoomConfig }
  | { type: "room/add"; room: RoomConfig }
  | { type: "room/update"; roomId: string; patch: Partial<RoomConfig> }
  | { type: "room/remove"; roomId: string }
  | { type: "room/switch"; roomId: string }
  | { type: "rooms/replace"; rooms: RoomConfig[]; scenario: SolutionScenario; scope: CalculationScope }
  | { type: "preset/apply"; rooms: RoomConfig[]; scenario: SolutionScenario; scope: CalculationScope; prefilled: string[]; note: string | null }
  | { type: "param/confirm"; roomId: string; param: ParamId; value: boolean }
  | { type: "screen/push"; screen: Step0Screen }
  | { type: "screen/pop" }
  | { type: "screen/replace"; screen: Step0Screen }
  | { type: "screen/set"; history: Step0Screen[] }
  | { type: "touched/mark"; key: keyof TouchedFlags }
  | { type: "touched/reset" };

/** Какие touched-флаги затрагивает патч комнаты. */
function touchedFromPatch(patch: Partial<RoomConfig>, current: TouchedFlags): TouchedFlags {
  const next = { ...current };
  let changed = false;

  if (patch.trackType !== undefined && !current.trackType) {
    next.trackType = true;
    changed = true;
  }
  if (patch.trackLength !== undefined && !current.trackLength) {
    next.trackLength = true;
    changed = true;
  }
  if ((patch.lightsEnabled !== undefined || patch.lightsCount !== undefined) && !current.lights) {
    next.lights = true;
    changed = true;
  }
  if (
    (patch.chandeliersEnabled !== undefined || patch.chandeliersCount !== undefined) &&
    !current.chandeliers
  ) {
    next.chandeliers = true;
    changed = true;
  }

  return changed ? next : current;
}

export function calculatorReducer(
  state: CalculatorState,
  action: CalculatorAction
): CalculatorState {
  switch (action.type) {
    case "session/reset":
      return createInitialState(action.scenario ?? state.scenario, state.sessionId + 1);

    case "scenario/choose":
      if (action.scenario === state.scenario) return state;
      return { ...state, scenario: action.scenario };

    case "scope/choose": {
      // Режим «весь объект» — это одна виртуальная комната, создаём сразу.
      if (action.scope === "object" && state.rooms.length === 0 && action.room) {
        return {
          ...state,
          scope: action.scope,
          rooms: [action.room],
          activeRoomId: action.room.id,
        };
      }
      return { ...state, scope: action.scope };
    }

    case "room/add":
      return {
        ...state,
        rooms: [...state.rooms, action.room],
        activeRoomId: action.room.id,
        roomSeq: state.roomSeq + 1,
      };

    case "room/update": {
      const index = state.rooms.findIndex((room) => room.id === action.roomId);
      if (index < 0) return state;

      const rooms = [...state.rooms];
      rooms[index] = { ...rooms[index], ...action.patch };

      return { ...state, rooms, touched: touchedFromPatch(action.patch, state.touched) };
    }

    case "room/remove": {
      const rooms = state.rooms.filter((room) => room.id !== action.roomId);
      if (rooms.length === state.rooms.length) return state;

      // Подтверждения удалённой комнаты больше не нужны.
      const confirmed = { ...state.confirmed };
      delete confirmed[action.roomId];

      return {
        ...state,
        rooms,
        confirmed,
        activeRoomId:
          state.activeRoomId === action.roomId ? (rooms[0]?.id ?? null) : state.activeRoomId,
      };
    }

    case "room/switch":
      if (!state.rooms.some((room) => room.id === action.roomId)) return state;
      return { ...state, activeRoomId: action.roomId };

    case "rooms/replace":
      if (action.rooms.length === 0) return state;
      return {
        ...state,
        scenario: action.scenario,
        scope: action.scope,
        rooms: action.rooms,
        activeRoomId: action.rooms[0]?.id ?? null,
        roomSeq: action.rooms.length + 1,
        prefilled: {},
        presetNote: null,
      };

    case "preset/apply":
      return {
        ...state,
        scenario: action.scenario,
        scope: action.scope,
        rooms: action.rooms,
        activeRoomId: action.rooms[0]?.id ?? null,
        roomSeq: action.rooms.length + 1,
        prefilled: action.prefilled.reduce<Record<string, boolean>>((acc, param) => {
          acc[param] = true;
          return acc;
        }, {}),
        presetNote: action.note,
        touched: NO_TOUCHED,
        // Пресет уже ответил за сценарий и комнату — начинаем сразу с площади.
        screenHistory: [
          { t: "param", roomId: action.rooms[0]?.id ?? "object", param: "area" },
        ],
      };

    case "param/confirm":
      return {
        ...state,
        confirmed: {
          ...state.confirmed,
          [action.roomId]: {
            ...(state.confirmed[action.roomId] ?? {}),
            [action.param]: action.value,
          },
        },
      };

    case "screen/push":
      return { ...state, screenHistory: [...state.screenHistory, action.screen] };

    case "screen/pop":
      // Первый экран не выкидываем: истории всегда есть куда вернуться.
      return state.screenHistory.length > 1
        ? { ...state, screenHistory: state.screenHistory.slice(0, -1) }
        : state;

    case "screen/replace":
      return {
        ...state,
        screenHistory: [...state.screenHistory.slice(0, -1), action.screen],
      };

    case "screen/set":
      return action.history.length > 0 ? { ...state, screenHistory: action.history } : state;

    case "touched/mark":
      if (state.touched[action.key]) return state;
      return { ...state, touched: { ...state.touched, [action.key]: true } };

    case "touched/reset":
      return { ...state, touched: NO_TOUCHED };

    default:
      return state;
  }
}

/** Текущий экран квиза. */
export function selectScreen(state: CalculatorState): Step0Screen {
  return state.screenHistory[state.screenHistory.length - 1] ?? { t: "scenario" };
}

/** Подтверждён ли параметр в конкретной комнате. */
export function isParamConfirmed(
  state: CalculatorState,
  roomId: string,
  param: ParamId
): boolean {
  return Boolean(state.confirmed[roomId]?.[param]);
}

export function selectActiveRoom(state: CalculatorState): RoomConfig | null {
  return state.rooms.find((room) => room.id === state.activeRoomId) ?? null;
}
