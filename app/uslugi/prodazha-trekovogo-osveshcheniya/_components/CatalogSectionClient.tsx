"use client";

import { useMemo, useState } from "react";

import { useCalculatorModal } from "@/components/calculator-modal/calculator-modal-context";
import { ProductImageLightbox } from "@/components/feed2/ProductImageLightbox";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Section } from "@/components/ui/section";

import type { LightingItem, LightingSnapshot } from "@/lib/calculator-modal-types";
import type { FeedCatalogProduct, FeedCatalogResult } from "@/lib/eks-feed2-catalog";

import { applyLightingDiscount } from "@/lib/lighting-formulas";
import { detectSocket, getDiscountedPrice, getRequiredLampSocket } from "@/lib/feed2-products";

import {
  CATALOG_SECTIONS,
  POINT_SUBTYPES,
  TRACK_GROUPS,
  TRACK_PROFILE_WHITELIST,
  TRACK_SYSTEMS,
  POINT_TO_MOUNT_VENDOR_CODE,
  CLARUS_PSU_VENDOR_CODES,
  isRemovedColibriVendorCode,
  type CatalogSectionId,
  type PointSubtypeId,
  type TrackGroupId,
  type TrackSystemId,
  type LampSocket,
} from "@/lib/catalog-ui-config";

import { ART_TRACK_PROFILE_VENDOR_WHITELIST, applyVendorOverrides } from "@/lib/vendor-code-overrides";

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
  return (
    text.includes("панел") ||
    text.includes("panel") ||
    text.includes("led панел") ||
    text.includes("led-панел") ||
    text.includes("led panel") ||
    text.includes("600x600") ||
    text.includes("595x595")
  );
}

function getPointSocket(product: FeedCatalogProduct): LampSocket | null {
  const vendorCode = toText(product.vendorCode);

  // legacy точечные
  if (vendorCode === "0У-00007177" || vendorCode === "0У-00007176") return "GX53";
  if (vendorCode === "0У-00001551" || vendorCode === "0У-00001552") return "MR16";

  const fromDetect = detectSocket(product);
  if (fromDetect === "GX53") return "GX53";
  if (fromDetect === "MR16") return "MR16";
  return null;
}

function matchesPointSubtype(product: FeedCatalogProduct, subtype: PointSubtypeId): boolean {
  // FIX: панели определяем до kind-check
  if (subtype === "PANELS") return isPanelProduct(product);
  if (product.kind !== "SPOT_FIXTURE") return false;
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

function benefitRub(priceRub: number): number {
  return Math.max(0, Math.round(priceRub - getDiscountedPrice(priceRub)));
}

function ProductCard({
  product,
  qty,
  onDec,
  onInc,
}: {
  product: FeedCatalogProduct;
  qty: number;
  onDec: () => void;
  onInc: () => void;
}) {
  const regular = toNumber(product.priceRub);
  const discounted = getDiscountedPrice(regular);
  const benefit = benefitRub(regular);

  const allAttrs = (product.keyAttributes?.length ? product.keyAttributes : product.params)
    .slice(0, 4)
    .map((p) => ({ label: toText(p.label), value: toText(p.value) }))
    .filter((a) => a.label && a.value);

  // V-20: show first 2 attributes on card surface, "+N ещё" expandable
  const visibleAttrs = allAttrs.slice(0, 2);
  const hiddenCount = allAttrs.length - visibleAttrs.length;

  const [showAllAttrs, setShowAllAttrs] = useState(false);
  const displayAttrs = showAllAttrs ? allAttrs : visibleAttrs;

  const attrs = displayAttrs.map((a) => `${a.label}: ${a.value}`).join(" • ");

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="grid grid-cols-[5.5rem_1fr] gap-3 sm:grid-cols-[8rem_1fr] sm:gap-4">
        <div className="cursor-zoom-in">
          <ProductImageLightbox src={toText(product.coverImage)} alt={toText(product.name)} />
        </div>

        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-950 break-words">{toText(product.name)}</p>

          {/* V-20: vendor code hidden from main card */}

          {attrs ? (
            <p className="mt-2 text-xs text-slate-600 break-words">
              {attrs}
              {hiddenCount > 0 && !showAllAttrs ? (
                <button
                  type="button"
                  onClick={() => setShowAllAttrs(true)}
                  className="ml-1 text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-800"
                >
                  ещё {hiddenCount}
                </button>
              ) : null}
              {showAllAttrs && hiddenCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setShowAllAttrs(false)}
                  className="ml-1 text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-800"
                >
                  свернуть
                </button>
              ) : null}
            </p>
          ) : null}

          <div className="mt-3 text-xs">
            <span className="line-through text-slate-400">{fmt(regular)} ₽</span>
            {" "}
            <span className="font-semibold text-emerald-700">{fmt(discounted)} ₽</span>
            {benefit > 0 ? <span className="text-slate-500"> · выгода {fmt(benefit)} ₽</span> : null}
            <span className="text-slate-400"> · с потолком</span>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onDec}
                className="h-11 w-11 rounded-xl border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 active:scale-95"
              >
                −
              </button>

              <div className="min-w-[4.5rem] text-center text-sm font-semibold text-slate-950">
                {product.unit === "m" ? qty.toFixed(1) : qty} {product.unit === "m" ? "м" : "шт"}
              </div>

              <button
                type="button"
                onClick={onInc}
                className="h-11 w-11 rounded-xl border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 active:scale-95"
              >
                +
              </button>
            </div>

            <span
              className={[
                "rounded-full px-3 py-1 text-xs font-semibold",
                qty > 0 ? "bg-emerald-50 text-emerald-700" : "hidden",
              ].join(" ")}
            >
              В корзине
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

