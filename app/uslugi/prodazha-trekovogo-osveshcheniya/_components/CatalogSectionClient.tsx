// app/uslugi/prodazha-trekovogo-osveshcheniya/_components/CatalogSectionClient.tsx
"use client";

import { useMemo, useState } from "react";

import { useCalculatorModal } from "@/components/calculator-modal/calculator-modal-context";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Section } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import type { LightingItem, LightingSnapshot } from "@/lib/calculator-modal-types";
import { applyLightingDiscount } from "@/lib/lighting-formulas";
import type {
  FeedCatalogKind,
  FeedCatalogProduct,
  FeedCatalogResult,
  FeedCatalogSystem,
} from "@/lib/eks-feed2-catalog";

type Props = {
  data: FeedCatalogResult;
};

type CartMap = Record<string, number>;

const IMG_FALLBACK =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
      <rect width="100%" height="100%" fill="#f1f5f9"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial,sans-serif" font-size="26" fill="#64748b">Изображение товара</text>
    </svg>`
  );

function fmt(n: number) {
  return new Intl.NumberFormat("ru-RU").format(Math.round(n));
}

function getSystemLabel(system: FeedCatalogSystem): string {
  switch (system) {
    case "COLIBRI_220":
      return "COLIBRI 220V";
    case "CLARUS_48":
      return "CLARUS 48V";
    case "TRACK_220":
      return "220V";
    case "SMART_HOME":
      return "Умный дом";
    default:
      return "Прочее";
  }
}

function getKindLabel(kind: FeedCatalogKind): string {
  switch (kind) {
    case "TRACK_PROFILE":
      return "Профили";
    case "TRACK_ACCESSORY":
      return "Комплектующие трека";
    case "TRACK_FIXTURE":
      return "Трековые светильники";
    case "SPOT_FIXTURE":
      return "Точечные светильники";
    case "LAMP":
      return "Лампы";
    case "PSU":
      return "Блоки питания";
    case "CONTROL":
      return "Управление";
    case "LED_STRIP":
      return "Лента";
    case "CEILING_COMPONENT":
      return "Закладные и комплектующие";
    default:
      return "Другое";
  }
}

function stepForUnit(unit: "pcs" | "m"): number {
  return unit === "m" ? 0.5 : 1;
}

function minForUnit(unit: "pcs" | "m"): number {
  return unit === "m" ? 0.5 : 1;
}

export function CatalogSectionClient({ data }: Props) {
  const { openCalculator } = useCalculatorModal();

  const [systemFilter, setSystemFilter] = useState<FeedCatalogSystem | "all">("all");
  const [kindFilter, setKindFilter] = useState<FeedCatalogKind | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartMap>({});

  const products = data.products;

  const systemOptions = useMemo(() => {
    const unique = Array.from(new Set(products.map((p) => p.system)));
    return unique;
  }, [products]);

  const kindOptions = useMemo(() => {
    const unique = Array.from(new Set(products.map((p) => p.kind)));
    return unique;
  }, [products]);

  const productMap = useMemo(() => {
    return new Map(products.map((p) => [p.productId, p]));
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return products.filter((p) => {
      if (systemFilter !== "all" && p.system !== systemFilter) return false;
      if (kindFilter !== "all" && p.kind !== kindFilter) return false;
      if (!q) return true;

      const hay = `${p.name} ${p.vendorCode}`.toLowerCase();
      return hay.includes(q);
    });
  }, [products, searchQuery, systemFilter, kindFilter]);

  const selectedLines = useMemo(() => {
    return Object.entries(cart)
      .map(([productId, qty]) => {
        const product = productMap.get(productId);
        if (!product || qty <= 0) return null;
        return { product, qty };
      })
      .filter((x): x is { product: FeedCatalogProduct; qty: number } => x !== null);
  }, [cart, productMap]);

  const cartTotal = useMemo(() => {
    return selectedLines.reduce((sum, line) => sum + line.qty * line.product.priceRub, 0);
  }, [selectedLines]);

  const cartDiscountedTotal = useMemo(() => applyLightingDiscount(cartTotal), [cartTotal]);
  const cartBenefit = Math.max(0, cartTotal - cartDiscountedTotal);

  const setQty = (product: FeedCatalogProduct, nextQty: number) => {
    const step = stepForUnit(product.unit);
    const normalized = Math.max(0, Math.round(nextQty / step) * step);

    setCart((prev) => {
      if (normalized <= 0) {
        const clone = { ...prev };
        delete clone[product.productId];
        return clone;
      }
      return { ...prev, [product.productId]: normalized };
    });
  };

  const handleAdd = (product: FeedCatalogProduct) => {
    const current = cart[product.productId] ?? 0;
    const step = stepForUnit(product.unit);
    const min = minForUnit(product.unit);
    setQty(product, current > 0 ? current + step : min);
  };

  const handleTransferToCalculator = () => {
    const items: LightingItem[] = selectedLines.map((line) => ({
      sku: line.product.productId,
      name: line.product.name,
      qty: line.qty,
      priceRub: line.product.priceRub,
    }));

    const totalRub = items.reduce((sum, i) => sum + i.qty * i.priceRub, 0);
    const discountedTotalRub = applyLightingDiscount(totalRub);

    const initialLighting: LightingSnapshot = {
      mode: "catalog",
      items,
      totalRub,
      discountedTotalRub,
      userCustomizedLighting: true,
    };

    openCalculator({
      initialStep: 1,
      initialLightingTab: "catalog",
      initialLighting,
      source: "catalog_trek_page",
    });
  };

  const selectedCount = selectedLines.length;

  return (
    <Section id="catalog" className="scroll-mt-24 bg-white">
      <Container>
        <Heading
          eyebrow="Каталог"
          title="Каталог трекового освещения и комплектующих"
          description="Актуальные товары из feed2: добавьте в подборку и передайте в калькулятор."
        />

        <div className="mt-6">
          <Button
            type="button"
            onClick={() => openCalculator({ initialStep: 0, source: "catalog_trek_page_cta" })}
          >
            Открыть калькулятор потолка
          </Button>
        </div>

        {!data.ok ? (
          <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-semibold text-amber-900">Каталог временно недоступен</p>
            <p className="mt-1 text-sm text-amber-800">
              Не удалось загрузить feed2. Попробуйте обновить страницу позже.
            </p>
            {data.errorMessage ? (
              <p className="mt-2 text-xs text-amber-700">Тех.деталь: {data.errorMessage}</p>
            ) : null}
          </div>
        ) : null}

        {data.ok ? (
          <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
            <div>
              <div className="space-y-4">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск по названию или артикулу"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                />

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSystemFilter("all")}
                    className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                      systemFilter === "all"
                        ? "border-slate-950 bg-slate-950 text-white"
                        : "border-slate-200 text-slate-700 hover:border-slate-400"
                    }`}
                  >
                    Все системы
                  </button>
                  {systemOptions.map((system) => (
                    <button
                      key={system}
                      type="button"
                      onClick={() => setSystemFilter(system)}
                      className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                        systemFilter === system
                          ? "border-slate-950 bg-slate-950 text-white"
                          : "border-slate-200 text-slate-700 hover:border-slate-400"
                      }`}
                    >
                      {getSystemLabel(system)}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setKindFilter("all")}
                    className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                      kindFilter === "all"
                        ? "border-slate-950 bg-slate-950 text-white"
                        : "border-slate-200 text-slate-700 hover:border-slate-400"
                    }`}
                  >
                    Все типы
                  </button>
                  {kindOptions.map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => setKindFilter(kind)}
                      className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                        kindFilter === kind
                          ? "border-slate-950 bg-slate-950 text-white"
                          : "border-slate-200 text-slate-700 hover:border-slate-400"
                      }`}
                    >
                      {getKindLabel(kind)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {filteredProducts.length === 0 ? (
                  <p className="col-span-full py-8 text-center text-sm text-slate-500">
                    По текущим фильтрам ничего не найдено
                  </p>
                ) : null}

                {filteredProducts.map((product) => {
                  const qty = cart[product.productId] ?? 0;
                  const regular = product.priceRub;
                  const discounted = applyLightingDiscount(regular);
                  const benefit = Math.max(0, regular - discounted);
                  const src: string = String(product.coverImage || IMG_FALLBACK);

                  return (
                    <div
                      key={product.productId}
                      className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4"
                    >
                      <div>
                        <div className="mb-3 overflow-hidden rounded-xl border border-slate-100 bg-slate-50 aspect-[4/3]">
                          <img
                            src={src}
                            alt={product.name}
                            loading="lazy"
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              const img = e.currentTarget;
                              img.onerror = null;
                              img.src = IMG_FALLBACK;
                            }}
                          />
                        </div>

                        <p className="text-sm font-semibold text-slate-950 leading-5">{product.name}</p>
                        <p className="mt-1 text-xs text-slate-500">Артикул: {product.vendorCode}</p>

                        <ul className="mt-2 space-y-1">
                          {product.keyAttributes.slice(0, 4).map((a) => (
                            <li key={`${a.label}-${a.value}`} className="text-xs text-slate-500">
                              {a.label}: {a.value}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="mt-4">
                        <p className="text-xs text-slate-500">
                          Цена: {fmt(regular)} ₽{product.unit === "m" ? " / м" : ""}
                        </p>
                        <p className="text-sm font-semibold text-emerald-700">
                          Со скидкой: {fmt(discounted)} ₽{product.unit === "m" ? " / м" : ""}
                        </p>
                        <p className="text-xs text-emerald-600">Выгода: {fmt(benefit)} ₽</p>

                        <div className="mt-3 flex items-center justify-between gap-2">
                          {qty <= 0 ? (
                            <button
                              type="button"
                              onClick={() => handleAdd(product)}
                              className="rounded-full border border-slate-950 bg-slate-950 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
                            >
                              Добавить
                            </button>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setQty(product, qty - stepForUnit(product.unit))
                                }
                                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-950 hover:bg-slate-50 transition-colors"
                                aria-label="Уменьшить"
                              >
                                −
                              </button>
                              <span className="min-w-[48px] text-center text-sm font-semibold text-slate-950">
                                {qty}
                                {product.unit === "m" ? " м" : " шт"}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setQty(product, qty + stepForUnit(product.unit))
                                }
                                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-950 hover:bg-slate-50 transition-colors"
                                aria-label="Увеличить"
                              >
                                +
                              </button>
                            </div>
                          )}

                          <a
                            href={product.url}
                            target="_blank"
                            rel="nofollow noopener noreferrer"
                            className="text-xs text-slate-500 hover:text-slate-900 underline"
                          >
                            Открыть товар
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <aside className="lg:sticky lg:top-24 h-fit rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-950">Мини-корзина</p>
              <p className="mt-1 text-xs text-slate-500">Выбрано позиций: {selectedCount}</p>

              <div className="mt-3 max-h-[320px] overflow-auto space-y-2">
                {selectedLines.length === 0 ? (
                  <p className="text-sm text-slate-500">Пока пусто</p>
                ) : null}

                {selectedLines.map((line) => {
                  const lineTotal = line.qty * line.product.priceRub;
                  const unitLabel = line.product.unit === "m" ? "м" : "шт";

                  return (
                    <div
                      key={line.product.productId}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2"
                    >
                      <p className="text-xs font-semibold text-slate-900">{line.product.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {line.qty} {unitLabel} × {fmt(line.product.priceRub)} ₽
                      </p>
                      <p className="text-xs text-slate-700">Итого: {fmt(lineTotal)} ₽</p>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 border-t border-slate-200 pt-3">
                <p className="text-sm text-slate-700">Цена: {fmt(cartTotal)} ₽</p>
                <p className="text-sm font-semibold text-emerald-700">
                  Со скидкой: {fmt(cartDiscountedTotal)} ₽
                </p>
                <p className="text-xs text-emerald-600">Выгода: {fmt(cartBenefit)} ₽</p>
              </div>

              <div className="mt-4 space-y-2">
                <Button
                  type="button"
                  onClick={handleTransferToCalculator}
                  disabled={selectedLines.length === 0}
                  className="w-full justify-center"
                >
                  Передать в калькулятор
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => openCalculator({ initialStep: 0, source: "catalog_trek_page" })}
                  className="w-full justify-center"
                >
                  Только калькулятор потолка
                </Button>
              </div>
            </aside>
          </div>
        ) : null}
      </Container>
    </Section>
  );
}
