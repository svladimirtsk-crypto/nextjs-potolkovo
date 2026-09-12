export function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  if (digits.length === 11 && digits.startsWith("8")) {
    return `+7${digits.slice(1)}`;
  }

  if (digits.length === 11 && digits.startsWith("7")) {
    return `+${digits}`;
  }

  if (digits.length === 10) {
    return `+7${digits}`;
  }

  if (digits.length >= 11 && digits.length <= 15) {
    return `+${digits}`;
  }

  return value.trim();
}

/**
 * PT-004 · Валидность телефона — рядом с нормализацией, без зависимостей.
 *
 * Правило жило в двух местах: в zod-схеме сервера (`lib/lead/schema.ts`) и
 * приватной функцией внутри `components/home/action-form.tsx`. Rescue-диалогу
 * понадобилась третья копия — а три копии одного правила расходятся молча, и
 * расходится тогда именно клиентская проверка: форма пропускает номер, который
 * сервер отбивает `422`.
 *
 * Модуль намеренно без импортов: его тянут и серверная схема, и клиентские
 * компоненты, и он не должен приносить в клиентский бандл zod.
 */
export function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11 && (digits.startsWith("7") || digits.startsWith("8"))) return true;
  return digits.length >= 11 && digits.length <= 15;
}
