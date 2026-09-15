/**
 * PT-016 · Чистые функции календаря дат замера.
 *
 * Здесь проверяется то, ради чего задача существует: просроченные даты не
 * попадают в строку, а когда будущих не осталось — строки нет вовсе (B-F108,
 * «не протухает молча»). Всё это — чистые функции, поэтому тесты не требуют ни
 * PostgreSQL, ни поднятого Next.
 *
 * Момент времени фиксирован: `2026-09-15T09:00:00Z` = 12:00 в Москве. Без
 * фиксации тест зависел бы от даты запуска и через месяц начал бы врать.
 */
import { describe, expect, it } from "vitest";

import { availability } from "@/content/availability";
import {
  MAX_DAYS_AHEAD,
  MAX_SLOTS_IN_LABEL,
  addDaysIso,
  buildAvailabilityLabel,
  daysBetweenIso,
  formatSlot,
  isIsoDate,
  moscowTodayIso,
  sortSlots,
  upcomingSlots,
  weekdayShort,
} from "@/lib/availability/format";
import {
  MAX_NOTE_LENGTH,
  MAX_SLOTS_PER_UPDATE,
  normalizeAvailabilityInput,
} from "@/lib/availability/input";
import type { AvailabilitySlot } from "@/lib/availability/types";

const NOW = new Date("2026-09-15T09:00:00Z");
const TODAY = "2026-09-15";

const slot = (date: string, note: string | null = null): AvailabilitySlot => ({ date, note });

describe("PT-016 · формат даты", () => {
  it("принимает только настоящие календарные даты", () => {
    expect(isIsoDate("2026-09-18")).toBe(true);
    expect(isIsoDate("2026-02-29")).toBe(false); // 2026 — не високосный
    expect(isIsoDate("2026-9-18")).toBe(false);
    expect(isIsoDate("18.09.2026")).toBe(false);
    expect(isIsoDate("")).toBe(false);
    expect(isIsoDate(undefined)).toBe(false);
    expect(isIsoDate(20260918)).toBe(false);
  });

  it("день недели и подпись — короткие, как в прежнем календаре «чт, сб»", () => {
    expect(weekdayShort("2026-09-18")).toBe("пт");
    expect(weekdayShort("2026-09-20")).toBe("вс");
    expect(formatSlot("2026-09-18")).toBe("пт 18.09");
    expect(formatSlot("2026-09-18", "утро")).toBe("пт 18.09 (утро)");
    expect(formatSlot("2026-09-18", "   ")).toBe("пт 18.09");
  });

  it("«сегодня» считается по Москве, а не по часам сервера в UTC", () => {
    // 21:30 UTC = 00:30 следующего дня в Москве. Сервер на Amvera живёт в UTC,
    // и без явной зоны вечерняя дата считалась бы сегодняшней до полуночи мск.
    expect(moscowTodayIso(new Date("2026-09-15T21:30:00Z"))).toBe("2026-09-16");
    expect(moscowTodayIso(new Date("2026-09-15T20:30:00Z"))).toBe("2026-09-15");
    expect(moscowTodayIso(NOW)).toBe(TODAY);
  });

  it("арифметика дат и горизонт", () => {
    expect(addDaysIso(TODAY, 0)).toBe(TODAY);
    expect(addDaysIso(TODAY, 16)).toBe("2026-10-01");
    expect(addDaysIso("2026-09-30", 1)).toBe("2026-10-01");
    expect(daysBetweenIso(TODAY, addDaysIso(TODAY, MAX_DAYS_AHEAD))).toBe(MAX_DAYS_AHEAD);
    expect(daysBetweenIso(TODAY, "2026-09-14")).toBe(-1);
  });

  it("сортировка по возрастанию: строки YYYY-MM-DD сравниваются лексически", () => {
    expect(sortSlots([slot("2026-10-01"), slot("2026-09-18"), slot("2026-09-20")]).map((s) => s.date)).toEqual([
      "2026-09-18",
      "2026-09-20",
      "2026-10-01",
    ]);
  });
});

