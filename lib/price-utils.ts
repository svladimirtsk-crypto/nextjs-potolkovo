/**
 * Форматирует цену в рублях
 */
export function formatPrice(price: number | null): string {
  if (price === null) return "по запросу";
  return `${Math.round(price).toLocaleString("ru-RU")} ₽`;
}

/**
 * Рассчитывает цену со скидкой
 */
export function calcDiscountedPrice(
  price: number | null,
  discountPercent: number
): number | null {
  if (price === null) return null;
  return Math.round(price * (1 - discountPercent / 100));
}
