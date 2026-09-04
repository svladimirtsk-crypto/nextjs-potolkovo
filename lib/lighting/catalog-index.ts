/**
 * T-029 · Лёгкий каталог для клиента.
 *
 * Клиентские компоненты не импортируют `data/eks-feed2-snapshot.json` (~940 КБ) —
 * вместо этого они дожидаются `getCatalogIndex()`, который подгружает
 * `data/catalog-index.json` (~105 КБ) динамическим `import()`. Файл собирает
 * `scripts/build-catalog-index.mjs` на этапе `prebuild`.
 */
import type {
  FeedCatalogKind,
  FeedCatalogSystem,
  FeedCatalogUnit,
} from "@/lib/eks-feed2-catalog";
import type { LampSocket } from "@/lib/catalog-ui-config";

/** Товар в облегчённом виде: только то, что нужно UI каталога. */
export type CatalogIndexProduct = {
  productId: string;
  vendorCode: string;
  name: string;
  priceRub: number;
  available: boolean;
  system: FeedCatalogSystem;
  kind: FeedCatalogKind;
  unit: FeedCatalogUnit;
  pieceLengthMeters: number | null;
  socket: LampSocket | null;
  coverImage: string;
};

export type CatalogIndex = {
  updatedAt: string;
  discountPercentForCeilingOrder: number | null;
  products: CatalogIndexProduct[];
};

/** Данные для быстрого префилла: артикул → вид, система, длина в мм. */
export type CatalogPrefillEntry = {
  kind: FeedCatalogKind;
  system: FeedCatalogSystem;
  lengthMm: number | null;
};

export type CatalogPrefill = Record<string, CatalogPrefillEntry>;

/** Сырой формат файла — кортежи плюс словари, см. build-catalog-index.mjs. */
type RawRow = [
  productId: string,
  vendorCode: string,
  name: string,
  priceRub: number,
  available: number,
  systemId: number,
  kindId: number,
  unitId: number,
  pieceLengthMeters: number | null,
  socketId: number,
  coverImage: string,
];

type RawIndexFile = {
  updatedAt: string;
  discountPercentForCeilingOrder: number | null;
  imagePrefix: string;
  dictionaries: {
    system: string[];
    kind: string[];
    unit: string[];
    socket: string[];
  };
  rows: RawRow[];
};

type RawPrefillFile = {
  dictionaries: { kind: string[]; system: string[] };
  items: Record<string, [kindId: number, systemId: number, lengthMm: number | null]>;
};

function lookup(dictionary: string[], id: number): string {
  return id >= 0 && id < dictionary.length ? dictionary[id] : "";
}

function decodeIndex(raw: RawIndexFile): CatalogIndex {
  const { dictionaries: dict, imagePrefix } = raw;

  return {
    updatedAt: raw.updatedAt,
    discountPercentForCeilingOrder: raw.discountPercentForCeilingOrder,
    products: raw.rows.map((row) => {
      const cover = row[10];
      const socket = lookup(dict.socket, row[9]);

      return {
        productId: row[0],
        vendorCode: row[1],
        name: row[2],
        priceRub: row[3],
        available: row[4] === 1,
        system: lookup(dict.system, row[5]) as FeedCatalogSystem,
        kind: lookup(dict.kind, row[6]) as FeedCatalogKind,
        unit: lookup(dict.unit, row[7]) as FeedCatalogUnit,
        pieceLengthMeters: row[8],
        socket: socket ? (socket as LampSocket) : null,
        // Общий префикс вырезан при сборке — возвращаем абсолютный URL.
        coverImage: cover && !cover.startsWith("http") ? `${imagePrefix}${cover}` : cover,
      };
    }),
  };
}

/** Мемоизируем промис, а не результат: параллельные вызовы грузят файл один раз. */
let indexPromise: Promise<CatalogIndex> | null = null;
let prefillPromise: Promise<CatalogPrefill> | null = null;

export function getCatalogIndex(): Promise<CatalogIndex> {
  if (!indexPromise) {
    indexPromise = import("@/data/catalog-index.json")
      .then((module) => decodeIndex((module.default ?? module) as unknown as RawIndexFile))
      .catch((error: unknown) => {
        // Сбрасываем кэш, чтобы следующий вызов мог повторить попытку.
        indexPromise = null;
        throw error;
      });
  }
  return indexPromise;
}

export function getCatalogPrefill(): Promise<CatalogPrefill> {
  if (!prefillPromise) {
    prefillPromise = import("@/data/catalog-prefill.json")
      .then((module) => {
        const raw = (module.default ?? module) as unknown as RawPrefillFile;
        const result: CatalogPrefill = {};

        for (const [sku, entry] of Object.entries(raw.items)) {
          result[sku] = {
            kind: lookup(raw.dictionaries.kind, entry[0]) as FeedCatalogKind,
            system: lookup(raw.dictionaries.system, entry[1]) as FeedCatalogSystem,
            lengthMm: entry[2],
          };
        }
        return result;
      })
      .catch((error: unknown) => {
        prefillPromise = null;
        throw error;
      });
  }
  return prefillPromise;
}

/** Для тестов: сбрасывает мемоизацию между кейсами. */
export function resetCatalogIndexForTests(): void {
  indexPromise = null;
  prefillPromise = null;
}
