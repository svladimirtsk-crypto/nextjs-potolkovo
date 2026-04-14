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

export function CatalogSection() {
  const { openCalculator } = useCalculatorModal();

  const [activeCategoryId, setActiveCategoryId] = useState(
    catalog.categories[0]?.id ?? ""
  );
  const [searchQuery, setSearchQuery]     = useState("");
  const [cartItems, setCartItems]         = useState<CartItems>({});
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set()
  );

  const HITS_COUNT = 4;

  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return catalog.products.filter(
      (p) =>
        p.categoryId === activeCategoryId &&
        (q === "" || p.title.toLowerCase().includes(q))
    );
  }, [activeCategoryId, searchQuery]);

  const isExpanded    = expandedCategories.has(activeCategoryId);
  const visibleProducts = isExpanded
    ? filteredProducts
    : filteredProducts.slice(0, HITS_COUNT);

  const cartTotal = useMemo(() => {
    return Object.entries(cartItems).reduce((sum, [sku, qty]) => {
      const product = catalog.products.find((p) => p.id === sku);
      return sum + qty * (product?.priceRub ?? 0);
    }, 0);
  }, [cartItems]);

  const cartCount = Object.values(cartItems).reduce(
    (sum, qty) => sum + qty,
    0
  );

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

    const totalRub         = items.reduce((sum, i) => sum + i.qty * i.priceRub, 0);
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
          {/* Search */}
          <input
            type="search"
            placeholder="Поиск по каталогу..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full max-w-md rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
            aria-label="Поиск по каталогу"
          />

          {/* Category tabs */}
          <div className="flex flex-wrap gap-2">
            {catalog.categories.map((cat) => (
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

          {/* Products grid */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleProducts.length === 0 ? (
              <p className="col-span-full py-8 text-center text-sm text-slate-500">
                Ничего не найдено
              </p>
            ) : null}

            {visibleProducts.map((product) => {
              const qty      = cartItems[product.id] ?? 0;
              const hasPrice = product.priceRub !== null;

              return (
                <div
                  key={product.id}
                  className="flex flex-col justify-between rounded-[1.5rem] border border-slate-200 bg-white p-5"
                >
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-950 leading-6">
                      {product.title}
                    </p>

                    {product.specs.length > 0 ? (
                      <ul className="mt-2 space-y-0.5">
                        {product.specs.slice(0, 3).map((spec) => (
                          <li
                            key={spec.label}
                            className="text-xs text-slate-500"
                          >
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

          {/* Show more */}
          {filteredProducts.length > HITS_COUNT && !isExpanded ? (
            <button
              type="button"
              onClick={() =>
                setExpandedCategories(
                  (prev) => new Set([...prev, activeCategoryId])
                )
              }
              className="w-full rounded-2xl border border-dashed border-slate-200 py-3 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-700 transition-colors"
            >
              Показать ещё {filteredProducts.length - HITS_COUNT} позиций
            </button>
          ) : null}

          <p className="text-xs text-slate-400">{catalog.disclaimer}</p>
        </div>

        {/* Sticky cart summary */}
        {cartCount > 0 ? (
          <div className="mt-8 rounded-[1.5rem] border border-slate-950 bg-slate-950 p-6 text-white">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-white/70">
                  Выбрано позиций: {cartCount}
                </p>
                <p className="mt-1 text-2xl font-bold">
                  {fmt(cartTotal)} ₽
                </p>
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
    </Section>
  );
}
