"use client";

import { useMemo, useState } from "react";

import { ProductImage } from "@/components/feed2/ProductImage";
import { useCalculatorModal } from "@/components/calculator-modal/calculator-modal-context";
import type { LightingItem, LightingSnapshot } from "@/lib/calculator-modal-types";
import type { FeedCatalogProduct, FeedCatalogResult } from "@/lib/eks-feed2-catalog";
import { applyLightingDiscount } from "@/lib/lighting-formulas";
import { detectSocket, getDiscountedPrice } from "@/lib/feed2-products";
import {
  CATALOG_SECTIONS,
  POINT_SUBTYPES,
  REMOVED_COLIBRI_VENDOR_CODES,
  TRACK_GROUPS,
  TRACK_PROFILE_WHITELIST,
  TRACK_SYSTEMS,
  type CatalogSectionId,
  type PointSubtypeId,
  type TrackGroupId,
  type TrackSystemId,
} from "@/lib/catalog-ui-config";

type CartItems = Record<string, number>;

function toText(value: unknown): string {
  return String(value ?? "").trim();
}

function toNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function fmt(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(Math.round(value));
}

function isMountsOrGrilles(product: FeedCatalogProduct): boolean {
  const text = `${toText(product.name)} ${toText(product.vendorCode)} ${toText(product.categoryPath)}`.toLowerCase();
  if (product.kind === "CEILING_COMPONENT") return true;
  return text.includes("заклад") || text.includes("решетк") || text.includes("решётк");
}

function isPanelProduct(product: FeedCatalogProduct): boolean {
  const text = `${toText(product.name)} ${toText(product.categoryPath)}`.toLowerCase();
  return text.includes("панел") || text.includes("led-панел") || text.includes("led панел");
}

function getPointSocket(product: FeedCatalogProduct): "GX53" | "MR16" | null {
  const vendorCode = toText(product.vendorCode);
  if (vendorCode === "0У-00007177" || vendorCode === "0У-00007176") return "GX53";
  if (vendorCode === "0У-00001551" || vendorCode === "0У-00001552") return "MR16";

  const fromDetect = detectSocket(product);
  if (fromDetect === "GX53") return "GX53";
  if (fromDetect === "MR16") return "MR16";
  return null;
}

function matchesPointSubtype(product: FeedCatalogProduct, subtype: PointSubtypeId): boolean {
  if (product.kind !== "SPOT_FIXTURE") return false;
  if (subtype === "PANELS") return isPanelProduct(product);
  const socket = getPointSocket(product);
  return socket === subtype;
}

function normalizeQty(nextQtyRaw: number, unit: "pcs" | "m"): number {
  const step = unit === "m" ? 0.5 : 1;
  const normalized = Math.round(nextQtyRaw / step) * step;
  return Math.max(0, Number.isFinite(normalized) ? normalized : 0);
}

function productToLightingItem(product: FeedCatalogProduct, qty: number): LightingItem {
  return {
    sku: toText(product.productId),
    name: toText(product.name),
    qty,
    priceRub: toNumber(product.priceRub),
  };
}

type Props = {
  data: FeedCatalogResult;
};

