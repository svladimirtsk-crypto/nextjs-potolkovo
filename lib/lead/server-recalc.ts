/**
 * PT-010 · Серверный пересчёт цены заявки (ТЗ, стр. 161; источники A-08/F-10, A-10, T-311).
 *
 * До этой задачи `/api/lead` записывал сумму, которую прислал браузер:
 *
 * ```ts
 * const grandTotal = payload.snapshot?.totals.grand ?? payload.totals?.grand ?? payload.grandTotal ?? 0;
 * ```
 *
 * `priceRub`, `discountPercentApplied` и `totals.grand` приходили в теле
 * запроса и принимались как есть. Любой, кто откроет DevTools, мог отправить
 * заявку на 1 ₽ и получить её в БД и в письме мастеру как авторитетную цифру.
 *
 * Здесь сервер извлекает из снапшота только **параметры** (тип потолка,
 * площадь, метраж профиля/трека/карниза, SKU и количества света) и считает
 * сумму теми же чистыми модулями, которыми считает клиент:
 * `calcRoomSnapshotV2` + `selectTotals` (`content/pricing.ts` через
 * `homepage.price.calculator`, ставки которых охраняет `tests/pricing.test.ts`)
 * и `lib/lighting-formulas` для скидки. Цены позиций берутся из каталога, а не
 * из payload.
 *
 * Клиентская сумма остаётся в заявке только для сверки: расхождение больше
 * `PRICE_MISMATCH_THRESHOLD_PCT` помечается и логируется, но лид не блокирует —
 * цена могла честно разойтись (прайс обновили между расчётом и
 * отправкой), и терять из-за этого контакт человека нельзя.
 *
 * Модуль не ходит в сеть и не читает `process.env`: на входе payload и список
 * товаров каталога, на выходе — результат. Каталог подставляет вызывающий
 * (`recalculateLeadPrice` грузит его сам), поэтому всю арифметику можно
 * проверить тестом без БД и без моков.
 */
import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";
import { toNumber, toText } from "@/lib/feed2-snapshot-normalize";
import { calcRoomSnapshotV2, roomConfigFromBreakdown, type V2RoomConfig } from "@/lib/calculator/room-snapshot";
import { selectTotals, type LightingSelection } from "@/lib/calculator/selectors";
import {
  LIGHTING_ONLY_DISCOUNT_PERCENT,
  LIGHTING_WITH_CEILING_DISCOUNT_PERCENT,
  applyLightingOnlyDiscount,
  applyLightingWithCeilingDiscount,
  calcLightingDiscountAmount,
} from "@/lib/lighting-formulas";
import {
  buildCartEntries,
  calcSelectedPointQty,
  calcSelectedTrackMeters,
  type CartEntry,
} from "@/lib/lighting/cart-derived";
import { REMOVED_COLIBRI_VENDOR_CODES } from "@/lib/catalog-ui-config";
import { getCatalogLookupProducts, getCatalogProducts } from "@/lib/lighting/catalog-products";

import {
  METER_UNIT,
  type LeadPayload,
  type LeadRoomSnapshot,
  type LeadSnapshotV2,
  type LeadTotals,
  type LightingLeadBlock,
  type LightingLeadItem,
} from "./schema";

/** Порог сверки из ТЗ: больше 1 % — расхождение, о котором нужно знать. */
export const PRICE_MISMATCH_THRESHOLD_PCT = 1;

export type PriceIssueCode =
  /** Снапшота нет (rescue/direct): пересчитывать нечего, сумма клиента не проверена. */
  | "no-snapshot"
  /** Комната прислана старым клиентом: конфиг восстановлен по лейблам. */
  | "legacy-room-snapshot"
  /** Позиция снята с продажи или недоступна — цена есть, но товара нет. */
  | "unavailable-product"
  /** Цена позиции в заявке не совпала с каталогом (в расчёт пошла каталожная). */
  | "client-price-deviation"
  /** Клиент заявил скидку «с потолком», но потолка в заявке нет. */
  | "discount-mode-downgraded"
  /** Серверная сумма разошлась с клиентской больше порога. */
  | "price-mismatch";

