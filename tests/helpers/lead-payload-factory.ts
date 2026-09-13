/**
 * PT-010 · Фабрика «клиентской» заявки для тестов серверного пересчёта.
 *
 * Заявка собирается теми же функциями, которыми её собирает браузер:
 * `calcRoomsTotal` → `buildRoomBreakdown` → `selectExtraInstall` →
 * `buildLeadSnapshotV2` → `calcLeadCeilingTotal`. Это важно: если собирать
 * payload «от руки», тест будет проверять не паритет клиента и сервера, а
 * совпадение двух рукописных копий.
 */
import { pricing } from "@/content/pricing";
import type { LightingSnapshot } from "@/lib/calculator-modal-types";
import { calcLeadCeilingTotal } from "@/lib/calculator/pricing";
import {
  buildRoomBreakdown,
  calcRoomSnapshotV2,
  calcRoomsTotal,
  type V2RoomConfig,
} from "@/lib/calculator/room-snapshot";
import {
  selectExtraInstall,
  selectRequirements,
  type LightingSelection,
} from "@/lib/calculator/selectors";
import type { CalculatorLeadSnapshot } from "@/lib/calculator/snapshot-types";
import { buildLeadSnapshotV2 } from "@/lib/calculator/types";
import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";
import { LeadPayloadSchema, type LeadPayload } from "@/lib/lead/schema";
import {
  buildCartEntries,
  calcSelectedPointQty,
  calcSelectedTrackMeters,
} from "@/lib/lighting/cart-derived";
import { getCatalogProducts } from "@/lib/lighting/catalog-products";
import {
  applyLightingOnlyDiscount,
  applyLightingWithCeilingDiscount,
  calcLightingDiscountAmount,
} from "@/lib/lighting-formulas";

export const catalogPromise = getCatalogProducts();

export function pick(products: readonly FeedCatalogProduct[], productId: string): FeedCatalogProduct {
  const found = products.find((product) => product.productId === productId);
  if (!found) throw new Error(`В каталоге нет ${productId} — тест устарел вместе с фидом`);
  return found;
}

/** Профиль КОЛИБРИ 1 м (штучный) и крепление АРТ (штучный спот). */
export const PROFILE_ID = "eks-0-00006089";
export const MOUNT_ID = "eks-00010705";
/** Профиль, который продаётся метрами: для проверки дробного количества. */
export const METER_PROFILE_ID = "eks-0-00001613";

export const BASE_ROOM: V2RoomConfig = {
  id: "r1",
  label: "Кухня",
  area: 18,
  ceilingType: "shadow",
  shadowEnabled: true,
  shadowLength: 19,
  floatingEnabled: false,
  floatingLength: 0,
  lightLinesEnabled: false,
  lightLinesLength: 0,
  corniceType: "built-in",
  corniceLength: 12,
  corniceLightingEnabled: true,
  corniceLightingLength: 12,
  corniceLightingPowerSupplies: 2,
  trackType: "built-in",
  trackLength: 6,
  chandeliersEnabled: false,
  chandeliersCount: 0,
  lightsEnabled: true,
  lightsCount: 8,
};

/** Пустая комната: для заявки «только свет», где потолка в расчёте нет. */
export const EMPTY_ROOM: V2RoomConfig = {
  id: "empty",
  label: "",
  area: 0,
  ceilingType: "standard",
  shadowEnabled: false,
  shadowLength: 0,
  floatingEnabled: false,
  floatingLength: 0,
  lightLinesEnabled: false,
  lightLinesLength: 0,
  corniceType: "none",
  corniceLength: 0,
  corniceLightingEnabled: false,
  corniceLightingLength: 0,
  corniceLightingPowerSupplies: 0,
  trackType: "none",
  trackLength: 0,
  chandeliersEnabled: false,
  chandeliersCount: 0,
  lightsEnabled: false,
  lightsCount: 0,
};

export type CartLine = { product: FeedCatalogProduct; qty: number; auto?: boolean };

/**
 * Заявка ровно в том виде, в котором её отправляет браузер: комнаты через
 * `calcRoomSnapshotV2`/`calcRoomsTotal`, свет через черновик корзины,
 * досчёт монтажа через `selectExtraInstall`, финальный снапшот через
 * `buildLeadSnapshotV2` + `calcLeadCeilingTotal` (как в `action-form.tsx`).
 */
