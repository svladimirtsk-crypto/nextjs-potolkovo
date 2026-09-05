import { describe, expect, it } from "vitest";

import { decideOrphanTrackAction } from "../lib/lighting/orphan-track";

/**
 * N-051 · Автоочистка трековых позиций съедала то, что клиент добавлял руками:
 * «+» на трековом светильнике не работал и никто не объяснял почему. Тесты
 * фиксируют границу между «трек выключили» и «клиент кладёт осознанно».
 */

const base = {
  requiredTrackMeters: 0,
  previousRequiredTrackMeters: 0,
  orphanCount: 1,
  isLightingFirst: false,
};

describe("N-051 · судьба трековых позиций без трека", () => {
  it("пустая корзина — делать нечего", () => {
    expect(decideOrphanTrackAction({ ...base, orphanCount: 0 })).toBe("none");
  });

  it("трек заказан — позиции законны", () => {
    expect(
      decideOrphanTrackAction({ ...base, requiredTrackMeters: 5, previousRequiredTrackMeters: 5 })
    ).toBe("none");
  });

  it("трек только что выключили — остатки убираем", () => {
    expect(decideOrphanTrackAction({ ...base, previousRequiredTrackMeters: 6 })).toBe("drop");
  });

  it("трека не было и нет: клиент добавил сам — не трогаем, объясняем", () => {
    // Главный регресс: раньше здесь было молчаливое удаление.
    expect(decideOrphanTrackAction(base)).toBe("warn");
  });

  it("вход «сначала свет» — набор из каталога не трогаем даже после выключения трека", () => {
    expect(
      decideOrphanTrackAction({
        ...base,
        isLightingFirst: true,
        previousRequiredTrackMeters: 6,
      })
    ).toBe("warn");
  });

  it("вход «сначала свет» без истории трека — тоже предупреждение", () => {
    expect(decideOrphanTrackAction({ ...base, isLightingFirst: true })).toBe("warn");
  });

  it("после автоудаления решение становится «нечего делать»", () => {
    // drop обнуляет корзину — следующий проход не должен зациклиться.
    const afterDrop = decideOrphanTrackAction({
      ...base,
      previousRequiredTrackMeters: 6,
      orphanCount: 0,
    });
    expect(afterDrop).toBe("none");
  });

  it("возврат трека делает позиции снова законными", () => {
    expect(
      decideOrphanTrackAction({ ...base, requiredTrackMeters: 4, previousRequiredTrackMeters: 0 })
    ).toBe("none");
  });
});