export type PriceIssue = {
  code: PriceIssueCode;
  message: string;
  sku?: string;
};

/**
 * Итог сверки.
 *
 * - `verified` — сервер посчитал то же, что клиент (в пределах порога);
 * - `mismatch` — суммы разошлись, в БД и в письме серверное число;
 * - `unverified` — пересчитать нечего (нет снапшота) или пересчёт упал.
 */
export type PriceCheckStatus = "verified" | "mismatch" | "unverified";

export type PriceCheck = {
  status: PriceCheckStatus;
  /** Что видел клиент. */
  clientGrand: number;
  /** Что посчитал сервер; `null`, если пересчёт невозможен. */
  serverGrand: number | null;
  /** Отклонение в процентах от клиентской суммы. */
  deltaPct: number | null;
  thresholdPct: number;
  issues: PriceIssue[];
};

/** Снапшот, который уходит в БД: клиентский состав + результат сверки. */
export type StoredLeadSnapshot = LeadSnapshotV2 & { priceCheck?: PriceCheck };

export type LeadRejectionCode = "unknown_sku" | "fractional_qty";

export type LeadRejection = {
  code: LeadRejectionCode;
  message: string;
  sku?: string;
};

export type RecalcAccepted = {
  ok: true;
  priceCheck: PriceCheck;
  /** Заявка в том виде, в котором её нужно сохранить и отправить мастеру. */
  payload: LeadPayload;
  snapshot: StoredLeadSnapshot | null;
  totals: LeadTotals | null;
  /** Авторитетная сумма для колонки `leads.grand_total`. */
  grandTotal: number;
};

export type RecalcRejected = { ok: false; rejection: LeadRejection };

export type RecalcResult = RecalcAccepted | RecalcRejected;

/** Сумма, которую клиент считал авторитетной (прежнее выражение из route.ts). */
export function clientGrandTotalOf(payload: LeadPayload): number {
  return toNumber(
    payload.snapshot?.totals.grand ?? payload.totals?.grand ?? payload.grandTotal ?? 0
  );
}

type CatalogLookup = {
  productsById: Map<string, FeedCatalogProduct>;
  productsByVendorCode: Map<string, FeedCatalogProduct>;
};

/** Индексы для резолва позиций: по `productId` и по артикулу поставщика. */
function buildCatalogLookup(products: readonly FeedCatalogProduct[]): CatalogLookup {
  return {
    productsById: new Map(products.map((product) => [toText(product.productId), product])),
    productsByVendorCode: new Map(
      products
        .map((product) => [toText(product.vendorCode), product] as const)
        .filter(([code]) => Boolean(code))
    ),
  };
}

type MergedLightingItem = {
  item: LightingLeadItem;
  product: FeedCatalogProduct;
  qty: number;
};

/**
 * Позиции света → серверные цены и количества.
 *
 * Резолвим по `sku` (= `productId`), а если не нашли — по `vendorCode`:
 * артикул поставщика человек видит в каталоге, и старый или сторонний клиент
 * мог положить его в `sku`. Не резолвится ни то, ни другое — заявка
 * отклоняется: считать нечего, а принимать цену клиента как раз нельзя.
 */
