"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import snapshotData from "@/data/eks-feed2-snapshot.json";

import type { FeedCatalogParam, FeedCatalogProduct } from "@/lib/eks-feed2-catalog";
import type { LightingItem, LightingSnapshot } from "@/lib/calculator-modal-types";

import { applyLightingDiscount } from "@/lib/lighting-formulas";
import { detectSocket, getDiscountedPrice, getRequiredLampSocket } from "@/lib/feed2-products";

import {
  CATALOG_SECTIONS,
  POINT_SUBTYPES,
  POINT_TO_MOUNT_VENDOR_CODE,
  CLARUS_PSU_VENDOR_CODES,
  REMOVED_COLIBRI_VENDOR_CODES,
  TRACK_GROUPS,
  TRACK_PROFILE_WHITELIST,
  TRACK_SYSTEMS,
  type CatalogSectionId,
  type PointSubtypeId,
  type TrackGroupId,
  type TrackSystemId,
  type LampSocket,
} from "@/lib/catalog-ui-config";

import { ProductImage } from "@/components/feed2/ProductImage";

import { useCalculatorModal } from "./calculator-modal-context";
import { usePriceCalculatorBridge } from "@/components/home/price-calculator-context";

type Tab = "recommendations" | "catalog";
type CatalogView = "selected" | "browse";
type CartItems = Record<string, number>;

function toText(value: unknown): string {
  return String(value ?? "").trim();
}

function toNumber(value: unknown): number {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

function fmt(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(Math.round(value));
}

function toNumberOrNull(value: unknown): number | null {
  const n = Number(value ?? NaN);
  return Number.isFinite(n) ? n : null;
}

function toParams(input: unknown): FeedCatalogParam[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      const x = item as { label?: unknown; value?: unknown };
      return { label: toText(x?.label), value: toText(x?.value) };
    })
    .filter((item) => item.label.length > 0 && item.value.length > 0);
}

function normalizeProduct(raw: unknown): FeedCatalogProduct | null {
  const p = raw as Record<string, unknown>;

  const vendorCode = toText(p.vendorCode);
  const offerId = toText(p.offerId);
  const name = toText(p.name);

  if (!name || (!vendorCode && !offerId)) return null;

  const productIdRaw = toText(p.productId);
  const productId = productIdRaw || `feed2-${vendorCode || offerId || name}`;

  const images = Array.isArray(p.images) ? p.images.map((item) => toText(item)).filter(Boolean) : [];

  return {
    productId: toText(productId),
    vendorCode,
    offerId,
    name,
    url: toText(p.url),
    categoryId: toText(p.categoryId),
    categoryPath: toText(p.categoryPath),
    images,
    coverImage: toText(p.coverImage) || images[0] || "",
    priceRub: toNumber(p.priceRub),
    available: Boolean(p.available ?? true),
    params: toParams(p.params),
    keyAttributes: toParams(p.keyAttributes),
    system: (toText(p.system) || "UNKNOWN") as FeedCatalogProduct["system"],
    kind: (toText(p.kind) || "OTHER") as FeedCatalogProduct["kind"],
    unit: (toText(p.unit) === "m" ? "m" : "pcs") as FeedCatalogProduct["unit"],
    lengthMeters: toNumberOrNull(p.lengthMeters),
    pieceLengthMeters: toNumberOrNull(p.pieceLengthMeters),
  };
}

function normalizeQty(nextQtyRaw: number, unit: "pcs" | "m"): number {
  const step = unit === "m" ? 0.5 : 1;
  const normalized = Math.round(nextQtyRaw / step) * step;
  return Math.max(0, Number.isFinite(normalized) ? normalized : 0);
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
    text.includes("600x600") ||
    text.includes("595x595")
  );
}

function getPointSocketByProduct(product: FeedCatalogProduct): LampSocket | null {
  const vendorCode = toText(product.vendorCode);

  if (vendorCode === "0У-00007177" || vendorCode === "0У-00007176") return "GX53";
  if (vendorCode === "0У-00001551" || vendorCode === "0У-00001552") return "MR16";

  const detected = detectSocket(product);
  if (detected === "GX53") return "GX53";
  if (detected === "MR16") return "MR16";

  return null;
}

function matchesPointSubtype(product: FeedCatalogProduct, subtype: PointSubtypeId): boolean {
  // FIX: PANELS до проверки kind
  if (subtype === "PANELS") return isPanelProduct(product);

  if (product.kind !== "SPOT_FIXTURE") return false;

  const socket = getPointSocketByProduct(product);
  return socket === subtype;
}

