"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import snapshotData from "@/data/eks-feed2-snapshot.json";
import type { FeedCatalogParam, FeedCatalogProduct } from "@/lib/eks-feed2-catalog";
import type { LightingItem, LightingSnapshot } from "@/lib/calculator-modal-types";
import { applyLightingDiscount } from "@/lib/lighting-formulas";
import {
  buildProductsIndex,
  computeBenefit,
  detectSocket,
  getDiscountedPrice,
  getRequiredLampSocket,
} from "@/lib/feed2-products";
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
      return {
        label: toText(x?.label),
        value: toText(x?.value),
      };
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

  const images = Array.isArray(p.images)
    ? p.images.map((item) => toText(item)).filter(Boolean)
    : [];

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
  return text.includes("панел") || text.includes("led-панел") || text.includes("led панел");
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

function isPointFixture(product: FeedCatalogProduct): boolean {
  return product.kind === "SPOT_FIXTURE";
}

function matchesPointSubtype(product: FeedCatalogProduct, subtype: PointSubtypeId): boolean {
  if (!isPointFixture(product)) return false;
  if (subtype === "PANELS") return isPanelProduct(product);
  const socket = getPointSocketByProduct(product);
  return socket === subtype;
}

function isLamp(product: FeedCatalogProduct): boolean {
  return product.kind === "LAMP" && toNumber(product.priceRub) > 0 && product.available !== false;
}

function ProductQtyControls({
  qty,
  onDec,
  onInc,
}: {
  qty: number;
  onDec: () => void;
  onInc: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1">
      <button type="button" onClick={onDec} className="h-8 w-8 rounded-lg text-base font-semibold text-slate-700 hover:bg-slate-100">
        -
      </button>
      <span className="min-w-14 text-center text-sm font-semibold text-slate-900">{qty}</span>
      <button type="button" onClick={onInc} className="h-8 w-8 rounded-lg text-base font-semibold text-slate-700 hover:bg-slate-100">
        +
      </button>
    </div>
  );
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
      className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
        active ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      {children}
    </button>
  );
}