function mergeLightingItems(
  items: readonly LightingLeadItem[],
  lookup: CatalogLookup,
  issues: PriceIssue[]
): MergedLightingItem[] | LeadRejection {
  const { productsById, productsByVendorCode } = lookup;
  const merged = new Map<string, MergedLightingItem>();

  for (const item of items) {
    const sku = toText(item.sku);
    const vendorCode = toText(item.vendorCode);
    const product =
      productsById.get(sku) ??
      productsByVendorCode.get(vendorCode) ??
      // Старый или сторонний клиент мог положить артикул поставщика в `sku`.
      productsByVendorCode.get(sku);

    if (!product) {
      return {
        code: "unknown_sku",
        sku: sku || vendorCode || undefined,
        message: "Позиция не найдена в каталоге",
      };
    }

    const productId = toText(product.productId);
    const unit = toText(product.unit) || toText(item.unit);
    const qty = toNumber(item.qty);

    /**
     * Дробное количество штучного товара. Клиент так прислать не может
     * (`normalizeQty` округляет штуки до целого), поэтому дробь здесь —
     * признак изменённого запроса. Метражный товар (`unit === "m"`) дробным
     * бывает законно: 2.5 м профиля — нормальная позиция.
     */
    if (unit !== METER_UNIT && !Number.isInteger(qty)) {
      return {
        code: "fractional_qty",
        sku: productId || undefined,
        message: "Дробное количество штучного товара",
      };
    }

    if (!product.available || REMOVED_COLIBRI_VENDOR_CODES.has(toText(product.vendorCode))) {
      issues.push({
        code: "unavailable-product",
        sku: productId || undefined,
        message: `«${toText(product.name)}» недоступен к заказу — позиция принята по каталожной цене`,
      });
    }

    const priceRub = toNumber(product.priceRub);
    const clientPrice = toNumber(item.priceRub);
    if (Math.abs(priceRub - clientPrice) > 0.5) {
      issues.push({
        code: "client-price-deviation",
        sku: productId || undefined,
        message: `Цена «${toText(product.name)}» в заявке ${clientPrice} ₽, в каталоге ${priceRub} ₽ — в расчёт пошла каталожная`,
      });
    }

    const existing = merged.get(productId);
    if (existing) {
      existing.qty += qty;
      continue;
    }

    merged.set(productId, { item, product, qty });
  }

  return [...merged.values()].filter((entry) => entry.qty > 0);
}

function lightingBlockFrom(
  source: LightingLeadBlock,
  entries: MergedLightingItem[],
  regularTotal: number,
  effectiveTotal: number,
  discountMode: LightingSelection["discountMode"],
  discountPercentApplied: number
): LightingLeadBlock {
  const items: LightingLeadItem[] = entries.map(({ item, product, qty }) => {
    const priceRub = toNumber(product.priceRub);
    return {
      ...item,
      sku: toText(product.productId),
      vendorCode: toText(product.vendorCode) || item.vendorCode,
      name: toText(product.name) || item.name,
      qty,
      priceRub,
      totalRub: Math.round(priceRub * qty * 100) / 100,
      system: toText(product.system) || item.system,
      kind: toText(product.kind) || item.kind,
      unit: toText(product.unit) || item.unit,
    };
  });

  return {
    ...source,
    items,
    regularTotalRub: regularTotal,
    effectiveTotalRub: effectiveTotal,
    discountMode,
    discountPercentApplied,
    discountAmountRub: calcLightingDiscountAmount(regularTotal, effectiveTotal),
  };
}

/**
 * Пересчёт по уже загруженному каталогу. Чистая функция — ядро задачи,
 * всё сетевое и всё про флаги остаётся снаружи.
 */
