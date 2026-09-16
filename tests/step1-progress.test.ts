import { describe, expect, it } from "vitest";

import {
  backFromLamps,
  backFromPoints,
  calcStep1Progress,
  missingActionFor,
  nextAfterChandeliers,
  nextAfterLamps,
  nextAfterPoints,
  nextAfterTrackFixtures,
  nextAfterTrackProfile,
  shownStepFor,
  type Step1ProgressInput,
} from "../lib/lighting/step1-progress";

/**
 * PT-018 (B-F104) · переходы между экранами Шага 1 «Свет».
 *
 * Шаг 1 — конечный автомат: система → профиль → светильники → точки → лампы →
 * люстры → подсветка карниза → готово. До переноса правила сидели в пяти
 * `useCallback` внутри компонента на 1395 строк, и «куда попадёт человек после
 * ламп» проверялось только E2E-кликами. Здесь автомат прописан целиком: каждый
 * переход и каждая ветка «назад».
 */

/** База: всё закрыто, ничего не требуется — переходы ведут в «Готово». */
const base: Step1ProgressInput = {
  requiredTrackMeters: 0,
  requiredPointQty: 0,
  selectedTrackMeters: 0,
  selectedPointQty: 0,
  lampRequiredTotal: 0,
  lampCurrentTotal: 0,
  selectedTrackSystem: null,
  trackFixturesCount: 0,
  needsChandeliers: false,
  needsCorniceLighting: false,
};

const facts = (patch: Partial<Step1ProgressInput>): Step1ProgressInput => ({ ...base, ...patch });

describe("PT-018 · прогресс обязательного выбора", () => {
  it("ничего не требуется — всё закрыто", () => {
    const progress = calcStep1Progress(base);
    expect(progress).toEqual({
      trackComplete: true,
      pointsComplete: true,
      lampsComplete: true,
      requiredSelectionComplete: true,
      missingTrackMeters: 0,
      missingPointQty: 0,
      missingLampQty: 0,
    });
  });

  it("недостающие метры и штуки считаются, а не уходят в минус", () => {
    const progress = calcStep1Progress(
      facts({
        requiredTrackMeters: 10,
        selectedTrackMeters: 4,
        requiredPointQty: 6,
        selectedPointQty: 9,
        lampRequiredTotal: 4,
        lampCurrentTotal: 0,
      })
    );

    expect(progress.missingTrackMeters).toBe(6);
    expect(progress.missingPointQty).toBe(0); // перебор не становится отрицательным
    expect(progress.missingLampQty).toBe(4);
    expect(progress.trackComplete).toBe(false);
    expect(progress.pointsComplete).toBe(true);
    expect(progress.lampsComplete).toBe(false);
    expect(progress.requiredSelectionComplete).toBe(false);
  });

  it("ровно норма — закрыто", () => {
    const progress = calcStep1Progress(
      facts({ requiredTrackMeters: 8, selectedTrackMeters: 8, requiredPointQty: 3, selectedPointQty: 3 })
    );
    expect(progress.requiredSelectionComplete).toBe(true);
  });
});

describe("PT-018 · переход после выбора профиля", () => {
  it("не уводит дальше, пока метраж не набран", () => {
    expect(
      nextAfterTrackProfile(facts({ requiredTrackMeters: 10, selectedTrackMeters: 4, selectedTrackSystem: "COLIBRI_220", trackFixturesCount: 5 }))
    ).toBeNull();
  });

  it("не уводит дальше, если метраж задан, а система не выбрана", () => {
    expect(
      nextAfterTrackProfile(facts({ requiredTrackMeters: 10, selectedTrackMeters: 10, selectedTrackSystem: null }))
    ).toBeNull();
  });

  it("дальше — светильники трека, если они есть в каталоге", () => {
    expect(
      nextAfterTrackProfile(facts({ requiredTrackMeters: 10, selectedTrackMeters: 10, selectedTrackSystem: "COLIBRI_220", trackFixturesCount: 3 }))
    ).toEqual({ step: "trackFixtures" });
  });

  it("светильников у системы нет — сразу точки", () => {
    expect(
      nextAfterTrackProfile(facts({ requiredTrackMeters: 10, selectedTrackMeters: 10, selectedTrackSystem: "COLIBRI_220", trackFixturesCount: 0, requiredPointQty: 4, selectedPointQty: 0 }))
    ).toEqual({ step: "points" });
  });

  it("точки набраны, лампы нет — идём за лампами", () => {
    expect(
      nextAfterTrackProfile(facts({ requiredTrackMeters: 10, selectedTrackMeters: 10, selectedTrackSystem: "COLIBRI_220", requiredPointQty: 4, selectedPointQty: 4, lampRequiredTotal: 4, lampCurrentTotal: 1 }))
    ).toEqual({ step: "lamps" });
  });

  it("всё закрыто — «Готово»", () => {
    expect(
      nextAfterTrackProfile(facts({ requiredTrackMeters: 10, selectedTrackMeters: 10, selectedTrackSystem: "COLIBRI_220" }))
    ).toEqual({ step: "done" });
  });
});

describe("PT-018 · переход после светильников трека", () => {
  it("точки важнее ламп", () => {
    expect(
      nextAfterTrackFixtures(facts({ requiredPointQty: 6, selectedPointQty: 2, lampRequiredTotal: 2, lampCurrentTotal: 0 }))
    ).toEqual({ step: "points" });
  });

  it("без потребности в точках — лампы", () => {
    expect(
      nextAfterTrackFixtures(facts({ lampRequiredTotal: 2, lampCurrentTotal: 1 }))
    ).toEqual({ step: "lamps" });
  });

  it("всё набрано — «Готово»", () => {
    expect(nextAfterTrackFixtures(facts({ requiredPointQty: 6, selectedPointQty: 6 }))).toEqual({ step: "done" });
  });
});

