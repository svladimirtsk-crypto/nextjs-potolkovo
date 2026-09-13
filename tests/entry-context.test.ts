import { describe, expect, it } from "vitest";

import { homepage } from "@/content/homepage";
import { servicePageContent, type ServiceCalculatorPreset } from "@/content/services";
import { resolveStep2Copy } from "@/lib/calculator-flow";
import { DISABLED_PRESET_SLUGS, presetToRoom } from "@/lib/calculator/presets";
import { DEFAULT_CALCULATOR_AREA } from "@/lib/catalog-ui-config";
import {
  buildEntrySource,
  entryToCalculatorOptions,
  projectEntryCtaLabel,
  resolveEntryPreset,
  type EntryContext,
} from "@/lib/entry-context";

/**
 * PT-008 · EntryContext (раздел 3.1 ТЗ).
 *
 * Главный инвариант: пресет страницы/кейса доезжает до движка целиком. До
 * PT-008 `wizard-step0-calculator.tsx` собирал пресет руками и копировал
 * восемь полей из девятнадцати — длины профилей, трека, карниза, световые
 * линии, метка помещения и область расчёта терялись молча.
 */

const services = Object.values(servicePageContent);

function servicePreset(slug: string): ServiceCalculatorPreset {
  const service = services.find((item) => item.slug === slug);
  if (!service) throw new Error(`Нет услуги ${slug}`);
  return service.price.calculatorPreset;
}

function entry(overrides: Partial<EntryContext> = {}): EntryContext {
  return {
    pagePath: "/uslugi/tenevoy-profil",
    serviceSlug: "tenevoy-profil",
    placement: "hero",
    entryMode: "default",
    intent: null,
    presetOrigin: "page",
    preset: null,
    ...overrides,
  };
}

/** Пресет со всеми 19 полями типа — на нём видно любую потерю. */
const FULL_PRESET: ServiceCalculatorPreset = {
  ceilingType: "shadow",
  areaDefault: 24,
  calculationScopeDefault: "object",
  roomLabelDefault: "Кухня-гостиная",
  corniceType: "hidden-niche",
  corniceLengthDefault: 8,
  corniceLightingEnabled: true,
  corniceLightingLengthDefault: 5,
  corniceLightingPowerSuppliesDefault: 2,
  trackType: "built-in",
  trackLengthDefault: 10,
  shadowLengthDefault: 19,
  floatingLengthDefault: 12,
  lightLinesEnabled: true,
  lightLinesLengthDefault: 4,
  lightsEnabled: true,
  lightsCount: 8,
  introNote: "Стартовые параметры загружены по этому кейсу.",
  lightingDefault: "kit",
};

