import { describe, expect, it } from "vitest";

import {
  buildStep1FooterAction,
  resolveStep1FooterAction,
  resolveStep1FooterFromProgress,
  type Step1FooterInput,
} from "../lib/lighting/step1-footer-action";
import { calcStep1Progress, type Step1ProgressInput } from "../lib/lighting/step1-progress";

/**
 * N-050 · Футер Шага 1 — производная от состояния шага, а не отдельное
 * состояние. Тесты фиксируют выбор подписи и блокировки, который раньше был
 * заперт внутри useEffect и проверялся только глазами.
 */

const base: Step1FooterInput = {
  activeTab: "recommendations",
  shownWStep: "points",
  hasMissingAction: false,
  hasSystemOptions: false,
  psuBlocks: false,
  requiredSelectionComplete: true,
  requiredTrackMeters: 0,
  hasTrackSystem: false,
  trackComplete: true,
  pointsComplete: true,
  lampsComplete: true,
};

const at = (over: Partial<Step1FooterInput>) => resolveStep1FooterAction({ ...base, ...over });

describe("resolveStep1FooterAction", () => {
  it("вне вкладки «Подбор» футер завершающий, шаг не важен", () => {
    for (const tab of ["catalog", "selected"]) {
      expect(at({ activeTab: tab, shownWStep: "trackProfile" }).intent).toBe("finish");
      expect(at({ activeTab: tab, shownWStep: "lamps", hasMissingAction: true }).intent).toBe(
        "missing"
      );
    }
  });

  it("каждый шаг мастера даёт свою подпись", () => {
    expect(at({ shownWStep: "trackProfile" }).label).toBe("Подтвердить профиль →");
    expect(at({ shownWStep: "trackFixtures" }).label).toBe("Подтвердить светильники →");
    expect(at({ shownWStep: "points" }).label).toBe("Подтвердить светильники →");
    expect(at({ shownWStep: "lamps" }).label).toBe("Подтвердить лампы →");
    expect(at({ shownWStep: "chandeliers" }).label).toBe("Подтвердить люстры →");
    expect(at({ shownWStep: "corniceLighting" }).label).toBe("Подтвердить подсветку →");
  });

  it("кнопка блокируется, пока нужное количество не набрано", () => {
    expect(at({ shownWStep: "points", pointsComplete: false }).disabled).toBe(true);
    expect(at({ shownWStep: "points", pointsComplete: true }).disabled).toBe(false);
    expect(at({ shownWStep: "lamps", lampsComplete: false }).disabled).toBe(true);
  });

  it("профиль трека: блокировка только когда метраж действительно нужен", () => {
    expect(
      at({ shownWStep: "trackProfile", requiredTrackMeters: 0, hasTrackSystem: false }).disabled
    ).toBe(false);
    expect(
      at({ shownWStep: "trackProfile", requiredTrackMeters: 4, hasTrackSystem: false }).disabled
    ).toBe(true);
    expect(
      at({
        shownWStep: "trackProfile",
        requiredTrackMeters: 4,
        hasTrackSystem: true,
        trackComplete: false,
      }).disabled
    ).toBe(true);
    expect(
      at({
        shownWStep: "trackProfile",
        requiredTrackMeters: 4,
        hasTrackSystem: true,
        trackComplete: true,
      }).disabled
    ).toBe(false);
  });

  it("экран системы: с вариантами — подсказка, без вариантов — завершение", () => {
    const withOptions = at({ shownWStep: "system", hasSystemOptions: true });
    expect(withOptions.intent).toBe("pickSystem");
    expect(withOptions.disabled).toBe(true);

    expect(at({ shownWStep: "system", hasSystemOptions: false }).intent).toBe("finish");
  });

  it("без блока питания завершение недоступно", () => {
    expect(at({ shownWStep: "system", psuBlocks: true }).disabled).toBe(true);
    expect(
      at({ shownWStep: "system", psuBlocks: false, requiredSelectionComplete: false }).disabled
    ).toBe(true);
  });

  it("шаг «none» всегда завершающий, даже при незакрытом пункте", () => {
    expect(at({ shownWStep: "none", hasMissingAction: true }).intent).toBe("finish");
  });
});

