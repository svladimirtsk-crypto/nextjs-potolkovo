"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import snapshotData from "@/data/eks-feed2-snapshot.json";
import type { FeedCatalogParam, FeedCatalogProduct } from "@/lib/eks-feed2-catalog";
import type { LightingItem, LightingSnapshot } from "@/lib/calculator-modal-types";
import { trackLightingCartChanged } from "@/lib/analytics";
import {
  LIGHTING_ONLY_DISCOUNT_PERCENT,
  LIGHTING_WITH_CEILING_DISCOUNT_PERCENT,
  applyLightingOnlyDiscount,
  applyLightingWithCeilingDiscount,
} from "@/lib/lighting-formulas";
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

import {
  ART_TRACK_PROFILE_VENDOR_WHITELIST,
  applyVendorOverrides,
} from "@/lib/vendor-code-overrides";
import {
  calcTrackProfileMeters,
  inferPieceLengthMeters,
} from "@/lib/product-length-meters";

import { ProductImage } from "@/components/feed2/ProductImage";
import { useCalculatorModal } from "./calculator-modal-context";
import { usePriceCalculatorBridge } from "@/components/home/price-calculator-context";

/* ─── helpers ─── */

type Tab = "recommendations" | "catalog";
type CatalogView = "selected" | "browse";
type CartItems = Record<string, number>;

function toText(v: unknown): string { return String(v ?? "").trim(); }
function toNumber(v: unknown): number { const n = Number(v ?? 0); return Number.isFinite(n) ? n : 0; }
function fmt(v: number): string { return new Intl.NumberFormat("ru-RU").format(Math.round(v)); }
function fmtM(v: number): string { return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(v); }
function toNumOrNull(v: unknown): number | null { const n = Number(v ?? NaN); return Number.isFinite(n) ? n : null; }

function normalizeQty(raw: number, unit: "pcs" | "m"): number {
  const step = unit === "m" ? 0.5 : 1;
  return Math.max(0, Math.round(raw / step) * step);
}

function toParams(input: unknown): FeedCatalogParam[] {
  if (!Array.isArray(input)) return [];
  return (input as any[]).map((x) => ({ label: toText(x?.label), value: toText(x?.value) }))
    .filter((i) => i.label.length > 0 && i.value.length > 0);
}

function normalizeProduct(raw: unknown): FeedCatalogProduct | null {
  const p = raw as Record<string, unknown>;
  const vendorCode = toText((p as any).vendorCode);
  const offerId = toText((p as any).offerId);
  const name = toText((p as any).name);
  if (!name || (!vendorCode && !offerId)) return null;
  const productIdRaw = toText((p as any).productId);
  const productId = productIdRaw || `feed2-${vendorCode || offerId || name}`;
  const images = Array.isArray((p as any).images)
    ? ((p as any).images as unknown[]).map(toText).filter(Boolean) : [];
  return {
    productId: toText(productId), vendorCode, offerId, name,
    url: toText((p as any).url), categoryId: toText((p as any).categoryId),
    categoryPath: toText((p as any).categoryPath), images,
    coverImage: toText((p as any).coverImage) || images[0] || "",
    priceRub: toNumber((p as any).priceRub),
    available: Boolean((p as any).available ?? true),
    params: toParams((p as any).params), keyAttributes: toParams((p as any).keyAttributes),
    system: (toText((p as any).system) || "UNKNOWN") as FeedCatalogProduct["system"],
    kind: (toText((p as any).kind) || "OTHER") as FeedCatalogProduct["kind"],
    unit: (toText((p as any).unit) === "m" ? "m" : "pcs") as FeedCatalogProduct["unit"],
    lengthMeters: toNumOrNull((p as any).lengthMeters),
    pieceLengthMeters: toNumOrNull((p as any).pieceLengthMeters),
  };
}

function isPanelProduct(p: FeedCatalogProduct): boolean {
  const t = `${toText(p.name)} ${toText(p.categoryPath)}`.toLowerCase();
  return t.includes("панел") || t.includes("panel") || t.includes("600x600") || t.includes("595x595");
}

function isLamp(p: FeedCatalogProduct): boolean {
  return p.kind === "LAMP" && toNumber(p.priceRub) > 0 && p.available !== false;
}

function isMountsOrGrilles(p: FeedCatalogProduct): boolean {
  const t = `${toText(p.name)} ${toText(p.vendorCode)} ${toText(p.categoryPath)}`.toLowerCase();
  if (p.kind === "CEILING_COMPONENT") return true;
  return t.includes("заклад") || t.includes("решетк") || t.includes("решётк");
}

function matchesPointSubtype(p: FeedCatalogProduct, sub: PointSubtypeId): boolean {
  if (sub === "PANELS") return isPanelProduct(p);
  if (p.kind !== "SPOT_FIXTURE") return false;
  const vc = toText(p.vendorCode);
  if (sub === "GX53" && (vc === "0У-00007177" || vc === "0У-00007176")) return true;
  if (sub === "MR16" && (vc === "0У-00001551" || vc === "0У-00001552")) return true;
  const d = detectSocket(p);
  return d === sub;
}

function isTrackSystemId(value: unknown): value is TrackSystemId {
  return value === "COLIBRI_220" || value === "CLARUS_48" || value === "TRACK_220";
}

function pickAttrs(p: FeedCatalogProduct): { label: string; value: string }[] {
  const a = p.keyAttributes?.length ? p.keyAttributes : p.params;
  return (a ?? []).slice(0, 4).map((x) => ({ label: toText(x.label), value: toText(x.value) }));
}

function getScrollParent(node: HTMLElement | null): HTMLElement | null {
  if (!node || typeof window === "undefined") return null;

  let parent = node.parentElement;
  while (parent) {
    const style = window.getComputedStyle(parent);
    const overflowY = style.overflowY;
    const canScroll =
      (overflowY === "auto" || overflowY === "scroll") &&
      parent.scrollHeight > parent.clientHeight;

    if (canScroll) return parent;
    parent = parent.parentElement;
  }

  return (document.scrollingElement as HTMLElement | null) ?? null;
}

/* ─── small UI components ─── */

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={["rounded-xl px-3 py-2 text-sm font-medium transition-colors",
        active ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"].join(" ")}>
      {children}
    </button>
  );
}