describe("PT-008 · resolveEntryPreset — пресет переносится целиком", () => {
  it("без пресета — стандартный потолок и дефолтная площадь прайса", () => {
    expect(resolveEntryPreset(null, { presetOrigin: "default" })).toEqual({
      ceilingType: "standard",
      areaDefault: DEFAULT_CALCULATOR_AREA,
    });
    expect(resolveEntryPreset(undefined)).toEqual({
      ceilingType: "standard",
      areaDefault: DEFAULT_CALCULATOR_AREA,
    });
  });

  it("все 19 полей пресета доходят до результата", () => {
    const resolved = resolveEntryPreset(FULL_PRESET, { presetOrigin: "explicit" });

    expect(resolved).toEqual(FULL_PRESET);
    // Отдельно — поля, которые теряла прежняя ручная сборка.
    expect(resolved.shadowLengthDefault).toBe(19);
    expect(resolved.trackLengthDefault).toBe(10);
    expect(resolved.floatingLengthDefault).toBe(12);
    expect(resolved.lightLinesEnabled).toBe(true);
    expect(resolved.lightLinesLengthDefault).toBe(4);
    expect(resolved.corniceLengthDefault).toBe(8);
    expect(resolved.corniceLightingEnabled).toBe(true);
    expect(resolved.corniceLightingLengthDefault).toBe(5);
    expect(resolved.corniceLightingPowerSuppliesDefault).toBe(2);
    expect(resolved.roomLabelDefault).toBe("Кухня-гостиная");
    expect(resolved.calculationScopeDefault).toBe("object");
  });

  it("пресет каждой из 9 услуг переносится без потерь", () => {
    for (const service of services) {
      const resolved = resolveEntryPreset(service.price.calculatorPreset, {
        presetOrigin: "page",
      });
      expect(resolved, service.slug).toEqual(service.price.calculatorPreset);
    }
  });

  it("обычный вход: площадь — дефолт прайса, остальные поля от пресета", () => {
    const resolved = resolveEntryPreset(FULL_PRESET, { presetOrigin: "default" });

    expect(resolved.areaDefault).toBe(DEFAULT_CALCULATOR_AREA);
    expect(resolved.shadowLengthDefault).toBe(19);
    expect(resolved.roomLabelDefault).toBe("Кухня-гостиная");
  });

  it("forcePreset сохраняет площадь и при обычном входе", () => {
    const resolved = resolveEntryPreset(FULL_PRESET, {
      presetOrigin: "default",
      forcePreset: true,
    });
    expect(resolved.areaDefault).toBe(24);
  });

  it("площадь страницы услуги больше не подменяется на 18 м²", () => {
    // T-021: раньше hero/mid/sticky/хедер отдавали площадь пресета в
    // `DEFAULT_CALCULATOR_AREA`, и «Теневой профиль» открывался на 18 м²
    // вместо своих 22 м².
    expect(resolveEntryPreset(servicePreset("tenevoy-profil"), { presetOrigin: "page" }).areaDefault).toBe(22);
    expect(resolveEntryPreset(servicePreset("svetovye-linii"), { presetOrigin: "page" }).areaDefault).toBe(24);
    expect(resolveEntryPreset(servicePreset("trekovoe-osveshchenie"), { presetOrigin: "page" }).areaDefault).toBe(20);
  });
});

describe("PT-008 · приёмка: кейс «18 м² / 19 м теневого / 10 м трека»", () => {
  const proofCase = homepage.proof.items.find((item) => item.slug === "shadow-track-apartment");
  const casePreset = (proofCase as { actionPreset?: ServiceCalculatorPreset } | undefined)
    ?.actionPreset;

  it("кейс есть в контенте главной", () => {
    expect(casePreset).toBeTruthy();
  });

  it("движок получает 18 м², 19 м теневого профиля и 10 м трека", () => {
    const resolved = resolveEntryPreset(casePreset, { presetOrigin: "explicit" });
    const { room, scope, prefilled, roomLabel } = presetToRoom(resolved);

    expect(room.area).toBe(18);
    expect(room.shadowEnabled).toBe(true);
    expect(room.shadowLength).toBe(19);
    expect(room.trackType).toBe("built-in");
    expect(room.trackLength).toBe(10);
    expect(roomLabel).toBe("Кухня-гостиная");
    expect(scope).toBe("room");
    expect(prefilled).toEqual(expect.arrayContaining(["area", "ceiling", "track"]));
  });

  it("регрессия: без полного переноса получались 17 м профиля и 4 м трека", () => {
    /**
     * Прежняя ручная сборка оставляла только `ceilingType` и `trackType`,
     * поэтому `presetToRoom` брал длины по периметру: round(4·√18) = 17 м
     * теневого профиля и round(17/4) = 4 м трека вместо 19 и 10 из кейса.
     */
    const stripped: ServiceCalculatorPreset = {
      ceilingType: casePreset!.ceilingType,
      areaDefault: casePreset!.areaDefault,
      trackType: casePreset!.trackType,
    };
    const { room } = presetToRoom(stripped);

    expect(room.shadowLength).toBe(17);
    expect(room.trackLength).toBe(4);
    expect(room.shadowLength).not.toBe(19);
  });
});

