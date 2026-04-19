// app/uslugi/prodazha-trekovogo-osveshcheniya/_components/CatalogSectionClient.tsx
"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { useCalculatorModal } from "@/components/calculator-modal/calculator-modal-context";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Section } from "@/components/ui/section";
import type { LightingItem, LightingSnapshot } from "@/lib/calculator-modal-types";
import type {
  FeedCatalogKind,
  FeedCatalogProduct,
  FeedCatalogResult,
  FeedCatalogSystem,
} from "@/lib/eks-feed2-catalog";
import { applyLightingDiscount } from "@/lib/lighting-formulas";

type Props = {
  data: FeedCatalogResult;
};

type CartItems = Record<string, number>;

const IMG_FALLBACK =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
      <rect width="100%" height="100%" fill="#f1f5f9"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" fill="#64748b">Фото товара</text>
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
      return "Точечные";
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

function stepByUnit(unit: "pcs" | "m"): number {
  return unit === "m" ? 0.5 : 1;
}

function minByUnit(unit: "pcs" | "m"): number {
  return unit === "m" ? 0.5 : 1;
}

function pickDisplayAttributes(product: FeedCatalogProduct) {
  if (product.keyAttributes && product.keyAttributes.length > 0) {
    return product.keyAttributes.slice(0, 4);
  }
  return product.params.slice(0, 4);
}