describe("PT-018 · экраны T-043: люстры и подсветка карниза", () => {
  it("после ламп — люстры вместе с разделом каталога", () => {
    expect(nextAfterLamps(facts({ needsChandeliers: true, needsCorniceLighting: true }))).toEqual({
      step: "chandeliers",
      catalogSection: "chandeliers",
    });
  });

  it("люстры не нужны — подсветка карниза", () => {
    expect(nextAfterLamps(facts({ needsCorniceLighting: true }))).toEqual({
      step: "corniceLighting",
      catalogSection: "cornice-lighting",
    });
  });

  it("ни того ни другого — «Готово»", () => {
    expect(nextAfterLamps(base)).toEqual({ step: "done" });
  });

  it("после люстр остаётся только подсветка карниза", () => {
    expect(nextAfterChandeliers(facts({ needsCorniceLighting: true }))).toEqual({
      step: "corniceLighting",
      catalogSection: "cornice-lighting",
    });
    expect(nextAfterChandeliers(base)).toEqual({ step: "done" });
  });

  it("после точек сначала лампы, затем цепочка T-043", () => {
    expect(
      nextAfterPoints(facts({ lampRequiredTotal: 4, lampCurrentTotal: 0, needsChandeliers: true }))
    ).toEqual({ step: "lamps" });
    expect(nextAfterPoints(facts({ needsChandeliers: true }))).toEqual({
      step: "chandeliers",
      catalogSection: "chandeliers",
    });
    expect(nextAfterPoints(base)).toEqual({ step: "done" });
  });
});

describe("PT-018 · «Назад» с ламп", () => {
  it("точки — если они требовались", () => {
    expect(backFromLamps(facts({ requiredPointQty: 4, selectedTrackSystem: "CLARUS_48" }))).toEqual({ step: "points" });
  });

  it("светильники трека — если система выбрана", () => {
    expect(backFromLamps(facts({ selectedTrackSystem: "CLARUS_48" }))).toEqual({ step: "trackFixtures" });
  });

  it("профиль — если метраж есть, а система нет", () => {
    expect(backFromLamps(facts({ requiredTrackMeters: 6 }))).toEqual({ step: "trackProfile" });
  });

  it("иначе — выбор системы", () => {
    expect(backFromLamps(base)).toEqual({ step: "system" });
  });
});

describe("PT-018 · назад с точек", () => {
  it("светильники трека — если система выбрана, даже при недобранных точках", () => {
    expect(
      backFromPoints(facts({ requiredPointQty: 4, selectedPointQty: 1, selectedTrackSystem: "CLARUS_48" }))
    ).toEqual({ step: "trackFixtures" });
  });

  it("профиль — если метраж есть, а система нет", () => {
    expect(backFromPoints(facts({ requiredTrackMeters: 6 }))).toEqual({ step: "trackProfile" });
  });

  it("иначе — выбор системы", () => {
    expect(backFromPoints(base)).toEqual({ step: "system" });
  });

  it("совпадает с «назад с ламп», когда точек не требуется", () => {
    const noPoints = facts({ selectedTrackSystem: "COLIBRI_220", requiredPointQty: 0 });
    expect(backFromPoints(noPoints)).toEqual(backFromLamps(noPoints));
  });
});

describe("PT-018 · чего не хватает до комплекта", () => {
  it("метры трека важнее точек и ламп", () => {
    const action = missingActionFor(
      calcStep1Progress(
        facts({ requiredTrackMeters: 10, selectedTrackMeters: 4, requiredPointQty: 4, lampRequiredTotal: 4 })
      ),
      "COLIBRI_220"
    );
    expect(action).toEqual({ label: "Добрать профиль →", step: "trackProfile" });
  });

  it("без выбранной системы сначала выбираем систему", () => {
    const action = missingActionFor(
      calcStep1Progress(facts({ requiredTrackMeters: 10, selectedTrackMeters: 4 })),
      null
    );
    expect(action).toEqual({ label: "Выбрать систему →", step: "system" });
  });

  it("трек закрыт — точки, затем лампы", () => {
    expect(missingActionFor(calcStep1Progress(facts({ requiredPointQty: 4, lampRequiredTotal: 2 })), null)).toEqual({
      label: "Выбрать светильники →",
      step: "points",
    });
    expect(missingActionFor(calcStep1Progress(facts({ lampRequiredTotal: 2 })), null)).toEqual({
      label: "Добавить лампы →",
      step: "lamps",
    });
  });

  it("всё закрыто — действия нет", () => {
    expect(missingActionFor(calcStep1Progress(base), null)).toBeNull();
  });
});

describe("PT-018 · показываемый экран", () => {
  const progress = calcStep1Progress(facts({ lampRequiredTotal: 4, lampCurrentTotal: 0 }));
  const action = missingActionFor(progress, null);

  it("«Готово» с недобором показывает недостающий экран", () => {
    expect(shownStepFor("done", progress, action)).toBe("lamps");
  });

  it("«Готово» с закрытым набором остаётся «Готово»", () => {
    const complete = calcStep1Progress(base);
    expect(shownStepFor("done", complete, missingActionFor(complete, null))).toBe("done");
  });

  it("другой экран не подменяется", () => {
    expect(shownStepFor("trackProfile", progress, action)).toBe("trackProfile");
  });

  it("без действия «Готово» не подменяется даже при недоборе", () => {
    expect(shownStepFor("done", progress, null)).toBe("done");
  });
});
