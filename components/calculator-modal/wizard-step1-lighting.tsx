"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import snapshotData from "@/data/eks-feed2-snapshot.json";
import type { FeedCatalogProduct, FeedCatalogParam } from "@/lib/eks-feed2-catalog";
import type { LightingItem, LightingSnapshot } from "@/lib/calculator-modal-types";
import { applyLightingDiscount } from "@/lib/lighting-formulas";
import {
  buildProductsIndex,
  computeBenefit,
  detectSocket,
  getDiscountedPrice,
} from "@/lib/feed2-products";
import { ProductImage } from "@/components/feed2/ProductImage";
import { useCalculatorModal } from "./calculator-modal-context";
import { usePriceCalculatorBridge } from "@/components/home/price-calculator-context";

type Tab = "recommendations" | "catalog";
type CatalogView = "selected" | "browse";
type CatalogSection = "track-systems" | "point-fixtures" | "mounts-grilles";
type TrackSystemUi = "COLIBRI_220" | "CLARUS_48" | "TRACK_220";
type TrackGroupUi = "TRACK_FIXTURE" | "TRACK_PROFILE";
type PointSubtype = "GX53" | "MR16" | "PANELS";
type CartItems = Record<string, number>;
type SocketType = "GX53" | "MR16";

const TRACK_SYSTEM_LABELS: Record<TrackSystemUi, string> = {
  COLIBRI_220: "COLIBRI 220V (встраиваемая)",
  CLARUS_48: "CLARUS 48V (встраиваемая)",
  TRACK_220: "ART 220V (накладная)",
};

const TRACK_PROFILE_WHITELIST: Record<TrackSystemUi, string[]> = {
  COLIBRI_220: ["0У-00006089", "0У-00006090", "0У-00006986"],
  CLARUS_48: ["0У-00006634", "0У-00006633"],
  TRACK_220: [
    "0У-00006342",
    "0У-00006341",
    "0У-00001613",
    "0У-00001356",
    "0У-00001355",
    "0У-00001354",
    "0У-00001353",
  ],
};

const POINT_TO_MOUNT_VENDOR: Record<string, string> = {
  "0У-00007177": "0У-00007121",
  "0У-00007176": "0У-00007121",
  "0У-00001551": "0У-00003286",
  "0У-00001552": "0У-00003286",
};

const CLARUS_PSU_VENDORS = ["0У-00002310", "0У-00002308"];

function fmt(n: number): string {
  return new Intl.NumberFormat("ru-RU").format(Math.round(n));
}

function toText(value: unknown): string {
  return String(value ?? "").trim();
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
  const url = toText(p.url);
  const categoryId = toText(p.categoryId);
  const categoryPath = toText(p.categoryPath);

  if (!name || (!vendorCode && !offerId)) return null;

  const productIdRaw = toText(p.productId);
  const productId = productIdRaw || `feed2-${vendorCode || offerId || name}`;

  const images = Array.isArray(p.images)
    ? p.images.map((item) => toText(item)).filter(Boolean)
    : [];

  const coverImage = toText(p.coverImage) || images[0] || "";
  const priceRub = Number(p.priceRub ?? 0);
  const available = Boolean(p.available ?? true);
  const params = toParams(p.params);
  const keyAttributes = toParams(p.keyAttributes);

  const normalized: FeedCatalogProduct = {
    productId: toText(productId),
    vendorCode,
    offerId,
    name,
    url,
    categoryId,
    categoryPath,
    images,
    coverImage,
    priceRub: Number.isFinite(priceRub) ? priceRub : 0,
    available,
    params,
    keyAttributes,
    system: (toText(p.system) || "UNKNOWN") as FeedCatalogProduct["system"],
    kind: (toText(p.kind) || "OTHER") as FeedCatalogProduct["kind"],
    unit: (toText(p.unit) === "m" ? "m" : "pcs") as FeedCatalogProduct["unit"],
    lengthMeters: toNumberOrNull(p.lengthMeters),
    pieceLengthMeters: toNumberOrNull(p.pieceLengthMeters),
  };

  return normalized;
}

