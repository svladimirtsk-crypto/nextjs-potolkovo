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
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

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

  return (
    <Section id="price" className="scroll-mt-24 bg-white">
      <Container>
        <Heading
          eyebrow="Каталог"
          title={sectionTitle}
          description={sectionIntro}
        />

        {/* Калькулятор */}
        <div className="mt-10">
          <PriceCalculatorClient
            preset={preset}
            compactSections
          />
        </div>

        {/* Заголовок каталога */}
        <div className="mt-16 mb-8">
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

        {/* Фильтры */}
        <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveCategory("all")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors min-h-[48px] focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
                activeCategory === "all"
                  ? "bg-slate-950 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Все
            </button>
            {catalog.categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors min-h-[48px] focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
                  activeCategory === cat.id
                    ? "bg-slate-950 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {cat.title}
              </button>
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

        {/* Грид товаров */}
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

              return (
                <article
                  key={product.id}
                  className="flex flex-col h-full rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
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
                        Ценa EKS: {formatPrice(product.priceRub)}
                      </p>
                      <p className="text-xl font-bold text-emerald-600 flex items-baseline gap-2 flex-wrap">
                        <span>С потолком: {formatPrice(discountedPrice)}</span>
                        <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">
                          −{catalog.discountPercentForCeilingOrder}%
                        </span>
                      </p>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Button
                        href="#action"
                        className="w-full justify-center"
                      >
                        Оставить заявку
                      </Button>
                      <a
                        href={product.url}
                        target="_blank"
                        rel="nofollow noopener noreferrer"
                        className="w-full inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white text-slate-700 font-medium py-3 text-sm hover:bg-slate-50 transition-colors min-h-[48px] focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                      >
                        Открыть на {catalog.supplierName}
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
