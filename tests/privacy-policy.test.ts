/**
 * PT-014 · Версия политики конфиденциальности.
 *
 * До задачи страница `/privacy` рисовала «Дата обновления: {new Date()}» — то
 * есть дату сборки. Любой деплой «обновлял» политику без единой правки текста,
 * а привязать согласие человека к редакции было не к чему. Тесты ниже держат
 * формат версии, её разбор и сам факт, что страница берёт дату из константы.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { PRIVACY_POLICY_VERSION } from "@/content/legal";
import {
  POLICY_VERSION_PATTERN,
  formatPolicyVersionDate,
  isPolicyVersion,
  normalizePolicyVersion,
  policyVersionDate,
} from "@/lib/privacy-policy";

const privacyPage = readFileSync(new URL("../app/privacy/page.tsx", import.meta.url), "utf8");
const legalSource = readFileSync(new URL("../content/legal.ts", import.meta.url), "utf8");

describe("PT-014 · константа версии", () => {
  it("задана и соответствует формату ГГГГ-ММ-ДД[.N]", () => {
    expect(PRIVACY_POLICY_VERSION).toMatch(POLICY_VERSION_PATTERN);
  });

  it("не заглушка", () => {
    expect(PRIVACY_POLICY_VERSION).not.toMatch(/TODO|FIXME|XXXX/i);
    expect(legalSource).toContain("export const PRIVACY_POLICY_VERSION");
  });

  it("дата версии не в будущем", () => {
    const date = policyVersionDate(PRIVACY_POLICY_VERSION);
    expect(date).not.toBeNull();
    expect((date as Date).getTime()).toBeLessThanOrEqual(Date.now());
  });
});

describe("PT-014 · страница политики берёт дату из константы", () => {
  it("нет `new Date()` в дате обновления", () => {
    expect(privacyPage).toContain("formatPolicyVersionDate(PRIVACY_POLICY_VERSION)");
    expect(privacyPage).not.toContain('Дата обновления: {new Date()');
  });

  it("дата обновления вообще не строится из текущего времени", () => {
    const line = privacyPage
      .split("\n")
      .find((candidate) => candidate.includes("Дата обновления"));
    expect(line).toBeTruthy();
    expect(line).not.toMatch(/new Date|Date\.now/);
  });
});

describe("PT-014 · разбор версии", () => {
  it("распознаёт дату и дату с ревизией", () => {
    expect(isPolicyVersion("2026-09-10")).toBe(true);
    expect(isPolicyVersion("2026-09-10.2")).toBe(true);
    expect(isPolicyVersion(" 2026-09-10 ")).toBe(true);
  });

  it("отклоняет мусор и не-строки", () => {
    for (const value of ["", "v1", "2026-13-45", "10.09.2026", "null", "'; DROP TABLE leads;--"]) {
      expect(isPolicyVersion(value)).toBe(false);
      expect(normalizePolicyVersion(value)).toBeNull();
    }
    expect(normalizePolicyVersion(undefined)).toBeNull();
    expect(normalizePolicyVersion(20260910)).toBeNull();
    expect(normalizePolicyVersion(null)).toBeNull();
  });

  it("нормализация убирает пробелы", () => {
    expect(normalizePolicyVersion("  2026-09-10.2  ")).toBe("2026-09-10.2");
  });
});

describe("PT-014 · человекочитаемая дата", () => {
  it("ГГГГ-ММ-ДД → ДД.ММ.ГГГГ, ревизия отбрасывается", () => {
    expect(formatPolicyVersionDate("2026-09-10")).toBe("10.09.2026");
    expect(formatPolicyVersionDate("2026-09-10.2")).toBe("10.09.2026");
    expect(formatPolicyVersionDate("2026-01-05")).toBe("05.01.2026");
  });

  it("нераспознанная строка возвращается как есть, а не падает", () => {
    expect(formatPolicyVersionDate("вчерась")).toBe("вчерась");
  });

  it("policyVersionDate даёт UTC-дату или null", () => {
    expect(policyVersionDate("2026-09-10")?.toISOString()).toBe("2026-09-10T00:00:00.000Z");
    expect(policyVersionDate("не дата")).toBeNull();
  });
});
