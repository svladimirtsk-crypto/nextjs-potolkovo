"use client";

import { useEffect, useMemo, useState } from "react";

import { useCalculatorModal } from "@/components/calculator-modal/calculator-modal-context";
import { useCalculatorStore } from "@/lib/calculator/store";
import { CATALOG_PAGE_SIZE, CatalogGrid } from "@/components/lighting/CatalogGrid";
import { CatalogFreshness } from "./CatalogFreshness";
import { CatalogWarnings } from "./CatalogWarnings";
import { CatalogFilterChipGroup, CatalogFilterChipsRow } from "@/components/lighting/CatalogFilterChips";
import {
  buildCatalogLightingSnapshot,
  cartToLightingItems,
} from "@/lib/lighting/catalog-checkout";
import {
  filterCatalogProducts,
  searchMatchesBySection,
} from "@/lib/lighting/catalog-filters";
import { toText } from "@/lib/feed2-snapshot-normalize";
import {
  buildLightingSnapshotFromItems,
  nextCatalogSnapshot,
} from "@/lib/lighting/track-sale-snapshot";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Section } from "@/components/ui/section";

import type { FeedCatalogResult } from "@/lib/eks-feed2-catalog";

import { trackLightingCartCheckout, trackSmartInterestSelected } from "@/lib/analytics";
import { useLightingCart } from "@/lib/lighting/use-lighting-cart";
import { askCheckoutIntent } from "./ask-checkout-intent";
import { useTrackSaleCart } from "./use-track-sale-cart";
import { LightingCartDrawer } from "@/components/lighting/LightingCartDrawer";

import {
  LIGHTING_ONLY_DISCOUNT_PERCENT,
  LIGHTING_WITH_CEILING_DISCOUNT_PERCENT,
} from "@/lib/lighting-formulas";

import {
  CATALOG_SECTIONS,
  POINT_SUBTYPES,
  TRACK_GROUPS,
  TRACK_SYSTEMS,
  isRemovedColibriVendorCode,
  LAMP_SOCKETS,
} from "@/lib/catalog-ui-config";

import { applyVendorOverrides } from "@/lib/vendor-code-overrides";
import { useCatalogFilters } from "@/lib/lighting/use-catalog-filters";
import { useCatalogIndex } from "@/lib/lighting/use-catalog-index";


