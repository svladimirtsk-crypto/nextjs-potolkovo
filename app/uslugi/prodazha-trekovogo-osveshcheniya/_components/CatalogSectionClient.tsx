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
type CatalogSection = "track-systems" | "point-fixtures";
type TrackSystemUi = "COLIBRI_220" | "CLARUS_48" | "TRACK_220";
type TrackGroupUi = "TRACK_FIXTURE" | "TRACK_PROFILE" | "TRACK_ACCESSORY";

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

function stepByUnit(unit: "pcs" | "m"): number {
  return unit === "m" ? 0.5 : 1;
}

function minByUnit(unit: "pcs" | "m"): number {
  return unit === "m" ? 0.5 : 1;
}

function pickDisplayAttributes(product: FeedCatalogProduct) {
  if (Array.isArray(product.keyAttributes) && product.keyAttributes.length > 0) {
    return product.keyAttributes.slice(0, 4);
  }
  return (product.params ?? []).slice(0, 4);
}

function detectSocket(product: FeedCatalogProduct): "GX53" | "MR16" | null {
  const paramsText = (product.params ?? [])
    .map((p) => `${p.label} ${p.value}`)
    .join(" ")
    .toLowerCase();
  const text = `${product.name} ${product.vendorCode} ${paramsText}`.toLowerCase();

  if (text.includes("gx53")) return "GX53";
  if (text.includes("mr16") || text.includes("gu5.3")) return "MR16";
  return null;
}

function isPointFixture(product: FeedCatalogProduct): boolean {
  return product.kind === "SPOT_FIXTURE";
}

function isLamp(product: FeedCatalogProduct): boolean {
  return product.kind === "LAMP";
}

function ProductImage({ src, alt }: { src?: string; alt: string }) {
  const imageSrc: string = String(src ?? IMG_FALLBACK);

  return (
    <div className="mb-3 h-44 w-full overflow-hidden rounded-xl border border-slate-100 bg-slate-50 p-3">
      <img
        src={imageSrc}
        alt={alt}
        loading="lazy"
        className="h-full w-full object-contain"
        onError={(e) => {
          const img = e.currentTarget;
          img.onerror = null;
          img.src = IMG_FALLBACK;
        }}
      />
    </div>
  );
}

