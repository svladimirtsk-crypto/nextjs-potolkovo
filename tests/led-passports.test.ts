/**
 * T8-011/012 · Паспортная библиотека: статусы полей и право менять расчёт.
 *
 * Ключевое требование ТЗ: `title_only` и `label_observed` сами по себе не дают
 * verified BOM. Поэтому проверяем не только «поле прочиталось», но и что
 * значение из названия НЕ подменяет расчёт, пока не появился паспорт.
 */
import { describe, expect, it } from "vitest";

import {
  STRIP_PASSPORT_FIELDS,
  applyPassportToSpec,
  applyStripPassportToSpec,
  field,
  findPassport,
  isVerifiedField,
  passportFromStripProfile,
  passportIsVerified,
  passportStatus,
  passportsFromStripProfiles,
  stripPassportGaps,
  worstPassportStatus,
  type StripPassport,
} from "@/lib/lighting/led-passports";
import { parseStripSpec } from "@/lib/lighting/led-hardware";

const profile = {
  series: "СТАНДАРТ 140",
  title: "Светодиодная лента СТАНДАРТ 140 24V 112 диодов 10W 4200К катушка 5 м ЧЗ",
  voltage: 24,
  wPerMeter: 10,
  kind: null, // 4200К не доказывает моно и один канал.
  reelMeters: 5,
};

describe("T8-011 · паспорт-кандидат из профиля", () => {
  it("всё, что взято из названия, помечено title_only", () => {
    const passport = passportFromStripProfile(profile);
    expect(passport.series).toBe("СТАНДАРТ 140");
    expect(passport.voltageDc).toMatchObject({ value: 24, status: "title_only" });
    expect(passport.maxPowerWm).toMatchObject({ value: 10, status: "title_only" });
    expect(passport.reelLengthM).toMatchObject({ value: 5, status: "title_only" });
    expect(passport.stripMode).toMatchObject({ value: null, status: "unknown" });
    expect(passport.channelCount).toMatchObject({ value: null, status: "unknown" });
  });

  it("чего нет в названии — unknown, а не 0 и не false", () => {
    const passport = passportFromStripProfile(profile);
    for (const key of ["cutStepMm", "widthMm", "ipRating", "maxFeedLengthM", "thermalMount", "priceBasis", "packQty", "moq"] as const) {
      expect(passport[key].value).toBeNull();
      expect(passport[key].status).toBe("unknown");
    }
  });

  it("список пробелов — это и есть запрос поставщику", () => {
    const gaps = stripPassportGaps(passportFromStripProfile(profile));
    expect(gaps).toEqual([
      "stripMode",
      "channelCount",
      "cutStepMm",
      "widthMm",
      "maxFeedLengthM",
      "thermalMount",
      "priceBasis",
      "packQty",
      "moq",
    ]);
    // Все перечисленные поля описаны человечески и помечены как обязательные.
    for (const key of gaps) {
      expect(STRIP_PASSPORT_FIELDS[key].required).toBe(true);
      expect(STRIP_PASSPORT_FIELDS[key].label.trim().length).toBeGreaterThan(1);
    }
  });

  it("паспорт из названий не verified, даже если все поля заполнены", () => {
    const passport = passportFromStripProfile(profile);
    expect(passportIsVerified(passport)).toBe(false);
    // Самый слабый обязательный статус — unknown: паспорта ещё нет вовсе.
    expect(passportStatus(passport)).toBe("unknown");
  });
});

