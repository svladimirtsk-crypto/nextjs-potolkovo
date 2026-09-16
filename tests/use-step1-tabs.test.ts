import { describe, expect, it } from "vitest";

import {
  applyTabChoice,
  applyViewChoice,
  baseKeyOf,
  resolveBaseCatalogView,
  resolveBaseTab,
  shownCatalogViewOf,
  shownTabState,
  type Step1TabBase,
  type Step1TabOverride,
} from "../lib/lighting/use-step1-tabs";

/**
 * PT-018 (B-F104) · T-031: вкладка и режим каталога Шага 1.
 *
 * Здесь правило, из-за которого T-031 убирал три эффекта с `setState`: базовый
 * режим выводится из того, откуда человек пришёл, а ручной выбор хранится
 * оверрайдом и сбрасывается вместе с базисом. Если оверрайд переживёт смену
 * базиса, модалка откроется на «Выбранном» у человека, который ничего не
 * выбирал; если сбросится раньше — вкладка «прыгнет» под руками.
 */

const base: Step1TabBase = {
  step1CatalogView: null,
  initialLightingTab: undefined,
  initialLightingView: undefined,
  entryMode: undefined,
};

describe("T-031 · базовая вкладка", () => {
  it("по умолчанию — «Подбор»", () => {
    expect(resolveBaseTab(base)).toBe("recommendations");
  });

  it("открытый в контексте каталог важнее параметров открытия", () => {
    expect(
      resolveBaseTab({ ...base, step1CatalogView: "browse", initialLightingTab: "recommendations" })
    ).toBe("catalog");
  });

  it("параметр открытия задаёт вкладку", () => {
    expect(resolveBaseTab({ ...base, initialLightingTab: "catalog" })).toBe("catalog");
    expect(resolveBaseTab({ ...base, initialLightingTab: "recommendations" })).toBe("recommendations");
  });

  it("вход «сначала свет» открывает каталог", () => {
    expect(resolveBaseTab({ ...base, entryMode: "lighting-first" })).toBe("catalog");
    expect(resolveBaseTab({ ...base, entryMode: "default" })).toBe("recommendations");
  });
});

describe("T-031 · базовый режим каталога", () => {
  it("по умолчанию — обычный просмотр", () => {
    expect(resolveBaseCatalogView(base)).toBe("browse");
  });

  it("контекст важнее параметра открытия", () => {
    expect(
      resolveBaseCatalogView({ ...base, step1CatalogView: "selected", initialLightingView: "browse" })
    ).toBe("selected");
  });

  it("«Выбранное» — только если его явно попросили", () => {
    expect(resolveBaseCatalogView({ ...base, initialLightingView: "selected" })).toBe("selected");
    expect(resolveBaseCatalogView({ ...base, initialLightingView: "browse" })).toBe("browse");
  });
});

describe("T-031 · оверрайд живёт только в своём базисе", () => {
  const baseKey = baseKeyOf("recommendations", "browse");
  const override: Step1TabOverride = { base: baseKey, tab: "catalog", view: "selected" };

  it("пока базис тот же — показываем выбор человека", () => {
    expect(
      shownTabState({ override, baseKey, baseTab: "recommendations", baseView: "browse" })
    ).toEqual({ tab: "catalog", view: "selected" });
  });

  it("базис сменился — возвращаемся к выведенным значениям", () => {
    const nextKey = baseKeyOf("catalog", "browse");
    expect(
      shownTabState({ override, baseKey: nextKey, baseTab: "catalog", baseView: "browse" })
    ).toEqual({ tab: "catalog", view: "browse" });
  });

  it("без оверрайда показываются выведенные значения", () => {
    expect(
      shownTabState({ override: null, baseKey, baseTab: "recommendations", baseView: "browse" })
    ).toEqual({ tab: "recommendations", view: "browse" });
  });

  it("выбор вкладки сохраняет режим каталога того же базиса", () => {
    expect(applyTabChoice(override, { baseKey, tab: "recommendations", baseView: "browse" })).toEqual({
      base: baseKey,
      tab: "recommendations",
      view: "selected",
    });
  });

  it("выбор вкладки в новом базисе не тащит старый режим", () => {
    const nextKey = baseKeyOf("catalog", "browse");
    expect(applyTabChoice(override, { baseKey: nextKey, tab: "catalog", baseView: "browse" })).toEqual({
      base: nextKey,
      tab: "catalog",
      view: "browse",
    });
  });

  it("выбор режима сохраняет вкладку того же базиса", () => {
    expect(applyViewChoice(override, { baseKey, view: "browse", baseTab: "recommendations" })).toEqual({
      base: baseKey,
      tab: "catalog",
      view: "browse",
    });
  });

  it("выбор режима в новом базисе не тащит старую вкладку", () => {
    const nextKey = baseKeyOf("recommendations", "selected");
    expect(
      applyViewChoice(override, { baseKey: nextKey, view: "selected", baseTab: "recommendations" })
    ).toEqual({ base: nextKey, tab: "recommendations", view: "selected" });
  });

  it("ключ базиса различает вкладку и режим", () => {
    expect(baseKeyOf("catalog", "browse")).not.toBe(baseKeyOf("catalog", "selected"));
    expect(baseKeyOf("catalog", "browse")).not.toBe(baseKeyOf("recommendations", "browse"));
    expect(baseKeyOf("catalog", "browse")).toBe("catalog|browse");
  });
});

describe("T-031 · пустое «Выбранное»", () => {
  it("без позиций показываем каталог", () => {
    expect(shownCatalogViewOf("selected", 0)).toBe("browse");
  });

  it("с позициями — то, что выбрал человек", () => {
    expect(shownCatalogViewOf("selected", 3)).toBe("selected");
    expect(shownCatalogViewOf("browse", 3)).toBe("browse");
    expect(shownCatalogViewOf("browse", 0)).toBe("browse");
  });
});
