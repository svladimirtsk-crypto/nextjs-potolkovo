import { describe, expect, it } from "vitest";

import {
  applyCatalogFilterChange,
  changeResetsResults,
  type CatalogFilterChange,
  type CatalogFiltersState,
} from "../lib/lighting/use-catalog-filters";

/**
 * N-051 · Правила фильтров каталога — одни на модалку и страницу.
 *
 * До выноса эти правила жили в обработчиках каждого чипа, в двух файлах, и
 * успели разойтись: в модалке смена раздела сбрасывала поиск, на странице —
 * сохраняла. Тест фиксирует поведение, чтобы копии не появились снова.
 *
 * Проверяется чистый переход, а не хук: правила и есть предмет ошибки, а
 * рендер React к делу не относится (и `@testing-library` в зависимости не
 * добавить — ТЗ разрешает только drizzle/pg).
 */
const INITIAL: CatalogFiltersState = {
  section: "track-systems",
  trackSystem: "COLIBRI_220",
  trackGroup: "TRACK_FIXTURE",
  pointSubtype: "GX53",
  lampSocket: "GX53",
  query: "",
};

describe("applyCatalogFilterChange", () => {
  it("смена раздела сохраняет поисковый запрос (T-065)", () => {
    const searching: CatalogFiltersState = { ...INITIAL, query: "диммер" };
    const next = applyCatalogFilterChange(searching, { type: "section", value: "lamps" });

    // Человек ищет «диммер», а не «диммер в разделе Трековые системы».
    expect(next.section).toBe("lamps");
    expect(next.query).toBe("диммер");
  });

  it("любой фильтр внутри раздела сбрасывает запрос", () => {
    const searching: CatalogFiltersState = { ...INITIAL, query: "шинопровод" };

    const changes: CatalogFilterChange[] = [
      { type: "trackSystem", value: "CLARUS_48" },
      { type: "trackGroup", value: "TRACK_ACCESSORY" },
      { type: "pointSubtype", value: "MR16" },
      { type: "lampSocket", value: "GU10" },
    ];

    for (const change of changes) {
      // Фильтр сужает выдачу, и старый запрос почти всегда даёт пусто.
      expect(applyCatalogFilterChange(searching, change).query, change.type).toBe("");
    }
  });

  it("каждый фильтр меняет только своё поле", () => {
    const next = applyCatalogFilterChange(INITIAL, { type: "lampSocket", value: "GU10" });

    expect(next.lampSocket).toBe("GU10");
    expect(next.section).toBe(INITIAL.section);
    expect(next.trackSystem).toBe(INITIAL.trackSystem);
    expect(next.pointSubtype).toBe(INITIAL.pointSubtype);
  });

  it("ввод текста не трогает остальное состояние", () => {
    const next = applyCatalogFilterChange(INITIAL, { type: "query", value: "gx53" });

    expect(next.query).toBe("gx53");
    expect({ ...next, query: "" }).toEqual(INITIAL);
  });

  it("resetQuery очищает поиск, не меняя раздел", () => {
    const state: CatalogFiltersState = { ...INITIAL, section: "lamps", query: "gx53" };
    const next = applyCatalogFilterChange(state, { type: "resetQuery" });

    expect(next.query).toBe("");
    expect(next.section).toBe("lamps");
  });

  it("переход не мутирует прежнее состояние", () => {
    applyCatalogFilterChange(INITIAL, { type: "section", value: "lamps" });
    expect(INITIAL.section).toBe("track-systems");
  });
});

describe("changeResetsResults", () => {
  it("смена раздела и фильтров сбрасывает пагинацию", () => {
    // Иначе после смены раздела осталась бы прокрутка от прошлой выдачи.
    expect(changeResetsResults({ type: "section", value: "lamps" })).toBe(true);
    expect(changeResetsResults({ type: "trackSystem", value: "CLARUS_48" })).toBe(true);
    expect(changeResetsResults({ type: "lampSocket", value: "MR16" })).toBe(true);
  });

  it("набор текста пагинацию не трогает", () => {
    // Сброс на каждой букве дёргал бы список под рукой у человека.
    expect(changeResetsResults({ type: "query", value: "л" })).toBe(false);
    expect(changeResetsResults({ type: "resetQuery" })).toBe(false);
  });
});
