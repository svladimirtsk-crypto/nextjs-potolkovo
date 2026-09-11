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

  it("обязательные реквизиты заполнены: наименование и ИНН", () => {
    // PT-006: заполнены владельцем 10.09.2026.
    expect(isLegalFieldFilled(contacts.legalName)).toBe(true);
    expect(isLegalFieldFilled(contacts.inn)).toBe(true);
  });

  it("ИНН проходит проверку контрольных сумм ФНС", () => {
    /**
     * Опечатка в одной цифре даёт технически «похожий» номер, который
     * невозможно заметить глазами, но по которому оператора не найти.
     * Алгоритм для 12-значного ИНН физлица/самозанятого.
     */
    const digits = [...contacts.inn].map(Number);
    expect(digits).toHaveLength(12);

    const w11 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
    const w12 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
    const check11 = (w11.reduce((s, w, i) => s + w * digits[i], 0) % 11) % 10;
    const check12 = (w12.reduce((s, w, i) => s + w * digits[i], 0) % 11) % 10;

    expect(check11).toBe(digits[10]);
    expect(check12).toBe(digits[11]);
  });

  it("ОГРНИП пуст осознанно — у самозанятого его не существует", () => {
    /**
     * Номер присваивается только при регистрации ИП. Если он однажды
     * появится — значит владелец сменил статус, и это должно быть
     * осознанным изменением, а не случайно вписанной строкой.
     */
    expect(isLegalFieldFilled(contacts.ogrnip)).toBe(false);
    expect(contacts.legalStatus).toContain("самозанятый");
  });
});
