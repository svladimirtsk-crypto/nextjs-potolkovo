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
   * T-047 · Реквизиты продавца. PT-006: заполнены владельцем 10.09.2026.
   *
   * Владелец — плательщик налога на профессиональный доход (самозанятый), а
   * не ИП. Поэтому ОГРНИП у него не существует в принципе: этот номер
   * присваивается только при регистрации ИП. Поле оставлено пустым осознанно
   * и исключено из обязательных в `check-legal-fields.mjs` — иначе гейт
   * требовал бы номер, которого не бывает, и его пришлось бы выдумать.
   *
   * Незаполненные поля не рендерятся ни в футере, ни в политике
   * (`isLegalFieldFilled`), поэтому пустой ОГРНИП нигде не покажется.
   */
  legalName: "Сотниченко Владимир Андреевич",
  inn: "645001840941",
  ogrnip: "",
  /** Правовой статус для политики: у самозанятого нет ИП и ОГРНИП. */
  legalStatus: "Плательщик налога на профессиональный доход (самозанятый)",
} as const;

/** Реквизит заполнен владельцем, а не остался заглушкой. */
export function isLegalFieldFilled(value: string): boolean {
  return value.trim().length > 0 && !value.startsWith("TODO_OWNER");
}