describe("PT-008 · световые линии страницы услуги", () => {
  it("«Световые линии» открывают расчёт с включёнными линиями", () => {
    const resolved = resolveEntryPreset(servicePreset("svetovye-linii"), { presetOrigin: "page" });
    const { room } = presetToRoom(resolved);

    expect(room.lightLinesEnabled).toBe(true);
    expect(room.lightLinesLength).toBe(4);
    expect(room.area).toBe(24);
  });
});

describe("PT-008 · источник и параметры openCalculator", () => {
  it("источник — «<slug>:<placement>», на главной — «home:…»", () => {
    expect(buildEntrySource(entry({ placement: "header" }))).toBe("tenevoy-profil:header");
    expect(buildEntrySource(entry({ serviceSlug: null, placement: "header" }))).toBe("home:header");
  });

  it("пресет страницы: source, слаг, путь страницы и происхождение", () => {
    const options = entryToCalculatorOptions(
      entry({ preset: servicePreset("tenevoy-profil"), presetOrigin: "page" })
    );

    expect(options).toMatchObject({
      source: "tenevoy-profil:hero",
      serviceSlug: "tenevoy-profil",
      pagePath: "/uslugi/tenevoy-profil",
      presetOrigin: "page",
      forcePreset: false,
    });
    expect(options.preset).toEqual(servicePreset("tenevoy-profil"));
  });

  it("явный кейс: forcePreset включён", () => {
    const options = entryToCalculatorOptions(
      entry({ placement: "proof", preset: FULL_PRESET, presetOrigin: "explicit" })
    );
    expect(options.forcePreset).toBe(true);
    expect(options.presetOrigin).toBe("explicit");
  });

  it("обычный вход: пресета нет, entryMode не дублируется", () => {
    const options = entryToCalculatorOptions(
      entry({ serviceSlug: null, preset: null, presetOrigin: "default" })
    );
    expect(options.preset).toBeUndefined();
    expect(options.presetOrigin).toBe("default");
    expect(options.entryMode).toBeUndefined();
    expect(options.source).toBe("home:hero");
  });

  it("вход «сначала свет» несёт entryMode", () => {
    const options = entryToCalculatorOptions(
      entry({ placement: "catalog", entryMode: "lighting-first", preset: null })
    );
    expect(options.entryMode).toBe("lighting-first");
  });

  it("точечные overrides побеждают — ими заданы особые источники", () => {
    const options = entryToCalculatorOptions(entry(), {
      source: "shadow-track-apartment:proof-card",
      presetOrigin: "explicit",
    });
    expect(options.source).toBe("shadow-track-apartment:proof-card");
    expect(options.presetOrigin).toBe("explicit");
    expect(options.forcePreset).toBe(false);
  });
});

describe("PT-008 · услуги без честного типового расчёта", () => {
  it("в списке обе услуги из ТЗ", () => {
    expect(DISABLED_PRESET_SLUGS.has("svetoprozrachnye-potolki")).toBe(true);
    expect(DISABLED_PRESET_SLUGS.has("individualnye-proekty")).toBe(true);
    expect([...DISABLED_PRESET_SLUGS]).toHaveLength(2);
  });

  it("пресет такой услуги помечен отключённым", () => {
    for (const slug of DISABLED_PRESET_SLUGS) {
      const result = presetToRoom(servicePreset(slug), { slug });
      expect(result.disabled, slug).toBe(true);
    }
  });

  it("подпись входа — «Обсудить проект» из копирайта формы Шага 2", () => {
    // Единый источник текста: отдельная строка в компоненте разошлась бы с
    // подписью кнопки отправки формы.
    expect(projectEntryCtaLabel()).toBe(resolveStep2Copy("advanced").submitLabel);
    expect(projectEntryCtaLabel()).toBe("Обсудить проект");
  });
});
