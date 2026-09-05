"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useCalculatorModal } from "@/components/calculator-modal/calculator-modal-context";
import { useCalculatorStore } from "@/lib/calculator/store";
import type { CalculatorLeadSnapshot } from "@/lib/calculator/snapshot-types";
import {
  isMountsOrGrilles,
  isPanelProduct,
  isSmartProduct,
  matchesPointSubtype,
  normalizeQty,
} from "@/lib/lighting/product-predicates";
import catalogImages from "@/data/catalog-images.json";
import { ProductCard } from "./CatalogProductCard";
import { CatalogWarnings } from "./CatalogWarnings";
import {
  calcClarusPsuOptions,
  calcLampCurrentBySocket,
  calcLampRequiredBySocket,
  calcMissingLamps,
  calcMissingMounts,
  calcMountRequiredByVendor,
  groupLampsBySocket,
} from "@/lib/lighting/catalog-kit-gaps";
import { toNumber, toText } from "@/lib/feed2-snapshot-normalize";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Section } from "@/components/ui/section";

import type { LightingItem, LightingSnapshot } from "@/lib/calculator-modal-types";
import type { FeedCatalogProduct, FeedCatalogResult } from "@/lib/eks-feed2-catalog";

import { trackLightingCartCheckout, trackSmartInterestSelected } from "@/lib/analytics";
import { useLightingCart } from "@/lib/lighting/use-lighting-cart";
import { clearIncompatibleSystem } from "@/lib/lighting/kit-rules";
import { showConfirmDialog } from "@/components/ui/confirm-dialog";
import { LightingCartDrawer } from "@/components/lighting/LightingCartDrawer";

import {
  LIGHTING_ONLY_DISCOUNT_PERCENT,
  LIGHTING_WITH_CEILING_DISCOUNT_PERCENT,
  applyLightingOnlyDiscount,
  applyLightingWithCeilingDiscount,
  calcLightingDiscountAmount,
} from "@/lib/lighting-formulas";
import { detectSocket } from "@/lib/feed2-products";

import {
  CATALOG_SECTIONS,
  POINT_SUBTYPES,
  TRACK_GROUPS,
  TRACK_PROFILE_WHITELIST,
  TRACK_SYSTEMS,
  POINT_TO_MOUNT_VENDOR_CODE,
  CLARUS_PSU_VENDOR_CODES,
  isRemovedColibriVendorCode,
  type CatalogSectionId,
  type PointSubtypeId,
  type TrackGroupId,
  type TrackSystemId,
  LAMP_SOCKETS,
  type LampSocket,
} from "@/lib/catalog-ui-config";

import { ART_TRACK_PROFILE_VENDOR_WHITELIST, applyVendorOverrides } from "@/lib/vendor-code-overrides";

type CartItems = Record<string, number>;

function fmt(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(Math.round(value));
}






/**
 * T-065 · К какой секции каталога относится товар.
 *
 * Нужна для глобального поиска: правила отбора раньше жили только внутри
 * `filteredProducts` вперемешку с активными фильтрами, поэтому «где ещё
 * есть эта позиция» посчитать было нечем.
 */
function sectionOfProduct(product: FeedCatalogProduct): CatalogSectionId | null {
  if (product.kind === "TRACK_PROFILE" || product.kind === "TRACK_FIXTURE" || product.kind === "TRACK_ACCESSORY") {
    return "track-systems";
  }
  if (product.kind === "SPOT_FIXTURE" || isPanelProduct(product)) return "point-fixtures";
  if (product.kind === "CHANDELIER") return "chandeliers";
  if (product.kind === "LED_STRIP" || product.kind === "PSU" || product.kind === "CONTROL") {
    return "cornice-lighting";
  }
  if (product.kind === "LAMP") return "lamps";
  if (isMountsOrGrilles(product)) return "mounts-grilles";
  return null;
}

/** Строка, по которой ищем: название, артикул и путь категории. */
function searchHaystack(product: FeedCatalogProduct): string {
  return `${toText(product.name)} ${toText(product.vendorCode)} ${toText(product.categoryPath)}`.toLowerCase();
}


function productToLightingItem(product: FeedCatalogProduct, qty: number): LightingItem {
  return {
    sku: toText(product.productId),
    name: toText(product.name),
    qty,
    priceRub: toNumber(product.priceRub),
  };
}

