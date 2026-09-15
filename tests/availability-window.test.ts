import { describe, expect, it } from "vitest";

import { availability, getAvailabilityLabel } from "../content/availability";

/**
 * N-061 · PT-016 · Запасной календарь замеров не должен врать (F-21, B-F108).
 *
 * До PT-016 этот файл был единственным источником дат, и здесь стояла жёсткая
 * проверка «срок годности не дальше трёх недель вперёд» — дубль порога из
 * `scripts/check-availability.mjs`, который ронял сборку.
 *
 * Теперь даты живут в `availability_slots` и правятся через
 * `/admin/availability` без деплоя, а файл стал запасным источником (показывается,
 * только пока БД не заполнена или недоступна). Решение владельца по PT-016,
 * вариант «а»: страж предупреждает, но сборку не роняет — протухший запасной
 * источник не врёт, а молчит. Проверку горизонта отсюда убрали по той же
 * причине: она блокировала бы CI и деплой из-за файла, который больше не
 * основной. Что осталось обязательным и проверяется ниже: дата разбирается
 * (иначе страж слеп) и протухший календарь молчит, а не показывает старые дни.
 */
const MS_IN_DAY = 24 * 60 * 60 * 1000;

describe("availability", () => {
  it("срок годности — настоящая ISO-дата, иначе страж не сможет её разобрать", () => {
    expect(availability.validUntil).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const validUntil = new Date(`${availability.validUntil}T23:59:59`);
    expect(Number.isNaN(validUntil.getTime())).toBe(false);
  });

  it("протухший календарь молчит, а не показывает старые дни", () => {
    const future = new Date(`${availability.validUntil}T23:59:59`);
    const afterExpiry = new Date(future.getTime() + MS_IN_DAY);

    expect(getAvailabilityLabel(afterExpiry)).toBeNull();
  });

  it("пока срок не вышел — строка со свободными днями есть", () => {
    const beforeExpiry = new Date(new Date(`${availability.validUntil}T00:00:00`).getTime() - MS_IN_DAY);
    const label = getAvailabilityLabel(beforeExpiry);

    expect(label).not.toBeNull();
    for (const day of availability.freeSlotDays) {
      expect(label).toContain(day);
    }
  });

  it("без свободных дней строки нет — пустое обещание хуже молчания", () => {
    expect(availability.freeSlotDays.length).toBeGreaterThan(0);
  });
});