function pickDisplayAttributes(product: FeedCatalogProduct): { label: string; value: string }[] {
  const attrs = product.keyAttributes?.length ? product.keyAttributes : product.params;
  return (attrs ?? []).slice(0, 4).map((attr) => ({ label: toText(attr.label), value: toText(attr.value) }));
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-xl px-3 py-2 text-sm font-medium transition-colors",
        active ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function ProductQtyControls({
  qty,
  unit,
  onDec,
  onInc,
}: {
  qty: number;
  unit: "pcs" | "m";
  onDec: () => void;
  onInc: () => void;
}) {
  const displayQty = unit === "m" ? qty.toFixed(1) : String(qty);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onDec}
        className="h-8 w-8 rounded-full border border-slate-200 bg-white text-sm font-semibold text-slate-900 hover:bg-slate-50"
        aria-label="Уменьшить количество"
      >
        −
      </button>

      <div className="min-w-[56px] text-center text-sm font-semibold text-slate-950">
        {displayQty} {unit === "m" ? "м" : "шт"}
      </div>

      <button
        type="button"
        onClick={onInc}
        className="h-8 w-8 rounded-full border border-slate-200 bg-white text-sm font-semibold text-slate-900 hover:bg-slate-50"
        aria-label="Увеличить количество"
      >
        +
      </button>
    </div>
  );
}