/* Product card with zoomable image */
function ProductCard({
  product, qty, onInc, onDec, onImageClick, discountPercent,
}: {
  product: FeedCatalogProduct; qty: number; onInc: () => void; onDec: () => void;
  onImageClick?: () => void;
  discountPercent: number;
}) {
  const regular = toNumber(product.priceRub);
  const discounted = getDiscountedPrice(regular, discountPercent);
  const benefit = computeBenefit(regular, discounted);
  const [showDetails, setShowDetails] = useState(false);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      {/* Image — clickable for zoom */}
      <div
        className="relative cursor-zoom-in bg-slate-100"
        onClick={onImageClick}
      >
        <ProductImage src={toText(product.coverImage)} alt={toText(product.name)} />
        {qty > 0 && (
          <span className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white">
            {product.unit === "m" ? qty.toFixed(1) : qty}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-4">
        <p className="break-words text-sm font-semibold text-slate-950 leading-snug">
          {toText(product.name)}
        </p>

        <div className="mt-2 text-xs">
          <span className="line-through text-slate-400">{fmt(regular)} ₽</span>{" "}
          <span className="font-semibold text-emerald-700">{fmt(discounted)} ₽</span>
          {benefit > 0 ? <span className="text-slate-500"> · −{discountPercent}% (−{fmt(benefit)} ₽)</span> : null}
          <span className="text-slate-400"> · с потолком</span>
        </div>

        {pickAttrs(product).length > 0 || toText(product.vendorCode) ? (
          <button type="button" onClick={() => setShowDetails(!showDetails)}
            className="mt-1 text-xs font-medium text-slate-500 hover:text-slate-800 underline decoration-slate-300 underline-offset-2">
            {showDetails ? "Скрыть" : "Подробнее"}
          </button>
        ) : null}

        {showDetails && (
          <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 space-y-0.5">
            {toText(product.vendorCode) && <p className="text-slate-500">Артикул: {toText(product.vendorCode)}</p>}
            {pickAttrs(product).map((a) => <p key={a.label}>{a.label}: {a.value}</p>)}
          </div>
        )}

        {/* Qty controls */}
        <div className="mt-3 flex items-center gap-2">
          <button type="button" onClick={onDec}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 active:scale-95"
            style={{ minHeight: 44, minWidth: 44 }}>−</button>
          <span className="min-w-[2.5rem] text-center text-sm font-semibold text-slate-950">
            {product.unit === "m" ? Number(qty.toFixed(1)) : qty}
          </span>
          <button type="button" onClick={onInc}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 active:scale-95"
            style={{ minHeight: 44, minWidth: 44 }}>+</button>
          <span className="ml-auto text-xs text-slate-500">{product.unit === "m" ? "м" : "шт."}</span>
        </div>
      </div>
    </div>
  );
}

/* Thin progress bar — compact, never blocks */
function ThinProgress({ current, required, unit }: { current: number; required: number; unit: string }) {
  if (required <= 0) return null;
  const pct = Math.min(100, Math.round((current / required) * 100));
  const done = current >= required;
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <div className="h-1 flex-1 rounded-full bg-slate-200">
        <div
          className={["h-1 rounded-full transition-all", done ? "bg-emerald-600" : "bg-slate-950"].join(" ")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={done ? "whitespace-nowrap font-semibold text-emerald-700" : "whitespace-nowrap text-slate-600"}>
        {unit === "м" ? fmtM(current) : fmt(current)}/{unit === "м" ? fmtM(required) : fmt(required)} {unit}
      </span>
    </div>
  );
}

function ImageQuickPreview({
  image,
  onClose,
}: {
  image: { src: string; alt: string } | null;
  onClose: () => void;
}) {
  if (!image) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Закрыть фото"
        className="fixed inset-0 z-[159] cursor-default bg-transparent"
        onClick={onClose}
      />
      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] left-3 right-3 z-[160] sm:bottom-auto sm:left-auto sm:right-8 sm:top-24 sm:w-[380px]">
        <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-2xl">
          <div className="mb-2 flex items-start justify-between gap-3">
            <p className="line-clamp-2 text-sm font-semibold leading-5 text-slate-950">{image.alt}</p>
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть фото"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
            >
              ✕
            </button>
          </div>
          <ProductImage
            src={image.src}
            alt={image.alt}
            containerClassName="h-[min(52dvh,420px)] w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3"
            className="h-full w-full object-contain"
          />
          <p className="mt-2 text-center text-[11px] text-slate-500">Кликните вне фото или на крестик, чтобы закрыть.</p>
        </div>
      </div>
    </>
  );
}

/* ─── MAIN COMPONENT ─── */

