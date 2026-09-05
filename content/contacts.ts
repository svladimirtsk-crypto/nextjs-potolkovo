export const contacts = {
  brandName: "ПОТОЛКОВО",
  brandShortName: "ПОТОЛКОВО",

  cityLabel: "Москва",
  regionLabel: "Москва и Московская область",

  phoneDisplay: "+7 905 521 99 09",
  phoneHref: "tel:+79055219909",

  telegramDisplay: "Написать в Telegram",
  telegramUrl: "https://t.me/potolkovo_msk",

  emailDisplay: "potolkovo_msk@mail.ru",
  emailHref: "mailto:potolkovo_msk@mail.ru",

  workingHoursLabel: "Пн — Вс / 9:00 — 21:00",

  /**
   * T-047 · Реквизиты продавца.
   *
   * Значения `TODO_OWNER` заполняет владелец перед релизом — публиковать
   * выдуманные ИНН/ОГРНИП нельзя. Незаполненные поля не рендерятся, а
   * `npm run check:legal` роняет сборку релиза, чтобы про них не забыли.
   */
  legalName: "TODO_OWNER",
  inn: "TODO_OWNER",
  ogrnip: "TODO_OWNER",
} as const;

/** Реквизит заполнен владельцем, а не остался заглушкой. */
export function isLegalFieldFilled(value: string): boolean {
  return value.trim().length > 0 && !value.startsWith("TODO_OWNER");
}