function ProductCard({
  product,
  qty,
  onInc,
  onDec,
}: {
  product: FeedCatalogProduct;
  qty: number;
  onInc: () => void;
  onDec: () => void;
}) {
  const regular = toNumber(product.priceRub);
  const discounted = getDiscountedPrice(regular);

  const benefit = Math.max(0, Math.round(regular - discounted));

  const attrs = pickDisplayAttributes(product)
    .map((a) => `${a.label}: ${a.value}`)
    .join(" • ");

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex gap-4">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100">
          <ProductImage src={product.coverImage} alt={toText(product.name)} className="object-cover" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-950">{toText(product.name)}</p>
              {toText(product.vendorCode) ? (
                <p className="mt-1 text-xs text-slate-500">Артикул: {toText(product.vendorCode)}</p>
              ) : null}
              {attrs ? <p className="mt-1 text-xs text-slate-500">{attrs}</p> : null}
            </div>

            <div className="text-right">
              <p className="text-sm font-semibold text-slate-950">{fmt(regular)} ₽</p>
              <p className="text-xs text-emerald-700">со скидкой: {fmt(discounted)} ₽</p>
              {benefit > 0 ? <p className="text-xs text-slate-500">выгода: {fmt(benefit)} ₽</p> : null}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <ProductQtyControls qty={qty} unit={product.unit} onDec={onDec} onInc={onInc} />
            {qty > 0 ? (
              <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white">В корзине</span>
            ) : (
              <span className="text-xs text-slate-500">Не выбрано</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function WizardStep1Lighting() {
  const { snapshot } = usePriceCalculatorBridge();

  const {
    options,
    step1CatalogView,
    setStep1CatalogView,
    lightingDraft,
    setLightingDraft,
  } = useCalculatorModal();

  const initialTab: Tab = options?.initialLightingTab === "catalog" ? "catalog" : "recommendations";
  const initialView: CatalogView = options?.initialLightingView === "selected" ? "selected" : "browse";

  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [catalogView, setCatalogView] = useState<CatalogView>(initialView);

  const [section, setSection] = useState<CatalogSectionId>("track-systems");
  const [trackSystem, setTrackSystem] = useState<TrackSystemId>("COLIBRI_220");
  const [trackGroup, setTrackGroup] = useState<TrackGroupId>("TRACK_FIXTURE");
  const [pointSubtype, setPointSubtype] = useState<PointSubtypeId>("GX53");

  const [query, setQuery] = useState<string>("");

  const [cartItems, setCartItems] = useState<CartItems>({});
  const prevInitialLightingRef = useRef<LightingSnapshot | null | undefined>(undefined);

  const products = useMemo(() => {
    const rawProducts = (snapshotData as { products?: unknown[] })?.products ?? [];
    return rawProducts
      .map((item) => normalizeProduct(item))
      .filter((item): item is FeedCatalogProduct => Boolean(item))
      .filter((p) => !REMOVED_COLIBRI_VENDOR_CODES.has(toText(p.vendorCode)));
  }, []);

  const byProductId = useMemo(() => {
    const map = new Map<string, FeedCatalogProduct>();
    for (const p of products) map.set(toText(p.productId), p);
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

  // sync from Step2 "Редактировать"
  useEffect(() => {
    if (!step1CatalogView) return;
    setCatalogView(step1CatalogView);
  }, [step1CatalogView]);

  // apply initialLighting (из страницы продажи / готовых комплектов)
  useEffect(() => {
    const incoming = options?.initialLighting;
    if (incoming === undefined) return;
    if (incoming === prevInitialLightingRef.current) return;

    prevInitialLightingRef.current = incoming;
    if (!incoming || incoming.mode !== "catalog" || !incoming.items?.length) return;

    const next: CartItems = {};

    for (const item of incoming.items) {
      const incomingSku = toText(item.sku);

      // sku может быть productId или vendorCode — пробуем оба
      const byId = byProductId.get(incomingSku);
      const byVendor = productIdByVendorCode.get(incomingSku);

      const resolvedId = byId ? incomingSku : toText(byVendor ?? "");
      if (!resolvedId) continue;

      const product = byProductId.get(resolvedId);
      if (!product) continue;

      next[resolvedId] = toNumber(item.qty);
    }

    setCartItems(next);
    setActiveTab("catalog");

    const nextView: CatalogView = options?.initialLightingView === "selected" ? "selected" : "browse";
    setCatalogView(nextView);
    setStep1CatalogView(nextView);
  }, [byProductId, options?.initialLighting, options?.initialLightingView, productIdByVendorCode, setStep1CatalogView]);

  const cartEntries = useMemo(() => {
    return Object.entries(cartItems)
      .filter(([, qty]) => qty > 0)
      .map(([productId, qty]) => {
        const product = byProductId.get(productId);
        return product ? { productId, product, qty } : null;
      })
      .filter((x): x is { productId: string; product: FeedCatalogProduct; qty: number } => Boolean(x));
  }, [byProductId, cartItems]);

  // build lightingDraft
  useEffect(() => {
    if (cartEntries.length === 0) {
      setLightingDraft({ mode: "none", userCustomizedLighting: false });
      return;
    }

    const items: LightingItem[] = cartEntries.map((e) => ({
      sku: toText(e.productId),
      name: toText(e.product.name),
      qty: e.qty,
      priceRub: toNumber(e.product.priceRub),
    }));

    const totalRub = items.reduce((sum, item) => sum + item.qty * item.priceRub, 0);
    const discountedTotalRub = applyLightingDiscount(totalRub);

    const draft: LightingSnapshot = {
      mode: "catalog",
      items,
      totalRub,
      discountedTotalRub,
      userCustomizedLighting: true,
      derivedInputsSnapshot: snapshot?.derivedInputs,
    };

    setLightingDraft(draft);
  }, [cartEntries, setLightingDraft, snapshot?.derivedInputs]);

  // deps
  const mountRequiredByVendor = useMemo(() => {
    const required: Record<string, number> = {};
    for (const entry of cartEntries) {
      const fixtureVendor = toText(entry.product.vendorCode);
      const mountVendor = POINT_TO_MOUNT_VENDOR_CODE[fixtureVendor];
      if (!mountVendor) continue;
      required[mountVendor] = (required[mountVendor] ?? 0) + entry.qty;
    }
    return required;
  }, [cartEntries]);

  const missingMounts = useMemo(() => {
    const out: Array<{ fixtureVendorCode: string; mountVendorCode: string; requiredQty: number; currentQty: number }> = [];

    for (const [fixtureVendor, mountVendor] of Object.entries(POINT_TO_MOUNT_VENDOR_CODE)) {
      const fixtureId = productIdByVendorCode.get(fixtureVendor);
      const mountId = productIdByVendorCode.get(mountVendor);
      if (!fixtureId || !mountId) continue;

      const fixtureQty = toNumber(cartItems[fixtureId]);
      if (fixtureQty <= 0) continue;

      const mountQty = toNumber(cartItems[mountId]);
      if (mountQty < fixtureQty) {
        out.push({ fixtureVendorCode: fixtureVendor, mountVendorCode: mountVendor, requiredQty: fixtureQty, currentQty: mountQty });
      }
    }

    return out;
  }, [cartItems, productIdByVendorCode]);

  const lampOptionsBySocket = useMemo(() => {
    const lamps = products
      .filter((p) => p.kind === "LAMP" && p.available !== false && toNumber(p.priceRub) > 0)
      .sort((a, b) => toNumber(a.priceRub) - toNumber(b.priceRub));

    return {
      GX53: lamps.filter((l) => detectSocket(l) === "GX53"),
      MR16: lamps.filter((l) => detectSocket(l) === "MR16"),
    };
  }, [products]);

  const lampRequiredBySocket = useMemo(() => {
    const required: Record<LampSocket, number> = { GX53: 0, MR16: 0 };

    for (const entry of cartEntries) {
      const socket = getRequiredLampSocket(entry.product);
      if (!socket) continue;
      required[socket] = (required[socket] ?? 0) + entry.qty;
    }

    return required;
  }, [cartEntries]);

  const missingLamps = useMemo(() => {
    const out: Array<{ socket: LampSocket; requiredQty: number; currentQty: number }> = [];

    for (const socket of ["GX53", "MR16"] as LampSocket[]) {
      const required = toNumber(lampRequiredBySocket[socket]);
      if (required <= 0) continue;

      const ids = lampOptionsBySocket[socket].map((l) => toText(l.productId));
      const current = ids.reduce((sum, id) => sum + toNumber(cartItems[id]), 0);

      if (current < required) out.push({ socket, requiredQty: required, currentQty: current });
    }

    return out;
  }, [cartItems, lampOptionsBySocket, lampRequiredBySocket]);

  const hasClarusFixtures = useMemo(() => {
    return cartEntries.some((e) => e.product.system === "CLARUS_48" && e.product.kind === "TRACK_FIXTURE");
  }, [cartEntries]);

  const clarusPsuQty = useMemo(() => {
    return cartEntries
      .filter((e) => CLARUS_PSU_VENDOR_CODES.includes(toText(e.product.vendorCode) as any))
      .reduce((sum, e) => sum + e.qty, 0);
  }, [cartEntries]);

  const addMountOneToOne = (fixtureVendor: string) => {
    const mountVendor = POINT_TO_MOUNT_VENDOR_CODE[toText(fixtureVendor)];
    if (!mountVendor) return;

    const mountId = productIdByVendorCode.get(mountVendor);
    if (!mountId) return;

    const required = toNumber(mountRequiredByVendor[mountVendor]);
    if (required <= 0) return;

    setCartItems((prev) => ({ ...prev, [mountId]: required }));
  };

  const addLampOneToOneCheapest = (socket: LampSocket) => {
    const required = toNumber(lampRequiredBySocket[socket]);
    if (required <= 0) return;

    const cheapest = lampOptionsBySocket[socket][0];
    if (!cheapest) return;

    const lampId = toText(cheapest.productId);

    setCartItems((prev) => {
      const next = { ...prev };

      // убираем другие лампы того же сокета
      const allIds = lampOptionsBySocket[socket].map((l) => toText(l.productId));
      for (const id of allIds) {
        if (id !== lampId) delete next[id];
      }

      next[lampId] = required;
      return next;
    });
  };

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

  const setCatalogViewAndSync = (view: CatalogView) => {
    setCatalogView(view);
    setStep1CatalogView(view);
  };

  const scopedProducts = useMemo(() => {
    let scoped: FeedCatalogProduct[] = [];

    if (catalogView === "selected") {
      scoped = cartEntries.map((e) => e.product);
    } else if (section === "track-systems") {
      if (trackGroup === "TRACK_PROFILE") {
        const whitelist = new Set(TRACK_PROFILE_WHITELIST[trackSystem]);
        scoped = products.filter(
          (p) => p.system === trackSystem && p.kind === "TRACK_PROFILE" && whitelist.has(toText(p.vendorCode))
        );
      } else {
        scoped = products.filter((p) => p.system === trackSystem && p.kind === trackGroup);
      }
    } else if (section === "point-fixtures") {
      scoped = products.filter((p) => matchesPointSubtype(p, pointSubtype));
    } else {
      scoped = products.filter((p) => isMountsOrGrilles(p));
    }

    const q = toText(query).toLowerCase();
    if (!q) return scoped;

    return scoped.filter((product) => {
      const attrs = pickDisplayAttributes(product).map((a) => `${a.label} ${a.value}`).join(" ");
      const haystack = `${toText(product.name)} ${toText(product.vendorCode)} ${toText(product.categoryPath)} ${attrs}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [catalogView, cartEntries, pointSubtype, products, query, section, trackGroup, trackSystem]);

  const totalSelected = useMemo(() => {
    return cartEntries.reduce((sum, e) => sum + e.qty * toNumber(e.product.priceRub), 0);
  }, [cartEntries]);

  const totalSelectedDiscounted = useMemo(() => applyLightingDiscount(totalSelected), [totalSelected]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <TabButton active={activeTab === "recommendations"} onClick={() => setActiveTab("recommendations")}>
          Рекомендации
        </TabButton>
        <TabButton active={activeTab === "catalog"} onClick={() => setActiveTab("catalog")}>
          Каталог
        </TabButton>
      </div>

      {activeTab === "recommendations" ? (
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            По параметрам: точечных{" "}
            <span className="font-semibold">{toNumber(snapshot?.derivedInputs?.pointSpotsQty)}</span> шт., трек{" "}
            <span className="font-semibold">{toNumber(snapshot?.derivedInputs?.trackLengthMeters)}</span> м.
          </div>

          {missingMounts.map((m) => (
            <div key={`${m.fixtureVendorCode}-${m.mountVendorCode}`} className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <p className="font-semibold">Не хватает закладных 1:1</p>
              <p className="mt-1 text-amber-900/80">
                Нужно: {m.requiredQty} шт., в корзине: {m.currentQty} шт.
              </p>
              <button
                type="button"
                onClick={() => addMountOneToOne(m.fixtureVendorCode)}
                className="mt-3 rounded-xl bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800"
              >
                Добавить 1:1
              </button>
            </div>
          ))}

          {missingLamps.map((m) => (
            <div key={m.socket} className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
              <p className="font-semibold">Не хватает ламп {m.socket} (1:1)</p>
              <p className="mt-1 text-blue-900/80">
                Нужно: {m.requiredQty} шт., в корзине: {m.currentQty} шт.
              </p>
              <button
                type="button"
                onClick={() => addLampOneToOneCheapest(m.socket)}
                className="mt-3 rounded-xl bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800"
              >
                Добавить 1:1 (самые доступные)
              </button>
            </div>
          ))}

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
                      className="rounded-xl bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-800"
                    >
                      Добавить: {toText(product.name)}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {activeTab === "catalog" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <TabButton active={catalogView === "browse"} onClick={() => setCatalogViewAndSync("browse")}>
              Каталог
            </TabButton>
            <TabButton active={catalogView === "selected"} onClick={() => setCatalogViewAndSync("selected")}>
              Выбранное ({cartEntries.length})
            </TabButton>
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
                  className={`rounded-xl px-3 py-1.5 text-sm ${
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
                  {TRACK_SYSTEMS.map((system) => (
                    <button
                      key={system.id}
                      type="button"
                      onClick={() => {
                        setTrackSystem(system.id);
                        setQuery("");
                      }}
                      className={`rounded-xl px-3 py-1.5 text-xs ${
                        trackSystem === system.id ? "bg-slate-900 text-white" : "bg-white text-slate-700"
                      }`}
                    >
                      {system.label}
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
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
            />
          </div>

          {catalogView === "selected" && cartEntries.length > 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
              <p className="text-slate-700">
                Итого без скидки: <span className="font-semibold text-slate-950">{fmt(totalSelected)} ₽</span>
              </p>
              <p className="mt-1 text-emerald-700">
                Итого со скидкой: <span className="font-semibold">{fmt(totalSelectedDiscounted)} ₽</span>{" "}
                <span className="text-xs font-semibold">−15%</span>
              </p>
            </div>
          ) : null}

          <div className="space-y-3">
            {scopedProducts.map((product) => {
              const id = toText(product.productId);
              const qty = toNumber(cartItems[id]);
              const step = product.unit === "m" ? 0.5 : 1;

              return (
                <ProductCard
                  key={id}
                  product={product}
                  qty={qty}
                  onInc={() => {
                    setCartItems((prev) => ({ ...prev, [id]: normalizeQty(qty + step, product.unit) }));
                  }}
                  onDec={() => {
                    setCartItems((prev) => {
                      const next = { ...prev };
                      const nextQty = normalizeQty(qty - step, product.unit);
                      if (nextQty <= 0) delete next[id];
                      else next[id] = nextQty;
                      return next;
                    });
                  }}
                />
              );
            })}

            {scopedProducts.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                Ничего не найдено
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* sanity: keep current lightingDraft */}
      {lightingDraft?.mode === "catalog" && lightingDraft.items?.length ? null : null}
    </div>
  );
}
