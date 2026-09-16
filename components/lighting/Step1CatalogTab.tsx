"use client";

/**
 * PT-018 (B-F104) · Вкладка «Каталог» Шага 1 «Свет».
 *
 * 128 строк JSX внутри условия `activeTab === "catalog"`: напоминание о лампах,
 * предупреждение об «осиротевшем» треке, предложения комплектующих, ленты
 * разделов и фильтров, сетка товаров и режим «Выбранное». Всё это рисовалось
 * в оркестраторе Шага 1 рядом с корзиной, мастером и футером — файл нельзя было
 * читать сверху вниз.
 *
 * Разметка перенесена дословно (классы, порядок узлов, тексты и `key`), поэтому
 * E2E-снимки не меняются. Внутреннего состояния нет: компонент рисует то, что
 * ему передали, и зовёт обработчики.
 */
import { CatalogBrowse } from "@/components/lighting/CatalogBrowse";
import { CatalogFilterChipGroup, CatalogFilterChipsRow } from "@/components/lighting/CatalogFilterChips";
import { OrphanTrackNotice } from "@/components/lighting/CatalogPieces";
import { SelectedList, type SelectedListItem, type SelectedListTotals } from "@/components/lighting/SelectedList";
import {
  LAMP_SOCKETS,
  POINT_SUBTYPES,
  TRACK_GROUPS,
  TRACK_SYSTEMS,
  type CatalogSectionId,
  type LampSocket,
} from "@/lib/catalog-ui-config";
import type { CatalogViewMode } from "@/lib/calculator-modal-types";
import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";
import {
  LIGHTING_ONLY_DISCOUNT_PERCENT,
  LIGHTING_WITH_CEILING_DISCOUNT_PERCENT,
} from "@/lib/lighting-formulas";
import type { LampSocketCounts, MissingLamp } from "@/lib/lighting/cart-derived";
import type { AccessorySuggestion } from "@/lib/lighting/use-step1-cart";
import type { CatalogFilters } from "@/lib/lighting/use-catalog-filters";

export type Step1CatalogTabProps = {
  /** «Выбранное» или обычный просмотр каталога. */
  view: CatalogViewMode;
  /** Разделы, которые видно этому пользователю (T-043). */
  sections: readonly { id: CatalogSectionId; label: string }[];
  filters: CatalogFilters;
  /** Уже суженная разделом, фильтрами и поиском выдача. */
  products: readonly FeedCatalogProduct[];
  cartItems: Record<string, number>;
  hasCeilingContext: boolean;
  cardDiscountPercent: number;
  /** Форматирование чисел задаёт оркестратор — оно общее с остальным Шагом 1. */
  fmt: (value: number) => string;

  onQtyChange: (product: FeedCatalogProduct, qty: number) => void;
  onRemoveProduct: (productId: string) => void;
  onZoom: (image: { src: string; alt: string }) => void;

  lamps: {
    missing: readonly MissingLamp[];
    requiredBySocket: LampSocketCounts;
    currentBySocket: LampSocketCounts;
    onAddCheapest: (socket: LampSocket) => void;
  };

  /** T-024: трек выключен, но трековые позиции в корзине есть. */
  orphan: {
    show: boolean;
    meters: number;
    isLightingFirst: boolean;
    onDrop: () => void;
  };

  /** T-012: предложения по комплектующим — без принуждения. */
  suggestions: readonly AccessorySuggestion[];

  selected: {
    items: readonly SelectedListItem[];
    totals: SelectedListTotals;
    showWithCeilingHint: boolean;
    onGoToSummary: () => void;
    goToSummaryDisabled: boolean;
  };
};

