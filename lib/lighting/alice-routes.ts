/**
 * Маршруты управления для голосового помощника — по подтверждению владельца.
 *
 * Владелец 16.10.2026 подтвердил два пути, по которым его ассортимент реально
 * работает в умном доме:
 *
 * 1. **Любая лента — через Wi-Fi 5-в-1 контроллер** (WB5). Один контроллер
 *    закрывает монохром, CCT, RGB, RGBW и RGB+CCT.
 * 2. **SMART-трековые светильники — через панель-конвертер** КОЛИБРИ СМАРТ
 *    (конвертер Wi-Fi + панель управления для трековой системы).
 *
 * Обе формулировки — owner-verified («подтверждено владельцем на его
 * комплекте»), а не паспорт каждой позиции. Это про управление: мощность,
 * каналы и совместимость конкретного комплекта по-прежнему проверяются.
 *
 * Зачем отдельный модуль: раньше карточка писала «функции SMART нужно
 * подтвердить для этой модели», хотя маршрут уже подтверждён. Одинаково
 * неверно и обещать «всё работает», и оставлять лида без известного пути.
 */
import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";
import { isSmartProduct } from "@/lib/lighting/product-predicates";
import { nonLuminaireRole } from "@/lib/lighting/product-role";

export type AliceRouteId = "strip-5in1" | "track-converter" | "track-converter-gateway";

export type AliceRoute = {
  id: AliceRouteId;
  /** Короткая подпись для карточки. */
  label: string;
  /** Подробность: что именно подтверждено и чего это не доказывает. */
  detail: string;
};

/** Формулировка, которую используем везде: подтверждение владельца, не паспорт. */
export const OWNER_CONFIRMED = "подтверждено владельцем на его комплекте";

const STRIP_ROUTE: Omit<AliceRoute, "id"> = {
  label: "Алиса: через Wi-Fi 5-в-1",
  detail:
    `Лента работает с Алисой через Wi-Fi 5-в-1 контроллер (WB5) — ${OWNER_CONFIRMED}. ` +
    "Один 5-в-1 закрывает монохром, CCT, RGB, RGBW и RGB+CCT; ток и каналы сверяем по паспорту.",
};

const TRACK_ROUTE: Omit<AliceRoute, "id"> = {
  label: "Алиса: через панель-конвертер",
  detail:
    `SMART-светильник работает с Алисой через панель-конвертер КОЛИБРИ СМАРТ — ${OWNER_CONFIRMED}. ` +
    "Конвертер Wi-Fi и панель управления — отдельные позиции раздела «Управление».",
};

const TRACK_GATEWAY_ROUTE: Omit<AliceRoute, "id"> = {
  label: "Шлюз для Алисы",
  detail:
    `Панель-конвертер — путь, по которому SMART-светильники трека работают с Алисой; ${OWNER_CONFIRMED}. ` +
    "Это управление треком, а не светильник.",
};

/**
 * Подтверждённый маршрут к Алисе для позиции каталога.
 *
 * `null` — маршрут не подтверждён: обещать голосовое управление такой позиции
 * нельзя, карточка оставляет нейтральный текст.
 */
export function aliceRouteOf(product: FeedCatalogProduct): AliceRoute | null {
  const name = String(product.name ?? "").toLowerCase().replaceAll("ё", "е");

  // Управление треком: конвертер и панель — сам шлюз, пульты — локальное управление.
  if (nonLuminaireRole(product) === "track-control") {
    if (/конвертер|панель управления/.test(name)) {
      return { id: "track-converter-gateway", ...TRACK_GATEWAY_ROUTE };
    }
    return null;
  }

  // SMART-трековые светильники (КОЛИБРИ СМАРТ, КЛАРУС СМАРТ) — через панель-конвертер.
  if (product.kind === "TRACK_FIXTURE" && isSmartProduct(product)) {
    return { id: "track-converter", ...TRACK_ROUTE };
  }

  // Любая лента — через Wi-Fi 5-в-1.
  if (product.kind === "LED_STRIP" && /светодиодная лента/i.test(product.name)) {
    return { id: "strip-5in1", ...STRIP_ROUTE };
  }

  return null;
}

/** Подпись блока «Умный свет» в навигации каталога: что уже подтверждено, а что нет. */
export const SMART_SECTION_NOTE =
  `SMART — маркировка каталога. Маршруты к Алисе подтверждены владельцем: ` +
  `любая лента — через Wi-Fi 5-в-1, SMART-трековые светильники — через панель-конвертер (${OWNER_CONFIRMED}). ` +
  "Питание, каналы и совместимость конкретного комплекта проверим перед заказом.";