function fmt(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(Math.round(value));
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

  /** N-051: индексы каталога — общий хук с каталогом внутри модалки. */
  const { byProductId, productIdByVendorCode, resolveProduct } = useCatalogIndex(products);

  /**
   * N-051: состояние фильтров — общий хук с каталогом внутри модалки.
   * Правила сброса запроса и пагинации живут там, а не размазаны по
   * обработчикам каждого чипа.
   */
  const catalogFilters = useCatalogFilters({
    onResultsReset: () => setVisibleCount(CATALOG_PAGE_SIZE),
  });
  const { section, trackSystem, trackGroup, pointSubtype, lampSocket, query } = catalogFilters;
  const [smartOnly, setSmartOnly] = useState(false);
  /**
   * T-031: корзина общая с модалкой (`lightingDraft`), локального состояния нет —
   * счётчики страницы и калькулятора всегда совпадают, комплект не теряется.
   */
  const lightingCart = useLightingCart(resolveProduct);
  const [visibleCount, setVisibleCount] = useState(24);
  const [cartOpen, setCartOpen] = useState(false);

  /* ─── Корзина страницы и её производные (PT-018: `use-track-sale-cart`) ───
   * Правила — в `catalog-kit-gaps` и `catalog-checkout`; хук их только собирает.
   * Источник корзины один: `lightingDraft` через `useLightingCart`. */
  const {
    cartItems, setCartItems, selectedEntries, selectedLightingItems, selectedTotal,
    lightingOnlySelectedTotal, missingMounts, missingLamps, clarusPsuOptions,
    setClarusPsu, addMountOneToOne, addLampOneToOneCheapest, incrementProduct,
  } = useTrackSaleCart({
    products,
    byProductId,
    productIdByVendorCode,
    resolveProduct,
    lightingCart,
  });

  /**
   * PT-018: комплект из каталога страницы пишется в общий снимок заявки.
   * Правило — чистая функция `nextCatalogSnapshot` (`lib/lighting/track-sale-snapshot`),
   * здесь остаётся только сам эффект-мост к стору (п. 0.7 ТЗ v2).
   */
  useEffect(() => {
    const lighting = buildLightingSnapshotFromItems(selectedLightingItems);
    setSnapshot((prev) =>
      nextCatalogSnapshot(prev, { lighting, selectedTotal, lightingOnlySelectedTotal })
    );
  }, [lightingOnlySelectedTotal, selectedLightingItems, selectedTotal, setSnapshot]);

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

  /** PT-011 · Экран интента вынесен в `askCheckoutIntent`: три исхода вместо «да/нет». */
  const openCheckoutIntent = async () => {
    if (selectedEntries.length === 0) return;

    const action = await askCheckoutIntent();
    if (action === "open-ceiling-flow") openWithCeiling();
    else if (action === "open-lighting-order") openLightingOrder();
    // "stay-in-catalog": диалог закрыли — корзина не меняется, никуда не идём.
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
   * N-020 · PT-017 (B-F109) · порядок показа задаёт `lib/catalog-photo`:
   * сначала позиции с локальным превью, затем с обложкой поставщика, затем
   * без фото. Скрывать товары без снимка нельзя — обязательное комплектующее
   * остаётся обязательным, поэтому они понижаются, а не исчезают.
   */
  const filters = useMemo(
    () => ({ section, trackSystem, trackGroup, pointSubtype, lampSocket, smartOnly, query }),
    [section, trackSystem, trackGroup, pointSubtype, lampSocket, smartOnly, query],
  );

  const filteredProducts = useMemo(
    () => filterCatalogProducts(products, filters),
    [products, filters],
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
                  catalogFilters.selectSection(item.id);
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
                if (next) catalogFilters.selectSection("track-systems");
                return next;
              });
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
              onSelect={catalogFilters.selectTrackSystem}
            />
            <CatalogFilterChipGroup
              options={TRACK_GROUPS}
              active={trackGroup}
              onSelect={catalogFilters.selectTrackGroup}
            />
          </CatalogFilterChipsRow>
        ) : null}

        {section === "point-fixtures" ? (
          <CatalogFilterChipsRow ariaLabel="Тип точечного светильника">
            <CatalogFilterChipGroup
              options={POINT_SUBTYPES}
              active={pointSubtype}
              onSelect={catalogFilters.selectPointSubtype}
            />
          </CatalogFilterChipsRow>
        ) : null}

        {section === "lamps" ? (
          <CatalogFilterChipsRow ariaLabel="Цоколь лампы">
            <CatalogFilterChipGroup
              options={LAMP_SOCKETS.map((socket) => ({ id: socket, label: socket }))}
              active={lampSocket}
              onSelect={catalogFilters.selectLampSocket}
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
          onChange={(event) => catalogFilters.setQuery(String(event.target.value ?? ""))}
          placeholder="Поиск по всему каталогу"
          aria-label="Поиск по каталогу"
          className="w-full rounded-[var(--radius-md)] border border-slate-300 bg-white pl-10 pr-10 py-3 text-sm text-slate-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2"
        />
          {query ? (
            <button
              type="button"
              onClick={catalogFilters.resetQuery}
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
                onClick={() => catalogFilters.selectSection(match.id)}
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
          onPickSection={catalogFilters.selectSection}
          query={query}
          onResetQuery={catalogFilters.resetQuery}
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
              // Ведём человека туда, куда только что добавили лампу.
              catalogFilters.selectSection("lamps");
              catalogFilters.selectLampSocket(socket);
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
