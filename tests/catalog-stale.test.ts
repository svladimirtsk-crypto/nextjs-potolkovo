import { describe, expect, it } from "vitest";

import { CATALOG_STALE_DAYS, isStale } from "../lib/lighting/catalog-index";

/**
 * N-041 · Видимая актуальность прайса (F-44).
 */
const NOW = new Date("2026-06-01T12:00:00.000Z");

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

describe("isStale", () => {
  it("свежий прайс не помечается устаревшим", () => {
    expect(isStale(daysAgo(0), NOW)).toBe(false);
    expect(isStale(daysAgo(10), NOW)).toBe(false);
  });

  it("ровно на пороге ещё свежий, на день позже — уже нет", () => {
    expect(isStale(daysAgo(CATALOG_STALE_DAYS), NOW)).toBe(false);
    expect(isStale(daysAgo(CATALOG_STALE_DAYS + 1), NOW)).toBe(true);
  });

  it("трёхмесячный прайс устарел", () => {
    expect(isStale(daysAgo(90), NOW)).toBe(true);
  });

  it("неизвестная дата считается устаревшей", () => {
    // Непроверено — значит нельзя называть цену окончательной.
    expect(isStale(null, NOW)).toBe(true);
    expect(isStale(undefined, NOW)).toBe(true);
    expect(isStale("", NOW)).toBe(true);
    expect(isStale("не дата", NOW)).toBe(true);
  });

  it("дата из будущего — сбой выгрузки, а не свежесть", () => {
    expect(isStale(new Date(NOW.getTime() + 86_400_000).toISOString(), NOW)).toBe(true);
  });

  it("порог можно задать явно", () => {
    expect(isStale(daysAgo(10), NOW, 7)).toBe(true);
    expect(isStale(daysAgo(10), NOW, 30)).toBe(false);
  });

  it("понимает короткий формат даты из фида", () => {
    expect(isStale("2026-05-20", NOW)).toBe(false);
    expect(isStale("2026-01-05", NOW)).toBe(true);
  });
});
