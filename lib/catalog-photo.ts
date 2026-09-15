/**
 * PT-017 (B-F109, T-323) · один источник правды про фотографию товара.
 *
 * До этого «есть ли фото» решалось в трёх местах по-разному: каталог смотрел
 * в манифест `data/catalog-images.json` (локальное превью), `ProductImage` —
 * туда же плюс внешнюю обложку, а автоподбор светильников не смотрел вовсе.
 * Здесь правило одно, и его можно проверить тестом.
 *
 * Три состояния, а не два:
 *   0 — превью скачано в `public/catalog`, картинка гарантированно покажется;
 *   1 — есть только ссылка на хост поставщика: может отработать, а может
 *       отдать 403/404 (именно поэтому T-061 и качал превью локально);
 *   2 — фото нет: обложки не было или сборщик получил вместо неё не картинку.
 *
 * Товары без фото НЕ скрываются (это требование PT-017: обязательное
 * комплектующее без фотографии остаётся обязательным комплектующим), но
 * опускаются ниже в выдаче и показываются с пометкой `PHOTO_PENDING_LABEL`.
 */
import catalogImages from "@/data/catalog-images.json";
import catalogImagesMissing from "@/data/catalog-images-missing.json";

/** Подпись на карточке и в заглушке, когда фотографии нет. */
export const PHOTO_PENDING_LABEL = "Фото уточняется";

/** Чем меньше ранг, тем выше товар в выдаче. */
export const PHOTO_RANK = {
  local: 0,
  remote: 1,
  none: 2,
} as const;

export type PhotoRankValue = (typeof PHOTO_RANK)[keyof typeof PHOTO_RANK];

/** Минимум полей, по которым решается вопрос о фото. */
export type PhotoSubject = {
  productId?: unknown;
  coverImage?: unknown;
};

/** Функция ранжирования — параметр, чтобы её можно было подменить в тесте. */
export type PhotoRanker<T = PhotoSubject> = (product: T) => number;

/** Отчёт `npm run build:catalog-images` про обложки, которые скачать не удалось. */
type MissingEntry = {
  productId?: string | null;
  vendorCode?: string | null;
  name?: string | null;
  coverImage?: string | null;
};

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/** Товары, у которых превью лежит локально (`public/catalog/{id}-{w}.webp`). */
const localPhotoIds = new Set(Object.keys(catalogImages));

// Файл сейчас пустой (`[]`), и TS выводит для него `never[]` — приводим к форме
// отчёта, чтобы код не ломался, когда сборщик снова напишет туда неудачи.
const missingReport = catalogImagesMissing as unknown as readonly MissingEntry[];

/** Обложки, которые сборщик уже пробовал скачать и получил не картинку. */
const knownBadCovers = new Set(
  missingReport.map((entry) => text(entry.coverImage)).filter(Boolean),
);
const knownBadIds = new Set(
  missingReport.map((entry) => text(entry.productId)).filter(Boolean),
);

/**
 * Сборка ранжирующей функции из трёх наборов данных.
 *
 * Вынесено отдельно, чтобы правило можно было проверить тестом на выдуманных
 * наборах: реальный отчёт `catalog-images-missing.json` сейчас пуст, и ветку
 * «обложка известна как битая» на живых данных не поймать.
 */
export function createPhotoRanker(
  localIds: ReadonlySet<string>,
  badCovers: ReadonlySet<string>,
  badIds: ReadonlySet<string>,
): PhotoRanker {
  return function rankPhoto(product: PhotoSubject): PhotoRankValue {
    const id = text(product?.productId);
    if (id && localIds.has(id)) return PHOTO_RANK.local;

    const cover = text(product?.coverImage);
    if (!cover) return PHOTO_RANK.none;
    // Обложка есть, но сборщик её уже не скачал — значит, хост отдаёт не картинку.
    if (badCovers.has(cover) || (id.length > 0 && badIds.has(id))) return PHOTO_RANK.none;

    return PHOTO_RANK.remote;
  };
}

/** Локальное превью есть — картинка покажется независимо от хоста поставщика. */
export function hasLocalPhoto(productId: unknown): boolean {
  const id = text(productId);
  return id.length > 0 && localPhotoIds.has(id);
}

/** Состояние фотографии товара: 0 — локальная, 1 — только внешняя, 2 — нет. */
export const photoRank: PhotoRanker = createPhotoRanker(
  localPhotoIds,
  knownBadCovers,
  knownBadIds,
);

/**
 * Фотографии нет вовсе — карточка получит пометку «Фото уточняется».
 *
 * Внешняя обложка, которую не проверяли сборщиком, сюда не попадает: её
 * сначала пробуем показать, а если браузер получит ошибку — `ProductImage`
 * сам переключится на заглушку с той же пометкой.
 */
export function isPhotoPending(product: PhotoSubject): boolean {
  return photoRank(product) === PHOTO_RANK.none;
}

/**
 * Устойчивая сортировка «сначала те, у кого фото получше».
 *
 * Порядок внутри одной группы сохраняется — цена, наличие и релевантность
 * поиска не перемешиваются, меняется только приоритет показа.
 */
export function sortByPhoto<T extends PhotoSubject>(
  list: readonly T[],
  rank: PhotoRanker<T> = photoRank,
): T[] {
  return [...list].sort((a, b) => rank(a) - rank(b));
}

/** Сколько товаров в каждом состоянии — для отчётов и тестов на реальных данных. */
export function photoCoverage<T extends PhotoSubject>(
  products: readonly T[],
  rank: PhotoRanker<T> = photoRank,
): { total: number; local: number; remote: number; none: number } {
  const result = { total: products.length, local: 0, remote: 0, none: 0 };

  for (const product of products) {
    const value = rank(product);
    if (value <= PHOTO_RANK.local) result.local += 1;
    else if (value <= PHOTO_RANK.remote) result.remote += 1;
    else result.none += 1;
  }

  return result;
}