export function CatalogSectionClient({ data }: Props) {
  const { openCalculator } = useCalculatorModal();

  const products = useMemo(() => {
    const list = (data.products ?? []).filter((product) => {
      const vendorCode = toText(product.vendorCode);
      if (REMOVED_COLIBRI_VENDOR_CODES.has(vendorCode)) return false;
      return true;
    });
    return list;
  }, [data.products]);

  const byProductId = useMemo(() => {
    const map = new Map<string, FeedCatalogProduct>();
    for (const product of products) {
      map.set(toText(product.productId), product);
    }
    return map;
  }, [products]);

  const [section, setSection] = useState<CatalogSectionId>("track-systems");
  const [trackSystem, setTrackSystem] = useState<TrackSystemId>("COLIBRI_220");
  const [trackGroup, setTrackGroup] = useState<TrackGroupId>("TRACK_FIXTURE");
  const [pointSubtype, setPointSubtype] = useState<PointSubtypeId>("GX53");
  const [query, setQuery] = useState("");
  const [cartItems, setCartItems] = useState<CartItems>({});

  const filteredProducts = useMemo(() => {
    let scoped: FeedCatalogProduct[] = [];

    if (section === "track-systems") {
      if (trackGroup === "TRACK_PROFILE") {
        const allowed = new Set(TRACK_PROFILE_WHITELIST[trackSystem]);
        scoped = products.filter((product) => {
          if (product.system !== trackSystem) return false;
          if (product.kind !== "TRACK_PROFILE") return false;
          return allowed.has(toText(product.vendorCode));
        });
      } else {
        scoped = products.filter((product) => {
          if (product.system !== trackSystem) return false;
          if (product.kind !== trackGroup) return false;
          return true;
        });
      }
    } else if (section === "point-fixtures") {
      scoped = products.filter((product) => matchesPointSubtype(product, pointSubtype));
    } else {
      scoped = products.filter((product) => isMountsOrGrilles(product));
    }

    const q = toText(query).toLowerCase();
    if (!q) return scoped;

    return scoped.filter((product) => {
      const haystack = `${toText(product.name)} ${toText(product.vendorCode)} ${toText(product.categoryPath)}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [pointSubtype, products, query, section, trackGroup, trackSystem]);

  const selectedProducts = useMemo(() => {
    return Object.entries(cartItems)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => {
        const product = byProductId.get(toText(id));
        return product ? { product, qty } : null;
      })
      .filter((item): item is { product: FeedCatalogProduct; qty: number } => Boolean(item));
  }, [byProductId, cartItems]);

  const selectedTotal = useMemo(() => {
    return selectedProducts.reduce((sum, item) => sum + toNumber(item.product.priceRub) * item.qty, 0);
  }, [selectedProducts]);

  const selectedDiscounted = useMemo(() => applyLightingDiscount(selectedTotal), [selectedTotal]);

  const setProductQty = (product: FeedCatalogProduct, nextQtyRaw: number) => {
    const id = toText(product.productId);
    const nextQty = normalizeQty(nextQtyRaw, product.unit);

    setCartItems((prev) => {
      const next = { ...prev };
      if (nextQty <= 0) {
        delete next[id];
      } else {
        next[id] = nextQty;
      }
      return next;
    });
  };

  const removeFromSelected = (productId: string) => {
    setCartItems((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  };

  const openInCalculator = () => {
    const items = selectedProducts.map((entry) => productToLightingItem(entry.product, entry.qty));
    if (items.length === 0) return;

    const totalRub = items.reduce((sum, item) => sum + item.qty * item.priceRub, 0);
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
      initialLightingView: "selected",
      entryMode: "lighting-first",
      initialLighting,
      source: "catalog-track-sale-page",
    });
  };

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight text-slate-950">Каталог освещения и комплектующих</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Выберите позиции и откройте их в калькуляторе. Структура разделов совпадает с модалкой.
        </p>
      </div>

      <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap gap-2">
          {CATALOG_SECTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setSection(item.id);
                setQuery("");
              }}
              className={`rounded-xl px-3 py-2 text-sm font-medium ${
                section === item.id ? "bg-slate-950 text-white" : "bg-white text-slate-700"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {section === "track-systems" ? (
          <>
            <div className="flex flex-wrap gap-2">
              {TRACK_SYSTEMS.map((sys) => (
                <button
                  key={sys.id}
                  type="button"
                  onClick={() => {
                    setTrackSystem(sys.id);
                    setQuery("");
                  }}
                  className={`rounded-xl px-3 py-1.5 text-xs ${
                    trackSystem === sys.id ? "bg-slate-900 text-white" : "bg-white text-slate-700"
                  }`}
                >
                  {sys.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {TRACK_GROUPS.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => {
                    setTrackGroup(group.id);
                    setQuery("");
                  }}
                  className={`rounded-xl px-3 py-1.5 text-xs ${
                    trackGroup === group.id ? "bg-slate-900 text-white" : "bg-white text-slate-700"
                  }`}
                >
                  {group.label}
                </button>
              ))}
            </div>
          </>
        ) : null}

        {section === "point-fixtures" ? (
          <div className="flex flex-wrap gap-2">
            {POINT_SUBTYPES.map((subtype) => (
              <button
                key={subtype.id}
                type="button"
                onClick={() => {
                  setPointSubtype(subtype.id);
                  setQuery("");
                }}
                className={`rounded-xl px-3 py-1.5 text-xs ${
                  pointSubtype === subtype.id ? "bg-slate-900 text-white" : "bg-white text-slate-700"
                }`}
              >
                {subtype.label}
              </button>
            ))}
          </div>
        ) : null}

        <input
          value={query}
          onChange={(event) => setQuery(String(event.target.value ?? ""))}
          placeholder="Поиск в текущем разделе"
          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
        />
      </div>

      {selectedProducts.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-950">
              Выбрано: {selectedProducts.length} поз.
            </p>
            <button
              type="button"
              onClick={openInCalculator}
              className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Открыть в калькуляторе
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {selectedProducts.map((entry) => {
              const productId = toText(entry.product.productId);
              return (
                <div
                  key={productId}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs"
                >
                  <span className="max-w-[220px] truncate">{toText(entry.product.name)} x {entry.qty}</span>
                  <button
                    type="button"
                    onClick={() => removeFromSelected(productId)}
                    aria-label={`Удалить ${toText(entry.product.name)}`}
                    className="rounded-full px-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-3 text-sm">
            <p>Итого: {fmt(selectedTotal)} ₽</p>
            <p className="font-semibold text-emerald-700">Со скидкой: {fmt(selectedDiscounted)} ₽</p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredProducts.map((product) => {
          const productId = toText(product.productId);
          const qty = toNumber(cartItems[productId]);
          const regular = toNumber(product.priceRub);
          const discounted = getDiscountedPrice(regular);
          const socket = detectSocket(product);

          return (
            <article key={productId} className="rounded-2xl border border-slate-200 bg-white p-3">
              <ProductImage src={toText(product.coverImage)} alt={toText(product.name)} />
              <div className="mt-3">
                <p className="line-clamp-2 text-sm font-semibold text-slate-900">{toText(product.name)}</p>
                <p className="mt-1 text-xs text-slate-500">Артикул: {toText(product.vendorCode)}</p>
              </div>

              <div className="mt-2 text-xs text-slate-600">
                <p>Цена: {fmt(regular)} ₽{product.unit === "m" ? " / м" : ""}</p>
                <p className="font-semibold text-emerald-700">
                  Со скидкой: {fmt(discounted)} ₽{product.unit === "m" ? " / м" : ""}
                </p>
                {socket ? <p>Сокет: {socket}</p> : null}
              </div>

              <div className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() => setProductQty(product, qty - (product.unit === "m" ? 0.5 : 1))}
                  className="h-8 w-8 rounded-lg text-base font-semibold text-slate-700 hover:bg-slate-100"
                >
                  -
                </button>
                <span className="min-w-14 text-center text-sm font-semibold text-slate-900">
                  {qty}
                </span>
                <button
                  type="button"
                  onClick={() => setProductQty(product, qty + (product.unit === "m" ? 0.5 : 1))}
                  className="h-8 w-8 rounded-lg text-base font-semibold text-slate-700 hover:bg-slate-100"
                >
                  +
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {filteredProducts.length === 0 ? (
        <p className="text-sm text-slate-500">По текущим фильтрам ничего не найдено</p>
      ) : null}
    </section>
  );
}
