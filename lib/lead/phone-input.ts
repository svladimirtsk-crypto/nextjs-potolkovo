/**
 * PT-013 · Маска ввода телефона — вынесена из `components/home/action-form.tsx`.
 *
 * Поведение не менялось (T-015: маска +7 (___) ___-__-__ без внешних
 * зависимостей). Вынос понадобился по двум причинам:
 *
 *  1. `action-form.tsx` зафиксирован в LEGACY_BUDGET стража размера файлов —
 *     добавлять в него строки нельзя, а PT-013 добавляет обработку состояний
 *     ошибки. Маска — ровно тот кусок, который к состояниям ошибки отношения
 *     не имеет и честно живёт в чистом модуле.
 *  2. Функцию можно покрыть тестами без рендера формы.
 *
 * Модуль чистый: ни React, ни DOM, ни `content/*`.
 */

/**
 * Приводит ввод к маске `+7 (___) ___-__-__`.
 *
 * `8` в начале заменяется на `7`, отсутствующая `7` добавляется — человек
 * может диктовать номер как угодно, а в payload всегда уходит один формат.
 */
export function formatPhoneInput(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits[0] === "8") digits = `7${digits.slice(1)}`;
  if (digits[0] !== "7") digits = `7${digits}`;
  digits = digits.slice(0, 11);

  const rest = digits.slice(1);
  let out = "+7";
  if (rest.length > 0) out += ` (${rest.slice(0, 3)}`;
  if (rest.length >= 3) out += ") ";
  if (rest.length > 3) out += rest.slice(3, 6);
  if (rest.length > 6) out += `-${rest.slice(6, 8)}`;
  if (rest.length > 8) out += `-${rest.slice(8, 10)}`;
  return out;
}