export function buildClientPayload(input: {
  rooms: V2RoomConfig[];
  cart: CartLine[];
  discountMode: LightingSelection["discountMode"];
  phone?: string;
}): LeadPayload {
  const { rooms, cart, discountMode } = input;

  const items = cart.map(({ product, qty, auto }) => ({
    sku: product.productId,
    name: product.name,
    qty,
    priceRub: product.priceRub,
    vendorCode: product.vendorCode,
    system: product.system,
    kind: product.kind,
    unit: product.unit,
    ...(auto ? { auto: true } : {}),
  }));

  const regular = cart.reduce((sum, line) => sum + line.product.priceRub * line.qty, 0);
  const effective =
    discountMode === "with-ceiling"
      ? applyLightingWithCeilingDiscount(regular)
      : discountMode === "lighting-only"
        ? applyLightingOnlyDiscount(regular)
        : regular;

  const lighting: LightingSnapshot | undefined =
    cart.length > 0
      ? {
          mode: "catalog",
          items,
          totalRub: regular,
          discountedTotalRub: effective,
          standaloneDiscountedTotalRub: applyLightingOnlyDiscount(regular),
          withCeilingDiscountedTotalRub: applyLightingWithCeilingDiscount(regular),
          discountMode,
          discountPercentApplied:
            discountMode === "with-ceiling"
              ? pricing.lightingDiscount.withCeilingPct
              : discountMode === "lighting-only"
                ? pricing.lightingDiscount.lightingOnlyPct
                : 0,
          discountAmountRub: calcLightingDiscountAmount(regular, effective),
          userCustomizedLighting: true,
        }
      : undefined;

  const aggregate = calcRoomsTotal(rooms);
  const base = calcRoomSnapshotV2(rooms[0] ?? EMPTY_ROOM).snapshot;

  const cartEntries = buildCartEntries(
    Object.fromEntries(cart.map((line) => [line.product.productId, line.qty])),
    (id) => cart.find((line) => line.product.productId === id)?.product
  );
  const lightingSelection: LightingSelection = {
    regularTotalRub: regular,
    effectiveTotalRub: effective,
    itemsCount: cart.length,
    selectedPointsQty: calcSelectedPointQty(cartEntries),
    selectedTrackMeters: calcSelectedTrackMeters(cartEntries),
    discountMode,
  };
  const extra = selectExtraInstall(selectRequirements(rooms), lightingSelection);

  const snapshot: CalculatorLeadSnapshot = {
        ...base,
        roomBreakdown: rooms.map((room) => buildRoomBreakdown(room)),
        area: rooms.reduce((sum, room) => sum + room.area, 0),
        total: aggregate.applied,
        totalRawRub: aggregate.raw,
        minimumOrderApplied: aggregate.minimumApplied,
        extraInstallRub: extra.rub,
        extraInstallLines: extra.lines,
        lighting,
        lightingDiscountMode: discountMode,
        lightingDiscountPercentApplied: lighting?.discountPercentApplied,
        solutionScenario: "modern",
        calculationScope: "room",
  };

  const leadSnapshot = rooms.length > 0 || cart.length > 0
    ? buildLeadSnapshotV2({
        snapshot,
        ceilingEffectiveTotal: calcLeadCeilingTotal({ snapshot }),
        lightingRegularTotal: lighting?.totalRub ?? 0,
        lightingEffectiveTotal: lighting?.discountedTotalRub ?? 0,
        source: "home:hero",
        entry: "ceiling-first",
      })
    : undefined;

  return LeadPayloadSchema.parse({
    name: "Иван",
    phone: input.phone ?? "+79160001122",
    consent: true,
    source: "home:hero",
    placement: "home",
    pagePath: "/",
    leadKind: "calculator",
    orderIntent: "lighting_with_ceiling",
    ...(leadSnapshot ? { snapshot: leadSnapshot } : {}),
  });
}

/** Минимальный товар для синтетических кейсов (недоступность, неизвестный SKU). */
export function fakeProduct(overrides: Partial<FeedCatalogProduct> = {}): FeedCatalogProduct {
  return {
    productId: "fake-1",
    vendorCode: "0У-99999999",
    offerId: "",
    name: "Светильник тестовый",
    url: "",
    categoryId: "",
    categoryPath: "",
    images: [],
    priceRub: 1000,
    available: true,
    system: "OTHER",
    kind: "SPOT_FIXTURE",
    unit: "pcs",
    ...overrides,
  } as FeedCatalogProduct;
}