describe("N-050 · buildStep1FooterAction", () => {
  const finish = () => ({ label: "К итогу →", onClick: () => {} });

  it("«не хватает позиций» ведёт к недостающему шагу", () => {
    const action = buildStep1FooterAction(
      { intent: "missing" },
      {
        missingAction: { label: "Выбрать светильники →" },
        goToMissingAction: () => {},
        finishAction: finish,
        handlers: {},
      }
    );
    expect(action.label).toBe("Выбрать светильники →");
  });

  it("без конкретного пробела «missing» превращается в завершение", () => {
    // Иначе кнопка осталась бы без подписи и вела в никуда.
    const action = buildStep1FooterAction(
      { intent: "missing" },
      { missingAction: null, goToMissingAction: () => {}, finishAction: finish, handlers: {} }
    );
    expect(action.label).toBe("К итогу →");
  });

  it("«finish» сохраняет блокировку, если она задана", () => {
    const enabled = buildStep1FooterAction(
      { intent: "finish" },
      { missingAction: null, goToMissingAction: () => {}, finishAction: finish, handlers: {} }
    );
    expect(enabled.disabled).toBeUndefined();

    const blocked = buildStep1FooterAction(
      { intent: "finish", disabled: true },
      { missingAction: null, goToMissingAction: () => {}, finishAction: finish, handlers: {} }
    );
    expect(blocked.disabled).toBe(true);
  });

  it("намерение подтверждения зовёт свой обработчик", () => {
    const calls: string[] = [];
    const action = buildStep1FooterAction(
      { intent: "confirmPoints", label: "Подтвердить светильники →" },
      {
        missingAction: null,
        goToMissingAction: () => {},
        finishAction: finish,
        handlers: {
          confirmPoints: () => calls.push("points"),
          confirmLamps: () => calls.push("lamps"),
        },
      }
    );

    action.onClick();
    expect(calls).toEqual(["points"]);
  });

  it("неизвестное намерение не роняет интерфейс", () => {
    // Кнопка без обработчика лучше, чем исключение при рендере футера.
    const action = buildStep1FooterAction(
      { intent: "нет-такого", label: "Дальше" },
      { missingAction: null, goToMissingAction: () => {}, finishAction: finish, handlers: {} }
    );
    expect(() => action.onClick()).not.toThrow();
  });
});

/**
 * PT-018 · Адаптер `resolveStep1FooterFromProgress` обязан давать ровно тот же
 * результат, что и плоский вызов: он существует только чтобы вызывающая сторона
 * не раскладывала прогресс по полям руками.
 */
describe("resolveStep1FooterFromProgress", () => {
  const facts: Step1ProgressInput = {
    requiredTrackMeters: 10,
    requiredPointQty: 4,
    selectedTrackMeters: 10,
    selectedPointQty: 1,
    lampRequiredTotal: 4,
    lampCurrentTotal: 4,
    selectedTrackSystem: "COLIBRI_220",
    trackFixturesCount: 3,
    needsChandeliers: false,
    needsCorniceLighting: false,
  };
  const progress = calcStep1Progress(facts);

  it("совпадает с плоским вызовом на том же наборе фактов", () => {
    const viaAdapter = resolveStep1FooterFromProgress({
      activeTab: "recommendations",
      shownWStep: "points",
      missingAction: null,
      hasSystemOptions: true,
      psuBlocks: false,
      requiredTrackMeters: facts.requiredTrackMeters,
      hasTrackSystem: true,
      progress,
    });

    const flat = resolveStep1FooterAction({
      activeTab: "recommendations",
      shownWStep: "points",
      hasMissingAction: false,
      hasSystemOptions: true,
      psuBlocks: false,
      requiredSelectionComplete: progress.requiredSelectionComplete,
      requiredTrackMeters: facts.requiredTrackMeters,
      hasTrackSystem: true,
      trackComplete: progress.trackComplete,
      pointsComplete: progress.pointsComplete,
      lampsComplete: progress.lampsComplete,
    });

    expect(viaAdapter).toEqual(flat);
  });

  it("незакрытые точки из прогресса видны как недостающее действие", () => {
    expect(progress.pointsComplete).toBe(false);
    expect(progress.missingPointQty).toBe(3);

    const descriptor = resolveStep1FooterFromProgress({
      activeTab: "recommendations",
      shownWStep: "done",
      missingAction: { label: "Выбрать светильники →" },
      hasSystemOptions: true,
      psuBlocks: false,
      requiredTrackMeters: facts.requiredTrackMeters,
      hasTrackSystem: true,
      progress,
    });

    expect(descriptor.intent).toBe("missing");
  });

  it("блокировка по БП: в мастере её несёт дескриптор, в каталоге — само действие", () => {
    const complete = calcStep1Progress({ ...facts, requiredPointQty: 0, selectedPointQty: 0 });
    const input = {
      shownWStep: "system" as const,
      missingAction: null,
      hasSystemOptions: false,
      psuBlocks: true,
      requiredTrackMeters: facts.requiredTrackMeters,
      hasTrackSystem: true,
      progress: complete,
    };

    // Экран выбора системы без вариантов: футер завершающий и заблокирован БП.
    expect(resolveStep1FooterFromProgress({ ...input, activeTab: "recommendations" })).toEqual({
      intent: "finish",
      disabled: true,
    });

    // На вкладке каталога дескриптор блокировку не несёт — её ставит finishAction.
    const onCatalog = resolveStep1FooterFromProgress({ ...input, activeTab: "catalog" });
    expect(onCatalog).toEqual({ intent: "finish" });

    const action = buildStep1FooterAction(onCatalog, {
      missingAction: null,
      goToMissingAction: () => undefined,
      finishAction: () => ({
        label: "Нужен блок питания",
        disabled: true,
        onClick: () => undefined,
      }),
      handlers: {},
    });

    expect(action.label).toBe("Нужен блок питания");
    expect(action.disabled).toBe(true);
  });
});