function createLightingOnlySnapshot(): CalculatorLeadSnapshot {
  return {
    area: 0,
    ceilingTypeLabel: "Потолок пока не рассчитан",
    ceilingBaseRate: 0,
    ceilingBaseTotal: 0,
    ceilingExtraLabel: null,
    ceilingLength: null,
    ceilingExtraRatePerMeter: null,
    ceilingExtraTotal: 0,
    lightLinesEnabled: false,
    lightLinesLabel: null,
    lightLinesLength: null,
    lightLinesRatePerMeter: null,
    lightLinesTotal: 0,
    corniceLabel: null,
    corniceLength: null,
    corniceRatePerMeter: null,
    corniceTotal: 0,
    trackLabel: null,
    trackLength: null,
    trackRatePerMeter: null,
    trackTotal: 0,
    lightsEnabled: false,
    lightsCount: null,
    lightsRatePerUnit: 0,
    lightsTotal: 0,
    total: 0,
    derivedInputs: {
      pointSpotsQty: 0,
      trackMountType: "none",
      trackLengthMeters: 0,
      recommendedTrackSpotsQty: 0,
    },
  };
}

function buildLightingSnapshotFromItems(items: LightingItem[]): LightingSnapshot | null {
  if (items.length === 0) return null;

  const totalRub = items.reduce((sum, item) => sum + item.qty * item.priceRub, 0);
  const discountedTotalRub = applyLightingOnlyDiscount(totalRub);
  const withCeilingDiscountedTotalRub = applyLightingWithCeilingDiscount(totalRub);

  return {
    mode: "catalog",
    items,
    totalRub,
    discountedTotalRub,
    standaloneDiscountedTotalRub: discountedTotalRub,
    withCeilingDiscountedTotalRub,
    discountMode: "lighting-only",
    discountPercentApplied: LIGHTING_ONLY_DISCOUNT_PERCENT,
    discountAmountRub: calcLightingDiscountAmount(totalRub, discountedTotalRub),
    userCustomizedLighting: true,
  };
}


type Props = { data: FeedCatalogResult };

