"use client";

import { useMemo, useState } from "react";

import { catalog } from "@/content/eksmarket-assortment";
import { applyLightingDiscount } from "@/lib/lighting-formulas";
import type { LightingSnapshot } from "@/lib/calculator-modal-types";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Section } from "@/components/ui/section";
import { useCalculatorModal } from "@/components/calculator-modal/calculator-modal-context";

function fmt(n: number) {
  return new Intl.NumberFormat("ru-RU").format(n);
}

export function CatalogSection() {
  const { openCalculator } = useCalculatorModal();

  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [cartItems, setCartItems] = useState<Record<string, number>>({});

  const filteredProducts = useMemo(() => {
    return catalog.products.filter((product) => {
      const matchesCategory =
        activeCategory === "all" || product.categoryId === activeCategory;
      const matchesSearch =
        searchQuery === "" ||
        product.title.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  const handleCartChange = (sku: string, delta: number, priceRub: number | null) => {
    if (priceRub == null) return;
    setCartItems((prev) => {
      const next = { ...prev };
      const current = next[sku] ?? 0;
      const updated = Math.max(0, current + delta);
      if (updated === 0) {
        delete next[sku];
      } else {
        next[sku] = updated;
      }
      return next;
    });
  };

  const cartCount = Object.values(cartItems).reduce((s, q) => s + q, 0);

  const handleAddToCalc = () => {
    const items = Object.entries(cartItems)
      .filter(([, qty]) => qty > 0)
      .map(([sku, qty]) => {
        const product = catalog.products.find((p) => p.id === sku);
        if (!product || product.priceRub == null) return null;
        return { sku, name: product.title, qty, priceRub: product.priceRub };
      })
      .filter(Boolean) as LightingSnapshot["items"];

    if (!items || items.length === 0) return;

    const totalRub = items.reduce((sum, i) => sum + i.qty * i.priceRub, 0);

    openCalculator({
      initialStep: 2,
      initialLighting: {
        mode: "catalog",
        items,
        totalRub,
        discountedTotalRub: applyLightingDiscount(totalRub),
        userCustomizedLighting: true,
      },
      source: "catalog-page",
    });
  };

  return (
    <Section className="scroll-mt-24 bg-slate-50">
      <Container>
        <Heading
          eyebrow="Каталог"
          title="Полный ассортимент"
          description={catalog.disclaimer}
        />

        <div className="mt-8 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex flex-wrap gap-2">
            <CatTab
              active={activeCategory === "all"}
              onClick={() => setActiveCategory("all")}
              label="Все"
            />
            {catalog.categories.map((cat) => (
              <CatTab
                key={cat.id}
                active={activeCategory === cat.id}
                onClick={() => setActiveCategory(cat.id)}
                label={cat.title}
              />
            ))}
          </div>

          <input
            type="search"
            placeholder="Поиск..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-64 min-h-[48px] rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
          />
        </div>

        <div className="mt-6 space-y-6">
          {filteredProducts.map((product) => {
            const qty = cartItems[product.id] ?? 0;
            const noPrice = product.priceRub == null;

            return (
              <div
                key={product.id}
                className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-950">{product.title}</p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {product.specs.slice(0, 3).map((spec, idx) => (
                      <span
                        key={idx}
                        className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded"
                      >
                        {spec.value}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-slate-950">
                    {noPrice ? "По запросу" : `${fmt(product.priceRub)} ₽`}
                  </p>
                </div>

                <div className="shrink-0">
                  {noPrice ? null : qty === 0 ? (
                    <button
                      type="button"
                      onClick={() => handleCartChange(product.id, 1, product.priceRub)}
                      className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 min-h-[48px]"
                    >
                      Добавить
                    </button>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleCartChange(product.id, -1, product.priceRub)}
                        className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100"
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-sm font-semibold text-slate-950">
                        {qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCartChange(product.id, 1, product.priceRub)}
                        className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100"
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {cartCount > 0 && (
          <div className="mt-8 sticky bottom-20 md:bottom-4 z-10 flex justify-center">
            <Button
              type="button"
              className="shadow-lg py-6 text-base"
              onClick={handleAddToCalc}
            >
              Добавить в расчёт ({cartCount} шт.)
            </Button>
          </div>
        )}
      </Container>
    </Section>
  );
}

function CatTab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 rounded-full text-xs font-medium transition-colors min-h-[48px] ${
        active
          ? "bg-slate-950 text-white"
          : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-100"
      }`}
    >
      {label}
    </button>
  );
}
