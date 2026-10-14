"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useCalculatorModal } from "@/components/calculator-modal/calculator-modal-context";
import { useCalculatorStore } from "@/lib/calculator/store";
import { CATALOG_PAGE_SIZE, CatalogGrid } from "@/components/lighting/CatalogGrid";
import { CatalogFreshness } from "./CatalogFreshness";
import { CatalogWarnings } from "./CatalogWarnings";
import { CatalogNavigation, CatalogToolbar } from "./CatalogControls";
import { CatalogCartBar } from "./CatalogCartBar";
import { catalogViewProducts, sortCatalogProducts, type CatalogSort } from "@/lib/lighting/catalog-presentation";
import { isSmartProduct } from "@/lib/lighting/product-predicates";
import {
  buildCatalogLightingSnapshot,
  cartToLightingItems,
} from "@/lib/lighting/catalog-checkout";
import {
  searchMatchesBySection,
} from "@/lib/lighting/catalog-filters";
import { toText } from "@/lib/feed2-snapshot-normalize";
import {
  buildLightingSnapshotFromItems,
  nextCatalogSnapshot,
} from "@/lib/lighting/track-sale-snapshot";
import { Container } from "@/components/ui/container";
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

import { isRetiredCatalogProduct } from "@/lib/catalog-retirement";

import { applyVendorOverrides } from "@/lib/vendor-code-overrides";
import { useCatalogFilters } from "@/lib/lighting/use-catalog-filters";
import { useCatalogIndex } from "@/lib/lighting/use-catalog-index";


type Props = { data: FeedCatalogResult };

export function CatalogSectionClient({ data }: Props) {
  const { openCalculator } = useCalculatorModal();
  const { setSnapshot } = useCalculatorStore();

  const products = useMemo(() => {
    return (data.products ?? [])
      .filter((product) => !isRetiredCatalogProduct(product))
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
  const [sort, setSort] = useState<CatalogSort>("photo");
  /**
   * T-031: корзина общая с модалкой (`lightingDraft`), локального состояния нет —
   * счётчики страницы и калькулятора всегда совпадают, комплект не теряется.
   */
  const lightingCart = useLightingCart(resolveProduct);
  const [visibleCount, setVisibleCount] = useState(24);
  const [cartOpen, setCartOpen] = useState(false);
  const closeCart = useCallback(() => setCartOpen(false), []);

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
    () => sortCatalogProducts(catalogViewProducts(products, filters), sort),
    [products, filters, sort],
  );

  const searchMatches = useMemo(
    () => searchMatchesBySection(smartOnly ? products.filter(isSmartProduct) : products, query, section),
    [products, query, section, smartOnly],
  );

  const resetFilters = () => {
    catalogFilters.selectTrackSystem("COLIBRI_220");
    catalogFilters.selectTrackGroup("TRACK_FIXTURE");
    catalogFilters.selectPointSubtype("GX53");
    catalogFilters.selectLampSocket("GX53");
    catalogFilters.selectSection("track-systems");
    catalogFilters.resetQuery();
    setSmartOnly(false);
    setSort("photo");
    setVisibleCount(CATALOG_PAGE_SIZE);
  };

  const gapCount = clarusPsuOptions.length > 0 ? 1 + missingMounts.length + missingLamps.length : missingMounts.length + missingLamps.length;
  const kitReview = gapCount > 0 ? <details className="pk-kit-review">
    <summary>Комплектация: подсказок для проверки — {gapCount}</summary>
    <p>Это подсказки по текущим правилам каталога, не подтверждение полной совместимости. Мощность, питание и управление проверим отдельно.</p>

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

  </details> : null;

  return (
    <Section id="price" className={`pk-catalog ${selectedEntries.length ? "pk-catalog-has-cart" : ""}`}>
      <Container>
        <header className="pk-catalog-heading">
          <div><p className="pk-catalog-label">ПОТОЛКОВО / Свет для вашего проекта</p>
            <h2>Каталог освещения</h2>
            <p>От одного светильника до комплекта с потолком. Выберите позиции — питание, управление и состав проверим перед заказом.</p>
          </div>
          <button type="button" onClick={openInCalculator}>Собрать в калькуляторе <span aria-hidden="true">↗</span></button>
        </header>
        <div className="pk-catalog-pricing">
          <p><span>Только оборудование</span><strong>−{LIGHTING_ONLY_DISCOUNT_PERCENT}% <small>на свет</small></strong></p>
          <p><span>Вместе с потолком</span><strong>−{LIGHTING_WITH_CEILING_DISCOUNT_PERCENT}% <small>на свет</small></strong></p>
          <div><b>В карточках — цена только света.</b><CatalogFreshness updatedAt={toText(data.updatedAt)} /></div>
        </div>
        <div className="pk-catalog-layout">
          <CatalogNavigation filters={catalogFilters} smartOnly={smartOnly} onSmartChange={() => {
            const next = !smartOnly;
            setSmartOnly(next);
            setVisibleCount(CATALOG_PAGE_SIZE);
            trackSmartInterestSelected({ placement: "catalog", enabled: next, source: "track-sale-page" });
          }} />
          <div className="pk-catalog-content">
            <CatalogToolbar filters={catalogFilters} smartOnly={smartOnly} sort={sort}
              onSort={(value) => { setSort(value); setVisibleCount(CATALOG_PAGE_SIZE); }}
              onReset={resetFilters} matches={searchMatches ?? []} count={filteredProducts.length} visibleCount={visibleCount} />
            {kitReview}
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
          searchMatches={searchMatches ?? []}
          onPickSection={catalogFilters.selectSection}
          query={query}
          onResetQuery={catalogFilters.resetQuery}
          onResetFilters={resetFilters}
        />


          </div>
        </div>
        <CatalogCartBar count={selectedEntries.length} total={lightingOnlySelectedTotal} onView={openSelectedList} onCheckout={openCheckoutIntent} />

        <LightingCartDrawer
          open={cartOpen}
          onClose={closeCart}
          entries={lightingCart.entries}
          kitReview={kitReview}
          totalRub={lightingCart.totalRub}
          discountedTotalRub={lightingCart.discountedTotalRub}
          withCeilingTotalRub={lightingCart.withCeilingTotalRub}
          onSetQty={(entry, qty) => lightingCart.setQty(entry.product, qty)}
          onRemove={(productId) => lightingCart.remove(productId)}
          onCheckout={() => {
            // The drawer trigger disappears. Give the choice dialog a persistent
            // return target so Escape does not strand keyboard focus on <body>.
            document.querySelector<HTMLButtonElement>("[data-cart-bar] .pk-cart-bar-actions button:last-child")?.focus({ preventScroll: true });
            setCartOpen(false);
            void openCheckoutIntent();
          }}
        />

        {!data.ok ? (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-950">
            Каталог временно не загрузился. Напишите в ПОТОЛКОВО — обсудим состав комплекта.
          </div>
        ) : null}
      </Container>
    </Section>
  );
}