type Props = { data: FeedCatalogResult };

export function CatalogSectionClient({ data }: Props) {
  const { openCalculator } = useCalculatorModal();

  const products = useMemo(() => {
    return (data.products ?? [])
      .filter((product) => !isRemovedColibriVendorCode(product.vendorCode))
      .map((p) => applyVendorOverrides(p));
  }, [data.products]);

  const byProductId = useMemo(() => {
    const map = new Map<string, FeedCatalogProduct>();
    for (const product of products) map.set(toText(product.productId), product);
    return map;
  }, [products]);

  const productIdByVendorCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const product of products) {
      const vendor = toText(product.vendorCode);
      const id = toText(product.productId);
      if (vendor && id) map.set(vendor, id);
    }
    return map;
  }, [products]);

  const [section, setSection] = useState<CatalogSectionId>("track-systems");
  const [trackSystem, setTrackSystem] = useState<TrackSystemId>("COLIBRI_220");
  const [trackGroup, setTrackGroup] = useState<TrackGroupId>("TRACK_FIXTURE");
  const [pointSubtype, setPointSubtype] = useState<PointSubtypeId>("GX53");
  const [lampSocket, setLampSocket] = useState<LampSocket>("GX53");

  const [query, setQuery] = useState("");
  const [cartItems, setCartItems] = useState<CartItems>({});
  const [visibleCount, setVisibleCount] = useState(24);

  const selectedEntries = useMemo(() => {
    return Object.entries(cartItems)
      .filter(([, qty]) => qty > 0)
      .map(([productId, qty]) => {
        const product = byProductId.get(productId);
        return product ? { productId, product, qty } : null;
      })
      .filter((x): x is { productId: string; product: FeedCatalogProduct; qty: number } => Boolean(x));
  }, [byProductId, cartItems]);

  const selectedTotal = useMemo(() => {
    return selectedEntries.reduce((sum, entry) => sum + entry.qty * toNumber(entry.product.priceRub), 0);
  }, [selectedEntries]);

  const discountedSelectedTotal = useMemo(() => applyLightingDiscount(selectedTotal), [selectedTotal]);

  // ===== Dependencies (mounts / lamps / PSU) =====
  const mountRequiredByVendor = useMemo(() => {
    const required: Record<string, number> = {};
    for (const entry of selectedEntries) {
      const fixtureVendor = toText(entry.product.vendorCode);
      const mountVendor = POINT_TO_MOUNT_VENDOR_CODE[fixtureVendor];
      if (!mountVendor) continue;
      required[mountVendor] = (required[mountVendor] ?? 0) + entry.qty;
    }
    return required;
  }, [selectedEntries]);

  const missingMounts = useMemo(() => {
    const out: Array<{
      fixtureVendorCode: string;
      mountVendorCode: string;
      requiredQty: number;
      currentQty: number;
      mountName?: string;
    }> = [];

    for (const [fixtureVendor, mountVendor] of Object.entries(POINT_TO_MOUNT_VENDOR_CODE)) {
      const fixtureId = productIdByVendorCode.get(fixtureVendor);
      const mountId = productIdByVendorCode.get(mountVendor);
      if (!fixtureId || !mountId) continue;

      const fixtureQty = toNumber(cartItems[fixtureId]);
      if (fixtureQty <= 0) continue;

      const mountQty = toNumber(cartItems[mountId]);
      if (mountQty < fixtureQty) {
        out.push({
          fixtureVendorCode: fixtureVendor,
          mountVendorCode: mountVendor,
          requiredQty: fixtureQty,
          currentQty: mountQty,
          mountName: byProductId.get(mountId)?.name,
        });
      }
    }

    return out;
  }, [byProductId, cartItems, productIdByVendorCode]);

  const lampProductsBySocket = useMemo(() => {
    const base = products
      .filter((p) => p.kind === "LAMP" && p.available !== false && toNumber(p.priceRub) > 0)
      .sort((a, b) => toNumber(a.priceRub) - toNumber(b.priceRub));

    const gx53 = base.filter((p) => detectSocket(p) === "GX53");
    const mr16 = base.filter((p) => detectSocket(p) === "MR16");

    return { GX53: gx53, MR16: mr16 };
  }, [products]);

  const lampRequiredBySocket = useMemo(() => {
    const required: Record<LampSocket, number> = { GX53: 0, MR16: 0 };
    for (const entry of selectedEntries) {
      const socket = getRequiredLampSocket(entry.product);
      if (!socket) continue;
      required[socket] = (required[socket] ?? 0) + entry.qty;
    }
    return required;
  }, [selectedEntries]);

  const lampCurrentBySocket = useMemo(() => {
    const current: Record<LampSocket, number> = { GX53: 0, MR16: 0 };
    for (const lamp of lampProductsBySocket.GX53) current.GX53 += toNumber(cartItems[toText(lamp.productId)]);
    for (const lamp of lampProductsBySocket.MR16) current.MR16 += toNumber(cartItems[toText(lamp.productId)]);
    return current;
  }, [cartItems, lampProductsBySocket]);

  const missingLamps = useMemo(() => {
    const out: Array<{ socket: LampSocket; requiredQty: number; currentQty: number; cheapestLampId: string | null }> =
      [];

    for (const socket of ["GX53", "MR16"] as LampSocket[]) {
      const required = toNumber(lampRequiredBySocket[socket]);
      if (required <= 0) continue;

      const current = toNumber(lampCurrentBySocket[socket]);
      if (current >= required) continue;

      const cheapest = lampProductsBySocket[socket][0];
      out.push({
        socket,
        requiredQty: required,
        currentQty: current,
        cheapestLampId: cheapest ? toText(cheapest.productId) : null,
      });
    }

    return out;
  }, [lampCurrentBySocket, lampProductsBySocket, lampRequiredBySocket]);

  const hasClarusFixtures = useMemo(() => {
    return selectedEntries.some((e) => e.product.system === "CLARUS_48" && e.product.kind === "TRACK_FIXTURE");
  }, [selectedEntries]);

  const clarusPsuQty = useMemo(() => {
    return selectedEntries
      .filter((e) => CLARUS_PSU_VENDOR_CODES.includes(toText(e.product.vendorCode) as any))
      .reduce((sum, e) => sum + e.qty, 0);
  }, [selectedEntries]);

  const setClarusPsu = (productId: string) => {
    setCartItems((prev) => {
      const next = { ...prev };
      for (const vendor of CLARUS_PSU_VENDOR_CODES) {
        const id = productIdByVendorCode.get(vendor);
        if (!id) continue;
        if (id !== productId) delete next[id];
      }
      next[productId] = Math.max(1, toNumber(next[productId]));
      return next;
    });
  };

  const addMountOneToOne = (fixtureVendor: string) => {
    const mountVendor = POINT_TO_MOUNT_VENDOR_CODE[toText(fixtureVendor)];
    if (!mountVendor) return;
    const mountId = productIdByVendorCode.get(mountVendor);
    if (!mountId) return;

    const required = toNumber(mountRequiredByVendor[mountVendor]);
    if (required <= 0) return;

    setCartItems((prev) => ({ ...prev, [mountId]: required }));
  };

  const addLampOneToOneCheapest = (socket: LampSocket, lampId: string) => {
    const required = toNumber(lampRequiredBySocket[socket]);
    if (required <= 0) return;

    setCartItems((prev) => {
      const next = { ...prev };
      const allLampIds = lampProductsBySocket[socket].map((p) => toText(p.productId));
      for (const id of allLampIds) if (id !== lampId) delete next[id];
      next[lampId] = required;
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
    const items: LightingItem[] = selectedEntries.map((entry) => productToLightingItem(entry.product, entry.qty));

    if (items.length === 0) {
      openCalculator({ initialStep: 0, source: "track-sale-empty" });
      return;
    }

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
      entryMode: "lighting-first",
      initialStep: 1,
      initialLightingTab: "catalog",
      initialLightingView: "selected",
      initialLighting,
      source: "track-sale-page",
    });
  };

  const filteredProducts = useMemo(() => {
    let scoped: FeedCatalogProduct[] = [];

    if (section === "track-systems") {
      if (trackGroup === "TRACK_PROFILE") {
        const base = TRACK_PROFILE_WHITELIST[trackSystem] ?? [];
        const allowed =
          trackSystem === "TRACK_220" ? new Set([...base, ...ART_TRACK_PROFILE_VENDOR_WHITELIST]) : new Set(base);

        scoped = products.filter((product) => {
          if (product.system !== trackSystem) return false;
          if (product.kind !== "TRACK_PROFILE") return false;
          return allowed.has(toText(product.vendorCode));
        });
      } else {
        scoped = products.filter((product) => product.system === trackSystem && product.kind === trackGroup);
      }
    } else if (section === "point-fixtures") {
      scoped = products.filter((product) => matchesPointSubtype(product, pointSubtype));
    } else if (section === "lamps") {
      scoped = products
        .filter((p) => p.kind === "LAMP" && p.available !== false && toNumber(p.priceRub) > 0)
        .filter((p) => detectSocket(p) === lampSocket);
    } else {
      scoped = products.filter((product) => isMountsOrGrilles(product));
    }

    const q = toText(query).toLowerCase();
    if (!q) return scoped;

    return scoped.filter((product) => {
      const haystack = `${toText(product.name)} ${toText(product.vendorCode)} ${toText(product.categoryPath)}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [lampSocket, pointSubtype, products, query, section, trackGroup, trackSystem]);

  return (
    <Section className="py-10">
      <Container>
        <div className="flex items-start justify-between gap-6">
          <Heading title="Каталог освещения" />

          <button
            type="button"
            onClick={openInCalculator}
            className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Открыть каталог в калькуляторе →
          </button>
        </div>

        {/* Dependencies / warnings */}
        {selectedEntries.length > 0 ? (
          <div className="mt-6 space-y-3">
            {hasClarusFixtures && clarusPsuQty < 1 ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-950">
                <p className="font-semibold">Для системы CLARUS обязателен минимум 1 блок питания.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {CLARUS_PSU_VENDOR_CODES.map((vendor) => {
                    const id = productIdByVendorCode.get(vendor);
                    if (!id) return null;
                    const product = byProductId.get(id);
                    if (!product) return null;

                    return (
                      <button
                        key={vendor}
                        type="button"
                        onClick={() => setClarusPsu(id)}
                        className="rounded-xl bg-rose-700 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-800"
                      >
                        Добавить: {toText(product.name)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {missingMounts.map((m) => (
              <div
                key={`${m.fixtureVendorCode}-${m.mountVendorCode}`}
                className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
              >
                <p className="font-semibold">Не хватает закладных 1:1</p>
                <p className="mt-2">
                  Нужно: <span className="font-semibold">{m.requiredQty}</span> шт., в корзине:{" "}
                  <span className="font-semibold">{m.currentQty}</span> шт.
                  {m.mountName ? ` · Закладная: ${toText(m.mountName)}` : ""}
                </p>

                <button
                  type="button"
                  onClick={() => addMountOneToOne(m.fixtureVendorCode)}
                  className="mt-3 rounded-xl bg-amber-700 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-800"
                >
                  Добавить 1:1
                </button>
              </div>
            ))}

            {missingLamps.map((m) => (
              <div key={m.socket} className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
                <p className="font-semibold">Не хватает ламп {m.socket} (1:1)</p>
                <p className="mt-2">
                  Нужно: <span className="font-semibold">{m.requiredQty}</span> шт., в корзине:{" "}
                  <span className="font-semibold">{m.currentQty}</span> шт.
                </p>

                <button
                  type="button"
                  disabled={!m.cheapestLampId}
                  onClick={() => {
                    if (!m.cheapestLampId) return;
                    addLampOneToOneCheapest(m.socket, m.cheapestLampId);
                    setSection("lamps");
                    setLampSocket(m.socket);
                    setQuery("");
                  }}
                  className="mt-3 rounded-xl bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                >
                  Добавить 1:1 (самые доступные)
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {/* Controls */}
        <div className="mt-8 flex flex-wrap gap-2">
          {CATALOG_SECTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setSection(item.id);
                setQuery("");
                setVisibleCount(24);
              }}
              className={[
                "rounded-xl px-3 py-2 text-sm font-medium",
                section === item.id ? "bg-slate-950 text-white" : "bg-white text-slate-700 hover:bg-slate-50",
                "border border-slate-200",
              ].join(" ")}
            >
              {item.label}
            </button>
          ))}
        </div>

        {section === "track-systems" ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {TRACK_SYSTEMS.map((system) => (
              <button
                key={system.id}
                type="button"
                onClick={() => {
                  setTrackSystem(system.id);
                  setQuery("");
                }}
                className={[
                  "rounded-xl px-3 py-1.5 text-xs",
                  trackSystem === system.id ? "bg-slate-900 text-white" : "bg-white text-slate-700",
                  "border border-slate-200",
                ].join(" ")}
              >
                {system.label}
              </button>
            ))}

            {TRACK_GROUPS.map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() => {
                  setTrackGroup(group.id);
                  setQuery("");
                }}
                className={[
                  "rounded-xl px-3 py-1.5 text-xs",
                  trackGroup === group.id ? "bg-slate-900 text-white" : "bg-white text-slate-700",
                  "border border-slate-200",
                ].join(" ")}
              >
                {group.label}
              </button>
            ))}
          </div>
        ) : null}

        {section === "point-fixtures" ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {POINT_SUBTYPES.map((subtype) => (
              <button
                key={subtype.id}
                type="button"
                onClick={() => {
                  setPointSubtype(subtype.id);
                  setQuery("");
                }}
                className={[
                  "rounded-xl px-3 py-1.5 text-xs",
                  pointSubtype === subtype.id ? "bg-slate-900 text-white" : "bg-white text-slate-700",
                  "border border-slate-200",
                ].join(" ")}
              >
                {subtype.label}
              </button>
            ))}
          </div>
        ) : null}

        {section === "lamps" ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {(["GX53", "MR16"] as LampSocket[]).map((socket) => (
              <button
                key={socket}
                type="button"
                onClick={() => {
                  setLampSocket(socket);
                  setQuery("");
                }}
                className={[
                  "rounded-xl px-3 py-1.5 text-xs",
                  lampSocket === socket ? "bg-slate-900 text-white" : "bg-white text-slate-700",
                  "border border-slate-200",
                ].join(" ")}
              >
                {socket}
              </button>
            ))}
          </div>
        ) : null}

        <div className="relative mt-4">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">🔍</span>
          <input
          value={query}
          onChange={(event) => setQuery(String(event.target.value ?? ""))}
          placeholder="Поиск в текущем разделе"
          className="w-full rounded-2xl border border-slate-300 bg-white pl-10 pr-4 py-3 text-sm text-slate-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
        />
        </div>

        {/* Selected mini-bar */}
        {selectedEntries.length > 0 ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-950">Выбрано: {selectedEntries.length} поз.</p>

              <button
                type="button"
                onClick={openInCalculator}
                className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Открыть в калькуляторе →
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {selectedEntries.map((entry) => {
                const productId = toText(entry.product.productId);
                return (
                  <div
                    key={productId}
                    className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700"
                  >
                    <span className="max-w-[16rem] truncate">
                      {toText(entry.product.name)} × {entry.qty}
                    </span>
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

            <div className="mt-3 text-sm text-slate-800">
              <p>Итого: {fmt(selectedTotal)} ₽</p>
              <p className="text-emerald-700">
                С потолком (−15%): {fmt(discountedSelectedTotal)} ₽
              </p>
            </div>
          </div>
        ) : null}

        {/* Products grid with "Показать ещё" */}
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredProducts.slice(0, visibleCount).map((product) => {
            const id = toText(product.productId);
            const qty = toNumber(cartItems[id]);
            const step = product.unit === "m" ? 0.5 : 1;

            return (
              <ProductCard
                key={id}
                product={product}
                qty={qty}
                onDec={() =>
                  setCartItems((prev) => {
                    const next = { ...prev };
                    const nextQty = normalizeQty(qty - step, product.unit);
                    if (nextQty <= 0) delete next[id];
                    else next[id] = nextQty;
                    return next;
                  })
                }
                onInc={() =>
                  setCartItems((prev) => {
                    const next = { ...prev };
                    next[id] = normalizeQty(qty + step, product.unit);
                    return next;
                  })
                }
              />
            );
          })}
        </div>

        {/* "Показать ещё" button */}
        {filteredProducts.length > visibleCount ? (
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setVisibleCount((c) => c + 24)}
              className="rounded-2xl border border-slate-300 bg-white px-8 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:border-slate-400"
            >
              Показать ещё ({filteredProducts.length - visibleCount} из {filteredProducts.length})
            </button>
          </div>
        ) : null}

        {filteredProducts.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            Ничего не найдено
          </div>
        ) : null}

        {!data.ok && data.errorMessage ? (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-950">
            Каталог: ошибка загрузки ({data.source}). {data.errorMessage}
          </div>
        ) : null}
      </Container>
    </Section>
  );
}
