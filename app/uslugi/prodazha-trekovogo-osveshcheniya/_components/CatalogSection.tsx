// app/uslugi/prodazha-trekovogo-osveshcheniya/_components/CatalogSection.tsx
"use client";

import { useMemo, useState } from "react";

import { catalog } from "@/content/eksmarket-assortment";
import type { LightingItem, LightingSnapshot } from "@/lib/calculator-modal-types";
import { applyLightingDiscount } from "@/lib/lighting-formulas";
import { useCalculatorModal } from "@/components/calculator-modal/calculator-modal-context";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Section } from "@/components/ui/section";
import { Button } from "@/components/ui/button";

function fmt(n: number) {
  return new Intl.NumberFormat("ru-RU").format(n);
}

type CartItems = Record<string, number>;
type CatalogGroup = "track" | "lights";

const GROUPS: Record<CatalogGroup, { title: string; categoryIds: string[] }> = {
  track: {
    title: "Трековое",
    categoryIds: ["colibri-220v", "clarus-48v", "art-220v"],
  },
  lights: {
    title: "Светильники",
    categoryIds: ["panels-loft", "gx53", "mr16"],
  },
};

export function CatalogSection() {
  const { openCalculator } = useCalculatorModal();

  const [activeGroup, setActiveGroup] = useState<CatalogGroup>("track");
  const [activeCategoryId, setActiveCategoryId] = useState(
    GROUPS.track.categoryIds[0] ?? catalog.categories[0]?.id ?? ""
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [cartItems, setCartItems] = useState<CartItems>({});
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const HITS_COUNT = 4;

  const groupCategories = useMemo(() => {
    const ids = new Set(GROUPS[activeGroup].categoryIds);
    return catalog.categories.filter((cat) => ids.has(cat.id));
  }, [activeGroup]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return catalog.products.filter(
      (p) =>
        p.categoryId === activeCategoryId &&
        (q === "" || p.title.toLowerCase().includes(q))
    );
  }, [activeCategoryId, searchQuery]);

  const isExpanded = expandedCategories.has(activeCategoryId);
  const visibleProducts = isExpanded
    ? filteredProducts
    : filteredProducts.slice(0, HITS_COUNT);

  const cartTotal = useMemo(() => {
    return Object.entries(cartItems).reduce((sum, [sku, qty]) => {
      const product = catalog.products.find((p) => p.id === sku);
      return sum + qty * (product?.priceRub ?? 0);
    }, 0);
  }, [cartItems]);

  const cartCount = Object.values(cartItems).reduce((sum, qty) => sum + qty, 0);

  const setQty = (sku: string, qty: number) => {
    setCartItems((prev) => ({ ...prev, [sku]: Math.max(0, qty) }));
  };

  const handleOpenModal = () => {
    const items: LightingItem[] = Object.entries(cartItems)
      .filter(([, qty]) => qty > 0)
      .map(([sku, qty]) => {
        const product = catalog.products.find((p) => p.id === sku);
        return {
          sku,
          name: product?.title ?? sku,
          qty,
          priceRub: product?.priceRub ?? 0,
        };
      });

    if (items.length === 0) {
      openCalculator({ initialStep: 0, source: "catalog-page-empty" });
      return;
    }

    const totalRub = items.reduce((sum, i) => sum + i.qty * i.priceRub, 0);
    const discountedTotalRub = applyLightingDiscount(totalRub);

    const lighting: LightingSnapshot = {
      mode: "catalog",
      items,
      totalRub,
      discountedTotalRub,
      userCustomizedLighting: true,
    };

    openCalculator({
      initialLighting: lighting,
      initialStep: 2,
      source: "catalog-page",
    });
  };

  return (
    <Section id="catalog" className="scroll-mt-24 bg-white">
      <Container>
        <Heading
          eyebrow="Каталог"
          title="Полный каталог освещения"
          description="Выберите позиции — добавятся в расчёт. Скидка 15% на всё оборудование при заказе натяжного потолка."
        />

        <div className="mt-10 space-y-6">
          <input
            type="search"
            placeholder="Поиск по каталогу..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full max-w-md rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
            aria-label="Поиск по каталогу"
          />

          <div className="flex flex-wrap gap-2">
            {(Object.keys(GROUPS) as CatalogGroup[]).map((groupKey) => {
              const group = GROUPS[groupKey];
              const isActive = activeGroup === groupKey;
              return (
                <button
                  key={groupKey}
                  type="button"
                  onClick={() => {
                    setActiveGroup(groupKey);
                    setActiveCategoryId(group.categoryIds[0] ?? "");
                    setSearchQuery("");
                  }}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
                  }`}
                >
                  {group.title}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            {groupCategories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setActiveCategoryId(cat.id);
                  setSearchQuery("");
                }}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  activeCategoryId === cat.id
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
                }`}
              >
                {cat.title}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleProducts.length === 0 ? (
              <p className="col-span-full py-8 text-center text-sm text-slate-500">
                Ничего не найдено
              </p>
            ) : null}

            {visibleProducts.map((product) => {
              const qty = cartItems[product.id] ?? 0;
              const hasPrice = product.priceRub !== null;
              const specsToShow = product.keyAttributes ?? product.specs.slice(0, 4);

              const hasSmart = [...specsToShow, ...product.specs].some(
                (spec) =>
                  spec.label === "Управление" &&
                  spec.value.toUpperCase().includes("SMART")
              );

              return (
                <div
                  key={product.id}
                  className="flex flex-col justify-between rounded-[1.5rem] border border-slate-200 bg-white p-5"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-950 leading-6">
                        {product.title}
                      </p>
                      {hasSmart ? (
                        <span className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          SMART
                        </span>
                      ) : null}
                    </div>

                    {specsToShow.length > 0 ? (
                      <ul className="mt-2 space-y-0.5">
                        {specsToShow.map((spec) => (
                          <li key={spec.label} className="text-xs text-slate-500">
                            {spec.label}: {spec.value}
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    {product.colors && product.colors.length > 0 ? (
                      <p className="mt-1 text-xs text-slate-400">
                        Цвета: {product.colors.join(", ")}
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    {hasPrice ? (
                      <p className="text-base font-bold text-slate-950">
                        {fmt(product.priceRub!)} ₽
                      </p>
                    ) : (
                      <p className="text-sm text-slate-400">По запросу</p>
                    )}

                    {hasPrice ? (
                      qty === 0 ? (
                        <button
                          type="button"
                          onClick={() => setQty(product.id, 1)}
                          className="rounded-full border border-slate-950 bg-slate-950 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
                        >
                          + В расчёт
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setQty(product.id, qty - 1)}
                            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-950 hover:bg-slate-50 transition-colors"
                            aria-label="Уменьшить"
                          >
                            −
                          </button>
                          <span className="w-5 text-center text-sm font-semibold text-slate-950">
                            {qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => setQty(product.id, qty + 1)}
                            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-950 hover:bg-slate-50 transition-colors"
                            aria-label="Увеличить"
                          >
                            +
                          </button>
                        </div>
                      )
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredProducts.length > HITS_COUNT && !isExpanded ? (
            <button
              type="button"
              onClick={() =>
                setExpandedCategories((prev) => new Set([...prev, activeCategoryId]))
              }
              className="w-full rounded-2xl border border-dashed border-slate-200 py-3 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-700 transition-colors"
            >
              Показать ещё {filteredProducts.length - HITS_COUNT} позиций
            </button>
          ) : null}

          <p className="text-xs text-slate-400">{catalog.disclaimer}</p>
        </div>

        {cartCount > 0 ? (
          <div className="mt-8 hidden sm:block rounded-[1.5rem] border border-slate-950 bg-slate-950 p-6 text-white">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-white/70">Выбрано позиций: {cartCount}</p>
                <p className="mt-1 text-2xl font-bold">{fmt(cartTotal)} ₽</p>
                <p className="text-xs text-emerald-400 mt-0.5">
                  → {fmt(applyLightingDiscount(cartTotal))} ₽ со скидкой 15%
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={handleOpenModal}
                className="justify-center sm:shrink-0"
              >
                Перейти к итогу →
              </Button>
            </div>
          </div>
        ) : null}
      </Container>

      {cartCount > 0 ? (
        <div
          className="sm:hidden fixed bottom-0 inset-x-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
        >
          <div className="flex items-center gap-3 max-w-6xl mx-auto">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-500">
                {cartCount}{" "}
                {cartCount === 1 ? "позиция" : cartCount < 5 ? "позиции" : "позиций"} в расчёте
              </p>
              <p className="text-lg font-bold text-slate-950 truncate">
                {fmt(cartTotal)} ₽ →{" "}
                <span className="text-emerald-600">{fmt(applyLightingDiscount(cartTotal))} ₽</span>
              </p>
            </div>
            <Button type="button" onClick={handleOpenModal} className="shrink-0 justify-center">
              К итогу →
            </Button>
          </div>
        </div>
      ) : null}
    </Section>
  );
}