export function Step1CatalogTab({
  view,
  sections,
  filters,
  products,
  cartItems,
  hasCeilingContext,
  cardDiscountPercent,
  fmt,
  onQtyChange,
  onRemoveProduct,
  onZoom,
  lamps,
  orphan,
  suggestions,
  selected,
}: Step1CatalogTabProps) {
  const { section, trackSystem, trackGroup, pointSubtype, lampSocket, query } = filters;

  return (
    <div key="catalog-tab" className="animate-fade-in space-y-4">
      {/* Lamp reminder */}
      {lamps.missing.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">Не хватает ламп</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {lamps.missing.map((m) => (
              <button key={m.socket} type="button" onClick={() => lamps.onAddCheapest(m.socket)}
                className="rounded-xl bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800">
                +{m.requiredQty - m.currentQty} ламп {m.socket}
              </button>
            ))}
          </div>
        </div>
      )}

      {orphan.show ? (
        <OrphanTrackNotice
          meters={orphan.meters}
          isLightingFirst={orphan.isLightingFirst}
          onDrop={orphan.onDrop}
        />
      ) : null}

      {view === "selected" && suggestions.length > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-950">Комплектующие</p>
          <p className="mt-1 text-xs text-amber-900">
            Это предложения — можно не добавлять или удалить позже.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.key}
                type="button"
                onClick={suggestion.apply}
                className="min-h-11 rounded-2xl border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-950 hover:bg-amber-100"
              >
                {suggestion.title} ({fmt(suggestion.priceRub)} ₽)
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {view === "selected" ? (
        <SelectedList
          items={selected.items}
          totals={selected.totals}
          showWithCeilingHint={selected.showWithCeilingHint}
          onQtyChange={onQtyChange}
          onRemove={onRemoveProduct}
          onGoToSummary={selected.onGoToSummary}
          goToSummaryDisabled={selected.goToSummaryDisabled}
        />
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar max-sm:-mx-5 max-sm:px-5">
            {sections.map((item) => (
              <button key={item.id} type="button" onClick={() => filters.selectSection(item.id)}
                className={["whitespace-nowrap rounded-xl border border-slate-200 px-3 py-2 text-sm max-sm:px-2.5 max-sm:py-1.5 max-sm:text-xs",
                  section === item.id ? "bg-slate-950 text-white" : "bg-white text-slate-700 hover:bg-slate-50"].join(" ")}>
                {item.label}
              </button>
            ))}
          </div>

          {/* N-051: ленты фильтров — общий компонент со страницей каталога. */}
          {section === "track-systems" ? (
            <CatalogFilterChipsRow ariaLabel="Трековые системы и группы">
              <CatalogFilterChipGroup
                options={TRACK_SYSTEMS}
                active={trackSystem}
                onSelect={filters.selectTrackSystem}
              />
              <CatalogFilterChipGroup
                options={TRACK_GROUPS}
                active={trackGroup}
                onSelect={filters.selectTrackGroup}
              />
            </CatalogFilterChipsRow>
          ) : null}

          {section === "point-fixtures" ? (
            <CatalogFilterChipsRow ariaLabel="Типы точечных светильников">
              <CatalogFilterChipGroup
                options={POINT_SUBTYPES}
                active={pointSubtype}
                onSelect={filters.selectPointSubtype}
              />
            </CatalogFilterChipsRow>
          ) : null}

          {section === "lamps" ? (
            <CatalogFilterChipsRow ariaLabel="Цоколи ламп">
              <CatalogFilterChipGroup
                options={LAMP_SOCKETS.map((socket) => ({
                  id: socket,
                  label:
                    lamps.currentBySocket[socket] > 0
                      ? `${socket} (${lamps.currentBySocket[socket]}/${lamps.requiredBySocket[socket]})`
                      : socket,
                }))}
                active={lampSocket}
                onSelect={filters.selectLampSocket}
              />
            </CatalogFilterChipsRow>
          ) : null}

          <CatalogBrowse
            query={query}
            onQueryChange={filters.setQuery}
            hasCeilingContext={hasCeilingContext}
            withCeilingPercent={LIGHTING_WITH_CEILING_DISCOUNT_PERCENT}
            lightingOnlyPercent={LIGHTING_ONLY_DISCOUNT_PERCENT}
            products={products}
            cartItems={cartItems}
            onQtyChange={onQtyChange}
            onZoom={onZoom}
            cardDiscountPercent={cardDiscountPercent}
          />
        </>
      )}
    </div>
  );
}