export function WizardStep1Lighting() {
  const { snapshot } = usePriceCalculatorBridge();
  const {
    lightingDraft, setLightingDraft, options,
    step1CatalogView, setStep1CatalogView,
    setStep1FooterAction,
    goToStep, showCeilingInUi, currentStep,
    lightingDiscountMode, lightingEffectiveTotal, lightingRegularTotal,
  } = useCalculatorModal();

  const [activeTab, setActiveTab] = useState<Tab>("recommendations");
  const [catalogView, setCatalogView] = useState<CatalogView>("browse");

  /* ─── Apply initial UI options once ─── */
  const appliedInitialUiRef = useRef<string | null>(null);
  useEffect(() => {
    const key = JSON.stringify({
      em: options?.entryMode, is: (options as any)?.initialStep,
      lt: options?.initialLightingTab, lv: options?.initialLightingView, s: options?.source,
    });
    if (appliedInitialUiRef.current === key) return;
    appliedInitialUiRef.current = key;
    const shouldCat = options?.entryMode === "lighting-first";
    const t: Tab = options?.initialLightingTab === "catalog" ? "catalog"
      : options?.initialLightingTab === "recommendations" ? "recommendations"
      : shouldCat ? "catalog" : "recommendations";
    const v: CatalogView = options?.initialLightingView === "selected" ? "selected" : "browse";
    setActiveTab(t);
    setCatalogView(v);
    if (t === "catalog") setStep1CatalogView(v);
    else setStep1CatalogView(null);
  }, [options, setStep1CatalogView]);

  /* ─── Catalog filters ─── */
  const [section, setSection] = useState<CatalogSectionId>("track-systems");
  const [trackSystem, setTrackSystem] = useState<TrackSystemId>("COLIBRI_220");
  const [trackGroup, setTrackGroup] = useState<TrackGroupId>("TRACK_FIXTURE");
  const [pointSubtype, setPointSubtype] = useState<PointSubtypeId>("GX53");
  const [lampSocket, setLampSocket] = useState<LampSocket>("GX53");
  const [query, setQuery] = useState("");

  /* ─── Cart state ─── */
  const [cartItems, setCartItems] = useState<CartItems>({});
  const [removedHint, setRemovedHint] = useState(false);

  /* ─── Products index ─── */
  const products = useMemo(() => {
    const raw = (snapshotData as { products?: unknown[] })?.products ?? [];
    return raw
      .map(normalizeProduct)
      .filter((item): item is FeedCatalogProduct => Boolean(item))
      .map((p) => applyVendorOverrides(p))
      .filter((p) => !REMOVED_COLIBRI_VENDOR_CODES.has(toText(p.vendorCode)));
  }, []);

  const productsById = useMemo(() => buildProductsIndex(products), [products]);

  const productIdByVendorCode = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of products) { const vc = toText(p.vendorCode); const id = toText(p.productId); if (vc && id) m.set(vc, id); }
    return m;
  }, [products]);

  /* ─── KEY FIX: Rehydrate + sync in single effect ─── */
  const syncReadyRef = useRef(false);
  const skipNextEmptySyncRef = useRef(false);

  // On first mount: try to restore cart from lightingDraft BEFORE any draft→clear can fire
  useEffect(() => {
    if (syncReadyRef.current) return;

    // Try rehydration from existing draft
    const draft = lightingDraft;
    if (draft && draft.mode === "catalog" && draft.items?.length) {
      const next: CartItems = {};
      let removedAny = false;
      for (const item of draft.items) {
        const sku = toText(item.sku);
        const byP = productsById.get(sku);
        const byV = productIdByVendorCode.get(sku);
        const id = byP ? sku : toText(byV ?? "");
        if (!id) { removedAny = true; continue; }
        const p = productsById.get(id);
        if (!p || REMOVED_COLIBRI_VENDOR_CODES.has(toText(p.vendorCode))) { removedAny = true; continue; }
        next[id] = toNumber(item.qty);
      }
      if (Object.keys(next).length > 0) {
        skipNextEmptySyncRef.current = true;
        setCartItems(next);
        if (removedAny) setRemovedHint(true);
      }
    }

    syncReadyRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productsById, productIdByVendorCode]);

  // Also handle options.initialLighting (lighting-first entry)
  const prevInitialRef = useRef<LightingSnapshot | null | undefined>(undefined);
  useEffect(() => {
    const inc = options?.initialLighting;
    if (inc === undefined || inc === prevInitialRef.current) return;
    prevInitialRef.current = inc;
    if (!inc || inc.mode !== "catalog" || !inc.items?.length) return;
    const next: CartItems = {};
    let removedAny = false;
    for (const item of inc.items) {
      const sku = toText(item.sku);
      const byP = productsById.get(sku);
      const byV = productIdByVendorCode.get(sku);
      const id = byP ? sku : toText(byV ?? "");
      if (!id) { removedAny = true; continue; }
      const p = productsById.get(id);
      if (!p || REMOVED_COLIBRI_VENDOR_CODES.has(toText(p.vendorCode))) { removedAny = true; continue; }
      next[id] = toNumber(item.qty);
    }
    if (Object.keys(next).length > 0) skipNextEmptySyncRef.current = true;
    setCartItems(next);
    setRemovedHint(removedAny);
    setActiveTab("catalog");
    setCatalogView(options?.initialLightingView === "selected" ? "selected" : "browse");
  }, [options?.initialLighting, options?.initialLightingView, productsById, productIdByVendorCode]);

  useEffect(() => {
    if (!step1CatalogView) return;
    setActiveTab("catalog");
    setCatalogView(step1CatalogView);
  }, [step1CatalogView]);

  const prevCurrentStepRef = useRef(currentStep);
  useEffect(() => {
    const prev = prevCurrentStepRef.current;
    prevCurrentStepRef.current = currentStep;

    if (prev === 0 && currentStep === 1) {
      setActiveTab("recommendations");
      setCatalogView("browse");
      setStep1CatalogView(null);
    }
  }, [currentStep, setStep1CatalogView]);

  /* ─── Derived cart data ─── */
  const cartEntries = useMemo(() =>
    Object.entries(cartItems)
      .filter(([, q]) => q > 0)
      .map(([id, qty]) => ({ productId: id, product: productsById.get(id), qty }))
      .filter((e): e is { productId: string; product: FeedCatalogProduct; qty: number } => Boolean(e.product))
      .filter((e) => !REMOVED_COLIBRI_VENDOR_CODES.has(toText(e.product.vendorCode))),
    [cartItems, productsById]);

  const selectedTrackMeters = useMemo(() => {
    let m = 0; for (const e of cartEntries) { if (e.product.kind === "TRACK_PROFILE") m += calcTrackProfileMeters(e.product, e.qty); } return m;
  }, [cartEntries]);

  const selectedPointQty = useMemo(() => {
    let q = 0; for (const e of cartEntries) { if (e.product.kind === "SPOT_FIXTURE" || isPanelProduct(e.product)) q += e.qty; } return q;
  }, [cartEntries]);

  const requiredTrackMeters = showCeilingInUi ? toNumber(snapshot?.derivedInputs?.trackLengthMeters) : 0;
  const requiredPointQty = showCeilingInUi ? toNumber(snapshot?.derivedInputs?.pointSpotsQty) : 0;
  const trackMountType = (snapshot?.derivedInputs?.trackMountType ?? "none") as "built-in" | "surface" | "none";

  type WStep = "system" | "trackProfile" | "trackFixtures" | "points" | "lamps" | "done";
  const [wStep, setWStep] = useState<WStep>(() =>
    requiredTrackMeters > 0 ? "system" : requiredPointQty > 0 ? "points" : "system"
  );
  const [wSystem, setWSystem] = useState<TrackSystemId | null>(null);
  const [wPointTab, setWPointTab] = useState<PointSubtypeId>("GX53");

  /* ─── Recommendations ─── */
  const recommendedTrackProfiles = useMemo(() => {
    if (!showCeilingInUi || requiredTrackMeters <= 0) return [];
    const targetSystems: TrackSystemId[] = trackMountType === "built-in" ? ["COLIBRI_220", "CLARUS_48"]
      : trackMountType === "surface" ? ["TRACK_220"] : [];
    return targetSystems.map((system) => {
      const base = TRACK_PROFILE_WHITELIST[system] ?? [];
      const allowed = system === "TRACK_220" ? new Set([...base, ...ART_TRACK_PROFILE_VENDOR_WHITELIST]) : new Set(base);
      const profiles = products.filter((p) => p.kind === "TRACK_PROFILE" && p.system === system && p.priceRub > 0 && allowed.has(toText(p.vendorCode)));
      if (!profiles.length) return null;
      profiles.sort((a, b) => a.priceRub - b.priceRub);
      const best = profiles[0];
      const pieceM = inferPieceLengthMeters(best);
      if (!pieceM || pieceM <= 0) return null;
      const qty = Math.ceil(requiredTrackMeters / pieceM);
      return { product: best, system, qty, totalMeters: qty * pieceM };
    }).filter(Boolean) as Array<{ product: FeedCatalogProduct; system: TrackSystemId; qty: number; totalMeters: number }>;
  }, [showCeilingInUi, requiredTrackMeters, trackMountType, products]);

  const hasRecommendations = recommendedTrackProfiles.length > 0 || requiredPointQty > 0;

  /* ─── Lamps / mounts deps ─── */
  const lampOptionsBySocket = useMemo(() => {
    const lamps = products.filter(isLamp);
    const s = (a: FeedCatalogProduct, b: FeedCatalogProduct) => toNumber(a.priceRub) - toNumber(b.priceRub);
    return { GX53: lamps.filter((l) => detectSocket(l) === "GX53").sort(s), MR16: lamps.filter((l) => detectSocket(l) === "MR16").sort(s) };
  }, [products]);

  const lampRequiredBySocket = useMemo(() => {
    const r: Record<LampSocket, number> = { GX53: 0, MR16: 0 };
    for (const e of cartEntries) { if (e.product.kind === "LAMP") continue; const s = getRequiredLampSocket(e.product); if (s) r[s] += e.qty; }
    return r;
  }, [cartEntries]);

  const lampCurrentBySocket = useMemo(() => {
    const c: Record<LampSocket, number> = { GX53: 0, MR16: 0 };
    for (const s of ["GX53", "MR16"] as LampSocket[]) {
      const ids = lampOptionsBySocket[s].map((l) => toText(l.productId));
      c[s] = ids.reduce((sum, id) => sum + toNumber(cartItems[id]), 0);
    }
    return c;
  }, [cartItems, lampOptionsBySocket]);

  const mountRequiredByVendor = useMemo(() => {
    const r: Record<string, number> = {};
    for (const e of cartEntries) { const mv = POINT_TO_MOUNT_VENDOR_CODE[toText(e.product.vendorCode)]; if (mv) r[mv] = (r[mv] ?? 0) + e.qty; }
    return r;
  }, [cartEntries]);

  const missingLamps = useMemo(() => {
    const out: Array<{ socket: LampSocket; requiredQty: number; currentQty: number }> = [];
    for (const s of ["GX53", "MR16"] as LampSocket[]) { const r = toNumber(lampRequiredBySocket[s]); if (r <= 0) continue; const c = toNumber(lampCurrentBySocket[s]); if (c < r) out.push({ socket: s, requiredQty: r, currentQty: c }); }
    return out;
  }, [lampCurrentBySocket, lampRequiredBySocket]);

  const lampRequiredTotal = useMemo(() => {
    return (["GX53", "MR16"] as LampSocket[]).reduce((sum, s) => sum + toNumber(lampRequiredBySocket[s]), 0);
  }, [lampRequiredBySocket]);

  const lampCurrentTotal = useMemo(() => {
    return (["GX53", "MR16"] as LampSocket[]).reduce((sum, s) => {
      if (toNumber(lampRequiredBySocket[s]) <= 0) return sum;
      return sum + toNumber(lampCurrentBySocket[s]);
    }, 0);
  }, [lampCurrentBySocket, lampRequiredBySocket]);

  const lampSocketsToShow = useMemo(() => {
    return (["GX53", "MR16"] as LampSocket[]).filter((s) => {
      return toNumber(lampRequiredBySocket[s]) > 0 || toNumber(lampCurrentBySocket[s]) > 0;
    });
  }, [lampCurrentBySocket, lampRequiredBySocket]);

  const missingMounts = useMemo(() => {
    const out: Array<{ fixtureVendorCode: string; mountVendorCode: string; fixtureName: string; mountName: string; requiredQty: number; currentQty: number }> = [];
    for (const [fv, mv] of Object.entries(POINT_TO_MOUNT_VENDOR_CODE)) {
      const fid = productIdByVendorCode.get(fv); const mid = productIdByVendorCode.get(mv);
      if (!fid || !mid) continue; const fp = productsById.get(fid); const mp = productsById.get(mid);
      if (!fp || !mp) continue; const fq = toNumber(cartItems[fid]); if (fq <= 0) continue;
      const mq = toNumber(cartItems[mid]); if (mq < fq) out.push({ fixtureVendorCode: fv, mountVendorCode: mv, fixtureName: toText(fp.name), mountName: toText(mp.name), requiredQty: fq, currentQty: mq });
    }
    return out;
  }, [cartItems, productIdByVendorCode, productsById]);

  const hasClarusInCart = useMemo(() => cartEntries.some((e) => e.product.system === "CLARUS_48"), [cartEntries]);
  const clarusPsuQty = useMemo(() => cartEntries.filter((e) => CLARUS_PSU_VENDOR_CODES.includes(toText(e.product.vendorCode) as any)).reduce((s, e) => s + e.qty, 0), [cartEntries]);

  /* ─── Auto-sync mounts ─── */
  useEffect(() => {
    setCartItems((prev) => {
      const next = { ...prev }; let ch = false;
      for (const [mv, rq] of Object.entries(mountRequiredByVendor)) {
        const mid = productIdByVendorCode.get(toText(mv)); if (!mid) continue;
        const cq = toNumber(next[mid]);
        if (rq > 0 && cq > 0 && cq !== rq) { next[mid] = rq; ch = true; }
        if (rq <= 0 && cq > 0) { delete next[mid]; ch = true; }
      }
      return ch ? next : prev;
    });
  }, [mountRequiredByVendor, productIdByVendorCode]);

  /* ─── Cart → lightingDraft sync (ONLY after rehydration is ready) ─── */
  useEffect(() => {
    if (!syncReadyRef.current) return; // Don't clear draft before rehydration!
    if (cartEntries.length === 0) {
      if (skipNextEmptySyncRef.current) {
        skipNextEmptySyncRef.current = false;
        return;
      }
      setLightingDraft({ mode: "none", userCustomizedLighting: false });
      return;
    }
    skipNextEmptySyncRef.current = false;
    const items: LightingItem[] = cartEntries.map((e) => ({ sku: toText(e.productId), name: toText(e.product.name), qty: e.qty, priceRub: toNumber(e.product.priceRub) }));
    const totalRub = items.reduce((s, i) => s + i.qty * i.priceRub, 0);
    setLightingDraft({
      mode: "catalog",
      items,
      totalRub,
      discountedTotalRub: applyLightingOnlyDiscount(totalRub),
      standaloneDiscountedTotalRub: applyLightingOnlyDiscount(totalRub),
      withCeilingDiscountedTotalRub: applyLightingWithCeilingDiscount(totalRub),
      userCustomizedLighting: true,
      derivedInputsSnapshot: snapshot?.derivedInputs,
    });
  }, [cartEntries, setLightingDraft, snapshot?.derivedInputs]);

  /* ─── setProductQty ─── */
  const setProductQty = useCallback((product: FeedCatalogProduct, nextQtyRaw: number) => {
    const id = toText(product.productId);
    const nextQty = normalizeQty(nextQtyRaw, product.unit);
    const prevQty = toNumber(cartItems[id]);
    if (prevQty !== nextQty) {
      trackLightingCartChanged({
        action: prevQty <= 0 && nextQty > 0 ? "add" : prevQty > 0 && nextQty <= 0 ? "remove" : "change",
        sku: id, productKind: String(product.kind), qty: nextQty, source: String(options?.source ?? "unknown"),
      });
    }
    setCartItems((prev) => { const n = { ...prev }; if (nextQty <= 0) delete n[id]; else n[id] = nextQty; return n; });
  }, [cartItems, options?.source]);

  const clearTrackProductsForSystem = useCallback((system: TrackSystemId | null) => {
    const clarusPsuVendorCodes = new Set<string>(CLARUS_PSU_VENDOR_CODES);

    setCartItems((prev) => {
      const next = { ...prev };
      let changed = false;

      for (const id of Object.keys(prev)) {
        const product = productsById.get(id);
        if (!product) continue;

        const kind = product.kind;
        const isTrackProduct =
          kind === "TRACK_PROFILE" || kind === "TRACK_FIXTURE" || kind === "TRACK_ACCESSORY";
        const isClarusPsu = clarusPsuVendorCodes.has(toText(product.vendorCode));

        const shouldRemove =
          system === null
            ? isTrackProduct || isClarusPsu
            : (isTrackProduct && product.system !== system) || (isClarusPsu && system !== "CLARUS_48");

        if (shouldRemove) {
          delete next[id];
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [productsById]);

  const setTrackProfileQty = useCallback((product: FeedCatalogProduct, nextQtyRaw: number) => {
    const system = isTrackSystemId(product.system) ? product.system : null;
    if (!system) return;

    const id = toText(product.productId);
    const nextQty = normalizeQty(nextQtyRaw, product.unit);
    const prevQty = toNumber(cartItems[id]);

    setWSystem(system);

    if (prevQty !== nextQty) {
      trackLightingCartChanged({
        action: prevQty <= 0 && nextQty > 0 ? "add" : prevQty > 0 && nextQty <= 0 ? "remove" : "change",
        sku: id,
        productKind: String(product.kind),
        qty: nextQty,
        source: String(options?.source ?? "unknown"),
      });
    }

    const clarusPsuVendorCodes = new Set<string>(CLARUS_PSU_VENDOR_CODES);

    setCartItems((prev) => {
      const next = { ...prev };

      for (const key of Object.keys(prev)) {
        const p = productsById.get(key);
        if (!p) continue;

        const isTrackProduct =
          p.kind === "TRACK_PROFILE" || p.kind === "TRACK_FIXTURE" || p.kind === "TRACK_ACCESSORY";
        const isClarusPsu = clarusPsuVendorCodes.has(toText(p.vendorCode));

        if ((isTrackProduct && p.system !== system) || (isClarusPsu && system !== "CLARUS_48")) {
          delete next[key];
        }
      }

      if (nextQty <= 0) delete next[id];
      else next[id] = nextQty;

      return next;
    });
  }, [cartItems, options?.source, productsById]);

  const addMountOneToOne = useCallback((fv: string) => {
    const mv = POINT_TO_MOUNT_VENDOR_CODE[toText(fv)]; if (!mv) return;
    const mid = productIdByVendorCode.get(mv); if (!mid) return;
    const rq = toNumber(mountRequiredByVendor[mv]); if (rq <= 0) return;
    setCartItems((prev) => ({ ...prev, [mid]: rq }));
  }, [mountRequiredByVendor, productIdByVendorCode]);

  const addCheapestLamps = useCallback((socket: LampSocket) => {
    const rq = toNumber(lampRequiredBySocket[socket]); if (rq <= 0) return;
    const c = toNumber(lampCurrentBySocket[socket]); const miss = Math.max(0, rq - c); if (miss <= 0) return;
    const cheapest = lampOptionsBySocket[socket][0]; if (!cheapest) return;
    const id = toText(cheapest.productId); if (!id) return;
    setCartItems((prev) => ({ ...prev, [id]: toNumber(prev[id]) + miss }));
  }, [lampRequiredBySocket, lampCurrentBySocket, lampOptionsBySocket]);

  const setClarusPsu = useCallback((pid: string) => {
    setCartItems((prev) => {
      const n = { ...prev };
      for (const v of CLARUS_PSU_VENDOR_CODES) { const id = productIdByVendorCode.get(v); if (id && id !== pid) delete n[id]; }
      n[pid] = Math.max(1, toNumber(n[pid])); return n;
    });
  }, [productIdByVendorCode]);

  /* ─── Navigation helpers ─── */
  const setCatalogViewAndSync = (v: CatalogView) => { setCatalogView(v); setStep1CatalogView(v); };
  /* ─── Selected view ─── */
  const selectedViewItems = useMemo(() =>
    cartEntries.map((e) => ({ product: e.product, item: { sku: toText(e.productId), name: toText(e.product.name), qty: e.qty, priceRub: toNumber(e.product.priceRub) } })),
    [cartEntries]);

  const selectedTotals = useMemo(() => {
    const regular = selectedViewItems.reduce((sum, x) => sum + x.item.qty * x.item.priceRub, 0);
    const standalone = applyLightingOnlyDiscount(regular);
    const withCeiling = applyLightingWithCeilingDiscount(regular);
    const effective = lightingDiscountMode === "with-ceiling" ? withCeiling : standalone;
    const effectivePercent = lightingDiscountMode === "with-ceiling"
      ? LIGHTING_WITH_CEILING_DISCOUNT_PERCENT
      : LIGHTING_ONLY_DISCOUNT_PERCENT;
    return {
      regular,
      standalone,
      withCeiling,
      effective,
      effectivePercent,
      effectiveBenefit: Math.max(0, regular - effective),
      withCeilingBenefit: Math.max(0, regular - withCeiling),
    };
  }, [lightingDiscountMode, selectedViewItems]);

  const cardDiscountPercent = lightingDiscountMode === "with-ceiling"
    ? LIGHTING_WITH_CEILING_DISCOUNT_PERCENT
    : LIGHTING_ONLY_DISCOUNT_PERCENT;

  /* ─── Image zoom state ─── */
  const [zoomImage, setZoomImage] = useState<{ src: string; alt: string } | null>(null);

  /* ═══════════════════════════════════════════════════
     WIZARD (Подбор tab) — step-by-step guided flow
     ═══════════════════════════════════════════════════ */
  const wizardInitializedRef = useRef(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const chooseWizardSystem = useCallback((system: TrackSystemId) => {
    setWSystem(system);
    clearTrackProductsForSystem(system);
    setWStep("trackProfile");
  }, [clearTrackProductsForSystem]);

  const chooseNoTrackFlow = useCallback(() => {
    setWSystem(null);
    clearTrackProductsForSystem(null);
    setWStep(requiredPointQty > 0 ? "points" : "done");
  }, [clearTrackProductsForSystem, requiredPointQty]);

  // Инициализация сценария: учитываем уже выбранную корзину и данные с шага потолка.
  useEffect(() => {
    if (wizardInitializedRef.current) return;

    const draftHasItems = lightingDraft?.mode === "catalog" && (lightingDraft.items?.length ?? 0) > 0;
    if (draftHasItems && cartEntries.length === 0) return;

    wizardInitializedRef.current = true;

    const trackEntry = cartEntries.find((e) =>
      e.product.kind === "TRACK_PROFILE" || e.product.kind === "TRACK_FIXTURE"
    );
    if (trackEntry?.product.system === "COLIBRI_220" || trackEntry?.product.system === "CLARUS_48" || trackEntry?.product.system === "TRACK_220") {
      setWSystem(trackEntry.product.system);
    }

    const hasTrackProfile = cartEntries.some((e) => e.product.kind === "TRACK_PROFILE");
    const hasTrackFixture = cartEntries.some((e) => e.product.kind === "TRACK_FIXTURE");
    const hasPoints = cartEntries.some((e) => e.product.kind === "SPOT_FIXTURE" || isPanelProduct(e.product));

    if (cartEntries.length > 0) {
      if (missingLamps.length > 0) setWStep("lamps");
      else if (requiredPointQty > 0 && !hasPoints) setWStep("points");
      else if (hasTrackProfile && !hasTrackFixture) setWStep("trackFixtures");
      else setWStep("done");
      return;
    }

    if (requiredTrackMeters > 0) setWStep("system");
    else if (requiredPointQty > 0) setWStep("points");
    else setWStep("system");
  }, [cartEntries, lightingDraft, missingLamps.length, requiredPointQty, requiredTrackMeters]);

  // При смене внутреннего шага/таба пользователь всегда видит начало следующего действия.
  const didMountScrollRef = useRef(false);
  useEffect(() => {
    if (!didMountScrollRef.current) {
      didMountScrollRef.current = true;
      return;
    }

    const parent = getScrollParent(rootRef.current);
    parent?.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeTab, catalogView, wStep]);

  useEffect(() => {
    if (!zoomImage) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setZoomImage(null);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [zoomImage]);

  const systemLabel = (id: TrackSystemId) =>
    id === "COLIBRI_220" ? "COLIBRI 220V" : id === "CLARUS_48" ? "CLARUS 48V" : "ART 220V";

  const wizardSystemOptions = useMemo<TrackSystemId[]>(() => {
    if (requiredTrackMeters <= 0) return [];
    if (trackMountType === "built-in") return ["COLIBRI_220", "CLARUS_48"];
    if (trackMountType === "surface") return ["TRACK_220"];
    return ["COLIBRI_220", "CLARUS_48", "TRACK_220"];
  }, [requiredTrackMeters, trackMountType]);

  const selectedTrackSystem = useMemo<TrackSystemId | null>(() => {
    if (wSystem) return wSystem;

    const trackEntry = cartEntries.find((e) =>
      e.product.kind === "TRACK_PROFILE" || e.product.kind === "TRACK_FIXTURE" || e.product.kind === "TRACK_ACCESSORY"
    );

    return isTrackSystemId(trackEntry?.product.system) ? trackEntry.product.system : null;
  }, [cartEntries, wSystem]);



  // Products for each wizard step
  const wTrackProfiles = useMemo(() => {
    const systems: TrackSystemId[] = selectedTrackSystem
      ? [selectedTrackSystem]
      : recommendedTrackProfiles.length > 0
        ? recommendedTrackProfiles.map((r) => r.system)
        : trackMountType === "built-in"
          ? ["COLIBRI_220", "CLARUS_48"]
          : trackMountType === "surface"
            ? ["TRACK_220"]
            : ["COLIBRI_220", "CLARUS_48", "TRACK_220"];

    const uniqueSystems = Array.from(new Set(systems));
    const result: FeedCatalogProduct[] = [];

    for (const sys of uniqueSystems) {
      const base = TRACK_PROFILE_WHITELIST[sys] ?? [];
      const allowed = sys === "TRACK_220" ? new Set([...base, ...ART_TRACK_PROFILE_VENDOR_WHITELIST]) : new Set(base);
      result.push(
        ...products.filter((p) =>
          p.kind === "TRACK_PROFILE" &&
          p.system === sys &&
          p.priceRub > 0 &&
          allowed.has(toText(p.vendorCode))
        )
      );
    }

    return result.sort((a, b) => {
      const systemDiff = systemLabel(a.system as TrackSystemId).localeCompare(systemLabel(b.system as TrackSystemId), "ru");
      return systemDiff || a.priceRub - b.priceRub;
    });
  }, [products, recommendedTrackProfiles, selectedTrackSystem, trackMountType]);

  const wTrackFixtures = useMemo(() => {
    if (!selectedTrackSystem) return [];
    return products.filter((p) => p.kind === "TRACK_FIXTURE" && p.system === selectedTrackSystem && p.priceRub > 0)
      .sort((a, b) => a.priceRub - b.priceRub);
  }, [selectedTrackSystem, products]);

  const wPointProducts = useMemo(() => {
    return products.filter((p) => matchesPointSubtype(p, wPointTab) && p.priceRub > 0)
      .sort((a, b) => a.priceRub - b.priceRub);
  }, [wPointTab, products]);

  const wLampProducts = useMemo(() => {
    return lampOptionsBySocket; // use as-is, already sorted
  }, [lampOptionsBySocket]);

  // Point fixture progress by subtype
  const pointProgressBySubtype = useMemo(() => {
    const result: Record<PointSubtypeId, { current: number; required: number }> = {
      GX53: { current: 0, required: 0 }, MR16: { current: 0, required: 0 }, PANELS: { current: 0, required: 0 },
    };
    for (const e of cartEntries) {
      if (e.product.kind === "SPOT_FIXTURE") {
        const s = detectSocket(e.product);
        if (s === "GX53") result.GX53.current += e.qty;
        else if (s === "MR16") result.MR16.current += e.qty;
      }
      if (isPanelProduct(e.product)) result.PANELS.current += e.qty;
    }
    // Общий план по точкам показываем в общей липкой полосе; в табах — только факт выбора.
    if (requiredPointQty > 0) result.GX53.required = requiredPointQty;
    return result;
  }, [cartEntries, requiredPointQty]);

  const goAfterTrackProfile = useCallback(() => {
    if (requiredTrackMeters > 0 && (!selectedTrackSystem || selectedTrackMeters < requiredTrackMeters)) return;

    if (wTrackFixtures.length > 0) {
      setWStep("trackFixtures");
      return;
    }
    if (requiredPointQty > 0 && selectedPointQty < requiredPointQty) {
      setWStep("points");
      return;
    }
    if (lampRequiredTotal > 0 && lampCurrentTotal < lampRequiredTotal) {
      setWStep("lamps");
      return;
    }
    setWStep("done");
  }, [lampCurrentTotal, lampRequiredTotal, requiredPointQty, requiredTrackMeters, selectedPointQty, selectedTrackMeters, selectedTrackSystem, wTrackFixtures.length]);

  const goAfterTrackFixtures = useCallback(() => {
    if (requiredPointQty > 0 && selectedPointQty < requiredPointQty) {
      setWStep("points");
      return;
    }
    if (lampRequiredTotal > 0 && lampCurrentTotal < lampRequiredTotal) {
      setWStep("lamps");
      return;
    }
    setWStep("done");
  }, [lampCurrentTotal, lampRequiredTotal, requiredPointQty, selectedPointQty]);

  const goAfterPoints = useCallback(() => {
    if (lampRequiredTotal > 0 && lampCurrentTotal < lampRequiredTotal) {
      setWStep("lamps");
      return;
    }
    setWStep("done");
  }, [lampCurrentTotal, lampRequiredTotal]);

  const goBackFromLamps = useCallback(() => {
    if (requiredPointQty > 0) {
      setWStep("points");
      return;
    }
    if (selectedTrackSystem) {
      setWStep("trackFixtures");
      return;
    }
    if (requiredTrackMeters > 0) {
      setWStep("trackProfile");
      return;
    }
    setWStep("system");
  }, [requiredPointQty, requiredTrackMeters, selectedTrackSystem]);


  const trackComplete = requiredTrackMeters <= 0 || selectedTrackMeters >= requiredTrackMeters;
  const pointsComplete = requiredPointQty <= 0 || selectedPointQty >= requiredPointQty;
  const lampsComplete = lampRequiredTotal <= 0 || lampCurrentTotal >= lampRequiredTotal;
  const requiredSelectionComplete = trackComplete && pointsComplete && lampsComplete;

  useEffect(() => {
    if (activeTab !== "recommendations") {
      setStep1FooterAction({
        label: "К итогу →",
        disabled: !requiredSelectionComplete,
        onClick: () => goToStep(2),
      });
      return () => setStep1FooterAction(null);
    }

    if (wStep === "system") {
      if (wizardSystemOptions.length > 0) {
        setStep1FooterAction({
          label: "Выберите систему",
          disabled: true,
          onClick: () => undefined,
        });
      } else {
        setStep1FooterAction({
          label: "К итогу →",
          disabled: !requiredSelectionComplete,
          onClick: () => goToStep(2),
        });
      }
    } else if (wStep === "trackProfile") {
      setStep1FooterAction({
        label: "Подтвердить профиль →",
        disabled: requiredTrackMeters > 0 && (!selectedTrackSystem || !trackComplete),
        onClick: goAfterTrackProfile,
      });
    } else if (wStep === "trackFixtures") {
      setStep1FooterAction({
        label: "Подтвердить светильники →",
        onClick: goAfterTrackFixtures,
      });
    } else if (wStep === "points") {
      setStep1FooterAction({
        label: "Подтвердить точки →",
        disabled: !pointsComplete,
        onClick: goAfterPoints,
      });
    } else if (wStep === "lamps") {
      setStep1FooterAction({
        label: "Подтвердить лампы →",
        disabled: !lampsComplete,
        onClick: () => setWStep("done"),
      });
    } else {
      setStep1FooterAction({
        label: "К итогу →",
        disabled: !requiredSelectionComplete,
        onClick: () => goToStep(2),
      });
    }

    return () => setStep1FooterAction(null);
  }, [
    activeTab,
    goAfterPoints,
    goAfterTrackFixtures,
    goAfterTrackProfile,
    goToStep,
    lampsComplete,
    pointsComplete,
    requiredSelectionComplete,
    requiredTrackMeters,
    selectedTrackSystem,
    setStep1FooterAction,
    trackComplete,
    wStep,
    wizardSystemOptions.length,
  ]);

  /* ─── Scoped catalog products ─── */
  const scopedProducts = useMemo(() => {
    let scoped: FeedCatalogProduct[] = [];
    if (catalogView === "selected") { scoped = selectedViewItems.map((i) => i.product); }
    else if (section === "track-systems") {
      if (trackGroup === "TRACK_PROFILE") {
        const base = TRACK_PROFILE_WHITELIST[trackSystem] ?? [];
        const allowed = trackSystem === "TRACK_220" ? new Set([...base, ...ART_TRACK_PROFILE_VENDOR_WHITELIST]) : new Set(base);
        scoped = products.filter((p) => p.system === trackSystem && p.kind === "TRACK_PROFILE" && allowed.has(toText(p.vendorCode)));
      } else { scoped = products.filter((p) => p.system === trackSystem && p.kind === trackGroup); }
    } else if (section === "point-fixtures") { scoped = products.filter((p) => matchesPointSubtype(p, pointSubtype)); }
    else if (section === "lamps") { scoped = products.filter((p) => isLamp(p) && detectSocket(p) === lampSocket); }
    else { scoped = products.filter(isMountsOrGrilles); }
    const q = toText(query).toLowerCase();
    if (!q) return scoped;
    return scoped.filter((p) => {
      const h = `${toText(p.name)} ${toText(p.vendorCode)} ${toText(p.categoryPath)} ${pickAttrs(p).map((a) => `${a.label} ${a.value}`).join(" ")}`.toLowerCase();
      return h.includes(q);
    });
  }, [catalogView, lampSocket, pointSubtype, products, query, section, selectedViewItems, trackGroup, trackSystem]);

  /* ═══════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════ */
  return (
    <div ref={rootRef} className="space-y-4">

      {/* ─── Compact image preview — not fullscreen ─── */}
      <ImageQuickPreview image={zoomImage} onClose={() => setZoomImage(null)} />

      {/* ─── Tabs ─── */}
      <div className="flex flex-wrap gap-2">
        <TabBtn active={activeTab === "recommendations"} onClick={() => setActiveTab("recommendations")}>Подбор</TabBtn>
        <TabBtn active={activeTab === "catalog" && catalogView === "browse"} onClick={() => { setActiveTab("catalog"); setCatalogViewAndSync("browse"); }}>Каталог</TabBtn>
        <TabBtn active={activeTab === "catalog" && catalogView === "selected"} onClick={() => { setActiveTab("catalog"); setCatalogViewAndSync("selected"); }}>
          Выбранное ({selectedViewItems.length})
        </TabBtn>
      </div>

      {removedHint && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          Некоторые позиции удалены из ассортимента и автоматически убраны из выбранного.
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          ПОДБОР — Guided Wizard
          ═══════════════════════════════════════════════ */}
      {activeTab === "recommendations" && (
        <div key="rec-tab" className="animate-fade-in space-y-4">

          {/* ─── STEP: Track System ─── */}
          {wStep === "system" && (
            wizardSystemOptions.length > 0 ? (
              <div className="space-y-3">
                <div className="rounded-2xl bg-slate-950 p-4 text-white">
                  <p className="text-sm font-semibold">Сначала выберите систему трека</p>
                  <p className="mt-1 text-xs text-white/70">
                    {trackMountType === "built-in"
                      ? "Для встроенного трека подойдут COLIBRI или CLARUS."
                      : trackMountType === "surface"
                        ? "Для накладного трека используем ART 220V."
                        : "Система определит подходящие профили и светильники."}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {wizardSystemOptions.map((system) => {
                    const isRecommended = system === "COLIBRI_220" && trackMountType === "built-in";
                    return (
                      <button
                        key={system}
                        type="button"
                        onClick={() => chooseWizardSystem(system)}
                        className={[
                          "rounded-2xl border-2 p-4 text-left transition-colors",
                          isRecommended
                            ? "border-blue-400 bg-blue-50 hover:border-blue-600"
                            : "border-slate-200 bg-white hover:border-slate-400",
                        ].join(" ")}
                      >
                        <p className={isRecommended ? "text-sm font-semibold text-blue-900" : "text-sm font-semibold text-slate-950"}>
                          {systemLabel(system)}
                        </p>
                        <p className={isRecommended ? "mt-1 text-xs text-blue-700" : "mt-1 text-xs text-slate-500"}>
                          {system === "COLIBRI_220"
                            ? "220V · проще в подборе"
                            : system === "CLARUS_48"
                              ? "48V · нужен блок питания"
                              : "Накладной · 220V"}
                          {isRecommended ? " · рекомендуется" : ""}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {requiredPointQty > 0 ? (
                  <button type="button" onClick={chooseNoTrackFlow}
                    className="w-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600 hover:bg-slate-100">
                    Без трека — только точечные →
                  </button>
                ) : null}

                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                  <p className="font-medium text-slate-700">У меня уже есть освещение</p>
                  <p className="mt-1">Если всё куплено — можно пропустить подбор.</p>
                  <button type="button" onClick={() => goToStep(2)}
                    className="mt-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                    Пропустить, к итогу →
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                <p className="font-semibold text-slate-950">Освещение можно подобрать вручную</p>
                <p className="mt-1 leading-5">
                  На шаге потолка не задан трек или количество точечных светильников.
                  Откройте каталог, если хотите добавить свет, или сразу переходите к итогу.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => { setActiveTab("catalog"); setCatalogViewAndSync("browse"); }}
                    className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    Открыть каталог
                  </button>
                  <button
                    type="button"
                    onClick={() => goToStep(2)}
                    className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    К итогу →
                  </button>
                </div>
              </div>
            )
          )}

          {/* ─── STEP: Track Profiles ─── */}
          {wStep === "trackProfile" && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-sm font-semibold text-emerald-950">
                  Профиль трека: {selectedTrackSystem ? systemLabel(selectedTrackSystem) : ""}
                </p>
                <p className="mt-1 text-xs text-emerald-800">Одно нажатие «+» добавляет 1 шт. Можно собрать профиль из разных длин.</p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {wTrackProfiles.map((p) => {
                  const id = toText(p.productId);
                  const qty = toNumber(cartItems[id]);
                  return (
                    <ProductCard key={id} product={p} qty={qty}
                      onInc={() => setTrackProfileQty(p, qty + 1)}
                      onDec={() => setTrackProfileQty(p, qty - 1)}
                      onImageClick={() => setZoomImage({ src: toText(p.coverImage), alt: toText(p.name) })}
                      discountPercent={cardDiscountPercent} />
                  );
                })}
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setWStep("system")}
                  className="flex-1 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  ← Система
                </button>
                <button
                  type="button"
                  onClick={goAfterTrackProfile}
                  disabled={requiredTrackMeters > 0 && (!selectedTrackSystem || !trackComplete)}
                  className="flex-1 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-slate-950"
                >
                  Подтвердить →
                </button>
              </div>
            </div>
          )}

          {/* ─── STEP: Track Fixtures (spots for track) ─── */}
          {wStep === "trackFixtures" && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-sm font-semibold text-emerald-950">Светильники для трека: {selectedTrackSystem ? systemLabel(selectedTrackSystem) : ""}</p>
                <p className="mt-1 text-xs text-emerald-800">Показываем все светильники выбранной системы.</p>
              </div>

              {wTrackFixtures.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {wTrackFixtures.map((p) => {
                    const id = toText(p.productId);
                    const qty = toNumber(cartItems[id]);
                    return (
                      <ProductCard key={id} product={p} qty={qty}
                        onInc={() => setProductQty(p, qty + 1)} onDec={() => setProductQty(p, qty - 1)}
                        onImageClick={() => setZoomImage({ src: toText(p.coverImage), alt: toText(p.name) })}
                      discountPercent={cardDiscountPercent} />
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-slate-600">Нет светильников для этой системы.</p>
              )}

              <div className="flex gap-3">
                <button type="button" onClick={() => setWStep("trackProfile")}
                  className="flex-1 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">← Назад</button>
                <button type="button" onClick={goAfterTrackFixtures}
                  className="flex-1 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800">Подтвердить →</button>
              </div>
            </div>
          )}

          {/* ─── STEP: Point Fixtures ─── */}
          {wStep === "points" && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-sm font-semibold text-emerald-950">Точечные светильники</p>
                <p className="mt-1 text-xs text-emerald-800">Выберите GX53, MR16 или панели.</p>
              </div>

              {/* Sub-tabs for point types */}
              <div className="flex gap-2">
                {POINT_SUBTYPES.map((st) => (
                  <button key={st.id} type="button" onClick={() => setWPointTab(st.id)}
                    className={["rounded-xl px-3 py-1.5 text-xs font-medium",
                      wPointTab === st.id ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"].join(" ")}>
                    {st.label}
                    {pointProgressBySubtype[st.id].current > 0 && (
                      <span className="ml-1 text-[10px] opacity-70">{pointProgressBySubtype[st.id].current} шт.</span>
                    )}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {wPointProducts.map((p) => {
                  const id = toText(p.productId);
                  const qty = toNumber(cartItems[id]);
                  return (
                    <ProductCard key={id} product={p} qty={qty}
                      onInc={() => setProductQty(p, qty + 1)} onDec={() => setProductQty(p, qty - 1)}
                      onImageClick={() => setZoomImage({ src: toText(p.coverImage), alt: toText(p.name) })}
                      discountPercent={cardDiscountPercent} />
                  );
                })}
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setWStep(selectedTrackSystem ? "trackFixtures" : requiredTrackMeters > 0 ? "trackProfile" : "system")}
                  className="flex-1 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">← Назад</button>
                <button
                  type="button"
                  onClick={goAfterPoints}
                  disabled={!pointsComplete}
                  className="flex-1 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-slate-950"
                >
                  Подтвердить →
                </button>
              </div>
            </div>
          )}

          {/* ─── STEP: Lamps ─── */}
          {wStep === "lamps" && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-sm font-semibold text-amber-950">Лампы к светильникам</p>
                <p className="mt-1 text-xs text-amber-800">Показываем все подходящие лампы, не только первые позиции.</p>
              </div>

              {lampSocketsToShow.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                  Для выбранных светильников отдельные лампы не требуются.
                </div>
              ) : null}

              {lampSocketsToShow.map((socket) => {
                const required = toNumber(lampRequiredBySocket[socket]);
                const current = toNumber(lampCurrentBySocket[socket]);
                const missing = Math.max(0, required - current);
                const lamps = wLampProducts[socket] ?? [];

                return (
                  <div key={socket} className="space-y-2">
                    <div className="rounded-2xl border border-slate-200 bg-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-950">Лампы {socket}</p>
                          <p className="text-xs text-slate-600">Нужно {fmt(required)} шт., выбрано {fmt(current)} шт.</p>
                        </div>
                        {missing > 0 ? (
                          <button
                            type="button"
                            onClick={() => addCheapestLamps(socket)}
                            className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                          >
                            +{fmt(missing)} шт. доступных
                          </button>
                        ) : (
                          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Готово</span>
                        )}
                      </div>
                      <div className="mt-2">
                        <ThinProgress current={current} required={required} unit="шт." />
                      </div>
                    </div>

                    {lamps.length > 0 ? (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {lamps.map((p) => {
                          const id = toText(p.productId);
                          const qty = toNumber(cartItems[id]);
                          return (
                            <ProductCard
                              key={id}
                              product={p}
                              qty={qty}
                              onInc={() => setProductQty(p, qty + 1)}
                              onDec={() => setProductQty(p, qty - 1)}
                              onImageClick={() => setZoomImage({ src: toText(p.coverImage), alt: toText(p.name) })}
                              discountPercent={cardDiscountPercent}
                            />
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                        Лампы {socket} не найдены в текущем фиде.
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="flex gap-3">
                <button type="button" onClick={goBackFromLamps}
                  className="flex-1 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">← Назад</button>
                <button
                  type="button"
                  onClick={() => setWStep("done")}
                  disabled={!lampsComplete}
                  className="flex-1 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-slate-950"
                >
                  Подтвердить →
                </button>
              </div>
            </div>
          )}

          {/* ─── STEP: Done ─── */}
          {wStep === "done" && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-semibold text-emerald-950">✓ Комплект собран</p>
                <p className="mt-1 text-xs text-emerald-800">
                  {lightingDraft?.items?.length ?? 0} поз. {lightingDraft?.totalRub ? `· ${fmt(lightingDraft.totalRub)} ₽` : ""}
                </p>
              </div>

              {missingMounts.map((item) => (
                <div key={`${item.fixtureVendorCode}-${item.mountVendorCode}`}
                  className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                  <p className="font-semibold">Не хватает закладных</p>
                  <p className="mt-1 text-amber-900/80">Для <span className="font-semibold">{item.fixtureName}</span> нужна <span className="font-semibold">{item.mountName}</span>.</p>
                  <button type="button" onClick={() => addMountOneToOne(item.fixtureVendorCode)}
                    className="mt-2 rounded-xl bg-amber-700 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-800">Добавить 1:1</button>
                </div>
              ))}

              {hasClarusInCart && clarusPsuQty < 1 && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-950">
                  <p className="font-semibold">Для CLARUS обязателен блок питания.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {CLARUS_PSU_VENDOR_CODES.map((v) => {
                      const id = productIdByVendorCode.get(v); if (!id) return null;
                      const p = productsById.get(id); if (!p) return null;
                      return <button key={v} type="button" onClick={() => setClarusPsu(id)}
                        className="rounded-xl bg-rose-700 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-800">{toText(p.name)}</button>;
                    })}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button type="button" onClick={() => { setActiveTab("catalog"); setCatalogViewAndSync("browse"); }}
                  className="flex-1 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">Каталог</button>
                <button
                  type="button"
                  onClick={() => goToStep(2)}
                  disabled={!requiredSelectionComplete}
                  className="flex-1 rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-emerald-700"
                >
                  К итогу →
                </button>
              </div>
            </div>
          )}


          {hasRecommendations && (
            <div className="text-center">
              <button type="button" onClick={() => setActiveTab("catalog")}
                className="text-sm font-medium text-slate-500 underline decoration-slate-300 underline-offset-4 hover:text-slate-800">
                Или выберите в каталоге →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          КАТАЛОГ tab
          ═══════════════════════════════════════════════ */}
      {activeTab === "catalog" && (
        <div key="catalog-tab" className="animate-fade-in space-y-4">
          {/* Lamp reminder */}
          {missingLamps.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <p className="font-semibold">Не хватает ламп</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {missingLamps.map((m) => (
                  <button key={m.socket} type="button" onClick={() => addCheapestLamps(m.socket)}
                    className="rounded-xl bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800">
                    +{m.requiredQty - m.currentQty} ламп {m.socket}
                  </button>
                ))}
              </div>
            </div>
          )}

          {catalogView === "selected" ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              {selectedViewItems.length === 0 ? (
                <p className="text-sm text-slate-600">Пока ничего не выбрано.</p>
              ) : (
                <>
                  <ul className="space-y-3">
                    {selectedViewItems.map(({ item, product }) => {
                      const regular = item.priceRub;
                      const discounted = getDiscountedPrice(regular, selectedTotals.effectivePercent);
                      const productId = toText(product.productId);
                      return (
                        <li key={toText(item.sku)} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          <div className="grid grid-cols-[5.5rem_1fr] gap-3">
                            <ProductImage src={toText(product.coverImage)} alt={toText(product.name)} />
                            <div className="min-w-0">
                              <p className="break-words text-sm font-semibold text-slate-950">{toText(item.name)}</p>
                              <p className="mt-2 text-xs text-slate-700">
                                {item.qty} шт. · {fmt(regular)} ₽/шт · со скидкой −{selectedTotals.effectivePercent}%: {fmt(discounted)} ₽/шт
                              </p>
                              <button type="button" onClick={() => setCartItems((prev) => { const n = { ...prev }; delete n[productId]; return n; })}
                                aria-label={`Удалить ${item.name}`}
                                className="mt-2 rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100">Удалить</button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 text-sm">
                    <p>Итого: <span className="line-through text-slate-400">{fmt(selectedTotals.regular)} ₽</span></p>
                    <p className="text-emerald-700">
                      Сейчас: {fmt(selectedTotals.effective)} ₽ · −{selectedTotals.effectivePercent}% (−{fmt(selectedTotals.effectiveBenefit)} ₽)
                    </p>
                    {lightingDiscountMode !== "with-ceiling" ? (
                      <p className="text-slate-500">
                        С потолком: {fmt(selectedTotals.withCeiling)} ₽ · −25% (−{fmt(selectedTotals.withCeilingBenefit)} ₽)
                      </p>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => goToStep(2)}
                      disabled={!requiredSelectionComplete}
                      className="mt-3 w-full rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-emerald-700"
                    >
                      К итогу →
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {CATALOG_SECTIONS.map((item) => (
                  <button key={item.id} type="button" onClick={() => { setSection(item.id); setQuery(""); }}
                    className={["rounded-xl border border-slate-200 px-3 py-2 text-sm",
                      section === item.id ? "bg-slate-950 text-white" : "bg-white text-slate-700 hover:bg-slate-50"].join(" ")}>
                    {item.label}
                  </button>
                ))}
              </div>

              {section === "track-systems" && (
                <div className="flex flex-wrap gap-2">
                  {TRACK_SYSTEMS.map((sys) => {
                    const isActive = trackSystem === sys.id;
                    const isRec = sys.id === "COLIBRI_220";
                    return (
                      <button key={sys.id} type="button" onClick={() => { setTrackSystem(sys.id); setQuery(""); }}
                        className={["rounded-xl border px-3 py-1.5 text-xs transition-colors",
                          isActive ? (isRec ? "bg-blue-600 text-white border-blue-600" : "bg-slate-900 text-white border-slate-900")
                          : (isRec ? "border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-100" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50")].join(" ")}>
                        {sys.label}{isRec && !isActive ? <span className="ml-1 text-[10px] opacity-70">● рек.</span> : null}
                      </button>
                    );
                  })}
                  {TRACK_GROUPS.map((g) => (
                    <button key={g.id} type="button" onClick={() => { setTrackGroup(g.id); setQuery(""); }}
                      className={["rounded-xl border border-slate-200 px-3 py-1.5 text-xs",
                        trackGroup === g.id ? "bg-slate-900 text-white" : "bg-white text-slate-700"].join(" ")}>
                      {g.label}
                    </button>
                  ))}
                </div>
              )}

              {section === "point-fixtures" && (
                <div className="flex flex-wrap gap-2">
                  {POINT_SUBTYPES.map((st) => (
                    <button key={st.id} type="button" onClick={() => { setPointSubtype(st.id); setQuery(""); }}
                      className={["rounded-xl border border-slate-200 px-3 py-1.5 text-xs",
                        pointSubtype === st.id ? "bg-slate-900 text-white" : "bg-white text-slate-700"].join(" ")}>
                      {st.label}
                    </button>
                  ))}
                </div>
              )}

              {section === "lamps" && (
                <div className="flex flex-wrap gap-2">
                  {(["GX53", "MR16"] as LampSocket[]).map((s) => (
                    <button key={s} type="button" onClick={() => { setLampSocket(s); setQuery(""); }}
                      className={["rounded-xl border border-slate-200 px-3 py-1.5 text-xs",
                        lampSocket === s ? "bg-slate-900 text-white" : "bg-white text-slate-700"].join(" ")}>
                      {s} {lampCurrentBySocket[s] > 0 ? `(${lampCurrentBySocket[s]}/${lampRequiredBySocket[s]})` : ""}
                    </button>
                  ))}
                </div>
              )}

              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">🔍</span>
                <input value={query} onChange={(e) => setQuery(e.target.value ?? "")}
                  placeholder="Поиск в текущем разделе"
                  className="w-full rounded-2xl border border-slate-300 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2" />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {scopedProducts.map((p) => {
                  const id = toText(p.productId);
                  const qty = toNumber(cartItems[id]);
                  const step = p.unit === "m" ? 0.5 : 1;
                  return (
                    <ProductCard key={id} product={p} qty={qty}
                      onInc={() => setProductQty(p, qty + step)} onDec={() => setProductQty(p, qty - step)}
                      onImageClick={() => setZoomImage({ src: toText(p.coverImage), alt: toText(p.name) })}
                      discountPercent={cardDiscountPercent} />
                  );
                })}
              </div>

              {scopedProducts.length === 0 && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">Ничего не найдено</div>
              )}
            </>
          )}
        </div>
      )}

      {/* ─── Cart summary pill ─── */}
      {lightingDraft?.mode === "catalog" && (lightingDraft.items?.length ?? 0) > 0 && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
              {lightingDraft.items?.length ?? 0}
            </span>
            <span className="text-sm font-medium text-slate-950">
              {lightingRegularTotal > lightingEffectiveTotal ? (
                <>
                  <span className="line-through text-slate-400">{fmt(lightingRegularTotal)} ₽</span>{" "}
                  <span>{fmt(lightingEffectiveTotal)} ₽</span>
                  <span className="ml-1 text-xs text-emerald-700">
                    −{lightingDiscountMode === "with-ceiling" ? 25 : 10}% (−{fmt(lightingRegularTotal - lightingEffectiveTotal)} ₽)
                  </span>
                </>
              ) : (
                <>{fmt(lightingRegularTotal)} ₽</>
              )}
            </span>
          </div>
          <button
            type="button"
            onClick={() => goToStep(2)}
            disabled={!requiredSelectionComplete}
            className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-emerald-700"
          >
            К итогу →
          </button>
        </div>
      )}
    </div>
  );
}
