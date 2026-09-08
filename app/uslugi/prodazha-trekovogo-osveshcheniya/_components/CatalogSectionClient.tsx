"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useCalculatorModal } from "@/components/calculator-modal/calculator-modal-context";
import { useCalculatorStore } from "@/lib/calculator/store";
import type { CalculatorLeadSnapshot } from "@/lib/calculator/snapshot-types";
import { normalizeQty } from "@/lib/lighting/product-predicates";
import catalogImages from "@/data/catalog-images.json";
import { CATALOG_PAGE_SIZE, CatalogGrid } from "@/components/lighting/CatalogGrid";
import { CatalogFreshness } from "./CatalogFreshness";
import { CatalogWarnings } from "./CatalogWarnings";
import { CatalogFilterChipGroup, CatalogFilterChipsRow } from "@/components/lighting/CatalogFilterChips";
import {
  buildCatalogLightingSnapshot,
  cartToLightingItems,
  productToLightingItem,
} from "@/lib/lighting/catalog-checkout";
import {
  filterCatalogProducts,
  searchMatchesBySection,
} from "@/lib/lighting/catalog-filters";
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

import {
  CATALOG_SECTIONS,
  POINT_SUBTYPES,
  TRACK_GROUPS,
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

import { applyVendorOverrides } from "@/lib/vendor-code-overrides";

type CartItems = Record<string, number>;

function fmt(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(Math.round(value));
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
    const items = cartToLightingItems(selectedEntries);

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

    const initialLighting = buildCatalogLightingSnapshot(items);

    trackLightingCartCheckout({
      mode: "open-calculator",
      itemsCount: items.length,
      lightingTotalRub: initialLighting.totalRub,
      lightingDiscountedRub: initialLighting.discountedTotalRub,
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
    const items = cartToLightingItems(selectedEntries);
    if (items.length === 0) return;

    const initialLighting = buildCatalogLightingSnapshot(items);

    trackLightingCartCheckout({
      mode: "lighting-only",
      itemsCount: items.length,
      lightingTotalRub: initialLighting.totalRub,
      lightingDiscountedRub: initialLighting.discountedTotalRub,
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
    const items = cartToLightingItems(selectedEntries);

    if (items.length === 0) {
      openCalculator({ initialStep: 0, source: "track-sale-add-ceiling-empty" });
      return;
    }

    const initialLighting = buildCatalogLightingSnapshot(items);

    trackLightingCartCheckout({
      mode: "with-ceiling",
      itemsCount: items.length,
      lightingTotalRub: initialLighting.totalRub,
      lightingDiscountedRub: initialLighting.withCeilingDiscountedTotalRub,
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
  /** Есть ли у товара локальное фото — влияет только на порядок показа. */
  const hasPhoto = useCallback(
    (product: FeedCatalogProduct) => toText(product.productId) in (catalogImages as Record<string, unknown>),
    [],
  );

  const filters = useMemo(
    () => ({ section, trackSystem, trackGroup, pointSubtype, lampSocket, smartOnly, query }),
    [section, trackSystem, trackGroup, pointSubtype, lampSocket, smartOnly, query],
  );

  const filteredProducts = useMemo(
    () => filterCatalogProducts(products, filters, hasPhoto),
    [products, filters, hasPhoto],
  );

  const searchMatches = useMemo(
    () => searchMatchesBySection(products, query, section),
    [products, query, section],
  );

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
          <CatalogFilterChipsRow ariaLabel="Система и группа трека">
            <CatalogFilterChipGroup
              options={TRACK_SYSTEMS}
              active={trackSystem}
              onSelect={(id) => {
                setTrackSystem(id);
                setQuery("");
              }}
            />
            <CatalogFilterChipGroup
              options={TRACK_GROUPS}
              active={trackGroup}
              onSelect={(id) => {
                setTrackGroup(id);
                setQuery("");
              }}
            />
          </CatalogFilterChipsRow>
        ) : null}

        {section === "point-fixtures" ? (
          <CatalogFilterChipsRow ariaLabel="Тип точечного светильника">
            <CatalogFilterChipGroup
              options={POINT_SUBTYPES}
              active={pointSubtype}
              onSelect={(id) => {
                setPointSubtype(id);
                setQuery("");
              }}
            />
          </CatalogFilterChipsRow>
        ) : null}

        {section === "lamps" ? (
          <CatalogFilterChipsRow ariaLabel="Цоколь лампы">
            <CatalogFilterChipGroup
              options={LAMP_SOCKETS.map((socket) => ({ id: socket, label: socket }))}
              active={lampSocket}
              onSelect={(id) => {
                setLampSocket(id);
                setQuery("");
              }}
            />
          </CatalogFilterChipsRow>
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
        {searchMatches && searchMatchesBySection.length > 0 ? (
          <div aria-live="polite" className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-slate-600">Найдено ещё:</span>
            {searchMatches.map((match) => (
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
        <CatalogFreshness updatedAt={toText(data.updatedAt)} />

        <CatalogGrid
          products={filteredProducts}
          visibleCount={visibleCount}
          onShowMore={() => setVisibleCount((c) => c + CATALOG_PAGE_SIZE)}
          cartItems={cartItems}
          onIncrement={(product, qty) => void incrementProduct(product, qty)}
          onDecrement={(product, qty) =>
            setCartItems((prev) => {
              const next = { ...prev };
              const id = toText(product.productId);
              if (qty <= 0) delete next[id];
              else next[id] = qty;
              return next;
            })
          }
          sectionId={section}
          searchMatches={searchMatches && searchMatchesBySection.length > 0 ? searchMatches : []}
          onPickSection={(id) => {
            setSection(id);
            setVisibleCount(CATALOG_PAGE_SIZE);
          }}
          query={query}
          onResetQuery={() => setQuery("")}
        />

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