export function CatalogSectionClient({ data }: Props) {
  const { openCalculator } = useCalculatorModal();
  const searchParams = useSearchParams();
  const debugEnabled = searchParams.get("catalogDebug") === "1";

  const [catalogSection, setCatalogSection] = useState<CatalogSection>("track-systems");
  const [trackSystem, setTrackSystem] = useState<TrackSystemUi>("COLIBRI_220");
  const [trackGroup, setTrackGroup] = useState<TrackGroupUi>("TRACK_FIXTURE");
  const [searchQuery, setSearchQuery] = useState("");
  const [cartItems, setCartItems] = useState<CartItems>({});
  const [lastAddedPointSku, setLastAddedPointSku] = useState<string | null>(null);

  const baseProducts = useMemo(() => {
    return data.products.filter((p) => Number.isFinite(p.priceRub) && p.priceRub > 0);
  }, [data.products]);

  const baseIsEmpty = baseProducts.length === 0;
  const showCatalogError = !data.ok || baseIsEmpty;

  const productsById = useMemo(
    () => new Map(baseProducts.map((p) => [p.productId, p])),
    [baseProducts]
  );

  const pointProducts = useMemo(() => {
    return baseProducts
      .filter((p) => isPointFixture(p))
      .sort((a, b) => {
        const avA = a.available === false ? 0 : 1;
        const avB = b.available === false ? 0 : 1;
        if (avA !== avB) return avB - avA;
        return a.priceRub - b.priceRub;
      });
  }, [baseProducts]);

  const lampsBySocket = useMemo(() => {
    const allLamps = baseProducts.filter((p) => isLamp(p) && p.available !== false);
    return {
      GX53: allLamps.filter((p) => detectSocket(p) === "GX53").slice(0, 4),
      MR16: allLamps.filter((p) => detectSocket(p) === "MR16").slice(0, 4),
    };
  }, [baseProducts]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const scoped =
      catalogSection === "track-systems"
        ? baseProducts.filter(
            (p) =>
              p.system === (trackSystem as FeedCatalogSystem) &&
              p.kind === (trackGroup as FeedCatalogKind)
          )
        : pointProducts;

    if (!q) return scoped;

    return scoped.filter((p) => {
      const hay = `${p.name} ${p.vendorCode}`.toLowerCase();
      return hay.includes(q);
    });
  }, [baseProducts, catalogSection, pointProducts, searchQuery, trackGroup, trackSystem]);

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

    if (normalized > 0 && isPointFixture(product)) {
      setLastAddedPointSku(product.productId);
    }
  };

  const addLampOneToOne = (lamp: FeedCatalogProduct, fixtureQty: number) => {
    setQty(lamp, fixtureQty);
  };

  const handleTransferToCalculator = () => {
    const items: LightingItem[] = selectedLines.map(({ product, qty }) => ({
      sku: product.productId,
      name: product.name,
      qty,
      priceRub: product.priceRub,
    }));

    const openWithExtendedOptions = (payload: Record<string, unknown>) => {
      openCalculator(payload as Parameters<typeof openCalculator>[0]);
    };

    if (items.length === 0) {
      openWithExtendedOptions({
        initialStep: 1,
        initialLightingTab: "catalog",
        initialLightingView: "browse",
        entryMode: "lighting-first",
        source: "catalog_trek_page_empty",
      });
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

    openWithExtendedOptions({
      initialStep: 1,
      initialLightingTab: "catalog",
      initialLightingView: "selected",
      entryMode: "lighting-first",
      initialLighting,
      source: "catalog_trek_page",
    });
  };

  const debugData = (data as FeedCatalogResult & { debug?: Record<string, unknown> }).debug;

  return (
    <Section id="catalog" className="scroll-mt-24 bg-white">
      <Container>
        <Heading
          eyebrow="Каталог"
          title="Каталог трекового и точечного освещения"
          description="Выберите товары, проверьте итог и передайте в калькулятор без потери позиций."
        />

        <div className="mt-6">
          <Button
            type="button"
            onClick={() =>
              openCalculator({
                initialStep: 0,
                source: "catalog_trek_page_cta",
              })
            }
          >
            Открыть калькулятор
          </Button>
        </div>

        {showCatalogError ? (
          <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-semibold text-amber-900">Каталог временно недоступен</p>
            <p className="mt-1 text-sm text-amber-800">Не удалось получить валидную базу товаров.</p>
            {data.errorMessage ? (
              <p className="mt-2 text-xs text-amber-700">Причина: {String(data.errorMessage ?? "")}</p>
            ) : null}
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
            <div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setCatalogSection("track-systems");
                      setSearchQuery("");
                    }}
                    className={`rounded-lg px-3 py-2 text-sm font-medium ${
                      catalogSection === "track-systems"
                        ? "bg-slate-950 text-white"
                        : "text-slate-700 hover:text-slate-950"
                    }`}
                  >
                    Трековые системы
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCatalogSection("point-fixtures");
                      setSearchQuery("");
                    }}
                    className={`rounded-lg px-3 py-2 text-sm font-medium ${
                      catalogSection === "point-fixtures"
                        ? "bg-slate-950 text-white"
                        : "text-slate-700 hover:text-slate-950"
                    }`}
                  >
                    Точечные светильники
                  </button>
                </div>

                {catalogSection === "track-systems" ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {(["COLIBRI_220", "CLARUS_48", "TRACK_220"] as TrackSystemUi[]).map((system) => (
                        <button
                          key={system}
                          type="button"
                          onClick={() => setTrackSystem(system)}
                          className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                            trackSystem === system
                              ? "border-slate-950 bg-slate-950 text-white"
                              : "border-slate-200 text-slate-700 hover:border-slate-400"
                          }`}
                        >
                          {system === "COLIBRI_220"
                            ? "COLIBRI 220V (встраиваемая)"
                            : system === "CLARUS_48"
                            ? "CLARUS 48V (встраиваемая)"
                            : "ART 220V (накладная)"}
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {(["TRACK_FIXTURE", "TRACK_PROFILE", "TRACK_ACCESSORY"] as TrackGroupUi[]).map((group) => (
                        <button
                          key={group}
                          type="button"
                          onClick={() => setTrackGroup(group)}
                          className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                            trackGroup === group
                              ? "border-slate-950 bg-slate-950 text-white"
                              : "border-slate-200 text-slate-700 hover:border-slate-400"
                          }`}
                        >
                          {group === "TRACK_FIXTURE"
                            ? "Светильники"
                            : group === "TRACK_PROFILE"
                            ? "Профили"
                            : "Комплектующие"}
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}

                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск в текущем разделе"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                />
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
                  const productUrl: string = String(product.url ?? "");

                  return (
                    <div
                      key={product.productId}
                      className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4"
                    >
                      <div>
                        <ProductImage src={product.coverImage} alt={product.name} />

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

                          {productUrl ? (
                            <a
                              href={productUrl}
                              target="_blank"
                              rel="nofollow noopener noreferrer"
                              className="text-xs text-slate-500 hover:text-slate-900 underline"
                            >
                              Открыть товар
                            </a>
                          ) : null}
                        </div>

                        {isPointFixture(product) && qty > 0 ? (
                          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <p className="text-xs font-medium text-slate-800">
                              Подобрать лампы ({String(detectSocket(product) ?? "") || "совместимые"})
                            </p>
                            <div className="mt-2 space-y-2">
                              {(detectSocket(product) === "GX53"
                                ? lampsBySocket.GX53
                                : detectSocket(product) === "MR16"
                                ? lampsBySocket.MR16
                                : []
                              ).map((lamp) => (
                                <div
                                  key={lamp.productId}
                                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2"
                                >
                                  <div className="min-w-0">
                                    <p className="truncate text-xs font-medium text-slate-900">{lamp.name}</p>
                                    <p className="text-xs text-slate-500">{fmt(lamp.priceRub)} ₽ / шт</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => addLampOneToOne(lamp, qty)}
                                    className="shrink-0 rounded-full border border-slate-900 bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800"
                                  >
                                    Добавить 1:1
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <aside className="h-fit rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:sticky lg:top-24">
              <p className="text-sm font-semibold text-slate-950">Выбрано</p>
              <p className="mt-1 text-xs text-slate-500">Позиции: {selectedLines.length}</p>

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
                <p className="text-sm font-semibold text-emerald-700">Со скидкой: {fmt(cartDiscounted)} ₽</p>
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

              {lastAddedPointSku ? (
                <p className="mt-3 text-xs text-slate-500">
                  Для точечных корпусов можно добавить совместимые лампы 1:1.
                </p>
              ) : null}
            </aside>
          </div>
        )}

        {debugEnabled && debugData ? (
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            {Object.entries(debugData).map(([k, v]) => (
              <p key={k}>
                {k}: {String(v ?? "")}
              </p>
            ))}
          </div>
        ) : null}
      </Container>
    </Section>
  );
}