function pickDisplayAttributes(product: FeedCatalogProduct): { label: string; value: string }[] {
  const attrs = product.keyAttributes?.length ? product.keyAttributes : product.params;
  return (attrs ?? []).slice(0, 4).map((attr) => ({
    label: toText(attr.label),
    value: toText(attr.value),
  }));
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
  const benefit = computeBenefit(regular, discounted);

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-3">
      <ProductImage src={toText(product.coverImage)} alt={toText(product.name)} />
      <div className="mt-3 space-y-1">
        <p className="line-clamp-2 text-sm font-semibold text-slate-950">{toText(product.name)}</p>
        <p className="text-xs text-slate-500">Артикул: {toText(product.vendorCode)}</p>
        <ul className="space-y-0.5">
          {pickDisplayAttributes(product).map((attr) => (
            <li key={`${toText(product.productId)}-${attr.label}-${attr.value}`} className="text-xs text-slate-600">
              {attr.label}: {attr.value}
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-3 space-y-1">
        <p className="text-xs text-slate-500">Цена: {fmt(regular)} ₽</p>
        <p className="text-xs font-semibold text-emerald-700">Со скидкой: {fmt(discounted)} ₽</p>
        <p className="text-xs text-emerald-600">Выгода: {fmt(benefit)} ₽</p>
      </div>
      <div className="mt-3">
        <ProductQtyControls qty={qty} onDec={onDec} onInc={onInc} />
      </div>
    </article>
  );
}

export function WizardStep1Lighting() {
  const { snapshot } = usePriceCalculatorBridge();
  const { lightingDraft, setLightingDraft, options, step1CatalogView, setStep1CatalogView } = useCalculatorModal();

  const initialTab: Tab = options?.initialLightingTab === "catalog" ? "catalog" : "recommendations";
  const initialCatalogView: CatalogView = options?.initialLightingView === "selected" ? "selected" : "browse";

  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [catalogView, setCatalogView] = useState<CatalogView>(initialCatalogView);

  const [section, setSection] = useState<CatalogSectionId>("track-systems");
  const [trackSystem, setTrackSystem] = useState<TrackSystemId>("COLIBRI_220");
  const [trackGroup, setTrackGroup] = useState<TrackGroupId>("TRACK_FIXTURE");
  const [pointSubtype, setPointSubtype] = useState<PointSubtypeId>("GX53");
  const [query, setQuery] = useState("");

  const [selectedLampBySocket, setSelectedLampBySocket] = useState<Record<LampSocket, string | null>>({
    GX53: null,
    MR16: null,
  });

  const [cartItems, setCartItems] = useState<CartItems>({});
  const [removedHint, setRemovedHint] = useState(false);

  const prevInitialLightingRef = useRef<LightingSnapshot | null | undefined>(undefined);

  const products = useMemo<FeedCatalogProduct[]>(() => {
    const rawProducts = (snapshotData as { products?: unknown[] })?.products ?? [];
    return rawProducts
      .map((item) => normalizeProduct(item))
      .filter((item): item is FeedCatalogProduct => Boolean(item))
      .filter((item) => !REMOVED_COLIBRI_VENDOR_CODES.has(toText(item.vendorCode)));
  }, []);

  const productsById = useMemo(() => buildProductsIndex(products), [products]);

  const productIdByVendorCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const product of products) {
      const vendorCode = toText(product.vendorCode);
      const productId = toText(product.productId);
      if (vendorCode && productId) map.set(vendorCode, productId);
    }
    return map;
  }, [products]);

  useEffect(() => {
    if (!step1CatalogView) return;
    setCatalogView(step1CatalogView);
  }, [step1CatalogView]);

  useEffect(() => {
    const incoming = options?.initialLighting;
    if (incoming === undefined) return;
    if (incoming === prevInitialLightingRef.current) return;

    prevInitialLightingRef.current = incoming;
    if (!incoming) return;

    if (incoming.mode === "catalog" && incoming.items?.length) {
      const next: CartItems = {};
      let removedAny = false;

      for (const item of incoming.items) {
        const incomingSku = toText(item.sku);
        const byProductId = productsById.get(incomingSku);
        const byVendorCodeId = productIdByVendorCode.get(incomingSku);
        const resolvedId = byProductId ? incomingSku : toText(byVendorCodeId ?? "");

        if (!resolvedId) {
          removedAny = true;
          continue;
        }

        const resolvedProduct = productsById.get(resolvedId);
        if (!resolvedProduct) {
          removedAny = true;
          continue;
        }

        if (REMOVED_COLIBRI_VENDOR_CODES.has(toText(resolvedProduct.vendorCode))) {
          removedAny = true;
          continue;
        }

        next[resolvedId] = toNumber(item.qty);
      }

      setCartItems(next);
      setRemovedHint(removedAny);
      setActiveTab("catalog");

      const nextView: CatalogView = options?.initialLightingView === "selected" ? "selected" : "browse";
      setCatalogView(nextView);
      setStep1CatalogView(nextView);
    }
  }, [options?.initialLighting, options?.initialLightingView, productIdByVendorCode, productsById, setStep1CatalogView]);

  const cartEntries = useMemo(() => {
    return Object.entries(cartItems)
      .filter(([, qty]) => qty > 0)
      .map(([productId, qty]) => {
        const product = productsById.get(productId);
        return product ? { productId, product, qty } : null;
      })
      .filter((entry): entry is { productId: string; product: FeedCatalogProduct; qty: number } => Boolean(entry))
      .filter((entry) => !REMOVED_COLIBRI_VENDOR_CODES.has(toText(entry.product.vendorCode)));
  }, [cartItems, productsById]);

  useEffect(() => {
    setCartItems((prev) => {
      const next: CartItems = { ...prev };
      let changed = false;

      for (const [productId] of Object.entries(next)) {
        const product = productsById.get(productId);
        if (!product || REMOVED_COLIBRI_VENDOR_CODES.has(toText(product.vendorCode))) {
          delete next[productId];
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [productsById]);

  const selectedViewItems = useMemo(() => {
    return cartEntries.map((entry) => ({
      product: entry.product,
      item: {
        sku: toText(entry.product.productId),
        name: toText(entry.product.name),
        qty: entry.qty,
        priceRub: toNumber(entry.product.priceRub),
      },
    }));
  }, [cartEntries]);

  const selectedTotals = useMemo(() => {
    const regular = selectedViewItems.reduce((sum, x) => sum + x.item.qty * x.item.priceRub, 0);
    const discounted = applyLightingDiscount(regular);
    const benefit = Math.max(0, regular - discounted);
    return { regular, discounted, benefit };
  }, [selectedViewItems]);

  const lampOptionsBySocket = useMemo(() => {
    const lamps = products.filter((product) => isLamp(product));
    return {
      GX53: lamps.filter((lamp) => detectSocket(lamp) === "GX53"),
      MR16: lamps.filter((lamp) => detectSocket(lamp) === "MR16"),
    };
  }, [products]);

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

  const lampRequiredBySocket = useMemo(() => {
    const required: Record<LampSocket, number> = { GX53: 0, MR16: 0 };
    for (const entry of cartEntries) {
      const socket = getRequiredLampSocket(entry.product);
      if (!socket) continue;
      required[socket] = (required[socket] ?? 0) + entry.qty;
    }
    return required;
  }, [cartEntries]);

  useEffect(() => {
    setCartItems((prev) => {
      const next: CartItems = { ...prev };
      let changed = false;

      for (const [mountVendor, requiredQty] of Object.entries(mountRequiredByVendor)) {
        const mountId = productIdByVendorCode.get(toText(mountVendor));
        if (!mountId) continue;

        const currentQty = toNumber(next[mountId]);
        if (requiredQty > 0 && currentQty > 0 && currentQty !== requiredQty) {
          next[mountId] = requiredQty;
          changed = true;
        }
        if (requiredQty <= 0 && currentQty > 0) {
          delete next[mountId];
          changed = true;
        }
      }

      for (const socket of ["GX53", "MR16"] as LampSocket[]) {
        const requiredQty = toNumber(lampRequiredBySocket[socket]);
        const lampIds = lampOptionsBySocket[socket].map((lamp) => toText(lamp.productId));
        const lampsInCart = lampIds.filter((id) => toNumber(next[id]) > 0);

        if (requiredQty <= 0) {
          for (const id of lampsInCart) {
            delete next[id];
            changed = true;
          }
          continue;
        }

        if (lampsInCart.length > 0) {
          const selectedId = toText(selectedLampBySocket[socket] ?? "");
          const chosenId = lampsInCart.includes(selectedId) ? selectedId : lampsInCart[0];

          for (const id of lampsInCart) {
            if (id !== chosenId) {
              delete next[id];
              changed = true;
            }
          }

          if (toNumber(next[chosenId]) !== requiredQty) {
            next[chosenId] = requiredQty;
            changed = true;
          }
        }
      }

      return changed ? next : prev;
    });
  }, [lampOptionsBySocket, lampRequiredBySocket, mountRequiredByVendor, productIdByVendorCode, selectedLampBySocket]);

  useEffect(() => {
    if (cartEntries.length === 0) {
      setLightingDraft({ mode: "none", userCustomizedLighting: false });
      return;
    }

    const items: LightingItem[] = cartEntries.map((entry) => ({
      sku: toText(entry.productId),
      name: toText(entry.product.name),
      qty: entry.qty,
      priceRub: toNumber(entry.product.priceRub),
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

  const hasClarusInSnapshot = useMemo(() => products.some((product) => product.system === "CLARUS_48"), [products]);

  const hasClarusInCart = useMemo(() => {
    return cartEntries.some((entry) => entry.product.system === "CLARUS_48");
  }, [cartEntries]);

  const clarusPsuQty = useMemo(() => {
    return cartEntries
      .filter((entry) => CLARUS_PSU_VENDOR_CODES.includes(toText(entry.product.vendorCode) as (typeof CLARUS_PSU_VENDOR_CODES)[number]))
      .reduce((sum, entry) => sum + entry.qty, 0);
  }, [cartEntries]);

  const missingMounts = useMemo(() => {
    const out: Array<{
      fixtureVendorCode: string;
      mountVendorCode: string;
      fixtureName: string;
      mountName: string;
      requiredQty: number;
      currentQty: number;
    }> = [];

    for (const [fixtureVendor, mountVendor] of Object.entries(POINT_TO_MOUNT_VENDOR_CODE)) {
      const fixtureId = productIdByVendorCode.get(fixtureVendor);
      const mountId = productIdByVendorCode.get(mountVendor);
      if (!fixtureId || !mountId) continue;

      const fixtureProduct = productsById.get(fixtureId);
      const mountProduct = productsById.get(mountId);
      if (!fixtureProduct || !mountProduct) continue;

      const fixtureQty = toNumber(cartItems[fixtureId]);
      if (fixtureQty <= 0) continue;

      const mountQty = toNumber(cartItems[mountId]);
      if (mountQty < fixtureQty) {
        out.push({
          fixtureVendorCode: fixtureVendor,
          mountVendorCode: mountVendor,
          fixtureName: toText(fixtureProduct.name),
          mountName: toText(mountProduct.name),
          requiredQty: fixtureQty,
          currentQty: mountQty,
        });
      }
    }

    return out;
  }, [cartItems, productIdByVendorCode, productsById]);

  const missingLamps = useMemo(() => {
    const out: Array<{ socket: LampSocket; requiredQty: number; currentQty: number }> = [];

    for (const socket of ["GX53", "MR16"] as LampSocket[]) {
      const required = toNumber(lampRequiredBySocket[socket]);
      if (required <= 0) continue;

      const ids = lampOptionsBySocket[socket].map((lamp) => toText(lamp.productId));
      const current = ids.reduce((sum, id) => sum + toNumber(cartItems[id]), 0);

      if (current < required) out.push({ socket, requiredQty: required, currentQty: current });
    }

    return out;
  }, [cartItems, lampOptionsBySocket, lampRequiredBySocket]);

  const setCatalogViewAndSync = (view: CatalogView) => {
    setCatalogView(view);
    setStep1CatalogView(view);
  };

  const setProductQty = (product: FeedCatalogProduct, nextQtyRaw: number) => {
    const id = toText(product.productId);
    const qty = normalizeQty(nextQtyRaw, product.unit);

    setCartItems((prev) => {
      const next = { ...prev };
      if (qty <= 0) {
        delete next[id];
      } else {
        next[id] = qty;
      }
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

  const addLampOneToOne = (socket: LampSocket, lampId: string) => {
    const required = toNumber(lampRequiredBySocket[socket]);
    if (required <= 0) return;

    setSelectedLampBySocket((prev) => ({ ...prev, [socket]: lampId }));

    setCartItems((prev) => {
      const next = { ...prev };
      const lampIds = lampOptionsBySocket[socket].map((lamp) => toText(lamp.productId));
      for (const id of lampIds) {
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

  const trackAssembled = useMemo(() => {
    const result: Record<TrackSystemId, boolean> = {
      COLIBRI_220: false,
      CLARUS_48: false,
      TRACK_220: false,
    };

    for (const system of ["COLIBRI_220", "CLARUS_48", "TRACK_220"] as TrackSystemId[]) {
      const hasFixture = cartEntries.some(
        (entry) => entry.product.system === system && entry.product.kind === "TRACK_FIXTURE"
      );
      const profileWhitelist = new Set(TRACK_PROFILE_WHITELIST[system]);
      const hasProfile = cartEntries.some(
        (entry) =>
          entry.product.system === system &&
          profileWhitelist.has(toText(entry.product.vendorCode))
      );
      result[system] = hasFixture && hasProfile;
    }

    return result;
  }, [cartEntries]);

  const pointCompleted = useMemo(() => {
    const fixtures = cartEntries.filter((entry) => {
      const socket = getRequiredLampSocket(entry.product);
      if (socket) return true;
      const vendorCode = toText(entry.product.vendorCode);
      return POINT_TO_MOUNT_VENDOR_CODE[vendorCode] !== undefined;
    });

    if (fixtures.length === 0) return false;

    const lampQtyBySocket: Record<LampSocket, number> = { GX53: 0, MR16: 0 };
    for (const socket of ["GX53", "MR16"] as LampSocket[]) {
      const lampIds = lampOptionsBySocket[socket].map((lamp) => toText(lamp.productId));
      lampQtyBySocket[socket] = lampIds.reduce((sum, id) => sum + toNumber(cartItems[id]), 0);
    }

    return fixtures.every((entry) => {
      const vendorCode = toText(entry.product.vendorCode);

      const mountVendor = POINT_TO_MOUNT_VENDOR_CODE[vendorCode];
      const mountOk = mountVendor
        ? toNumber(cartItems[toText(productIdByVendorCode.get(mountVendor) ?? "")]) >= entry.qty
        : true;

      const socket = getRequiredLampSocket(entry.product);
      const lampOk = socket ? lampQtyBySocket[socket] >= toNumber(lampRequiredBySocket[socket]) : true;

      return mountOk && lampOk;
    });
  }, [cartEntries, lampOptionsBySocket, lampRequiredBySocket, cartItems, productIdByVendorCode]);

  const scopedProducts = useMemo(() => {
    let scoped: FeedCatalogProduct[] = [];

    if (catalogView === "selected") {
      scoped = selectedViewItems.map((item) => item.product);
    } else if (section === "track-systems") {
      if (trackGroup === "TRACK_PROFILE") {
        const whitelist = new Set(TRACK_PROFILE_WHITELIST[trackSystem]);
        scoped = products.filter(
          (product) =>
            product.system === trackSystem &&
            product.kind === "TRACK_PROFILE" &&
            whitelist.has(toText(product.vendorCode))
        );
      } else {
        scoped = products.filter(
          (product) => product.system === trackSystem && product.kind === trackGroup
        );
      }
    } else if (section === "point-fixtures") {
      scoped = products.filter((product) => matchesPointSubtype(product, pointSubtype));
    } else {
      scoped = products.filter((product) => isMountsOrGrilles(product));
    }

    const q = toText(query).toLowerCase();
    if (!q) return scoped;

    return scoped.filter((product) => {
      const attrs = pickDisplayAttributes(product).map((a) => `${a.label} ${a.value}`).join(" ");
      const haystack = `${toText(product.name)} ${toText(product.vendorCode)} ${toText(product.categoryPath)} ${attrs}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [catalogView, pointSubtype, products, query, section, selectedViewItems, trackGroup, trackSystem]);

  const showClarusEmptyMessage =
    section === "track-systems" && trackSystem === "CLARUS_48" && !hasClarusInSnapshot;

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
        <TabButton active={activeTab === "recommendations"} onClick={() => setActiveTab("recommendations")}>
          Рекомендации
        </TabButton>
        <TabButton active={activeTab === "catalog"} onClick={() => setActiveTab("catalog")}>
          Каталог
        </TabButton>
      </div>

      {removedHint ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Некоторые позиции удалены из ассортимента и автоматически убраны из выбранного.
        </div>
      ) : null}

      {activeTab === "recommendations" ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-600">
              По параметрам: точечных {toNumber(snapshot?.derivedInputs?.pointSpotsQty)} шт., трек {toNumber(snapshot?.derivedInputs?.trackLengthMeters)} м.
            </p>
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              <li>COLIBRI: {trackAssembled.COLIBRI_220 ? "собрано" : "не собрано"}</li>
              <li>CLARUS: {trackAssembled.CLARUS_48 ? "собрано" : "не собрано"}</li>
              <li>ART: {trackAssembled.TRACK_220 ? "собрано" : "не собрано"}</li>
              <li>Точечные: {pointCompleted ? "укомплектовано" : "не укомплектовано"}</li>
            </ul>
          </div>

          {missingMounts.map((item) => (
            <div key={`${item.fixtureVendorCode}-${item.mountVendorCode}`} className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-900">
                Для {item.fixtureName} нужна закладная {item.mountName}
              </p>
              <p className="mt-1 text-xs text-amber-700">
                Нужно: {item.requiredQty} шт., в корзине: {item.currentQty} шт.
              </p>
              <button
                type="button"
                onClick={() => addMountOneToOne(item.fixtureVendorCode)}
                className="mt-2 rounded-xl bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800"
              >
                Добавить 1:1
              </button>
            </div>
          ))}

          {missingLamps.map((missing) => (
            <div key={missing.socket} className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm font-medium text-blue-900">
                Для светильников с цоколем {missing.socket} не хватает ламп.
              </p>
              <p className="mt-1 text-xs text-blue-700">
                Нужно: {missing.requiredQty} шт., в корзине: {missing.currentQty} шт.
              </p>

              <div className="mt-2 space-y-2">
                {lampOptionsBySocket[missing.socket].slice(0, 4).map((lamp) => {
                  const lampId = toText(lamp.productId);
                  return (
                    <div key={lampId} className="rounded-xl border border-blue-100 bg-white p-3">
                      <p className="text-xs font-semibold text-slate-900">{toText(lamp.name)}</p>
                      <p className="mt-1 text-xs text-slate-600">
                        {pickDisplayAttributes(lamp)
                          .map((attr) => `${attr.label}: ${attr.value}`)
                          .join(" • ")}
                      </p>
                      <button
                        type="button"
                        onClick={() => addLampOneToOne(missing.socket, lampId)}
                        className="mt-2 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800"
                      >
                        Добавить 1:1
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {hasClarusInCart && clarusPsuQty < 1 ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <p className="text-sm font-semibold text-rose-900">
                Для системы CLARUS обязателен минимум 1 блок питания.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {CLARUS_PSU_VENDOR_CODES.map((vendor) => {
                  const id = productIdByVendorCode.get(vendor);
                  if (!id) return null;
                  const product = productsById.get(id);
                  if (!product) return null;
                  return (
                    <button
                      key={vendor}
                      type="button"
                      onClick={() => setClarusPsu(id)}
                      className="rounded-xl bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-800"
                    >
                      {toText(product.name)}
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
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCatalogViewAndSync("browse")}
              className={`rounded-xl px-3 py-2 text-sm font-medium ${
                catalogView === "browse" ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700"
              }`}
            >
              Каталог
            </button>
            <button
              type="button"
              onClick={() => setCatalogViewAndSync("selected")}
              className={`rounded-xl px-3 py-2 text-sm font-medium ${
                catalogView === "selected" ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700"
              }`}
            >
              Выбранное ({selectedViewItems.length})
            </button>
          </div>

          {catalogView === "selected" ? (
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              {selectedViewItems.length === 0 ? (
                <p className="text-sm text-slate-500">Пока ничего не выбрано.</p>
              ) : null}

              {selectedViewItems.map(({ item, product }) => {
                const regular = item.priceRub;
                const discounted = getDiscountedPrice(regular);
                const productId = toText(product.productId);

                return (
                  <div key={productId} className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="grid grid-cols-[96px_1fr] gap-3">
                      <ProductImage
                        src={toText(product.coverImage)}
                        alt={toText(product.name)}
                        containerClassName="h-24 w-24 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-2"
                        className="h-full w-full object-contain"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-950">{item.name}</p>
                        <p className="mt-1 text-xs text-slate-600">
                          {pickDisplayAttributes(product).map((a) => `${a.label}: ${a.value}`).join(" • ")}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Qty: {item.qty} • {fmt(regular)} ₽ / шт • со скидкой {fmt(discounted)} ₽ / шт
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setCartItems((prev) => {
                            const next = { ...prev };
                            delete next[productId];
                            return next;
                          });
                        }}
                        aria-label={`Удалить ${item.name}`}
                        className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                );
              })}

              {selectedViewItems.length > 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                  <p>Итого без скидки: {fmt(selectedTotals.regular)} ₽</p>
                  <p className="font-semibold text-emerald-700">Итого со скидкой: {fmt(selectedTotals.discounted)} ₽</p>
                  <p className="text-emerald-600">Ваша выгода: {fmt(selectedTotals.benefit)} ₽</p>
                </div>
              ) : null}
            </div>
          ) : (
            <>
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

              {showClarusEmptyMessage ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Нет данных CLARUS в snapshot
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                {scopedProducts.map((product) => {
                  const id = toText(product.productId);
                  const qty = toNumber(cartItems[id]);

                  return (
                    <ProductCard
                      key={id}
                      product={product}
                      qty={qty}
                      onInc={() => setProductQty(product, qty + (product.unit === "m" ? 0.5 : 1))}
                      onDec={() => setProductQty(product, qty - (product.unit === "m" ? 0.5 : 1))}
                    />
                  );
                })}
              </div>

              {!showClarusEmptyMessage && scopedProducts.length === 0 ? (
                <p className="text-sm text-slate-500">Ничего не найдено</p>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
