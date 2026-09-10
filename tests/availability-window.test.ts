import { describe, expect, it } from "vitest";

import { availability, getAvailabilityLabel } from "../content/availability";

/**
 * N-061 · Календарь замеров не должен врать (F-21).
 *
 * Список свободных дней правится руками. Без срока годности он тихо
 * устаревает: до N-061 здесь стоял `validUntil: 2026-12-31`, то есть сайт
 * обещал одни и те же «чт, сб» больше ста дней подряд.
 */
const MS_IN_DAY = 24 * 60 * 60 * 1000;
const MAX_DAYS_AHEAD = 21;

describe("availability", () => {
  it("срок годности не дальше трёх недель вперёд", () => {
    /**
     * Тот же порог, что и в `scripts/check-availability.mjs`. Дублируется
     * намеренно: скрипт роняет сборку, а тест показывает причину до неё.
     */
    const validUntil = new Date(`${availability.validUntil}T23:59:59`);
    const daysAhead = (validUntil.getTime() - Date.now()) / MS_IN_DAY;

    expect(daysAhead).toBeLessThanOrEqual(MAX_DAYS_AHEAD);
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
