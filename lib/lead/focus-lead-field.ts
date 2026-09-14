/**
 * PT-013 · Фокус на первом проблемном поле формы.
 *
 * Подсветки поля недостаточно: форма заявки длинная (имя, телефон, адрес,
 * получение, время, согласие, кнопка), и после отказа сервера первое ошибочное
 * поле может оставаться за пределами экрана. Человек видит плашку, но не видит,
 * что именно исправлять. `focus()` прокручивает поле в область видимости и
 * передаёт управление скринридеру вместе с `aria-invalid`/`aria-describedby`.
 *
 * Модуль не про React: принимает любой `ParentNode`, поэтому тестируется без
 * рендера и работает и для формы на странице, и для формы внутри модалки.
 */
import type { LeadFormField } from "./failure-view";

/** Селектор поля формы по имени из zod-ответа. */
const FIELD_SELECTORS: Record<LeadFormField, string> = {
  name: '[data-testid="lead-name"]',
  phone: '[data-testid="lead-phone"]',
  address: '[data-testid="lead-address"]',
  consent: '[data-testid="lead-consent"]',
  // Радио «Когда удобно» — первая опция группы.
  preferredTime: 'input[name="preferredTime"]',
};

/**
 * Ставит фокус на поле. Молча ничего не делает, если поля в DOM нет: форма
 * существует в нескольких вариантах (страница услуги, модалка калькулятора),
 * и не все поля есть в каждом. Ошибка фокуса не должна ломать показ отказа.
 */
export function focusLeadField(
  root: ParentNode | null | undefined,
  field: LeadFormField | null | undefined
): boolean {
  if (!root || !field) return false;

  const selector = FIELD_SELECTORS[field];
  if (!selector) return false;

  const element = root.querySelector<HTMLElement>(selector);
  if (!element || typeof element.focus !== "function") return false;

  element.focus();
  return true;
}

/**
 * PT-013 · ARIA-атрибуты поля с ошибкой.
 *
 * Подсветка цветом — не единственный канал: скринридер должен знать, что поле
 * заполнено неверно, и уметь перейти к тексту ошибки. Возвращает пустой объект,
 * если ошибки нет, — тогда атрибуты просто не попадают в DOM.
 */
export function leadFieldAriaProps(
  field: LeadFormField,
  errors: Partial<Record<LeadFormField, string>>
): { "aria-invalid"?: "true"; "aria-describedby"?: string } {
  if (!errors[field]) return {};

  return {
    "aria-invalid": "true",
    "aria-describedby": `lead-${field}-error`,
  };
}
