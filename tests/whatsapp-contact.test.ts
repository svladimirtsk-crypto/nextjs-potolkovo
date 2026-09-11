import { describe, expect, it } from "vitest";

import { contacts } from "../content/contacts";
import { telegramLeadLink } from "../lib/service-page-actions";

/**
 * Кнопка «Написать в WhatsApp».
 *
 * Проверки в основном про формат ссылки: `wa.me` молча не открывает диалог,
 * если в номере есть «+», пробелы или скобки. Человек нажимает кнопку и
 * видит пустой экран — ошибка, которую невозможно заметить по коду.
 */
describe("контакт WhatsApp", () => {
  it("ссылка ведёт на wa.me", () => {
    expect(contacts.whatsappUrl.startsWith("https://wa.me/")).toBe(true);
  });

  it("номер только из цифр — без плюса, пробелов и скобок", () => {
    const number = contacts.whatsappUrl.replace("https://wa.me/", "");

    expect(number).toMatch(/^\d+$/);
    // Российский номер в международном формате: 7 + десять цифр.
    expect(number).toHaveLength(11);
    expect(number.startsWith("7")).toBe(true);
  });

  it("это отдельный номер, а не телефон для звонков", () => {
    /**
     * У владельца связь разведена: звонки на один номер, мессенджер на
     * другой. Если однажды ссылку соберут из phoneHref «для порядка» —
     * сообщения уйдут в никуда.
     */
    const whatsapp = contacts.whatsappUrl.replace("https://wa.me/", "");
    const phone = contacts.phoneHref.replace("tel:+", "");

    expect(whatsapp).not.toBe(phone);
  });

  it("подпись говорит о действии, а не о названии сервиса", () => {
    expect(contacts.whatsappDisplay).toContain("Написать");
  });
});

describe("ссылка с номером заявки", () => {
  it("работает и для WhatsApp: wa.me принимает тот же параметр text", () => {
    const link = telegramLeadLink(contacts.whatsappUrl, "A1B2C");

    expect(link.startsWith("https://wa.me/")).toBe(true);
    expect(decodeURIComponent(link)).toContain("Заявка №A1B2C");
  });

  it("кириллица экранирована — иначе ссылка обрежется", () => {
    const link = telegramLeadLink(contacts.whatsappUrl, "A1B2C");

    expect(link).not.toContain("Заявка");
    expect(link).toContain("?text=");
  });

  it("без номера заявки ссылка остаётся рабочей", () => {
    // Код может не успеть прийти — написать человек хочет всё равно.
    const link = telegramLeadLink(contacts.whatsappUrl, null);

    expect(link).toContain("?text=");
    expect(decodeURIComponent(link)).not.toContain("№");
  });
});
