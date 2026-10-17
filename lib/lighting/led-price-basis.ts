/**
 * T8-010/011 · За что именно взята цена ленты: метр, катушка или неизвестно.
 *
 * Это не косметика. Фид отдаёт только число в `<price>` и ничего о единице
 * продажи: у лент «…катушка 5 м ЧЗ» цена 970 ₽ — это цена катушки, а витрина
 * исторически помечала всю категорию как метры. Пока единица не определена,
 * корзина считает `price × метры`, и катушка за 970 ₽ превращается в
 * 970 ₽/м: 15 м стоят 14 550 ₽ вместо 3 × 970 = 2 910 ₽. Это ровно сценарий 02
 * приёмочной матрицы («цена не умножена ошибочно на 5»).
 *
 * Поэтому здесь базис цены выводится по явным признакам и всегда с указанием
 * доказательства. Чего нет в данных — остаётся `unknown`, а не «наверное метр»:
 * догадка в цене дороже честного вопроса поставщику.
 */
import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";

export type PriceBasis = "per_meter" | "per_reel" | "unknown";

/**
 * Откуда взят базис:
 *  - `title_explicit` — в названии прямо «цена за пог. м»;
 *  - `title_reel` — в названии «катушка 5 м» (цена относится к катушке);
 *  - `feed_unit` — единица пришла из данных каталога/витрины (`unit = m`);
 *  - `none` — признаков нет.
 */
export type PriceBasisEvidence = "title_explicit" | "title_reel" | "feed_unit" | "none";

export type PriceBasisInfo = {
  basis: PriceBasis;
  evidence: PriceBasisEvidence;
  /** Длина катушки из названия, если она названа. */
  reelMeters: number | null;
  /** Цена за метр, если её можно вывести из цены катушки. Для показа, не для продажи. */
  pricePerMeterRub: number | null;
  /** Продаётся целыми катушками — дробных «0,5 катушки» не бывает. */
  soldByReel: boolean;
  /** Человеческое объяснение для интерфейса и заявки. */
  note: string;
};

type PriceBasisInput = Pick<FeedCatalogProduct, "name"> &
  Partial<Pick<FeedCatalogProduct, "unit" | "priceRub">>;

const num = (value: string | undefined): number | null => {
  if (!value) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};

/** Явная цена за погонный метр: «цена за пог м», «цена за пог.м», «за метр». */
const PER_METER_MARKER = /цена\s+за\s+(?:пог\.?\s*)?м(?:етр)?/i;
/**
 * «катушка 5 м», «катушка 5м», «катушка 10 м».
 *
 * Кириллица не входит в `\w`, поэтому хвост слова описан диапазоном букв:
 * шаблон с `\w` после «катушк» не совпал бы с «катушка» и молча вернул бы
 * «неизвестно».
 */
const REEL_MARKER = /катушк[а-яёa-z]*\s*(\d+(?:[.,]\d+)?)\s*м/i;

export function resolvePriceBasis(input: PriceBasisInput): PriceBasisInfo {
  const name = String(input.name ?? "");
  const price = typeof input.priceRub === "number" && Number.isFinite(input.priceRub) ? input.priceRub : null;

  if (PER_METER_MARKER.test(name)) {
    return {
      basis: "per_meter",
      evidence: "title_explicit",
      reelMeters: num(name.match(REEL_MARKER)?.[1]),
      pricePerMeterRub: price,
      soldByReel: false,
      note: "Цена за погонный метр — указано в названии позиции.",
    };
  }

  const reelMatch = name.match(REEL_MARKER);
  if (reelMatch) {
    const reelMeters = num(reelMatch[1]);
    return {
      basis: "per_reel",
      evidence: "title_reel",
      reelMeters,
      pricePerMeterRub: price !== null && reelMeters && reelMeters > 0 ? Math.round((price / reelMeters) * 100) / 100 : null,
      soldByReel: true,
      note: `Цена за катушку ${reelMeters ?? "?"} м — катушка не делится, продаётся целой.`,
    };
  }

  if (input.unit === "m") {
    return {
      basis: "per_meter",
      evidence: "feed_unit",
      reelMeters: null,
      pricePerMeterRub: price,
      soldByReel: false,
      note: "Витрина отдаёт позицию в метрах; цена считается за метр — подтвердить у поставщика.",
    };
  }

  return {
    basis: "unknown",
    evidence: "none",
    reelMeters: null,
    pricePerMeterRub: null,
    soldByReel: false,
    note: "Единица продажи и цена за единицу не подтверждены — уточнить у поставщика.",
  };
}

/**
 * Единица продажи для корзины.
 *
 * Возвращает `null`, если решать нельзя (не LED-позиция). Для катушки — `pcs`,
 * чтобы количество не умножалось на метры. Для остальных лент сохраняется
 * текущее поведение (`m`), потому что переключать всю витрину на штуки без
 * подтверждённого базиса значило бы сломать уже понятную цену за метр.
 */
export function stripSaleUnit(info: PriceBasisInfo): "m" | "pcs" {
  return info.soldByReel ? "pcs" : "m";
}

/**
 * Количество к покупке для ленты.
 *
 * `installedMeters` — установленная длина (уже с рядами). Для катушки считаем
 * целые катушки; для метража — точный метраж (можно дробный); при неизвестном
 * базисе — консервативно вверх до целых метров.
 */
export function stripPurchaseQty(input: {
  installedMeters: number;
  basis: PriceBasisInfo;
}): { qty: number; unit: "m" | "pcs"; roundedMeters: number | null } {
  const { installedMeters, basis } = input;
  if (!(installedMeters > 0)) return { qty: 0, unit: stripSaleUnit(basis), roundedMeters: null };

  if (basis.basis === "per_reel" && basis.reelMeters && basis.reelMeters > 0) {
    const reels = Math.ceil(installedMeters / basis.reelMeters);
    return { qty: reels, unit: "pcs", roundedMeters: Math.round(reels * basis.reelMeters * 100) / 100 };
  }

  if (basis.basis === "per_meter") {
    const meters = Math.round(installedMeters * 10) / 10;
    return { qty: meters, unit: "m", roundedMeters: meters };
  }

  // Неизвестный базис: округляем вверх до целых метров, чтобы не продать 0,4 м.
  const meters = Math.ceil(installedMeters);
  return { qty: meters, unit: "m", roundedMeters: meters };
}