function stepByUnit(unit: "pcs" | "m"): number {
  return unit === "m" ? 0.5 : 1;
}

function normalizeQty(value: number, unit: "pcs" | "m"): number {
  const step = stepByUnit(unit);
  const normalized = Math.round(value / step) * step;
  if (!Number.isFinite(normalized)) return 0;
  return Math.max(0, normalized);
}

function pickDisplayAttributes(product: FeedCatalogProduct): { label: string; value: string }[] {
  const attrs = product.keyAttributes?.length ? product.keyAttributes : product.params;
  return (attrs ?? []).slice(0, 4).map((attr) => ({
    label: toText(attr.label),
    value: toText(attr.value),
  }));
}

function getSocketByFixture(product: FeedCatalogProduct): SocketType | null {
  const vendorCode = toText(product.vendorCode);
  if (vendorCode === "0У-00007177" || vendorCode === "0У-00007176") return "GX53";
  if (vendorCode === "0У-00001551" || vendorCode === "0У-00001552") return "MR16";

  const autoSocket = detectSocket(product);
  if (autoSocket === "GX53") return "GX53";
  if (autoSocket === "MR16") return "MR16";
  return null;
}

function isPanelProduct(product: FeedCatalogProduct): boolean {
  const text = `${toText(product.name)} ${toText(product.vendorCode)}`.toLowerCase();
  return text.includes("панел");
}

function isMountOrGrille(product: FeedCatalogProduct): boolean {
  const text = `${toText(product.name)} ${toText(product.vendorCode)}`.toLowerCase();
  return text.includes("заклад") || text.includes("решетк") || text.includes("решётк");
}

function isLamp(product: FeedCatalogProduct): boolean {
  return product.kind === "LAMP";
}

function isPointFixture(product: FeedCatalogProduct): boolean {
  return product.kind === "SPOT_FIXTURE";
}