describe("T8-012 · что паспорт имеет право менять", () => {
  const spec = { voltage: 24, wPerMeter: 10, reelMeters: 5, kind: "mono" as const };

  it("данные из названия не подменяют расчёт и попадают в blocked", () => {
    const { spec: next, application } = applyPassportToSpec(spec, passportFromStripProfile(profile));
    expect(next).toEqual(spec);
    expect(application.applied).toEqual([]);
    expect(application.blocked).toEqual(["voltageDc", "maxPowerWm", "reelLengthM"]);
    expect(application.verified).toBe(false);
  });

  it("паспорт с datasheet_verified меняет значения и снимает блокировку", () => {
    const verified: StripPassport = {
      ...passportFromStripProfile(profile),
      voltageDc: field(24, "datasheet_verified", "паспорт серии, файл eks-standart-140.pdf"),
      maxPowerWm: field(9.6, "datasheet_verified", "паспорт серии"),
      reelLengthM: field(10, "datasheet_verified", "паспорт серии"),
      cutStepMm: field(50, "datasheet_verified", "паспорт серии"),
    };
    const { spec: next, application } = applyPassportToSpec(spec, verified);
    expect(next.wPerMeter).toBe(9.6);
    expect(next.reelMeters).toBe(10);
    expect(application.applied).toEqual(["voltageDc", "maxPowerWm", "reelLengthM"]);
    expect(application.verified).toBe(true);
    expect(passportIsVerified(verified)).toBe(true);
  });

  it("LED-10 · режим по этикетке не меняет unknown, паспорт меняет и обновляет ток/ватты катушки", () => {
    const raw = parseStripSpec(profile.title)!;
    const base = passportFromStripProfile(profile);
    const label = { ...base, stripMode: field("mono" as const, "label_observed", "фото") };
    expect(applyStripPassportToSpec(raw, label).spec.kind).toBe("unknown");
    expect(applyStripPassportToSpec(raw, label).application.blocked).toContain("stripMode");
    const datasheet = {
      ...base,
      stripMode: field("mono" as const, "datasheet_verified", "тестовый паспорт"),
      maxPowerWm: field(12, "datasheet_verified", "тестовый паспорт"),
      reelLengthM: field(10, "datasheet_verified", "тестовый паспорт"),
    };
    const { spec: next, application } = applyStripPassportToSpec(raw, datasheet);
    expect(next).toMatchObject({ kind: "mono", modeEvidence: "datasheet_verified", wPerMeter: 12, wattsPerReel: 120, ampsPerReel: 5 });
    expect(application.applied).toContain("stripMode");
    expect(application.verified).toBe(false); // напряжение по-прежнему лишь из заголовка.
  });

  it("label_observed (фото этикетки) всё ещё не паспорт", () => {
    const label: StripPassport = {
      ...passportFromStripProfile(profile),
      maxPowerWm: field(10, "label_observed", "фото этикетки"),
      voltageDc: field(24, "label_observed", "фото этикетки"),
      reelLengthM: field(5, "label_observed", "фото этикетки"),
    };
    expect(isVerifiedField(label.maxPowerWm)).toBe(false);
    expect(passportIsVerified(label)).toBe(false);
    expect(applyPassportToSpec(spec, label).application.applied).toEqual([]);
  });

  it("без паспорта расчёт не меняется", () => {
    const { spec: next, application } = applyPassportToSpec(spec, null);
    expect(next).toBe(spec);
    expect(application.applied).toEqual([]);
  });
});

describe("T8-012 · поиск и статусы", () => {
  const a = passportFromStripProfile({ ...profile, series: "СТАНДАРТ 140" });
  const b = passportFromStripProfile({ ...profile, series: "ПРО 160", wPerMeter: 22 });

  it("находит паспорт по серии и по вхождению в название", () => {
    expect(findPassport([a, b], "СТАНДАРТ 140")?.series).toBe("СТАНДАРТ 140");
    expect(findPassport([a, b], "светодиодная лента про 160 24v 22w")?.series).toBe("ПРО 160");
    expect(findPassport([a, b], "неизвестная серия")).toBeNull();
    expect(findPassport(null, "СТАНДАРТ 140")).toBeNull();
  });

  it("worstPassportStatus берёт самое слабое звено", () => {
    expect(worstPassportStatus(["datasheet_verified", "unknown"])).toBe("unknown");
    expect(worstPassportStatus(["datasheet_verified", "title_only"])).toBe("title_only");
    expect(worstPassportStatus([])).toBe("unknown");
  });
});

describe("T8-011 · паспорта по всему профилю", () => {
  it("серии не дублируются, а позиции без серии группируются по режиму и напряжению", () => {
    const passports = passportsFromStripProfiles([
      { series: "СТАНДАРТ 140", title: "Лента СТАНДАРТ 140 10W", voltage: 24, wPerMeter: 10, kind: "mono", reelMeters: 5 },
      { series: "СТАНДАРТ 140", title: "Лента СТАНДАРТ 140 12W", voltage: 24, wPerMeter: 12, kind: "mono", reelMeters: 5 },
      { series: null, title: "Лента RGB 14,4W", voltage: 24, wPerMeter: 14.4, kind: "rgb", reelMeters: 5 },
      { series: null, title: "Лента CCT 10.8W", voltage: 24, wPerMeter: 10.8, kind: "cct", reelMeters: 5 },
    ]);
    expect(passports.map((passport) => passport.series)).toEqual([
      "СТАНДАРТ 140",
      "RGB 24V",
      "CCT 24V",
    ]);
    for (const passport of passports) {
      expect(passportStatus(passport)).toBe("unknown"); // паспортов пока нет
    }
  });
});