describe("PT-016 · просроченные даты скрываются", () => {
  it("прошедшие даты не попадают в список, сегодняшняя — попадает", () => {
    const upcoming = upcomingSlots(
      [slot("2026-09-10"), slot(TODAY), slot("2026-09-18")],
      NOW
    ).map((s) => s.date);

    expect(upcoming).toEqual([TODAY, "2026-09-18"]);
  });

  it("строка есть, пока впереди хотя бы одно окно", () => {
    const label = buildAvailabilityLabel(
      [slot("2026-09-10"), slot("2026-09-18"), slot("2026-09-20", "утро")],
      { now: NOW }
    );

    expect(label).toBe(`${availability.labelPrefix} пт 18.09, вс 20.09 (утро)`);
  });

  it("все даты прошли — строки нет: блок срочности исчезает сам, без деплоя", () => {
    expect(buildAvailabilityLabel([slot("2026-09-10"), slot("2026-09-14")], { now: NOW })).toBeNull();
    expect(buildAvailabilityLabel([], { now: NOW })).toBeNull();
  });

  it("мусорные даты игнорируются, а не роняют страницу", () => {
    const label = buildAvailabilityLabel(
      [slot("не дата"), slot("2026-02-31"), slot("2026-09-25")],
      { now: NOW }
    );

    expect(label).toBe(`${availability.labelPrefix} пт 25.09`);
  });

  it("в строке не больше трёх ближайших окон — иначе это простыня в форме", () => {
    const dates = ["2026-09-18", "2026-09-20", "2026-09-25", "2026-09-28", "2026-10-01"];
    const label = buildAvailabilityLabel(dates.map((date) => slot(date)), { now: NOW });

    expect(label).toContain("пт 18.09");
    expect(label).toContain("пт 25.09");
    // Четвёртая и пятая даты в списке есть, но в строку не попали.
    expect(label).not.toContain("28.09");
    expect(label).not.toContain("01.10");
    expect(MAX_SLOTS_IN_LABEL).toBe(3);
    expect(label?.split(",").length).toBe(MAX_SLOTS_IN_LABEL);
  });

  it("префикс тот же, что проверяют правовые тесты календаря", () => {
    const label = buildAvailabilityLabel([slot("2026-09-18")], { now: NOW });
    expect(label?.startsWith(availability.labelPrefix)).toBe(true);
  });
});

describe("PT-016 · разбор сохранения календаря", () => {
  it("принимает список дат, сортирует и приводит подпись", () => {
    const result = normalizeAvailabilityInput(
      {
        slots: [
          { date: "2026-09-25", note: "  после 17:00  " },
          { date: "2026-09-18", note: "" },
          { date: TODAY },
        ],
      },
      NOW
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.slots).toEqual([
      { date: TODAY, note: null },
      { date: "2026-09-18", note: null },
      { date: "2026-09-25", note: "после 17:00" },
    ]);
  });

  it("пустой список валиден: «свободных окон нет» — честный ответ", () => {
    const result = normalizeAvailabilityInput({ slots: [] }, NOW);
    expect(result).toEqual({ ok: true, slots: [] });
  });

  it("отклоняет то, что не является списком дат", () => {
    for (const body of [null, "2026-09-18", { slots: "2026-09-18" }, {}]) {
      const result = normalizeAvailabilityInput(body, NOW);
      expect(result.ok, JSON.stringify(body)).toBe(false);
    }
  });

  it("отклоняет прошедшую дату и говорит, с какой можно", () => {
    const result = normalizeAvailabilityInput({ slots: [{ date: "2026-09-14" }] }, NOW);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0].message).toContain("уже прошла");
  });

  it("отклоняет дату дальше горизонта: обещание на полгода нельзя сдержать", () => {
    const far = addDaysIso(TODAY, MAX_DAYS_AHEAD + 1);
    const result = normalizeAvailabilityInput({ slots: [{ date: far }] }, NOW);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0].message).toContain(String(MAX_DAYS_AHEAD));

    // Ровно на границе — можно.
    expect(
      normalizeAvailabilityInput({ slots: [{ date: addDaysIso(TODAY, MAX_DAYS_AHEAD) }] }, NOW).ok
    ).toBe(true);
  });

  it("отклоняет дубликаты, мусор вместо даты и слишком длинную подпись", () => {
    const dupes = normalizeAvailabilityInput(
      { slots: [{ date: "2026-09-18" }, { date: "2026-09-18" }] },
      NOW
    );
    expect(dupes.ok).toBe(false);
    if (!dupes.ok) expect(dupes.issues[0].message).toContain("встречается дважды");

    const garbage = normalizeAvailabilityInput({ slots: [{ date: "2026-02-31" }] }, NOW);
    expect(garbage.ok).toBe(false);

    const longNote = normalizeAvailabilityInput(
      { slots: [{ date: "2026-09-18", note: "о".repeat(MAX_NOTE_LENGTH + 1) }] },
      NOW
    );
    expect(longNote.ok).toBe(false);
    if (!longNote.ok) expect(longNote.issues[0].message).toContain(String(MAX_NOTE_LENGTH));

    const notText = normalizeAvailabilityInput(
      { slots: [{ date: "2026-09-18", note: 5 }] },
      NOW
    );
    expect(notText.ok).toBe(false);
  });

  it("отклоняет слишком большой список", () => {
    const many = Array.from({ length: MAX_SLOTS_PER_UPDATE + 1 }, (_, index) => ({
      date: addDaysIso(TODAY, index),
    }));

    const result = normalizeAvailabilityInput({ slots: many }, NOW);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0].message).toContain(String(MAX_SLOTS_PER_UPDATE));
  });

  it("собирает все замечания разом, а не по одному за сохранение", () => {
    const result = normalizeAvailabilityInput(
      { slots: [{ date: "2026-09-14" }, { date: "вчера" }, { date: "2026-09-18" }] },
      NOW
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.length).toBe(2);
  });
});
