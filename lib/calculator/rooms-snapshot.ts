import { applyMinimumOrder, pricing } from "@/content/pricing";
import type { SolutionScenario } from "@/lib/calculator-modal-types";
import type { CalculatorLeadSnapshot } from "@/lib/calculator/snapshot-types";
import {
  buildRoomBreakdown,
  calcRoomSnapshotV2,
  calcRoomsTotal,
  type RoomsTotal,
  type V2RoomConfig,
} from "@/lib/calculator/room-snapshot";

/**
 * N-050 · Снапшот заявки по списку комнат Шага 0.
 *
 * Раньше это тело жило внутри `useEffect(() => setSnapshot(prev => …))` в
 * `lib/calculator-v2/use-ceiling-calculator-engine.ts` (ныне `use-calculator-engine.ts`) — запрещённая ТЗ v2 (п. 0.7)
 * синхронизация состояния эффектом. Логика была непроверяема: чтобы увидеть
 * агрегаты, требовалось смонтировать дерево и дождаться кадра.
 *
 * Здесь она описана как чистая функция `(prev, input) => next | prev`.
 * Возврат ровно того же объекта означает «изменений нет»: React пропускает
 * такой `setState`, лишнего рендера не происходит.
 *
 * Пустой список комнат — не повод затирать снапшот: в сценарии «сначала свет»
 * там уже лежит собранный комплект, и его нельзя потерять до создания комнаты.
 */

export type RoomsSnapshotInput = {
  rooms: V2RoomConfig[];
  solutionScenario: SolutionScenario;
  calculationScope: "room" | "object" | null;
};

/** Суммарная площадь всех комнат. */
export function calcTotalArea(rooms: Array<{ area: number }>): number {
  return rooms.reduce((sum, room) => sum + room.area, 0);
}

/**
 * Итог по комнатам с минимальным заказом. Если поштучный расчёт почему-то
 * недоступен, откатываемся на площадь по базовой ставке — лучше приблизительная
 * сумма, чем ноль в заявке.
 */
export function calcRoomsTotalSafe(rooms: V2RoomConfig[]): RoomsTotal {
  if (rooms.length === 0) return { raw: 0, applied: 0, minimumApplied: false };
  try {
    return calcRoomsTotal(rooms);
  } catch {
    return applyMinimumOrder(calcTotalArea(rooms) * pricing.ceiling.standard);
  }
}

/**
 * T-043: секции «Люстры» и «Подсветка карниза» включаются, если их выбрали
 * хотя бы в одной комнате, а не только в первой.
 */
function aggregateDerivedInputs(
  base: CalculatorLeadSnapshot["derivedInputs"],
  rooms: V2RoomConfig[]
): CalculatorLeadSnapshot["derivedInputs"] {
  return {
    ...base,
    chandeliersEnabled: rooms.some((r) => r.chandeliersEnabled),
    chandeliersQty: rooms.reduce(
      (sum, r) => sum + (r.chandeliersEnabled ? r.chandeliersCount : 0),
      0
    ),
    corniceLightingEnabled: rooms.some((r) => r.corniceLightingEnabled),
    corniceLightingMeters: rooms.reduce(
      (sum, r) => sum + (r.corniceLightingEnabled ? r.corniceLightingLength : 0),
      0
    ),
  };
}

export function mergeRoomsIntoSnapshot(
  prev: CalculatorLeadSnapshot | null,
  input: RoomsSnapshotInput
): CalculatorLeadSnapshot | null {
  const { rooms, solutionScenario, calculationScope } = input;

  // Комнат нет — снапшот оставляем как есть (в нём может лежать набор света).
  if (rooms.length === 0) return prev;

  let base: CalculatorLeadSnapshot;
  let aggregate: RoomsTotal;
  try {
    base = calcRoomSnapshotV2(rooms[0]).snapshot;
    aggregate = calcRoomsTotal(rooms);
  } catch {
    // Расчёт не удался — прежний снапшот достовернее полуготового.
    return prev;
  }

  const next: CalculatorLeadSnapshot = {
    ...(prev ?? base),
    ...base,
    derivedInputs: aggregateDerivedInputs(base.derivedInputs, rooms),
    area: calcTotalArea(rooms),
    total: aggregate.applied,
    totalRawRub: aggregate.raw,
    minimumOrderApplied: aggregate.minimumApplied,
    // T-008: устаревшее поле больше не используется.
    grandTotal: undefined,
    // T-022: полный состав каждой комнаты (все длины/количества/суммы).
    roomBreakdown: rooms.map((room) => buildRoomBreakdown(room)),
    solutionScenario,
    calculationScope: calculationScope ?? "room",
  };

  return sameSnapshot(prev, next) ? prev : next;
}

/**
 * Сравнение по значению: снапшот пересобирается на каждый рендер, но менять
 * состояние стоит только при реальном отличии, иначе получаем цикл
 * «эффект → setState → рендер → эффект».
 */
function sameSnapshot(
  prev: CalculatorLeadSnapshot | null,
  next: CalculatorLeadSnapshot
): boolean {
  if (!prev) return false;
  return JSON.stringify(prev) === JSON.stringify(next);
}
