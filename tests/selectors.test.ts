import { describe, expect, it } from "vitest";

import { pricing } from "@/content/pricing";
import { calcProgress, maxParamsForScenario, paramPosition } from "@/lib/calculator/fsm";
import {
  selectBackVisible,
  selectExtraInstall,
  selectFooterAction,
  selectOrderIntent,
  selectRequirements,
  selectRequirementsFromBreakdown,
  selectSummaryReady,
  selectTotals,
  type LightingSelection,
  type SelectorRoom,
} from "@/lib/calculator/selectors";
import { getEnabledParams } from "@/lib/step0-fsm";

function makeRoom(id: string, patch: Partial<SelectorRoom> = {}): SelectorRoom {
  return {
    id,
    label: `Комната ${id}`,
    area: 18,
    ceilingType: "standard",
    shadowEnabled: false,
    shadowLength: 18,
    floatingEnabled: false,
    floatingLength: 18,
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

const NO_LIGHTING: LightingSelection = {
  regularTotalRub: 0,
  effectiveTotalRub: 0,
  itemsCount: 0,
  selectedPointsQty: 0,
  selectedTrackMeters: 0,
  discountMode: "none",
};

describe("T-030 - selectRequirements", () => {
  it("summiruet trek i tochki po komnatam", () => {
    const requirements = selectRequirements([
      makeRoom("r1", { trackType: "built-in", trackLength: 10, lightsEnabled: true, lightsCount: 6 }),
      makeRoom("r2", { trackType: "surface", trackLength: 4, lightsEnabled: true, lightsCount: 4 }),
    ]);

    expect(requirements.trackMeters).toBe(14);
    expect(requirements.points).toBe(10);
    expect(requirements.lamps).toBe(10);
    expect(requirements.rooms).toHaveLength(2);
  });

  it("trackMountType: vstroennyy silnee nakladnogo", () => {
    expect(
      selectRequirements([
        makeRoom("r1", { trackType: "surface", trackLength: 4 }),
        makeRoom("r2", { trackType: "built-in", trackLength: 4 }),
      ]).trackMountType
    ).toBe("built-in");

    expect(
      selectRequirements([makeRoom("r1", { trackType: "surface", trackLength: 4 })]).trackMountType
    ).toBe("surface");

    expect(selectRequirements([makeRoom("r1")]).trackMountType).toBe("none");
  });

  it("vyklyuchennyy svet i trek ne popadayut v trebovaniya", () => {
    const requirements = selectRequirements([
      makeRoom("r1", { trackType: "none", trackLength: 10, lightsEnabled: false, lightsCount: 8 }),
    ]);

    expect(requirements.trackMeters).toBe(0);
    expect(requirements.points).toBe(0);
  });

  it("trekovye svetilniki - orientir-diapazon, a ne tochnoe chislo", () => {
    const { trackFixtures } = selectRequirements([
      makeRoom("r1", { trackType: "built-in", trackLength: 10 }),
    ]);

    expect(trackFixtures.min).toBeLessThan(trackFixtures.max);
    expect(trackFixtures.min).toBeGreaterThan(0);
  });

  it("iz roomBreakdown poluchaetsya to zhe, chto iz komnat", () => {
    const fromRooms = selectRequirements([
      makeRoom("r1", { trackType: "built-in", trackLength: 10, lightsEnabled: true, lightsCount: 6 }),
    ]);
    const fromBreakdown = selectRequirementsFromBreakdown([
      {
        id: "r1",
        label: "Комната r1",
        area: 18,
        totalRub: 0,
        ceilingTypeLabel: "Простой потолок",
        trackLabel: "Встроенный трек",
        trackLength: 10,
        lightsCount: 6,
      },
    ]);

    expect(fromBreakdown.trackMeters).toBe(fromRooms.trackMeters);
    expect(fromBreakdown.points).toBe(fromRooms.points);
    expect(fromBreakdown.trackMountType).toBe("built-in");
  });
});

describe("T-030 - doschet montazha", () => {
  const requirements = selectRequirements([
    makeRoom("r1", { trackType: "built-in", trackLength: 10, lightsEnabled: true, lightsCount: 6 }),
    makeRoom("r2", { lightsEnabled: true, lightsCount: 6 }),
  ]);

  it("12 korpusov na 12 zalozhennyh tochek -> 0", () => {
    const extra = selectExtraInstall(requirements, { ...NO_LIGHTING, selectedPointsQty: 12 });
    expect(extra.rub).toBe(0);
    expect(extra.lines).toEqual([]);
  });

  it("14 korpusov -> 2 x 750 = 1500", () => {
    const extra = selectExtraInstall(requirements, { ...NO_LIGHTING, selectedPointsQty: 14 });
    expect(extra.rub).toBe(2 * pricing.spotInstall);
    expect(extra.lines[0]).toContain("2 точек");
  });

  it("menshe korpusov, chem zalozheno -> ne vychitaem", () => {
    expect(selectExtraInstall(requirements, { ...NO_LIGHTING, selectedPointsQty: 4 }).rub).toBe(0);
  });

  it("lishnie metry treka schitayutsya po stavke montazha", () => {
    const extra = selectExtraInstall(requirements, { ...NO_LIGHTING, selectedTrackMeters: 13 });
    expect(extra.rub).toBe(3 * pricing.track.builtInPerM);
  });
});

describe("T-030 - selectTotals", () => {
  it("minimalnyy zakaz podnimaet malenkiy raschet", () => {
    const totals = selectTotals([makeRoom("r1", { area: 5 })]);

    expect(totals.ceilingRaw).toBeLessThan(pricing.minimumOrderRub);
    expect(totals.ceilingApplied).toBe(pricing.minimumOrderRub);
    expect(totals.minimumApplied).toBe(true);
  });

  it("multi-room summiruetsya", () => {
    const one = selectTotals([makeRoom("r1", { area: 30 })]).ceilingRaw;
    const two = selectTotals([makeRoom("r1", { area: 30 }), makeRoom("r2", { area: 30 })]).ceilingRaw;

    expect(two).toBe(one * 2);
  });

  it("invariant: grand = potolok + doschet + svet so skidkoy", () => {
    const lighting: LightingSelection = {
      regularTotalRub: 20000,
      effectiveTotalRub: 15000,
      itemsCount: 3,
      selectedPointsQty: 20,
      selectedTrackMeters: 0,
      discountMode: "with-ceiling",
    };
    const rooms = [makeRoom("r1", { area: 30, lightsEnabled: true, lightsCount: 6 })];
    const totals = selectTotals(rooms, lighting);

    expect(totals.grand).toBe(
      totals.ceilingApplied + totals.extraInstallRub + totals.lightingEffective
    );
    expect(totals.discountPct).toBe(pricing.lightingDiscount.withCeilingPct);
    // 20 корпусов против 6 заложенных → досчёт за 14 точек.
    expect(totals.extraInstallRub).toBe(14 * pricing.spotInstall);
  });

  it("pustoy raschet daet nuli", () => {
    const totals = selectTotals([]);
    expect(totals).toMatchObject({ ceilingRaw: 0, ceilingApplied: 0, grand: 0 });
  });

  it("skidka lighting-only - 10 procentov", () => {
    const totals = selectTotals([], { ...NO_LIGHTING, itemsCount: 1, discountMode: "lighting-only" });
    expect(totals.discountPct).toBe(pricing.lightingDiscount.lightingOnlyPct);
  });
});

describe("T-030 - gotovnost i intent", () => {
  it("summary gotov, esli est komnaty ili svet", () => {
    expect(selectSummaryReady([], NO_LIGHTING)).toBe(false);
    expect(selectSummaryReady([makeRoom("r1")], NO_LIGHTING)).toBe(true);
    expect(selectSummaryReady([], { ...NO_LIGHTING, itemsCount: 2 })).toBe(true);
  });

  it("intent vyvoditsya iz sostava rascheta", () => {
    expect(selectOrderIntent([makeRoom("r1")], NO_LIGHTING)).toBe("ceiling_only");
    expect(selectOrderIntent([], { ...NO_LIGHTING, itemsCount: 2 })).toBe("lighting_only");
    expect(selectOrderIntent([makeRoom("r1")], { ...NO_LIGHTING, itemsCount: 2 })).toBe(
      "lighting_with_ceiling"
    );
  });
});

describe("T-030 - futer Shaga 0", () => {
  it("podpisi knopki po ekranam", () => {
    expect(selectFooterAction({ t: "scenario" }, { scope: null })?.label).toBe(
      "Выберите вариант выше"
    );
    expect(selectFooterAction({ t: "calcMode" }, { scope: null })).toEqual({
      label: "Выберите режим выше",
      disabled: true,
    });
    expect(selectFooterAction({ t: "calcMode" }, { scope: "room" })).toEqual({
      label: "Продолжить →",
      disabled: false,
    });
    expect(
      selectFooterAction({ t: "param", roomId: "r1", param: "area" }, { scope: "room" })?.label
    ).toBe("Подтвердить площадь →");
    // На сводке кнопки задаёт сам экран.
    expect(selectFooterAction({ t: "summary" }, { scope: "room" })).toBeNull();
  });

  it("nazad skryta na scenarii i na avtoproskochennom calcMode", () => {
    expect(
      selectBackVisible({ t: "scenario" }, { historyLength: 1, scenarioPreselected: false })
    ).toBe(false);
    expect(
      selectBackVisible({ t: "calcMode" }, { historyLength: 1, scenarioPreselected: true })
    ).toBe(false);
    expect(
      selectBackVisible({ t: "calcMode" }, { historyLength: 2, scenarioPreselected: true })
    ).toBe(true);
  });
});

describe("T-030 - progress s fiksirovannym M", () => {
  it("znamenatel ne zavisit ot vklyuchennyh opciy", () => {
    const scenario = "modern" as const;
    const short = getEnabledParams({
      scenario,
      shadowEnabled: false,
      floatingEnabled: false,
      showModernOptions: true,
    });
    const long = getEnabledParams({
      scenario,
      shadowEnabled: true,
      floatingEnabled: true,
      showModernOptions: true,
    });

    const a = calcProgress({ t: "calcMode" }, { scenario, enabledParams: short });
    const b = calcProgress({ t: "calcMode" }, { scenario, enabledParams: long });

    // Включение теневого профиля не должно менять знаменатель полоски.
    expect(a.total).toBe(b.total);
  });

  it("standard koroche modern", () => {
    expect(maxParamsForScenario("standard")).toBeLessThan(maxParamsForScenario("modern"));
  });

  it("progress rastet po hodu kviza i ne prevyshaet total", () => {
    const scenario = "standard" as const;
    const enabledParams = getEnabledParams({
      scenario,
      shadowEnabled: false,
      floatingEnabled: false,
      showModernOptions: false,
    });
    const ctx = { scenario, enabledParams };

    const start = calcProgress({ t: "scenario" }, ctx);
    const middle = calcProgress({ t: "param", roomId: "r1", param: "cornice" }, ctx);
    const end = calcProgress({ t: "summary" }, ctx);

    expect(start.done).toBe(0);
    expect(middle.done).toBeGreaterThan(start.done);
    expect(end.done).toBeGreaterThan(middle.done);
    expect(end.done).toBeLessThanOrEqual(end.total);
  });

  it("paramPosition daet nomer voprosa", () => {
    const scenario = "standard" as const;
    const enabledParams = getEnabledParams({
      scenario,
      shadowEnabled: false,
      floatingEnabled: false,
      showModernOptions: false,
    });

    expect(paramPosition({ t: "param", roomId: "r1", param: "area" }, { scenario, enabledParams }))
      .toEqual({ index: 1, total: maxParamsForScenario(scenario) });
    expect(paramPosition({ t: "summary" }, { scenario, enabledParams })).toBeNull();
  });
});