export function CatalogSectionClient({ data }: Props) {
  const { openCalculator } = useCalculatorModal();
  const searchParams = useSearchParams();
  const debugEnabled = searchParams.get("catalogDebug") === "1";

  const [systemFilter, setSystemFilter] = useState<FeedCatalogSystem | "all">("all");
  const [kindFilter, setKindFilter] = useState<FeedCatalogKind | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [cartItems, setCartItems] = useState<CartItems>({});

  const baseProducts = useMemo(() => {
    return data.products.filter((p) => Number.isFinite(p.priceRub) && p.priceRub > 0);
  }, [data.products]);

  const baseIsEmpty = baseProducts.length === 0;
  const showCatalogError = !data.ok || baseIsEmpty;

  const systems = useMemo(
    () => Array.from(new Set(baseProducts.map((p) => p.system))),
    [baseProducts]
  );

  const kinds = useMemo(
    () => Array.from(new Set(baseProducts.map((p) => p.kind))),
    [baseProducts]
  );

  const productsById = useMemo(
    () => new Map(baseProducts.map((p) => [p.productId, p])),
    [baseProducts]
  );

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return baseProducts.filter((p) => {
      if (systemFilter !== "all" && p.system !== systemFilter) return false;
      if (kindFilter !== "all" && p.kind !== kindFilter) return false;
      if (!q) return true;

      const hay = `${p.name} ${p.vendorCode}`.toLowerCase();
      return hay.includes(q);
    });
  }, [baseProducts, systemFilter, kindFilter, searchQuery]);

  const selectedLines = useMemo(() => {
    return Object.entries(cartItems)
      .map(([id, qty]) => {
        const product = productsById.get(id);
        if (!product || qty <= 0) return null;
        return { product, qty };
      })
      .filter((x): x is { product: FeedCatalogProduct; qty: number } => x !== null);
  }, [cartItems, productsById]);

  const cartTotal = useMemo(() => {
    return selectedLines.reduce((sum, x) => sum + x.qty * x.product.priceRub, 0);
  }, [selectedLines]);

  const cartDiscounted = useMemo(() => applyLightingDiscount(cartTotal), [cartTotal]);
  const cartBenefit = Math.max(0, cartTotal - cartDiscounted);

  const setQty = (product: FeedCatalogProduct, qty: number) => {
    const step = stepByUnit(product.unit);
    const normalized = Math.max(0, Math.round(qty / step) * step);

    setCartItems((prev) => {
      if (normalized <= 0) {
        const clone = { ...prev };
        delete clone[product.productId];
        return clone;
      }
      return { ...prev, [product.productId]: normalized };
    });
  };

  const handleTransferToCalculator = () => {
    const items: LightingItem[] = selectedLines.map(({ product, qty }) => ({
      sku: product.productId,
      name: product.name,
      qty,
      priceRub: product.priceRub,
    }));

    if (items.length === 0) {
      openCalculator({ initialStep: 1, source: "catalog_trek_page_empty" });
      return;
    }

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

  return (
    <Section id="catalog" className="scroll-mt-24 bg-white">
      <Container>
        <Heading
          eyebrow="Каталог"
          title="Каталог трекового освещения"
          description="Добавьте товары и передайте в калькулятор без потери данных."
        />

        <div className="mt-6">
          <Button
            type="button"
            onClick={() => openCalculator({ initialStep: 0, source: "catalog_trek_page_cta" })}
          >
            Открыть калькулятор
          </Button>
        </div>

        {showCatalogError ? (
          <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-semibold text-amber-900">Каталог временно недоступен</p>
            <p className="mt-1 text-sm text-amber-800">
              Не удалось получить валидную базу товаров.
            </p>
            {data.errorMessage ? (
              <p className="mt-2 text-xs text-amber-700">Причина: {data.errorMessage}</p>
            ) : null}
          </div>
        ) : (
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
                  {systems.map((system) => (
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
                  {kinds.map((kind) => (
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
                  const qty = cartItems[product.productId] ?? 0;
                  const regular = product.priceRub;
                  const discount = applyLightingDiscount(regular);
                  const benefit = Math.max(0, regular - discount);
                  const src: string = String(product.coverImage || IMG_FALLBACK);

                  return (
                    <div
                      key={product.productId}
                      className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4"
                    >
                      <div>
                        <div className="mb-3 aspect-[4/3] overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
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

                        <p className="text-sm font-semibold text-slate-950">{product.name}</p>
                        <p className="mt-1 text-xs text-slate-500">Артикул: {product.vendorCode}</p>

                        <ul className="mt-2 space-y-1">
                          {pickDisplayAttributes(product).map((a) => (
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
                          Со скидкой: {fmt(discount)} ₽{product.unit === "m" ? " / м" : ""}
                        </p>
                        <p className="text-xs text-emerald-600">Выгода: {fmt(benefit)} ₽</p>

                        <div className="mt-3 flex items-center justify-between gap-2">
                          {qty <= 0 ? (
                            <button
                              type="button"
                              onClick={() => setQty(product, minByUnit(product.unit))}
                              className="rounded-full border border-slate-950 bg-slate-950 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
                            >
                              Добавить
                            </button>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setQty(product, qty - stepByUnit(product.unit))}
                                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-950 hover:bg-slate-50 transition-colors"
                                aria-label="Уменьшить"
                              >
                                −
                              </button>
                              <span className="min-w-[64px] text-center text-sm font-semibold text-slate-950">
                                {qty}
                                {product.unit === "m" ? " м" : " шт"}
                              </span>
                              <button
                                type="button"
                                onClick={() => setQty(product, qty + stepByUnit(product.unit))}
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

            <aside className="h-fit rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:sticky lg:top-24">
              <p className="text-sm font-semibold text-slate-950">Мини-корзина</p>
              <p className="mt-1 text-xs text-slate-500">Выбрано позиций: {selectedLines.length}</p>

              <div className="mt-3 max-h-[320px] space-y-2 overflow-auto">
                {selectedLines.length === 0 ? (
                  <p className="text-sm text-slate-500">Пока пусто</p>
                ) : null}

                {selectedLines.map(({ product, qty }) => (
                  <div
                    key={product.productId}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2"
                  >
                    <p className="text-xs font-semibold text-slate-900">{product.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {qty} {product.unit === "m" ? "м" : "шт"} × {fmt(product.priceRub)} ₽
                    </p>
                    <p className="text-xs text-slate-700">Итого: {fmt(qty * product.priceRub)} ₽</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 border-t border-slate-200 pt-3">
                <p className="text-sm text-slate-700">Цена: {fmt(cartTotal)} ₽</p>
                <p className="text-sm font-semibold text-emerald-700">
                  Со скидкой: {fmt(cartDiscounted)} ₽
                </p>
                <p className="text-xs text-emerald-600">Выгода: {fmt(cartBenefit)} ₽</p>
              </div>

              <div className="mt-4">
                <Button
                  type="button"
                  onClick={handleTransferToCalculator}
                  disabled={selectedLines.length === 0}
                  className="w-full justify-center"
                >
                  Передать в калькулятор
                </Button>
              </div>
            </aside>
          </div>
        )}

        {debugEnabled && data.debug ? (
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            <p>enabled: {String(data.debug.enabled ?? "")}</p>
            <p>strict: {String(data.debug.strict ?? "")}</p>
            <p>selectedSource: {String(data.debug.selectedSource ?? "")}</p>
            <p>status: {String(data.debug.status ?? "")}</p>
            <p>contentType: {String(data.debug.contentType ?? "")}</p>
            <p>bodyLength: {String(data.debug.bodyLength ?? "")}</p>
            <p>categoriesCount: {String(data.debug.categoriesCount ?? "")}</p>
            <p>offerBlocksCount: {String(data.debug.offerBlocksCount ?? "")}</p>
            <p>productsParsed: {String(data.debug.productsParsed ?? "")}</p>
            <p>productsKept: {String(data.debug.productsKept ?? "")}</p>
            <p>skippedNoCategoryId: {String(data.debug.skippedNoCategoryId ?? "")}</p>
            <p>skippedUnknownCategory: {String(data.debug.skippedUnknownCategory ?? "")}</p>
            <p>skippedNotWhitelisted: {String(data.debug.skippedNotWhitelisted ?? "")}</p>
            <p>skippedNoPrice: {String(data.debug.skippedNoPrice ?? "")}</p>
            <p>skippedNoVendorCode: {String(data.debug.skippedNoVendorCode ?? "")}</p>
            <p>errorMessage: {String(data.debug.errorMessage ?? "")}</p>
            <p>fetchedAt: {String(data.debug.fetchedAt ?? "")}</p>
          </div>
        ) : null}
      </Container>
    </Section>
  );
}
