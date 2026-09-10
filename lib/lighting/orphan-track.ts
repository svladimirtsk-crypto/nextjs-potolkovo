/**
 * N-051 · Что делать с трековыми позициями, когда трек «выключен».
 *
 * Исходное поведение T-024: пока на Шаге 0 не выбран трек
 * (`requiredTrackMeters === 0`), эффект удалял из корзины любую трековую
 * позицию. Для входа «сначала свет» удаление уже было заменено на
 * предупреждение, а для обычного входа осталось молчаливым — и ловило не то,
 * что задумано.
 *
 * Симптом: клиент открывает каталог Шага 1, жмёт «+» на трековом светильнике,
 * а счётчик остаётся на нуле. Товар показан как доступный, отказа никто не
 * объясняет. Добавление выглядит сломанным.
 *
 * Различие, которого не хватало, — между двумя разными ситуациями:
 *
 *  1. Клиент поменял параметры Шага 0 и трек стал не нужен. Позиции в корзине
 *     остались от прежнего выбора — их разумно убрать автоматически.
 *  2. Трек не выбран давно, и клиент прямо сейчас осознанно кладёт трековую
 *     позицию руками. Удалять её нельзя: это прямое действие пользователя.
 *
 * Отличает их не состав корзины, а *переход* требуемого метража в ноль.
 */

export type OrphanTrackDecision = "drop" | "warn" | "none";

export function decideOrphanTrackAction(input: {
  /** Метраж трека, заданный на Шаге 0 сейчас. */
  requiredTrackMeters: number;
  /** Тот же метраж на предыдущем рендере. */
  previousRequiredTrackMeters: number;
  /** Сколько трековых позиций сейчас в корзине. */
  orphanCount: number;
  /** Вход «сначала свет»: набор собран до калькулятора. */
  isLightingFirst: boolean;
}): OrphanTrackDecision {
  const { requiredTrackMeters, previousRequiredTrackMeters, orphanCount, isLightingFirst } = input;

  if (orphanCount === 0) return "none";
  // Трек нужен — позиции на своём месте.
  if (requiredTrackMeters > 0) return "none";

  // Набор пришёл из каталога: молча трогать чужую работу нельзя.
  if (isLightingFirst) return "warn";

  // Трек только что «выключили» на Шаге 0 — убираем то, что осталось от него.
  const trackWasJustDisabled = previousRequiredTrackMeters > 0;
  if (trackWasJustDisabled) return "drop";

  // Трека не было и раньше: значит позиции добавлены руками. Объясняем.
  return "warn";
}

import type { CartEntry } from "@/lib/lighting/cart-derived";
import { CLARUS_PSU_VENDOR_CODES } from "@/lib/catalog-ui-config";
import { toText } from "@/lib/feed2-snapshot-normalize";
import { calcTrackProfileMeters } from "@/lib/product-length-meters";

/**
 * Трековые позиции корзины, когда трек на Шаге 0 не заказан. Блоки питания
 * CLARUS считаем вместе с ними: без трека они тоже бессмысленны.
 */
export function selectOrphanTrackEntries(
  cartEntries: CartEntry[],
  requiredTrackMeters: number
): CartEntry[] {
  if (requiredTrackMeters > 0) return [];

  const clarusPsuVendorCodes = new Set<string>(CLARUS_PSU_VENDOR_CODES);
  return cartEntries.filter(({ product }) => {
    const isTrackProduct =
      product.kind === "TRACK_PROFILE" ||
      product.kind === "TRACK_FIXTURE" ||
      product.kind === "TRACK_ACCESSORY";
    return isTrackProduct || clarusPsuVendorCodes.has(toText(product.vendorCode));
  });
}

/** Сколько метров профиля висит в корзине без заказанного трека. */
export function calcOrphanTrackMeters(entries: CartEntry[]): number {
  return entries.reduce(
    (sum, entry) =>
      entry.product.kind === "TRACK_PROFILE"
        ? sum + calcTrackProfileMeters(entry.product, entry.qty)
        : sum,
    0
  );
}
