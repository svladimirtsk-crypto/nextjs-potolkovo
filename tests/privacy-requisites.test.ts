import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { contacts, isLegalFieldFilled } from "../content/contacts";

/**
 * PT-006 · Реквизиты оператора персональных данных.
 *
 * На живом сайте в разделе «Оператор персональных данных» стояло
 * «Наименование: TODO_OWNER» — служебная метка для разработчика в документе,
 * который предъявляется как юридический.
 *
 * Причина была в половинчатой защите: футер прятал незаполненные поля через
 * `isLegalFieldFilled`, а страница политики подставляла значения как есть.
 * Такая защита хуже отсутствующей: выглядит как реквизиты, но ими не является.
 */
const ROOT = path.resolve(import.meta.dirname, "..");

/** Файлы, которые показывают реквизиты клиенту. */
const PUBLIC_SURFACES = ["app/privacy/page.tsx", "components/home/home-footer.tsx"];

describe("публикация реквизитов", () => {
  it("ни одна публичная поверхность не выводит поле без проверки заполненности", () => {
    /**
     * Проверяем не текст, а способ: любое обращение к `contacts.legalName`
     * и соседям должно проходить через `isLegalFieldFilled`. Иначе очередная
     * новая страница повторит ту же ошибку.
     */
    for (const file of PUBLIC_SURFACES) {
      const source = readFileSync(path.join(ROOT, file), "utf8");
      if (!/contacts\.(legalName|inn|ogrnip)/.test(source)) continue;

      expect(source, `${file} печатает реквизиты без проверки`).toContain("isLegalFieldFilled");
    }
  });

  it("isLegalFieldFilled отличает заглушку от настоящего значения", () => {
    expect(isLegalFieldFilled("TODO_OWNER")).toBe(false);
    expect(isLegalFieldFilled("")).toBe(false);
    expect(isLegalFieldFilled("   ")).toBe(false);
    expect(isLegalFieldFilled("ИП Иванов Владимир Сергеевич")).toBe(true);
    expect(isLegalFieldFilled("770123456789")).toBe(true);
  });

  it("реквизиты заполнены либо все, либо ни одного", () => {
    /**
     * Тест намеренно не требует заполненности: данные даёт владелец, а
     * выдуманный ИНН хуже отсутствующего (правило 5 ТЗ). Но частично
     * заполненный набор — почти наверняка ошибка: в документе появится
     * наименование без ИНН, и это выглядит как попытка что-то скрыть.
     */
    const filled = [contacts.legalName, contacts.inn, contacts.ogrnip].filter(isLegalFieldFilled);

    expect(filled.length === 0 || filled.length === 3).toBe(true);
  });
});
