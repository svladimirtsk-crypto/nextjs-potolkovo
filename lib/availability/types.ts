/**
 * PT-016 · Типы календаря свободных дат замера.
 *
 * Модуль намеренно без импортов: его читают и сервер (БД, роуты), и клиент
 * (хук `use-availability-label`), поэтому здесь не должно быть ни `pg`,
 * ни `lib/env`, ни `next/server`.
 */

/** Одна дата замера. `date` — строка `YYYY-MM-DD` в Europe/Moscow. */
export type AvailabilitySlot = {
  date: string;
  /** Подпись окна («утро», «после 17:00») или `null`. */
  note: string | null;
};

/** Слот в том виде, в каком его отдаёт публичный API (с готовой подписью). */
export type AvailabilitySlotView = AvailabilitySlot & {
  /** «чт 18.09» либо «чт 18.09 (утро)» — то, что видит человек. */
  display: string;
};

/** Откуда взят календарь: из БД или из запасного файла `content/availability.ts`. */
export type AvailabilitySource = "db" | "file";

/**
 * Снимок календаря.
 *
 * `label === null` означает «показывать нечего» — блок срочности на сайте
 * скрывается. Это главное свойство задачи (B-F108): просроченные даты не
 * должны молча превращаться в обещание несуществующего окна.
 */
export type AvailabilitySnapshot = {
  label: string | null;
  /** Только будущие даты, по возрастанию — то, что реально показывается. */
  slots: AvailabilitySlotView[];
  source: AvailabilitySource;
  /**
   * Заполняли ли календарь через админку. `false` при `source: "db"` быть не
   * может: пока строки настроек нет, источником считается файл.
   */
  configured: boolean;
  /** Последняя будущая дата либо `validUntil` файла — «до чего актуально». */
  validUntil: string | null;
  /** Когда календарь меняли в последний раз (ISO) — для админки и отладки. */
  updatedAt: string | null;
  /** Время формирования снимка (ISO). */
  generatedAt: string;
};
