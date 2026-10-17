/**
 * PT-024 · Какое значение уходит в аналитику при подтверждении параметра.
 *
 * Раньше квиз отправлял `String(room.area)` для любого экрана: метраж трека,
 * длина карниза и число люстр превращались в площадь. Отдельно ломался режим
 * «весь объект»: `screen.roomId` там равен `"object"`, а сама комната
 * называется `object-1`, поэтому поиск по id давал `undefined` и в событие
 * уходила пустая строка.
 *
 * Здесь две вещи:
 *  - таблица «параметр → поле RoomConfig» вместо `area` по умолчанию;
 *  - поиск комнаты, который понимает и обычную комнату, и виртуальный объект.
 *
 * Для выключенной функции отдаём `false`, а не `0`: ноль метров и «решение
 * не включено» — разные сигналы, и в отчёте их нельзя смешивать.
 */
import type { ParamId } from "@/lib/step0-fsm";
import type { RoomConfig } from "@/lib/calculator/use-calculator-engine";

export type ParamValue = string | number | boolean;

/** Значение параметра комнаты для события `quiz_param_confirm`. */
export function paramConfirmValue(room: RoomConfig, param: ParamId): ParamValue {
  switch (param) {
    case "area":
      return room.area;
    case "ceiling":
      return room.ceilingType;
    case "shadowProfile":
      return room.shadowEnabled ? room.shadowLength : false;
    case "floatingProfile":
      return room.floatingEnabled ? room.floatingLength : false;
    case "lightLines":
      return room.lightLinesEnabled ? room.lightLinesLength : false;
    case "cornice":
      return room.corniceType === "none" ? false : room.corniceLength;
    case "track":
      return room.trackType === "none" ? false : room.trackLength;
    case "chandeliers":
      return room.chandeliersEnabled ? room.chandeliersCount : false;
    case "lights":
      return room.lightsEnabled ? room.lightsCount : false;
  }
}

/**
 * Комната, к которой относится экран квиза.
 *
 * Порядок: точный id → виртуальная комната объекта (`"object"` → `object-1`,
 * либо единственная комната сессии) → активная комната движка. Тот же порядок
 * использует `ParamScreen`, поэтому аналитика и интерфейс говорят об одной
 * комнате.
 */
export function resolveQuizRoom(
  rooms: readonly RoomConfig[],
  screenRoomId: string,
  activeRoomId?: string | null
): RoomConfig | null {
  const direct = rooms.find((room) => room.id === screenRoomId);
  if (direct) return direct;

  if (screenRoomId === "object") {
    const object = rooms.find((room) => room.id === "object-1");
    if (object) return object;
    // Режим «весь объект» — всегда ровно одна комната.
    if (rooms.length === 1) return rooms[0] ?? null;
  }

  if (activeRoomId) {
    const active = rooms.find((room) => room.id === activeRoomId);
    if (active) return active;
  }

  return null;
}

/** Индекс комнаты для `room_index`; неизвестная комната — первая, как и раньше. */
export function quizRoomIndex(rooms: readonly RoomConfig[], room: RoomConfig | null): number {
  if (!room) return 0;
  const index = rooms.findIndex((candidate) => candidate.id === room.id);
  return index >= 0 ? index : 0;
}