function matchesPointSubtype(product: FeedCatalogProduct, subtype: PointSubtype): boolean {
  if (!isPointFixture(product)) return false;
  if (subtype === "PANELS") return isPanelProduct(product);

  const socket = getSocketByFixture(product);
  if (subtype === "GX53") return socket === "GX53";
  if (subtype === "MR16") return socket === "MR16";
  return false;
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
      <button
        type="button"
        onClick={onDec}
        className="h-8 w-8 rounded-lg text-base font-semibold text-slate-700 hover:bg-slate-100"
      >
        −
      </button>
      <span className="min-w-14 text-center text-sm font-semibold text-slate-900">{qty}</span>
      <button
        type="button"
        onClick={onInc}
        className="h-8 w-8 rounded-lg text-base font-semibold text-slate-700 hover:bg-slate-100"
      >
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
  const regular = product.priceRub;
  const discounted = getDiscountedPrice(regular);
  const benefit = computeBenefit(regular, discounted);

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-3">
      <ProductImage src={product.coverImage} alt={toText(product.name)} />
      <div className="mt-3 space-y-1">
        <p className="line-clamp-2 text-sm font-semibold text-slate-950">{toText(product.name)}</p>
        <p className="text-xs text-slate-500">VC: {toText(product.vendorCode)}</p>
        <ul className="space-y-0.5">
          {pickDisplayAttributes(product).map((attr) => (
            <li
              key={`${toText(product.productId)}-${attr.label}-${attr.value}`}
              className="text-xs text-slate-600"
            >
              {attr.label}: {attr.value}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-3 space-y-1">
        <p className="text-xs text-slate-500">Цена: {fmt(regular)} ₽</p>
        <p className="text-xs font-semibold text-emerald-700">
          Со скидкой 15%: {fmt(discounted)} ₽
        </p>
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
  const {
    lightingDraft,
    setLightingDraft,
    options,
    step1CatalogView,
    setStep1CatalogView,
  } = useCalculatorModal();

  const initialTab: Tab = options?.initialLightingTab === "catalog" ? "catalog" : "recommendations";
  const initialCatalogView: CatalogView =
    options?.initialLightingView === "selected" ? "selected" : "browse";

  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [catalogView, setCatalogView] = useState<CatalogView>(initialCatalogView);

  const [catalogSection, setCatalogSection] = useState<CatalogSection>("track-systems");
  const [trackSystem, setTrackSystem] = useState<TrackSystemUi>("COLIBRI_220");
  const [trackGroup, setTrackGroup] = useState<TrackGroupUi>("TRACK_FIXTURE");
  const [pointSubtype, setPointSubtype] = useState<PointSubtype>("GX53");
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedLampBySocket, setSelectedLampBySocket] = useState<Record<SocketType, string | null>>({
    GX53: null,
    MR16: null,
  });

  const [cartItems, setCartItems] = useState<CartItems>(() => {
    const initialItems = lightingDraft?.items ?? [];
    return Object.fromEntries(initialItems.map((item) => [toText(item.sku), Number(item.qty ?? 0)]));
  });

  const prevInitialLightingRef = useRef<LightingSnapshot | null | undefined>(undefined);

  const products = useMemo<FeedCatalogProduct[]>(() => {
    const rawProducts = (snapshotData as { products?: unknown[] })?.products ?? [];
    const normalized = rawProducts
      .map((item) => normalizeProduct(item))
      .filter((item): item is FeedCatalogProduct => Boolean(item))
      .filter((item) => Boolean(toText(item.productId)));
    return normalized;
  }, []);

  const productsById = useMemo(() => buildProductsIndex(products), [products]);

  const productIdByVendorCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const product of products) {
      const vendorCode = toText(product.vendorCode);
      const productId = toText(product.productId);
      if (!vendorCode || !productId) continue;
      if (!map.has(vendorCode)) map.set(vendorCode, productId);
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
      for (const item of incoming.items) {
        next[toText(item.sku)] = Number(item.qty ?? 0);
      }
      setCartItems(next);
      setActiveTab("catalog");

      const nextView: CatalogView =
        options?.initialLightingView === "selected" ? "selected" : "browse";
      setCatalogView(nextView);
      setStep1CatalogView(nextView);
    }
  }, [options?.initialLighting, options?.initialLightingView, setStep1CatalogView]);

  const cartEntries = useMemo(() => {
    return Object.entries(cartItems)
      .filter(([, qty]) => Number(qty) > 0)
      .map(([productId, qty]) => {
        const product = productsById.get(productId);
        return {
          product,
          productId,
          qty: Number(qty),
        };
      })
      .filter(
        (entry): entry is { product: FeedCatalogProduct; productId: string; qty: number } =>
          Boolean(entry.product)
      );
  }, [cartItems, productsById]);

  const selectedViewItems = useMemo(() => {
    return cartEntries.map((entry) => ({
      item: {
        sku: entry.productId,
        qty: entry.qty,
        name: toText(entry.product.name),
        priceRub: Number(entry.product.priceRub ?? 0),
      },
      product: entry.product,
    }));
  }, [cartEntries]);

  const selectedTotals = useMemo(() => {
    const regular = selectedViewItems.reduce((sum, x) => sum + x.item.qty * x.item.priceRub, 0);
    const discounted = getDiscountedPrice(regular);
    return {
      regular,
      discounted,
      benefit: computeBenefit(regular, discounted),
    };
  }, [selectedViewItems]);

  const lampOptionsBySocket = useMemo(() => {
    const lamps = products.filter((product) => isLamp(product) && product.available !== false);
    return {
      GX53: lamps.filter((lamp) => detectSocket(lamp) === "GX53"),
      MR16: lamps.filter((lamp) => detectSocket(lamp) === "MR16"),
    };
  }, [products]);

  const mountRequiredByVendor = useMemo(() => {
    const required: Record<string, number> = {};
    for (const entry of cartEntries) {
      const fixtureVendorCode = toText(entry.product.vendorCode);
      const mountVendorCode = POINT_TO_MOUNT_VENDOR[fixtureVendorCode];
      if (!mountVendorCode) continue;
      required[mountVendorCode] = Number(required[mountVendorCode] ?? 0) + Number(entry.qty ?? 0);
    }
    return required;
  }, [cartEntries]);

  const lampRequiredBySocket = useMemo(() => {
    const required: Record<SocketType, number> = { GX53: 0, MR16: 0 };
    for (const entry of cartEntries) {
      const socket = getSocketByFixture(entry.product);
      if (!socket) continue;
      required[socket] = Number(required[socket] ?? 0) + Number(entry.qty ?? 0);
    }
    return required;
  }, [cartEntries]);

  useEffect(() => {
    setCartItems((prev) => {
      const next: CartItems = { ...prev };
      let changed = false;

      for (const [mountVendorCode, requiredQtyRaw] of Object.entries(mountRequiredByVendor)) {
        const requiredQty = Number(requiredQtyRaw ?? 0);
        const mountProductId = productIdByVendorCode.get(toText(mountVendorCode));
        if (!mountProductId) continue;
        const currentQty = Number(next[mountProductId] ?? 0);

        if (requiredQty <= 0 && currentQty > 0) {
          delete next[mountProductId];
          changed = true;
          continue;
        }

        if (requiredQty > 0 && currentQty > 0 && currentQty !== requiredQty) {
          next[mountProductId] = requiredQty;
          changed = true;
        }
      }

      const sockets: SocketType[] = ["GX53", "MR16"];
      for (const socket of sockets) {
        const requiredQty = Number(lampRequiredBySocket[socket] ?? 0);
        const lampIds = lampOptionsBySocket[socket].map((lamp) => toText(lamp.productId));
        const lampIdsInCart = lampIds.filter((id) => Number(next[id] ?? 0) > 0);

        if (requiredQty <= 0) {
          for (const id of lampIdsInCart) {
            delete next[id];
            changed = true;
          }
          continue;
        }

        if (lampIdsInCart.length > 0) {
          const selectedId = toText(selectedLampBySocket[socket] ?? "");
          const chosenId = lampIdsInCart.includes(selectedId) ? selectedId : lampIdsInCart[0];

          for (const id of lampIdsInCart) {
            if (id !== chosenId) {
              delete next[id];
              changed = true;
            }
          }

          if (Number(next[chosenId] ?? 0) !== requiredQty) {
            next[chosenId] = requiredQty;
            changed = true;
          }
        }
      }

      if (!changed) return prev;
      return next;
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
      qty: Number(entry.qty ?? 0),
      priceRub: Number(entry.product.priceRub ?? 0),
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

  const setCatalogViewAndSync = (view: CatalogView) => {
    setCatalogView(view);
    setStep1CatalogView(view);
  };

  const setProductQty = (product: FeedCatalogProduct, nextQtyRaw: number) => {
    const productId = toText(product.productId);
    const normalizedQty = normalizeQty(Number(nextQtyRaw ?? 0), product.unit);

    setCartItems((prev) => {
      const next = { ...prev };
      if (normalizedQty <= 0) {
        delete next[productId];
        return next;
      }
      next[productId] = normalizedQty;
      return next;
    });
  };

  const addMountOneToOne = (fixtureVendorCode: string) => {
    const mountVendorCode = POINT_TO_MOUNT_VENDOR[toText(fixtureVendorCode)];
    if (!mountVendorCode) return;

    const mountProductId = productIdByVendorCode.get(toText(mountVendorCode));
    if (!mountProductId) return;

    const requiredQty = Number(mountRequiredByVendor[mountVendorCode] ?? 0);
    if (requiredQty <= 0) return;

    setCartItems((prev) => ({ ...prev, [mountProductId]: requiredQty }));
  };

  const addLampOneToOne = (socket: SocketType, lampProductId: string) => {
    const requiredQty = Number(lampRequiredBySocket[socket] ?? 0);
    if (requiredQty <= 0) return;

    setSelectedLampBySocket((prev) => ({ ...prev, [socket]: lampProductId }));

    setCartItems((prev) => {
      const next = { ...prev };
      const lampIds = lampOptionsBySocket[socket].map((lamp) => toText(lamp.productId));

      for (const id of lampIds) {
        if (id !== lampProductId) delete next[id];
      }

      next[lampProductId] = requiredQty;
      return next;
    });
  };

  const setClarusPsu = (psuProductId: string) => {
    setCartItems((prev) => {
      const next = { ...prev };

      for (const vendorCode of CLARUS_PSU_VENDORS) {
        const id = productIdByVendorCode.get(vendorCode);
        if (!id) continue;
        if (id !== psuProductId) delete next[id];
      }

      next[psuProductId] = Math.max(1, Number(next[psuProductId] ?? 0));
      return next;
    });
  };

  const hasClarusInSnapshot = useMemo(() => {
    return products.some((product) => product.system === "CLARUS_48");
  }, [products]);

  const hasClarusInCart = useMemo(() => {
    return cartEntries.some((entry) => entry.product.system === "CLARUS_48");
  }, [cartEntries]);

  const clarusPsuQty = useMemo(() => {
    return cartEntries
      .filter((entry) => CLARUS_PSU_VENDORS.includes(toText(entry.product.vendorCode)))
      .reduce((sum, entry) => sum + Number(entry.qty ?? 0), 0);
  }, [cartEntries]);

  const trackAssembledBySystem = useMemo(() => {
    const result: Record<TrackSystemUi, boolean> = {
      COLIBRI_220: false,
      CLARUS_48: false,
      TRACK_220: false,
    };

    const systems: TrackSystemUi[] = ["COLIBRI_220", "CLARUS_48", "TRACK_220"];
    for (const system of systems) {
      const hasFixture = cartEntries.some(
        (entry) => entry.product.system === system && entry.product.kind === "TRACK_FIXTURE"
      );
      const profileWhitelist = TRACK_PROFILE_WHITELIST[system];
      const hasProfile = cartEntries.some((entry) => {
        if (entry.product.system !== system) return false;
        const vendorCode = toText(entry.product.vendorCode);
        return profileWhitelist.includes(vendorCode);
      });
      result[system] = hasFixture && hasProfile;
    }

    return result;
  }, [cartEntries]);

  const pointCompleted = useMemo(() => {
    const pointFixtures = cartEntries.filter((entry) => isPointFixture(entry.product));
    if (pointFixtures.length === 0) return false;

    const mountQtyByVendor: Record<string, number> = {};
    for (const entry of cartEntries) {
      const vendorCode = toText(entry.product.vendorCode);
      mountQtyByVendor[vendorCode] = Number(mountQtyByVendor[vendorCode] ?? 0) + Number(entry.qty ?? 0);
    }

    const lampQtyBySocket: Record<SocketType, number> = { GX53: 0, MR16: 0 };
    for (const socket of (["GX53", "MR16"] as SocketType[])) {
      const lampIds = lampOptionsBySocket[socket].map((lamp) => toText(lamp.productId));
      lampQtyBySocket[socket] = lampIds.reduce(
        (sum, id) => sum + Number(cartItems[id] ?? 0),
        0
      );
    }

    const requiredLampQtyBySocket = lampRequiredBySocket;

    return pointFixtures.every((entry) => {
      const fixtureVendorCode = toText(entry.product.vendorCode);
      const mountVendorCode = POINT_TO_MOUNT_VENDOR[fixtureVendorCode];
      const mountOk = mountVendorCode
        ? Number(mountQtyByVendor[mountVendorCode] ?? 0) >= Number(entry.qty ?? 0)
        : true;

      const socket = getSocketByFixture(entry.product);
      const lampOk = socket
        ? Number(lampQtyBySocket[socket] ?? 0) >= Number(requiredLampQtyBySocket[socket] ?? 0)
        : true;

      return mountOk && lampOk;
    });
  }, [cartEntries, lampOptionsBySocket, lampRequiredBySocket, cartItems]);

  const missingMounts = useMemo(() => {
    const list: Array<{
      fixtureVendorCode: string;
      mountVendorCode: string;
      requiredQty: number;
      currentQty: number;
      fixtureName: string;
      mountName: string;
    }> = [];

    for (const [fixtureVendorCode, mountVendorCode] of Object.entries(POINT_TO_MOUNT_VENDOR)) {
      const fixtureProductId = productIdByVendorCode.get(fixtureVendorCode);
      const mountProductId = productIdByVendorCode.get(mountVendorCode);
      if (!fixtureProductId || !mountProductId) continue;

      const fixtureProduct = productsById.get(fixtureProductId);
      const mountProduct = productsById.get(mountProductId);
      if (!fixtureProduct || !mountProduct) continue;

      const fixtureQty = Number(cartItems[fixtureProductId] ?? 0);
      if (fixtureQty <= 0) continue;

      const mountQty = Number(cartItems[mountProductId] ?? 0);
      if (mountQty < fixtureQty) {
        list.push({
          fixtureVendorCode,
          mountVendorCode,
          requiredQty: fixtureQty,
          currentQty: mountQty,
          fixtureName: toText(fixtureProduct.name),
          mountName: toText(mountProduct.name),
        });
      }
    }

    return list;
  }, [cartItems, productIdByVendorCode, productsById]);

  const missingLamps = useMemo(() => {
    const list: Array<{ socket: SocketType; requiredQty: number; currentQty: number }> = [];

    for (const socket of (["GX53", "MR16"] as SocketType[])) {
      const requiredQty = Number(lampRequiredBySocket[socket] ?? 0);
      if (requiredQty <= 0) continue;

      const lampIds = lampOptionsBySocket[socket].map((lamp) => toText(lamp.productId));
      const currentQty = lampIds.reduce((sum, id) => sum + Number(cartItems[id] ?? 0), 0);

      if (currentQty < requiredQty) {
        list.push({ socket, requiredQty, currentQty });
      }
    }

    return list;
  }, [cartItems, lampOptionsBySocket, lampRequiredBySocket]);

  const browseProducts = useMemo(() => {
    let scoped: FeedCatalogProduct[] = [];

    if (catalogView === "selected") {
      scoped = selectedViewItems.map((x) => x.product);
    } else if (catalogSection === "track-systems") {
      if (trackGroup === "TRACK_FIXTURE") {
        scoped = products.filter(
          (product) =>
            product.system === trackSystem &&
            product.kind === "TRACK_FIXTURE" &&
            product.available !== false
        );
      } else {
        const whitelist = TRACK_PROFILE_WHITELIST[trackSystem];
        scoped = products.filter((product) => {
          if (product.system !== trackSystem) return false;
          if (product.available === false) return false;
          const vendorCode = toText(product.vendorCode);
          return whitelist.includes(vendorCode);
        });
      }
    } else if (catalogSection === "point-fixtures") {
      scoped = products.filter(
        (product) => matchesPointSubtype(product, pointSubtype) && product.available !== false
      );
    } else {
      scoped = products.filter(
        (product) => isMountOrGrille(product) && product.available !== false
      );
    }

    const query = toText(searchQuery).toLowerCase();
    if (!query) return scoped;

    return scoped.filter((product) => {
      const attrText = pickDisplayAttributes(product)
        .map((attr) => `${attr.label} ${attr.value}`)
        .join(" ");
      const haystack = `${toText(product.name)} ${toText(product.vendorCode)} ${attrText}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [catalogSection, catalogView, pointSubtype, products, searchQuery, selectedViewItems, trackGroup, trackSystem]);

  const recommendationTrack = useMemo(() => {
    return products
      .filter((product) => product.kind === "TRACK_FIXTURE" && product.available !== false)
      .slice(0, 6);
  }, [products]);

  const recommendationPoint = useMemo(() => {
    return products.filter((product) => isPointFixture(product) && product.available !== false).slice(0, 6);
  }, [products]);

  const setNoLighting = () => {
    setCartItems({});
    setLightingDraft({ mode: "none", userCustomizedLighting: false });
  };

  const showClarusMissingMessage =
    catalogSection === "track-systems" &&
    trackSystem === "CLARUS_48" &&
    !hasClarusInSnapshot;

  const derivedInputs = snapshot?.derivedInputs;

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

      {activeTab === "recommendations" ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-600">
              По параметрам: точечных {Number(derivedInputs?.pointSpotsQty ?? 0)}, трек{" "}
              {Number(derivedInputs?.trackLengthMeters ?? 0)} м.п.
            </p>
            <p className="mt-2 text-xs text-slate-500">Статусы сборки систем:</p>
            <ul className="mt-1 space-y-1 text-sm">
              <li>COLIBRI: {trackAssembledBySystem.COLIBRI_220 ? "собрано" : "не собрано"}</li>
              <li>CLARUS: {trackAssembledBySystem.CLARUS_48 ? "собрано" : "не собрано"}</li>
              <li>ART: {trackAssembledBySystem.TRACK_220 ? "собрано" : "не собрано"}</li>
              <li>Точечные: {pointCompleted ? "укомплектовано" : "не укомплектовано"}</li>
            </ul>
          </div>

          {missingMounts.map((item) => (
            <div key={`${item.fixtureVendorCode}-${item.mountVendorCode}`} className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-900">
                Для {item.fixtureName} нужна закладная {item.mountName} 1:1
              </p>
              <p className="mt-1 text-xs text-amber-700">
                Нужно: {item.requiredQty} шт., в корзине: {item.currentQty} шт.
              </p>
              <button
                type="button"
                onClick={() => addMountOneToOne(item.fixtureVendorCode)}
                className="mt-3 rounded-xl bg-amber-700 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-800"
              >
                Добавить / синхронизировать 1:1
              </button>
            </div>
          ))}

          {missingLamps.map((missing) => (
            <div key={missing.socket} className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm font-medium text-blue-900">
                Для корпусов {missing.socket} не хватает ламп
              </p>
              <p className="mt-1 text-xs text-blue-700">
                Нужно: {missing.requiredQty} шт., в корзине: {missing.currentQty} шт.
              </p>

              <div className="mt-3 space-y-2">
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
                {CLARUS_PSU_VENDORS.map((vendorCode) => {
                  const productId = productIdByVendorCode.get(vendorCode);
                  if (!productId) return null;
                  const product = productsById.get(productId);
                  if (!product) return null;

                  return (
                    <button
                      key={vendorCode}
                      type="button"
                      onClick={() => setClarusPsu(productId)}
                      className="rounded-xl bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-800"
                    >
                      {toText(product.name)}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-950">Точечные (подбор)</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {recommendationPoint.map((product) => {
                const productId = toText(product.productId);
                const qty = Number(cartItems[productId] ?? 0);
                return (
                  <ProductCard
                    key={productId}
                    product={product}
                    qty={qty}
                    onInc={() => setProductQty(product, qty + stepByUnit(product.unit))}
                    onDec={() => setProductQty(product, qty - stepByUnit(product.unit))}
                  />
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-950">Трековые (подбор)</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {recommendationTrack.map((product) => {
                const productId = toText(product.productId);
                const qty = Number(cartItems[productId] ?? 0);
                return (
                  <ProductCard
                    key={productId}
                    product={product}
                    qty={qty}
                    onInc={() => setProductQty(product, qty + stepByUnit(product.unit))}
                    onDec={() => setProductQty(product, qty - stepByUnit(product.unit))}
                  />
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={setNoLighting}
            className="rounded-2xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
          >
            Без освещения
          </button>
        </div>
      ) : null}

      {activeTab === "catalog" ? (
        <div className="space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCatalogViewAndSync("browse")}
              className={`rounded-xl px-3 py-2 text-sm font-medium ${
                catalogView === "browse"
                  ? "bg-slate-950 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Каталог
            </button>
            <button
              type="button"
              onClick={() => setCatalogViewAndSync("selected")}
              className={`rounded-xl px-3 py-2 text-sm font-medium ${
                catalogView === "selected"
                  ? "bg-slate-950 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
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

                return (
                  <div key={toText(item.sku)} className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="grid grid-cols-[96px_1fr] gap-3">
                      <ProductImage
                        src={product?.coverImage}
                        alt={toText(item.name)}
                        containerClassName="h-24 w-24 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-2"
                        className="h-full w-full object-contain"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-950">{toText(item.name)}</p>
                        <p className="mt-1 text-xs text-slate-600">
                          {pickDisplayAttributes(product)
                            .map((attr) => `${attr.label}: ${attr.value}`)
                            .join(" • ")}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Qty: {item.qty} • {fmt(regular)} ₽ / шт • со скидкой {fmt(discounted)} ₽ / шт
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}

              {selectedViewItems.length > 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                  <p>Итого без скидки: {fmt(selectedTotals.regular)} ₽</p>
                  <p className="font-semibold text-emerald-700">
                    Итого со скидкой: {fmt(selectedTotals.discounted)} ₽
                  </p>
                  <p className="text-emerald-600">Ваша выгода: {fmt(selectedTotals.benefit)} ₽</p>
                </div>
              ) : null}
            </div>
          ) : (
            <>
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCatalogSection("track-systems");
                      setSearchQuery("");
                    }}
                    className={`rounded-xl px-3 py-1.5 text-sm ${
                      catalogSection === "track-systems"
                        ? "bg-slate-950 text-white"
                        : "bg-white text-slate-700"
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
                    className={`rounded-xl px-3 py-1.5 text-sm ${
                      catalogSection === "point-fixtures"
                        ? "bg-slate-950 text-white"
                        : "bg-white text-slate-700"
                    }`}
                  >
                    Точечные
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCatalogSection("mounts-grilles");
                      setSearchQuery("");
                    }}
                    className={`rounded-xl px-3 py-1.5 text-sm ${
                      catalogSection === "mounts-grilles"
                        ? "bg-slate-950 text-white"
                        : "bg-white text-slate-700"
                    }`}
                  >
                    Решетки и закладные
                  </button>
                </div>

                {catalogSection === "track-systems" ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {(Object.keys(TRACK_SYSTEM_LABELS) as TrackSystemUi[]).map((system) => (
                        <button
                          key={system}
                          type="button"
                          onClick={() => {
                            setTrackSystem(system);
                            setSearchQuery("");
                          }}
                          className={`rounded-xl px-3 py-1.5 text-xs ${
                            trackSystem === system
                              ? "bg-slate-900 text-white"
                              : "bg-white text-slate-700"
                          }`}
                        >
                          {TRACK_SYSTEM_LABELS[system]}
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setTrackGroup("TRACK_FIXTURE");
                          setSearchQuery("");
                        }}
                        className={`rounded-xl px-3 py-1.5 text-xs ${
                          trackGroup === "TRACK_FIXTURE"
                            ? "bg-slate-900 text-white"
                            : "bg-white text-slate-700"
                        }`}
                      >
                        Светильники
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTrackGroup("TRACK_PROFILE");
                          setSearchQuery("");
                        }}
                        className={`rounded-xl px-3 py-1.5 text-xs ${
                          trackGroup === "TRACK_PROFILE"
                            ? "bg-slate-900 text-white"
                            : "bg-white text-slate-700"
                        }`}
                      >
                        Профили/шинопроводы
                      </button>
                    </div>
                  </>
                ) : null}

                {catalogSection === "point-fixtures" ? (
                  <div className="flex flex-wrap gap-2">
                    {(["GX53", "MR16", "PANELS"] as PointSubtype[]).map((subtype) => (
                      <button
                        key={subtype}
                        type="button"
                        onClick={() => {
                          setPointSubtype(subtype);
                          setSearchQuery("");
                        }}
                        className={`rounded-xl px-3 py-1.5 text-xs ${
                          pointSubtype === subtype
                            ? "bg-slate-900 text-white"
                            : "bg-white text-slate-700"
                        }`}
                      >
                        {subtype}
                      </button>
                    ))}
                  </div>
                ) : null}

                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(toText(event.target.value))}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                  aria-label="Поиск по текущему разделу"
                  placeholder="Поиск внутри текущего раздела"
                />
              </div>

              {showClarusMissingMessage ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  Нет данных CLARUS в snapshot
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                {browseProducts.map((product) => {
                  const productId = toText(product.productId);
                  const qty = Number(cartItems[productId] ?? 0);

                  return (
                    <ProductCard
                      key={productId}
                      product={product}
                      qty={qty}
                      onInc={() => setProductQty(product, qty + stepByUnit(product.unit))}
                      onDec={() => setProductQty(product, qty - stepByUnit(product.unit))}
                    />
                  );
                })}
              </div>

              {!showClarusMissingMessage && browseProducts.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-500">Ничего не найдено</p>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