export function CatalogSectionClient({ data }: Props) {
  /** Дата прайса поставщика — показываем рядом с каталогом. */
  const catalogUpdatedAtLabel = useMemo(() => {
    const parsed = new Date(toText(data.updatedAt));
    if (Number.isNaN(parsed.getTime())) return "актуальную дату уточню";
    return parsed.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  }, [data.updatedAt]);

  const { openCalculator } = useCalculatorModal();
  const { setSnapshot } = useCalculatorStore();

  const products = useMemo(() => {
    return (data.products ?? [])
      .filter((product) => !isRemovedColibriVendorCode(product.vendorCode))
      .map((p) => applyVendorOverrides(p));
  }, [data.products]);

  const byProductId = useMemo(() => {
    const map = new Map<string, FeedCatalogProduct>();
    for (const product of products) map.set(toText(product.productId), product);
    return map;
  }, [products]);

  const productIdByVendorCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const product of products) {
      const vendor = toText(product.vendorCode);
      const id = toText(product.productId);
      if (vendor && id) map.set(vendor, id);
    }
    return map;
  }, [products]);

  const [section, setSection] = useState<CatalogSectionId>("track-systems");
  const [trackSystem, setTrackSystem] = useState<TrackSystemId>("COLIBRI_220");
  const [trackGroup, setTrackGroup] = useState<TrackGroupId>("TRACK_FIXTURE");
  const [pointSubtype, setPointSubtype] = useState<PointSubtypeId>("GX53");
  const [lampSocket, setLampSocket] = useState<LampSocket>("GX53");
  const [smartOnly, setSmartOnly] = useState(false);

  const [query, setQuery] = useState("");
  /**
   * T-031: корзина общая с модалкой (`lightingDraft`), локального состояния нет —
   * счётчики страницы и калькулятора всегда совпадают, комплект не теряется.
   */
  const resolveProduct = useCallback(
    (productId: string) => byProductId.get(productId),
    [byProductId]
  );
  const lightingCart = useLightingCart(resolveProduct);
  const cartItems = lightingCart.cart;

  /** Совместимость со старым кодом: принимает как объект, так и updater. */
  const setCartItems = useCallback(
    (updater: CartItems | ((prev: CartItems) => CartItems)) => {
      const next = typeof updater === "function" ? updater(lightingCart.cart) : updater;
      lightingCart.replaceCart(next);
    },
    [lightingCart]
  );
  const [visibleCount, setVisibleCount] = useState(24);
  const [cartOpen, setCartOpen] = useState(false);

  const selectedEntries = useMemo(() => {
    return Object.entries(cartItems)
      .filter(([, qty]) => qty > 0)
      .map(([productId, qty]) => {
        const product = byProductId.get(productId);
        return product ? { productId, product, qty } : null;
      })
      .filter((x): x is { productId: string; product: FeedCatalogProduct; qty: number } => Boolean(x));
  }, [byProductId, cartItems]);

  const selectedLightingItems = useMemo(() => {
    return selectedEntries.map((entry) => productToLightingItem(entry.product, entry.qty));
  }, [selectedEntries]);

  const selectedTotal = useMemo(() => {
    return selectedEntries.reduce((sum, entry) => sum + entry.qty * toNumber(entry.product.priceRub), 0);
  }, [selectedEntries]);

  const lightingOnlySelectedTotal = useMemo(() => applyLightingOnlyDiscount(selectedTotal), [selectedTotal]);
  const withCeilingSelectedTotal = useMemo(() => applyLightingWithCeilingDiscount(selectedTotal), [selectedTotal]);

  useEffect(() => {
    const lighting = buildLightingSnapshotFromItems(selectedLightingItems);

    setSnapshot((prev) => {
      if (!lighting) {
        if (!prev?.lighting) return prev;
        return {
          ...prev,
          lighting: undefined,
          lightingDiscountApplied: false,
          lightingDiscountPercentApplied: 0,
          lightingDiscountMode: "none",
          lightingDiscountAmountRub: 0,
        };
      }

      const base = prev ?? createLightingOnlySnapshot();
      return {
        ...base,
        leadSource: base.leadSource ?? "track-sale-page-catalog",
        lighting,
        lightingDiscountApplied: true,
        lightingDiscountPercentApplied: LIGHTING_ONLY_DISCOUNT_PERCENT,
        lightingDiscountMode: "lighting-only",
        lightingDiscountAmountRub: lighting.discountAmountRub ?? Math.max(0, selectedTotal - lightingOnlySelectedTotal),
      };
    });
  }, [lightingOnlySelectedTotal, selectedLightingItems, selectedTotal, setSnapshot]);

  // ===== Dependencies (mounts / lamps / PSU) =====
  const mountRequiredByVendor = useMemo(() => calcMountRequiredByVendor(selectedEntries), [selectedEntries]);

  const missingMounts = useMemo(
    () => calcMissingMounts(cartItems, productIdByVendorCode, byProductId),
    [byProductId, cartItems, productIdByVendorCode],
  );

  const lampProductsBySocket = useMemo(() => groupLampsBySocket(products), [products]);

  const lampRequiredBySocket = useMemo(() => calcLampRequiredBySocket(selectedEntries), [selectedEntries]);

  const lampCurrentBySocket = useMemo(
    () => calcLampCurrentBySocket(cartItems, lampProductsBySocket),
    [cartItems, lampProductsBySocket],
  );

  const missingLamps = useMemo(
    () => calcMissingLamps(lampRequiredBySocket, lampCurrentBySocket, lampProductsBySocket),
    [lampCurrentBySocket, lampProductsBySocket, lampRequiredBySocket],
  );

  const clarusPsuOptions = useMemo(
    () => calcClarusPsuOptions(selectedEntries, productIdByVendorCode, byProductId),
    [selectedEntries, productIdByVendorCode, byProductId],
  );

  const setClarusPsu = (productId: string) => {
    setCartItems((prev) => {
      const next = { ...prev };
      for (const vendor of CLARUS_PSU_VENDOR_CODES) {
        const id = productIdByVendorCode.get(vendor);
        if (!id) continue;
        if (id !== productId) delete next[id];
      }
      next[productId] = Math.max(1, toNumber(next[productId]));
      return next;
    });
  };

  const addMountOneToOne = (fixtureVendor: string) => {
    const mountVendor = POINT_TO_MOUNT_VENDOR_CODE[toText(fixtureVendor)];
    if (!mountVendor) return;
    const mountId = productIdByVendorCode.get(mountVendor);
    if (!mountId) return;

    const required = toNumber(mountRequiredByVendor[mountVendor]);
    if (required <= 0) return;

    setCartItems((prev) => ({ ...prev, [mountId]: required }));
  };

  const addLampOneToOneCheapest = (socket: LampSocket, lampId: string) => {
    const required = toNumber(lampRequiredBySocket[socket]);
    if (required <= 0) return;

    setCartItems((prev) => {
      const next = { ...prev };
      const allLampIds = lampProductsBySocket[socket].map((p) => toText(p.productId));
      for (const id of allLampIds) if (id !== lampId) delete next[id];
      next[lampId] = required;
      return next;
    });
  };

  /**
   * T-031: добавление позиции с проверкой совместимости систем.
   * При конфликте спрашиваем подтверждение; отказ не меняет корзину.
   */
  const incrementProduct = useCallback(
    async (product: FeedCatalogProduct, nextQtyRaw: number) => {
      const id = toText(product.productId);
      const nextQty = normalizeQty(nextQtyRaw, product.unit);
      if (nextQty <= 0) return;

      const conflict = lightingCart.checkConflict(product);
      if (conflict) {
        const confirmed = await showConfirmDialog({
          title: "Разные системы трека",
          message: conflict.message,
          confirmLabel: "Заменить",
          cancelLabel: "Оставить как есть",
          variant: "warning",
        });
        // Отказ — корзина остаётся нетронутой.
        if (confirmed !== true) return;

        lightingCart.update((prev) => ({
          ...clearIncompatibleSystem(prev, conflict.targetSystem, resolveProduct),
          [id]: nextQty,
        }));
        return;
      }

      lightingCart.update((prev) => ({ ...prev, [id]: nextQty }));
    },
    [lightingCart, resolveProduct]
  );

  const openInCalculator = () => {
    const items: LightingItem[] = selectedEntries.map((entry) => productToLightingItem(entry.product, entry.qty));

    if (items.length === 0) {
      openCalculator({
        entryMode: "lighting-first",
        initialStep: 1,
        initialLightingTab: "catalog",
        initialLightingView: "browse",
        source: "track-sale-empty",
      });
      return;
    }

    const totalRub = items.reduce((sum, item) => sum + item.qty * item.priceRub, 0);
    const discountedTotalRub = applyLightingOnlyDiscount(totalRub);
    const withCeilingDiscountedTotalRub = applyLightingWithCeilingDiscount(totalRub);

    const initialLighting: LightingSnapshot = {
      mode: "catalog",
      items,
      totalRub,
      discountedTotalRub,
      standaloneDiscountedTotalRub: discountedTotalRub,
      withCeilingDiscountedTotalRub,
      discountMode: "lighting-only",
      discountPercentApplied: LIGHTING_ONLY_DISCOUNT_PERCENT,
      discountAmountRub: calcLightingDiscountAmount(totalRub, discountedTotalRub),
      userCustomizedLighting: true,
    };

    trackLightingCartCheckout({
      mode: "open-calculator",
      itemsCount: items.length,
      lightingTotalRub: totalRub,
      lightingDiscountedRub: discountedTotalRub,
      source: "track-sale-page",
    });

    openCalculator({
      entryMode: "lighting-first",
      initialStep: 1,
      initialLightingTab: "catalog",
      initialLightingView: "selected",
      initialLighting,
      source: "track-sale-page",
    });
  };

  /**
   * T-045 · Экран интента перед оформлением.
   *
   * Режим скидки определяет весь дальнейший путь: «только оборудование» ведёт
   * сразу к заявке (Шаг 2), «с потолком» — в расчёт потолка (Шаг 0). Спрашиваем
   * это один раз явным вопросом, а не двумя кнопками в липком баре.
   */
  const openCheckoutIntent = async () => {
    if (selectedEntries.length === 0) return;

    const withCeiling = await showConfirmDialog({
      title: "Как оформляем комплект?",
      message:
        "Только оборудование — скидка 10 %, пришлю счёт после проверки наличия. " +
        "С натяжным потолком — скидка на свет 25 %, сначала посчитаем потолок.",
      confirmLabel: "С потолком −25 %",
      cancelLabel: "Только оборудование −10 %",
      variant: "info",
    });

    if (withCeiling === true) {
      openWithCeiling();
      return;
    }
    openLightingOrder();
  };

  // T-031: «Посмотреть» открывает мини-корзину прямо на странице,
  // без ухода в калькулятор.
  const openSelectedList = () => {
    setCartOpen(true);
  };

  const openLightingOrder = () => {
    const items: LightingItem[] = selectedEntries.map((entry) => productToLightingItem(entry.product, entry.qty));

    if (items.length === 0) return;

    const totalRub = items.reduce((sum, item) => sum + item.qty * item.priceRub, 0);
    const discountedTotalRub = applyLightingOnlyDiscount(totalRub);
    const withCeilingDiscountedTotalRub = applyLightingWithCeilingDiscount(totalRub);

    const initialLighting: LightingSnapshot = {
      mode: "catalog",
      items,
      totalRub,
      discountedTotalRub,
      standaloneDiscountedTotalRub: discountedTotalRub,
      withCeilingDiscountedTotalRub,
      discountMode: "lighting-only",
      discountPercentApplied: LIGHTING_ONLY_DISCOUNT_PERCENT,
      discountAmountRub: calcLightingDiscountAmount(totalRub, discountedTotalRub),
      userCustomizedLighting: true,
    };

    trackLightingCartCheckout({
      mode: "lighting-only",
      itemsCount: items.length,
      lightingTotalRub: totalRub,
      lightingDiscountedRub: discountedTotalRub,
      source: "track-sale-page-lighting-only",
    });

    openCalculator({
      entryMode: "lighting-first",
      initialStep: 2,
      initialLightingTab: "catalog",
      initialLightingView: "selected",
      initialLighting,
      source: "track-sale-page-lighting-only",
    });
  };

  const openWithCeiling = () => {
    const items: LightingItem[] = selectedEntries.map((entry) => productToLightingItem(entry.product, entry.qty));

    if (items.length === 0) {
      openCalculator({ initialStep: 0, source: "track-sale-add-ceiling-empty" });
      return;
    }

    const totalRub = items.reduce((sum, item) => sum + item.qty * item.priceRub, 0);
    const discountedTotalRub = applyLightingOnlyDiscount(totalRub);
    const withCeilingDiscountedTotalRub = applyLightingWithCeilingDiscount(totalRub);

    const initialLighting: LightingSnapshot = {
      mode: "catalog",
      items,
      totalRub,
      discountedTotalRub,
      standaloneDiscountedTotalRub: discountedTotalRub,
      withCeilingDiscountedTotalRub,
      discountMode: "lighting-only",
      discountPercentApplied: LIGHTING_ONLY_DISCOUNT_PERCENT,
      discountAmountRub: calcLightingDiscountAmount(totalRub, discountedTotalRub),
      userCustomizedLighting: true,
    };

    trackLightingCartCheckout({
      mode: "with-ceiling",
      itemsCount: items.length,
      lightingTotalRub: totalRub,
      lightingDiscountedRub: withCeilingDiscountedTotalRub,
      source: "track-sale-page-add-ceiling",
    });

    openCalculator({
      entryMode: "lighting-first",
      initialStep: 0,
      initialLightingTab: "catalog",
      initialLightingView: "selected",
      initialLighting,
      source: "track-sale-page-add-ceiling",
    });
  };

  /**
   * N-020 · Товары с локальным фото — выше.
   *
   * У 34 позиций поставщик удалил обложки, и они кучно стоят в начале фида:
   * первый экран каталога состоял почти из одних заглушек. Сортировка
   * стабильная, поэтому внутри каждой из двух групп исходный порядок фида
   * сохраняется — меняется только приоритет показа.
   */
  const withPhotoFirst = useCallback((list: FeedCatalogProduct[]): FeedCatalogProduct[] => {
    const hasPhoto = (product: FeedCatalogProduct) =>
      toText(product.productId) in (catalogImages as Record<string, unknown>);
    return [...list].sort((a, b) => Number(hasPhoto(b)) - Number(hasPhoto(a)));
  }, []);

  const filteredProducts = useMemo(() => {
    let scoped: FeedCatalogProduct[] = [];

    if (section === "track-systems") {
      if (trackGroup === "TRACK_PROFILE") {
        const base = TRACK_PROFILE_WHITELIST[trackSystem] ?? [];
        const allowed =
          trackSystem === "TRACK_220" ? new Set([...base, ...ART_TRACK_PROFILE_VENDOR_WHITELIST]) : new Set(base);

        scoped = products.filter((product) => {
          if (product.system !== trackSystem) return false;
          if (product.kind !== "TRACK_PROFILE") return false;
          return allowed.has(toText(product.vendorCode));
        });
      } else {
        scoped = products.filter((product) => product.system === trackSystem && product.kind === trackGroup);
      }
    } else if (section === "point-fixtures") {
      scoped = products.filter((product) => matchesPointSubtype(product, pointSubtype));
    } else if (section === "lamps") {
      scoped = products
        .filter((p) => p.kind === "LAMP" && p.available !== false && toNumber(p.priceRub) > 0)
        .filter((p) => detectSocket(p) === lampSocket);
    } else {
      scoped = products.filter((product) => isMountsOrGrilles(product));
    }

    if (smartOnly) {
      scoped = scoped.filter(isSmartProduct);
    }

    const q = toText(query).toLowerCase();
    if (!q) return withPhotoFirst(scoped);

    return withPhotoFirst(
      scoped.filter((product) => {
        const haystack = `${toText(product.name)} ${toText(product.vendorCode)} ${toText(product.categoryPath)}`.toLowerCase();
        return haystack.includes(q);
      }),
    );
  }, [lampSocket, pointSubtype, products, query, section, smartOnly, trackGroup, trackSystem, withPhotoFirst]);

  /**
   * T-065 · Глобальный поиск: сколько совпадений в КАЖДОМ разделе.
   *
   * Раньше поиск работал только внутри активной секции и молчал, если товар
   * лежал в соседней: человек искал «блок питания», получал «ничего не
   * найдено» в «Трековых системах» и уходил, хотя позиция была в «Подсветке
   * карниза». Считаем по всему каталогу и показываем, куда перейти.
   */
  const searchMatchesBySection = useMemo(() => {
    const q = toText(query).trim().toLowerCase();
    if (q.length < 2) return null;

    const counts = new Map<CatalogSectionId, number>();
    for (const product of products) {
      if (!searchHaystack(product).includes(q)) continue;
      const productSection = sectionOfProduct(product);
      if (!productSection) continue;
      counts.set(productSection, (counts.get(productSection) ?? 0) + 1);
    }

    return CATALOG_SECTIONS.filter((item) => item.id !== section && (counts.get(item.id) ?? 0) > 0).map(
      (item) => ({ id: item.id, label: item.label, count: counts.get(item.id) ?? 0 })
    );
  }, [products, query, section]);

  return (
    <Section id="price" className={selectedEntries.length > 0 ? "scroll-mt-24 py-10 pb-36 max-sm:pb-44" : "scroll-mt-24 py-10"}>
      <Container>
        <div className="flex items-start justify-between gap-6">
          <Heading title="Каталог освещения" />

          <button
            type="button"
            onClick={openInCalculator}
            className="min-h-11 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)]"
          >
Собрать в калькуляторе →
          </button>
        </div>

        {/* Controls */}
        {/*
          T-064: секции каталога — это настоящие вкладки, поэтому размечены
          как tablist/tab. Скринридер теперь сообщает «вкладка 2 из 6» и
          состояние выбора, чего не давал набор обычных кнопок.
        */}
        <div className="mt-8 flex gap-2 overflow-x-auto pb-1 no-scrollbar scroll-fade-x sm:flex-wrap">
          <div role="tablist" aria-label="Разделы каталога" className="contents">
            {CATALOG_SECTIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`catalog-tab-${item.id}`}
                aria-selected={section === item.id}
                aria-controls="catalog-panel"
                onClick={() => {
                  // T-065: запрос сохраняется при смене раздела — человек
                  // ищет «диммер», а не «диммер в разделе Трековые системы».
                  setSection(item.id);
                  setVisibleCount(24);
                }}
                className={[
                  "inline-flex min-h-11 items-center whitespace-nowrap rounded-[var(--radius-sm)] px-3.5 text-sm font-medium",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2",
                  section === item.id
                    ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                  "border",
                ].join(" ")}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setSmartOnly((prev) => {
                const next = !prev;
                trackSmartInterestSelected({ placement: "catalog", enabled: next, source: "track-sale-page" });
                if (next) setSection("track-systems");
                return next;
              });
              setVisibleCount(24);
            }}
            className={[
              "whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium border",
              smartOnly ? "border-violet-600 bg-violet-600 text-white" : "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100",
            ].join(" ")}
          >
            SMART
          </button>
        </div>

        {smartOnly ? (
          <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm leading-6 text-violet-950">
            Показаны SMART-позиции: светильники, панели управления и аксессуары. Управление лучше подбирать под сценарии помещения — зафиксирую интерес и предложу вариант лично.
          </div>
        ) : null}

        {section === "track-systems" ? (
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar scroll-fade-x sm:flex-wrap">
            {TRACK_SYSTEMS.map((system) => (
              <button
                key={system.id}
                type="button"
                onClick={() => {
                  setTrackSystem(system.id);
                  setQuery("");
                }}
                className={[
                  "whitespace-nowrap rounded-xl px-3 py-1.5 text-xs",
                  trackSystem === system.id ? "bg-slate-900 text-white" : "bg-white text-slate-700",
                  "border border-slate-200",
                ].join(" ")}
              >
                {system.label}
              </button>
            ))}

            {TRACK_GROUPS.map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() => {
                  setTrackGroup(group.id);
                  setQuery("");
                }}
                className={[
                  "whitespace-nowrap rounded-xl px-3 py-1.5 text-xs",
                  trackGroup === group.id ? "bg-slate-900 text-white" : "bg-white text-slate-700",
                  "border border-slate-200",
                ].join(" ")}
              >
                {group.label}
              </button>
            ))}
          </div>
        ) : null}

        {section === "point-fixtures" ? (
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar scroll-fade-x sm:flex-wrap">
            {POINT_SUBTYPES.map((subtype) => (
              <button
                key={subtype.id}
                type="button"
                onClick={() => {
                  setPointSubtype(subtype.id);
                  setQuery("");
                }}
                className={[
                  "whitespace-nowrap rounded-xl px-3 py-1.5 text-xs",
                  pointSubtype === subtype.id ? "bg-slate-900 text-white" : "bg-white text-slate-700",
                  "border border-slate-200",
                ].join(" ")}
              >
                {subtype.label}
              </button>
            ))}
          </div>
        ) : null}

        {section === "lamps" ? (
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar scroll-fade-x sm:flex-wrap">
            {(LAMP_SOCKETS).map((socket) => (
              <button
                key={socket}
                type="button"
                onClick={() => {
                  setLampSocket(socket);
                  setQuery("");
                }}
                className={[
                  "whitespace-nowrap rounded-xl px-3 py-1.5 text-xs",
                  lampSocket === socket ? "bg-slate-900 text-white" : "bg-white text-slate-700",
                  "border border-slate-200",
                ].join(" ")}
              >
                {socket}
              </button>
            ))}
          </div>
        ) : null}

        <div className="relative mt-4">
          <span aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
              <circle cx="9" cy="9" r="5.5" />
              <path d="M13.5 13.5L17 17" strokeLinecap="round" />
            </svg>
          </span>
          <input
          value={query}
          onChange={(event) => setQuery(String(event.target.value ?? ""))}
          placeholder="Поиск по всему каталогу"
          aria-label="Поиск по каталогу"
          className="w-full rounded-[var(--radius-md)] border border-slate-300 bg-white pl-10 pr-10 py-3 text-sm text-slate-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2"
        />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Очистить поиск"
              className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            >
              ✕
            </button>
          ) : null}
        </div>

        {/*
          T-065: найденное в других разделах. Без этой строки поиск выглядел
          сломанным — совпадения в соседней секции просто не существовали
          для пользователя.
        */}
        {searchMatchesBySection && searchMatchesBySection.length > 0 ? (
          <div aria-live="polite" className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-slate-600">Найдено ещё:</span>
            {searchMatchesBySection.map((match) => (
              <button
                key={match.id}
                type="button"
                onClick={() => {
                  setSection(match.id);
                  setVisibleCount(24);
                }}
                className="inline-flex min-h-9 items-center rounded-full border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
              >
                «{match.label}»: {match.count}
              </button>
            ))}
          </div>
        ) : null}

        {/*
          T-045: один липкий бар вместо трёх конкурирующих кнопок.
          Выбор режима скидки перенесён в экран интента — раньше человек должен
          был решить «свет −10 %» или «потолок −25 %» прямо в баре, не понимая
          разницы.
        */}
        {selectedEntries.length > 0 ? (
          <div data-cart-bar data-count={selectedEntries.length} style={{ zIndex: "var(--z-cart, 45)" }} className="fixed bottom-4 left-1/2 hidden w-[min(1120px,calc(100vw-2rem))] -translate-x-1/2 rounded-[1.5rem] border border-slate-200 bg-white/95 p-4 shadow-[0_14px_42px_rgba(15,23,42,0.16)] backdrop-blur sm:block">
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* T-064: сумма меняется от кликов по карточкам — озвучиваем. */}
              <p aria-live="polite" aria-atomic="true" className="min-w-0 text-sm font-semibold text-slate-950">
                Корзина · {selectedEntries.length} поз. · {fmt(lightingOnlySelectedTotal)} ₽
              </p>

              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={openSelectedList}
                  className="min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Посмотреть
                </button>
                <button
                  type="button"
                  onClick={openCheckoutIntent}
                  className="min-h-11 rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)]"
                >
                  Оформить
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {selectedEntries.length > 0 ? (
          <div data-cart-bar data-count={selectedEntries.length} style={{ zIndex: "var(--z-cart, 45)", paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }} className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-8px_28px_rgba(15,23,42,0.12)] backdrop-blur sm:hidden">
            <div className="flex items-center justify-between gap-3">
              <p aria-live="polite" aria-atomic="true" className="min-w-0 text-xs font-semibold text-slate-950">
                Корзина · {selectedEntries.length} поз. · {fmt(lightingOnlySelectedTotal)} ₽
              </p>
              <div className="flex shrink-0 gap-1.5">
                <button
                  type="button"
                  onClick={openSelectedList}
                  className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
                >
                  Посмотреть
                </button>
                <button
                  type="button"
                  onClick={openCheckoutIntent}
                  className="min-h-11 rounded-xl bg-slate-950 px-3 text-xs font-semibold text-white"
                >
                  Оформить
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* T-044: режим скидки — одной строкой над сеткой, а не в каждой карточке */}
        <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800">
          Цены со скидкой −{LIGHTING_ONLY_DISCOUNT_PERCENT} % на свет · −{LIGHTING_WITH_CEILING_DISCOUNT_PERCENT} % при заказе с потолком
        </div>

        {/*
          T-045: честная оговорка про источник цен. Прайс поставщика меняется,
          и обещать неизменную цену до проверки наличия нельзя.
        */}
        <p className="mt-3 text-xs leading-5 text-slate-600">
          Цены и наличие по прайсу поставщика EKS Market на {catalogUpdatedAtLabel}; уточню перед счётом.
        </p>

        {/* Products grid with "Показать ещё" */}
        <div
          id="catalog-panel"
          role="tabpanel"
          aria-labelledby={`catalog-tab-${section}`}
          className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          {filteredProducts.slice(0, visibleCount).map((product) => {
            const id = toText(product.productId);
            const qty = toNumber(cartItems[id]);
            const step = product.unit === "m" ? 0.5 : 1;

            return (
              <ProductCard
                key={id}
                product={product}
                qty={qty}
                onDec={() =>
                  setCartItems((prev) => {
                    const next = { ...prev };
                    const nextQty = normalizeQty(qty - step, product.unit);
                    if (nextQty <= 0) delete next[id];
                    else next[id] = nextQty;
                    return next;
                  })
                }
                onInc={() => void incrementProduct(product, qty + step)}
              />
            );
          })}
        </div>

        {/* "Показать ещё" button */}
        {filteredProducts.length > visibleCount ? (
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setVisibleCount((c) => c + 24)}
              className="rounded-2xl border border-slate-300 bg-white px-8 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:border-slate-400"
            >
              Показать ещё ({filteredProducts.length - visibleCount} из {filteredProducts.length})
            </button>
          </div>
        ) : null}

        {filteredProducts.length === 0 ? (
          <div className="mt-6 rounded-[var(--radius-lg)] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            {searchMatchesBySection && searchMatchesBySection.length > 0 ? (
              <>
                <p className="font-semibold text-slate-950">
                  В этом разделе ничего нет, но есть в других
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {searchMatchesBySection.map((match) => (
                    <button
                      key={match.id}
                      type="button"
                      onClick={() => {
                        setSection(match.id);
                        setVisibleCount(24);
                      }}
                      className="inline-flex min-h-11 items-center rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)]"
                    >
                      {match.label} ({match.count})
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p>Ничего не найдено.</p>
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="mt-3 inline-flex min-h-11 items-center rounded-[var(--radius-sm)] border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-100"
                  >
                    Сбросить поиск
                  </button>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        {/* Dependencies / warnings */}
        {selectedEntries.length > 0 ? (
          <CatalogWarnings
            psuOptions={clarusPsuOptions}
            missingMounts={missingMounts}
            missingLamps={missingLamps}
            onAddPsu={setClarusPsu}
            onAddMount={addMountOneToOne}
            onAddLamp={(socket, cheapestLampId) => {
              addLampOneToOneCheapest(socket, cheapestLampId);
              setSection("lamps");
              setLampSocket(socket);
              setQuery("");
            }}
          />
        ) : null}

        <LightingCartDrawer
          open={cartOpen}
          onClose={() => setCartOpen(false)}
          entries={lightingCart.entries}
          totalRub={lightingCart.totalRub}
          discountedTotalRub={lightingCart.discountedTotalRub}
          withCeilingTotalRub={lightingCart.withCeilingTotalRub}
          onSetQty={(entry, qty) => lightingCart.setQty(entry.product, qty)}
          onRemove={(productId) => lightingCart.remove(productId)}
          onCheckout={() => {
            setCartOpen(false);
            openLightingOrder();
          }}
        />

        {!data.ok ? (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-950">
            Каталог временно не загрузился. Напишите мне — подберу комплект вручную.
          </div>
        ) : null}
      </Container>
    </Section>
  );
}
