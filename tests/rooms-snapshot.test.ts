import { describe, expect, it } from "vitest";

import {
  calcRoomsTotalSafe,
  calcTotalArea,
  mergeRoomsIntoSnapshot,
} from "../lib/calculator/rooms-snapshot";
import type { V2RoomConfig } from "../lib/calculator/room-snapshot";
import type { CalculatorLeadSnapshot } from "../lib/calculator/snapshot-types";
import { pricing } from "../content/pricing";

/**
 * N-050 · Сборка снапшота по комнатам раньше жила внутри useEffect и
 * проверялась только прогоном воронки в браузере. Тесты фиксируют свойства,
 * от которых зависят сумма в заявке и отсутствие циклов рендера.
 */

function room(patch: Partial<V2RoomConfig> = {}): V2RoomConfig {
  return {
    id: "room-1",
    label: "Комната",
    area: 18,
    ceilingType: "standard",
    shadowEnabled: false,
    shadowLength: 17,
    floatingEnabled: false,
    floatingLength: 17,
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
    ...patch,
  };
}

const base = { solutionScenario: "standard" as const, calculationScope: "room" as const };

describe("N-050 · площадь и итог по комнатам", () => {
  it("складывает площади всех комнат", () => {
    expect(calcTotalArea([room({ area: 18 }), room({ id: "r2", area: 12 })])).toBe(30);
  });

  it("пустой список — нулевой итог, а не падение", () => {
    expect(calcRoomsTotalSafe([])).toEqual({ raw: 0, applied: 0, minimumApplied: false });
  });

  it("18 м² простого потолка — 18 000 ₽ (18 × ставка полотна)", () => {
    // Без карниза и монтажа: именно база, а не 25 500 ₽ из сквозного сценария.
    expect(calcRoomsTotalSafe([room()]).applied).toBe(18 * pricing.ceiling.standard);
  });

  it("маленькая площадь поднимается до минимального заказа", () => {
    const total = calcRoomsTotalSafe([room({ area: 2 })]);
    expect(total.minimumApplied).toBe(true);
    expect(total.applied).toBeGreaterThan(total.raw);
  });
});

describe("N-050 · слияние комнат в снапшот", () => {
  it("пустой список комнат не затирает снапшот со светом", () => {
    const prev = { area: 0, total: 852 } as unknown as CalculatorLeadSnapshot;
    expect(mergeRoomsIntoSnapshot(prev, { rooms: [], ...base })).toBe(prev);
  });

  it("собирает агрегаты по одной комнате", () => {
    const next = mergeRoomsIntoSnapshot(null, { rooms: [room()], ...base });
    expect(next?.area).toBe(18);
    expect(next?.total).toBe(18 * pricing.ceiling.standard);
    expect(next?.roomBreakdown).toHaveLength(1);
  });

  it("площадь и разбивка учитывают все комнаты, а не только первую", () => {
    const next = mergeRoomsIntoSnapshot(null, {
      rooms: [room(), room({ id: "r2", label: "Кухня", area: 12 })],
      ...base,
    });
    expect(next?.area).toBe(30);
    expect(next?.roomBreakdown).toHaveLength(2);
  });

  it("T-043: люстры из второй комнаты попадают в снапшот", () => {
    const next = mergeRoomsIntoSnapshot(null, {
      rooms: [
        room(),
        room({ id: "r2", chandeliersEnabled: true, chandeliersCount: 3 }),
      ],
      ...base,
    });
    expect(next?.derivedInputs.chandeliersEnabled).toBe(true);
    expect(next?.derivedInputs.chandeliersQty).toBe(3);
  });

  it("T-043: подсветка карниза суммируется по всем комнатам", () => {
    const next = mergeRoomsIntoSnapshot(null, {
      rooms: [
        room({ corniceLightingEnabled: true, corniceLightingLength: 4 }),
        room({ id: "r2", corniceLightingEnabled: true, corniceLightingLength: 3 }),
      ],
      ...base,
    });
    expect(next?.derivedInputs.corniceLightingEnabled).toBe(true);
    expect(next?.derivedInputs.corniceLightingMeters).toBe(7);
  });

  it("повторный вызов с теми же данными возвращает тот же объект", () => {
    const rooms = [room()];
    const first = mergeRoomsIntoSnapshot(null, { rooms, ...base });
    const second = mergeRoomsIntoSnapshot(first, { rooms, ...base });
    // Идентичность объекта — сигнал React'у «состояние не менялось».
    expect(second).toBe(first);
  });

  it("изменение площади даёт новый объект", () => {
    const first = mergeRoomsIntoSnapshot(null, { rooms: [room()], ...base });
    const second = mergeRoomsIntoSnapshot(first, {
      rooms: [room({ area: 25 })],
      ...base,
    });
    expect(second).not.toBe(first);
    expect(second?.area).toBe(25);
  });

  it("T-008: устаревшее grandTotal не переносится из прежнего снапшота", () => {
    const prev = { area: 5, grandTotal: 99999 } as unknown as CalculatorLeadSnapshot;
    const next = mergeRoomsIntoSnapshot(prev, { rooms: [room()], ...base });
    expect(next?.grandTotal).toBeUndefined();
  });

  it("сохраняет поля прежнего снапшота, которых нет в расчёте комнат", () => {
    const prev = {
      area: 0,
      lighting: { mode: "kit", items: [{ id: "x" }] },
    } as unknown as CalculatorLeadSnapshot;
    const next = mergeRoomsIntoSnapshot(prev, { rooms: [room()], ...base });
    expect(next?.lighting).toEqual({ mode: "kit", items: [{ id: "x" }] });
    expect(next?.total).toBe(18 * pricing.ceiling.standard);
  });

  it("scope по умолчанию — комната", () => {
    const next = mergeRoomsIntoSnapshot(null, {
      rooms: [room()],
      solutionScenario: "standard",
      calculationScope: null,
    });
    expect(next?.calculationScope).toBe("room");
  });

  it("объектный расчёт помечается scope=object", () => {
    const next = mergeRoomsIntoSnapshot(null, {
      rooms: [room({ area: pricing.defaults.objectArea })],
      solutionScenario: "standard",
      calculationScope: "object",
    });
    expect(next?.calculationScope).toBe("object");
  });
});