export function recalculateLeadPriceWithCatalog(
  payload: LeadPayload,
  products: readonly FeedCatalogProduct[],
  lookupProducts: readonly FeedCatalogProduct[] = products
): RecalcResult {
  const clientGrand = clientGrandTotalOf(payload);
  const snapshot = payload.snapshot ?? null;

  if (!snapshot) {
    /**
     * Rescue-лид и заявка «напрямую» снапшота не имеют: состав не прислан,
     * пересчитывать нечего. Клиентская сумма остаётся, но помечается как
     * непроверенная — именно так она и должна читаться в CRM.
     */
    return {
      ok: true,
      priceCheck: {
        status: "unverified",
        clientGrand,
        serverGrand: null,
        deltaPct: null,
        thresholdPct: PRICE_MISMATCH_THRESHOLD_PCT,
        issues: [
          {
            code: "no-snapshot",
            message: "Заявка без расчётного снапшота — сумма не проверялась сервером",
          },
        ],
      },
      payload,
      snapshot: null,
      totals: payload.totals ?? null,
      grandTotal: clientGrand,
    };
  }

  const issues: PriceIssue[] = [];

  /* ---------------- Потолок: комнаты ---------------- */

  const restores = snapshot.rooms.map((room) => roomConfigFromBreakdown(room));
  const rooms: V2RoomConfig[] = restores.map((restore) => restore.config);

  const legacyRooms = restores.filter((restore) => !restore.normalized);
  if (legacyRooms.length > 0) {
    issues.push({
      code: "legacy-room-snapshot",
      message: `Комнат без нормализованных параметров: ${legacyRooms.length} — состав восстановлен по лейблам`,
    });
  }
  for (const restore of restores) {
    for (const assumption of restore.assumptions) {
      issues.push({ code: "legacy-room-snapshot", message: `Комната «${restore.config.label}»: ${assumption}` });
    }
  }

  const roomSnapshots: LeadRoomSnapshot[] = snapshot.rooms.map((room, index) => ({
    ...room,
    // Авторитетная сумма комнаты — серверная, а не присланная клиентом.
    totalRub: calcRoomSnapshotV2(rooms[index]).total,
  }));

  /* ---------------- Свет: позиции и скидка ---------------- */

  const lookup = buildCatalogLookup(lookupProducts);
  const productsById = new Map(products.map((product) => [toText(product.productId), product]));

  const merged = mergeLightingItems(snapshot.lighting?.items ?? [], lookup, issues);
  if (!Array.isArray(merged)) {
    return { ok: false, rejection: merged };
  }

  const cartItems: Record<string, number> = {};
  for (const entry of merged) {
    cartItems[toText(entry.product.productId)] = entry.qty;
  }
  const cartEntries: CartEntry[] = buildCartEntries(cartItems, (id) => productsById.get(id));

  const regularTotal = merged.reduce(
    (sum, entry) => sum + toNumber(entry.product.priceRub) * entry.qty,
    0
  );

  /**
   * Режим скидки — выбор человека («только оборудование −10 %» против
   * «потолок + свет −25 %»), а не арифметика, поэтому сервер его не
   * перевыбирает. Проверяется только согласованность: скидка «с потолком»
   * без потолка в заявке невозможна и даунгрейдится до «только свет».
   */
  const requestedMode = toText(snapshot.lighting?.discountMode);
  const hasCeiling = rooms.length > 0;
  const discountMode: LightingSelection["discountMode"] =
    requestedMode === "with-ceiling" || requestedMode === "lighting-only"
      ? requestedMode
      : "none";

  if (discountMode === "with-ceiling" && !hasCeiling) {
    issues.push({
      code: "discount-mode-downgraded",
      message: "Скидка «с потолком» заявлена без потолка — применена скидка «только свет»",
    });
  }
  const effectiveMode: LightingSelection["discountMode"] =
    discountMode === "with-ceiling" && !hasCeiling ? "lighting-only" : discountMode;

  const effectiveTotal =
    effectiveMode === "with-ceiling"
      ? applyLightingWithCeilingDiscount(regularTotal)
      : effectiveMode === "lighting-only"
        ? applyLightingOnlyDiscount(regularTotal)
        : regularTotal;

  const discountPercentApplied =
    effectiveMode === "with-ceiling"
      ? LIGHTING_WITH_CEILING_DISCOUNT_PERCENT
      : effectiveMode === "lighting-only"
        ? LIGHTING_ONLY_DISCOUNT_PERCENT
        : 0;

  /* ---------------- Итог ---------------- */

  const lightingSelection: LightingSelection = {
    regularTotalRub: regularTotal,
    effectiveTotalRub: effectiveTotal,
    itemsCount: merged.length,
    selectedPointsQty: calcSelectedPointQty(cartEntries),
    selectedTrackMeters: calcSelectedTrackMeters(cartEntries),
    discountMode: effectiveMode,
  };

  const totals = selectTotals(rooms, lightingSelection);

  /**
   * N-050 в серверном исполнении: клиент, отказавшийся от потолка, его не
   * оплачивает — `calcLeadCeilingTotal` в таком режиме возвращает 0. Повторяем
   * ровно это, иначе заявка «только свет» получила бы сверху минимальный
   * заказ по потолку, которого человек не заказывал.
   */
  const ceilingPart =
    effectiveMode === "lighting-only" ? 0 : totals.ceilingApplied + totals.extraInstallRub;
  const serverGrand = ceilingPart + totals.lightingEffective;

  const storedTotals: LeadTotals = {
    ceilingRaw: totals.ceilingRaw,
    minimumApplied: totals.minimumApplied,
    installExtra: totals.extraInstallRub,
    lightingRegular: totals.lightingRegular,
    lightingEffective: totals.lightingEffective,
    discountPct: totals.discountPct,
    grand: serverGrand,
  };

  const deltaPct =
    clientGrand > 0
      ? (Math.abs(serverGrand - clientGrand) / clientGrand) * 100
      : serverGrand > 0
        ? 100
        : 0;
  const mismatch = deltaPct > PRICE_MISMATCH_THRESHOLD_PCT;

  if (mismatch) {
    issues.push({
      code: "price-mismatch",
      message: `Клиент видел ${Math.round(clientGrand)} ₽, сервер насчитал ${Math.round(serverGrand)} ₽ (расхождение ${deltaPct.toFixed(1)} %)`,
    });
  }

  const priceCheck: PriceCheck = {
    status: mismatch ? "mismatch" : "verified",
    clientGrand,
    serverGrand,
    deltaPct: Math.round(deltaPct * 100) / 100,
    thresholdPct: PRICE_MISMATCH_THRESHOLD_PCT,
    issues,
  };

  const storedSnapshot: StoredLeadSnapshot = {
    ...snapshot,
    rooms: roomSnapshots,
    lighting: snapshot.lighting
      ? lightingBlockFrom(
          snapshot.lighting,
          merged,
          regularTotal,
          effectiveTotal,
          effectiveMode,
          discountPercentApplied
        )
      : null,
    totals: storedTotals,
    priceCheck,
  };

  return {
    ok: true,
    priceCheck,
    payload: {
      ...payload,
      snapshot: storedSnapshot,
      // Верхнеуровневые `totals`/`grandTotal` — те же клиентские цифры; если
      // они были, заменять их нужно тоже, иначе в записи останутся два
      // разных ответа на вопрос «сколько стоит заказ».
      ...(payload.totals ? { totals: storedTotals } : {}),
      ...(payload.grandTotal !== undefined ? { grandTotal: serverGrand } : {}),
    },
    snapshot: storedSnapshot,
    totals: storedTotals,
    grandTotal: serverGrand,
  };
}

/**
 * Точка входа для `/api/lead`: грузит каталог и пересчитывает.
 *
 * Каталог — статичный индекс `data/catalog-index.json` через
 * `getCatalogProducts()`, а не `getCatalogData()`: последний умеет ходить в
 * живой фид поставщика, и заявка не должна зависеть от доступности чужого
 * сайта (и уж тем более ждать его ответа в момент отправки формы).
 */
export async function recalculateLeadPrice(payload: LeadPayload): Promise<RecalcResult> {
  const [products, lookupProducts] = await Promise.all([
    getCatalogProducts(),
    getCatalogLookupProducts(),
  ]);
  return recalculateLeadPriceWithCatalog(payload, products, lookupProducts);
}
