"use client";

import { useMemo, useState } from "react";

import { catalog } from "@/content/eksmarket-assortment";
import type { ServiceCalculatorPreset } from "@/content/services";
import { formatPrice, calcDiscountedPrice } from "@/lib/price-utils";
import { PriceCalculatorClient } from "@/components/home/price-calculator-client";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Section } from "@/components/ui/section";
import {
  useTrackSaleIntent,
  type SelectedProduct,
} from "./TrackSaleIntentContext";

type TrackSaleCatalogSectionProps = {
  preset: ServiceCalculatorPreset;
  sectionTitle: string;
  sectionIntro: string;
};

export function TrackSaleCatalogSection({
  preset,
  sectionTitle,
  sectionIntro,
}: TrackSaleCatalogSectionProps) {
  const { mode, selectedProducts, toggleProduct, clearSelection, isSelected, count } =
    useTrackSaleIntent();

  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [calculatorExpanded, setCalculatorExpanded] = useState(false);

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

  const handleToggle = (product: (typeof catalog.products)[number]) => {
    const selected: SelectedProduct = {
      sku: product.id,
      title: product.title,
      providerUrl: product.url,
      priceRetail: product.priceRub,
      priceWithCeiling: calcDiscountedPrice(
        product.priceRub,
        catalog.discountPercentForCeilingOrder
      ),
      imageUrl: product.imageUrl,
    };
    toggleProduct(selected);
  };

  return (
    <Section id="price" className="scroll-mt-24 bg-white">
      <Container>
        <Heading
          eyebrow="Каталог"
          title={sectionTitle}
          description={sectionIntro}
        />

        {/* Calculator zone */}
        {mode === "install" ? (
          <div className="mt-10">
            <PriceCalculatorClient
              preset={preset}
              compactSections
            />
          </div>
        ) : (
          <div className="mt-10">
            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 overflow-hidden">
              <button
                type="button"
                onClick={() => setCalculatorExpanded((prev) => !prev)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                aria-expanded={calculatorExpanded}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-950">
                    Нужна установка в потолок?
                  </p>
                  <p className="mt-0.5 text-sm text-slate-500">
                    Посчитать монтаж и натяжной потолок со скидкой −15% на свет
                  </p>
                </div>
                <span
                  aria-hidden="true"
                  className={`shrink-0 text-sm text-slate-500 transition-transform ${
                    calculatorExpanded ? "rotate-180" : ""
                  }`}
                >
                  ▾
                </span>
              </button>

              {calculatorExpanded ? (
                <div className="border-t border-slate-200 p-4 sm:p-5">
                  <PriceCalculatorClient
                    preset={preset}
                    compactSections
                  />
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* Catalog header */}
        <div className="mt-16 mb-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-950">
            Ассортимент трекового освещения
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {catalog.disclaimer}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Данные актуальны на {catalog.updatedAt}
          </p>
        </div>

        {/* Selection panel */}
        {count > 0 ? (
          <div className="mb-6 rounded-2xl border border-slate-950 bg-slate-950 text-white px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center justify-center h-7 min-w-[28px] px-2 rounded-full bg-white text-slate-950 text-xs font-bold">
                {count}
              </span>
              <span className="text-sm font-medium">
                {count === 1
                  ? "позиция в подборке"
                  : count < 5
                  ? "позиции в подборке"
                  : "позиций в подборке"}
              </span>
              <span className="text-xs text-white/60">
                Количество/длины уточним при подтверждении
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={clearSelection}
                className="text-xs text-white/60 underline underline-offset-2 hover:text-white/90 transition-colors min-h-[48px] flex items-center"
              >
                Очистить
              </button>
              <Button
                href="#action"
                className="justify-center !bg-white !text-slate-950 hover:!bg-white/90"
              >
                Отправить на просчёт
              </Button>
            </div>
          </div>
        ) : null}

        {/* Filters */}
        <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
          <div className="flex flex-wrap gap-2">
            <CategoryButton
              active={activeCategory === "all"}
              onClick={() => setActiveCategory("all")}
              label="Все"
            />
            {catalog.categories.map((cat) => (
              <CategoryButton
                key={cat.id}
                active={activeCategory === cat.id}
                onClick={() => setActiveCategory(cat.id)}
                label={cat.title}
              />
            ))}
          </div>

          <div className="w-full sm:w-72">
            <input
              type="text"
              placeholder="Поиск по названию..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full min-h-[48px] rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
            />
          </div>
        </div>

        {/* Grid */}
        {filteredProducts.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            Товары не найдены
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => {
              const discountedPrice = calcDiscountedPrice(
                product.priceRub,
                catalog.discountPercentForCeilingOrder
              );
              const selected = isSelected(product.id);

              return (
                <article
                  key={product.id}
                  className={`flex flex-col h-full rounded-[1.5rem] border p-6 transition-shadow ${
                    selected
                      ? "border-slate-950 shadow-md bg-slate-50/50"
                      : "border-slate-200 bg-white shadow-sm hover:shadow-md"
                  }`}
                >
                  <div className="mb-4 flex-grow">
                    <h3 className="text-base font-semibold text-slate-950 mb-3 line-clamp-3">
                      {product.title}
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {product.specs.slice(0, 3).map((spec, idx) => (
                        <span
                          key={idx}
                          className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-lg"
                        >
                          {spec.value}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-auto border-t border-slate-100 pt-4">
                    <div className="mb-4">
                      <p className="text-sm text-slate-500 line-through">
                        Цена EKS: {formatPrice(product.priceRub)}
                      </p>
                      <p className="text-xl font-bold text-emerald-600 flex items-baseline gap-2 flex-wrap">
                        <span>
                          {mode === "install"
                            ? "С потолком: "
                            : "Со скидкой: "}
                          {formatPrice(discountedPrice)}
                        </span>
                        <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">
                          −{catalog.discountPercentForCeilingOrder}%
                        </span>
                      </p>
                    </div>

                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggle(product)}
                        className={`w-full inline-flex items-center justify-center rounded-2xl py-3 text-sm font-medium min-h-[48px] transition-colors focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
                          selected
                            ? "bg-slate-950 text-white"
                            : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {selected ? "✓ В подборке" : "В подбор"}
                      </button>

                      <a
                        href={product.url}
                        target="_blank"
                        rel="nofollow noopener noreferrer"
                        className="block text-center text-xs text-slate-400 hover:text-slate-600 transition-colors py-1 min-h-[48px] flex items-center justify-center"
                      >
                        Подробнее на {catalog.supplierName} ↗
                      </a>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Container>
    </Section>
  );
}

function CategoryButton({
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
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors min-h-[48px] focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
        active
          ? "bg-slate-950 text-white"
          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
      }`}
    >
      {label}
    </button>
  );
}
