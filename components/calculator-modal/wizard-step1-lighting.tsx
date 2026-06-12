"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import snapshotData from "@/data/eks-feed2-snapshot.json";
import type { FeedCatalogParam, FeedCatalogProduct } from "@/lib/eks-feed2-catalog";
import type { LightingItem, LightingSnapshot } from "@/lib/calculator-modal-types";
import { trackLightingCartChanged } from "@/lib/analytics";
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
function fmtMeters(value: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(
    value
  );
}
function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
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

  const vendorCode = toText((p as any).vendorCode);
  const offerId = toText((p as any).offerId);
  const name = toText((p as any).name);
  if (!name || (!vendorCode && !offerId)) return null;

  const productIdRaw = toText((p as any).productId);
  const productId = productIdRaw || `feed2-${vendorCode || offerId || name}`;

  const images = Array.isArray((p as any).images)
    ? ((p as any).images as unknown[])
        .map((item) => toText(item))
        .filter(Boolean)
    : [];

  return {
    productId: toText(productId),
    vendorCode,
    offerId,
    name,
    url: toText((p as any).url),
    categoryId: toText((p as any).categoryId),
    categoryPath: toText((p as any).categoryPath),
    images,
    coverImage: toText((p as any).coverImage) || images[0] || "",
    priceRub: toNumber((p as any).priceRub),
    available: Boolean((p as any).available ?? true),
    params: toParams((p as any).params),
    keyAttributes: toParams((p as any).keyAttributes),
    system: (toText((p as any).system) || "UNKNOWN") as FeedCatalogProduct["system"],
    kind: (toText((p as any).kind) || "OTHER") as FeedCatalogProduct["kind"],
    unit: (toText((p as any).unit) === "m" ? "m" : "pcs") as FeedCatalogProduct["unit"],
    lengthMeters: toNumberOrNull((p as any).lengthMeters),
    pieceLengthMeters: toNumberOrNull((p as any).pieceLengthMeters),
  };
}

function normalizeQty(nextQtyRaw: number, unit: "pcs" | "m"): number {
  const step = unit === "m" ? 0.5 : 1;
  const normalized = Math.round(nextQtyRaw / step) * step;
  return Math.max(0, Number.isFinite(normalized) ? normalized : 0);
}

function isMountsOrGrilles(product: FeedCatalogProduct): boolean {
  const text = `${toText(product.name)} ${toText(product.vendorCode)} ${toText(
    product.categoryPath
  )}`.toLowerCase();
  if (product.kind === "CEILING_COMPONENT") return true;
  return (
    text.includes("заклад") || text.includes("решетк") || text.includes("решётк")
  );
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
  if (subtype === "PANELS") return isPanelProduct(product);

  if (product.kind !== "SPOT_FIXTURE") return false;
  const socket = getPointSocketByProduct(product);
  return socket === subtype;
}

function isLamp(product: FeedCatalogProduct): boolean {
  return (
    product.kind === "LAMP" &&
    toNumber(product.priceRub) > 0 &&
    product.available !== false
  );
}

function pickDisplayAttributes(product: FeedCatalogProduct): { label: string; value: string }[] {
  const attrs = product.keyAttributes?.length ? product.keyAttributes : product.params;
  return (attrs ?? [])
    .slice(0, 4)
    .map((attr) => ({ label: toText(attr.label), value: toText(attr.value) }));
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
        active
          ? "bg-slate-950 text-white"
          : "bg-slate-100 text-slate-700 hover:bg-slate-200",
      ].join(" ")}
    >
      {children}
    </button>
  );
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
  const handleDec = () => {
    // P2.9: haptic feedback
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(10);
    onDec();
  };
  const handleInc = () => {
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(10);
    onInc();
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleDec}
        className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 active:scale-95"
        aria-label="Уменьшить"
        style={{ minHeight: 44, minWidth: 44 }}
      >
        −
      </button>

      <div className="min-w-[3.5rem] text-center text-sm font-semibold text-slate-950">
        {qty}
      </div>

      <button
        type="button"
        onClick={handleInc}
        className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 active:scale-95"
        aria-label="Увеличить"
        style={{ minHeight: 44, minWidth: 44 }}
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
  const benefit = computeBenefit(regular, discounted);
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="grid grid-cols-[5.5rem_1fr] gap-3 sm:grid-cols-[8rem_1fr] sm:gap-4">
        <ProductImage src={toText(product.coverImage)} alt={toText(product.name)} />

        <div className="min-w-0">
          <p className="break-words text-sm font-semibold text-slate-950">
            {toText(product.name)}
          </p>

          {/* P2.4: Article removed from main card — hidden in details popover */}
          {/* P2.5: Name + price + qty first, details expandable */}
          <div className="mt-2 text-xs">
            <span className="line-through text-slate-400">{fmt(regular)} ₽</span>
            {" "}
            <span className="font-semibold text-emerald-700">{fmt(discounted)} ₽</span>
            {benefit > 0 ? (
              <span className="text-slate-500"> · выгода {fmt(benefit)} ₽</span>
            ) : null}
            <span className="text-slate-400"> · с потолком</span>
          </div>

          {/* P2.5: "Подробнее" раскрывает характеристики */}
          {pickDisplayAttributes(product).length > 0 || toText(product.vendorCode) ? (
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="mt-1 text-xs font-medium text-slate-500 hover:text-slate-800 underline decoration-slate-300 underline-offset-2"
            >
              {showDetails ? "Скрыть" : "Подробнее"}
            </button>
          ) : null}

          {showDetails ? (
            <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              {toText(product.vendorCode) ? (
                <p className="text-xs text-slate-500">
                  Артикул: {toText(product.vendorCode)}
                </p>
              ) : null}
              {pickDisplayAttributes(product).length > 0 ? (
                <div className="mt-1 space-y-0.5 text-xs text-slate-600">
                  {pickDisplayAttributes(product).map((attr) => (
                    <p key={attr.label}>
                      {attr.label}: {attr.value}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <ProductQtyControls
              qty={product.unit === "m" ? Number(qty.toFixed(1)) : qty}
              onDec={onDec}
              onInc={onInc}
            />

            {/* P2.3: hide "Не выбрано" when qty=0 */}
            {qty > 0 ? (
              <span className="rounded-full px-3 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700">
                В корзине: {product.unit === "m" ? qty.toFixed(1) : qty} {product.unit === "m" ? "м" : "шт"}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProgressRow({
  label,
  unit,
  current,
  required,
}: {
  label: string;
  unit: string;
  current: number;
  required: number | null;
}) {
  const hasTarget = required !== null && required > 0;
  const ratio = hasTarget ? clamp01(current / required) : null;
  const done = hasTarget ? current >= required : false;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-sm font-semibold text-slate-950">{label}</p>

        {hasTarget ? (
          <p className="text-sm text-slate-700">
            <span className="font-semibold text-slate-950">
              {unit === "м" ? fmtMeters(current) : fmt(current)}
            </span>{" "}
            / {unit === "м" ? fmtMeters(required) : fmt(required)} {unit}
          </p>
        ) : (
          <p className="text-sm text-slate-700">
            В корзине:{" "}
            <span className="font-semibold text-slate-950">
              {unit === "м" ? fmtMeters(current) : fmt(current)}
            </span>{" "}
            {unit}
          </p>
        )}
      </div>

      {hasTarget ? (
        <div className="mt-3">
          <div className="h-2 w-full rounded-full bg-slate-200">
            <div
              className={["h-2 rounded-full", done ? "bg-emerald-600" : "bg-slate-950"].join(" ")}
              style={{ width: `${Math.round((ratio ?? 0) * 100)}%` }}
            />
          </div>

          <p className="mt-2 text-xs text-slate-500">
            {done ? "Расчёт полностью укомплектован ✓" : "Выберите свет — или переходите к итогу."}
          </p>
        </div>
      ) : null}
    </div>
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
  goToStep,
  showCeilingInUi,
  lightingDiscountEligible,
} = useCalculatorModal();

  const [activeTab, setActiveTab] = useState<Tab>("recommendations");
  const [catalogView, setCatalogView] = useState<CatalogView>("browse");

  const appliedInitialUiRef = useRef<string | null>(null);
  useEffect(() => {
    const key = JSON.stringify({
      entryMode: options?.entryMode ?? null,
      initialStep: (options as any)?.initialStep ?? null,
      initialLightingTab: options?.initialLightingTab ?? null,
      initialLightingView: options?.initialLightingView ?? null,
      source: options?.source ?? null,
    });
    if (appliedInitialUiRef.current === key) return;
    appliedInitialUiRef.current = key;

    const shouldOpenCatalogByDefault =
      options?.entryMode === "lighting-first" || (options as any)?.initialStep === 1;

    const nextTab: Tab =
      options?.initialLightingTab === "catalog"
        ? "catalog"
        : options?.initialLightingTab === "recommendations"
          ? "recommendations"
          : shouldOpenCatalogByDefault
            ? "catalog"
            : "recommendations";

    const nextView: CatalogView =
      options?.initialLightingView === "selected" ? "selected" : "browse";

    setActiveTab(nextTab);
    setCatalogView(nextView);
    setStep1CatalogView(nextView);
  }, [options, setStep1CatalogView]);

  const [section, setSection] = useState<CatalogSectionId>("track-systems");
  const [trackSystem, setTrackSystem] = useState<TrackSystemId>("COLIBRI_220");
  const [trackGroup, setTrackGroup] = useState<TrackGroupId>("TRACK_FIXTURE");
  const [pointSubtype, setPointSubtype] = useState<PointSubtypeId>("GX53");
  const [lampSocket, setLampSocket] = useState<LampSocket>("GX53");

  const [query, setQuery] = useState("");
  const [cartItems, setCartItems] = useState<CartItems>({});
  const [removedHint, setRemovedHint] = useState(false);

  const prevInitialLightingRef = useRef<LightingSnapshot | null | undefined>(undefined);

  const products = useMemo(() => {
    const rawProducts = (snapshotData as { products?: unknown[] })?.products ?? [];
    return rawProducts
      .map((item) => normalizeProduct(item))
      .filter((item): item is FeedCatalogProduct => Boolean(item))
      .map((p) => applyVendorOverrides(p))
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

      const nextView: CatalogView =
        options?.initialLightingView === "selected" ? "selected" : "browse";
      setCatalogView(nextView);
      setStep1CatalogView(nextView);
    }
  }, [
    options?.initialLighting,
    options?.initialLightingView,
    productIdByVendorCode,
    productsById,
    setStep1CatalogView,
  ]);

  const cartEntries = useMemo(() => {
    return Object.entries(cartItems)
      .filter(([, qty]) => qty > 0)
      .map(([productId, qty]) => {
        const product = productsById.get(productId);
        return product ? { productId, product, qty } : null;
      })
      .filter(
        (entry): entry is { productId: string; product: FeedCatalogProduct; qty: number } =>
          Boolean(entry)
      )
      .filter((entry) => !REMOVED_COLIBRI_VENDOR_CODES.has(toText(entry.product.vendorCode)));
  }, [cartItems, productsById]);

  // ===== Progress numbers =====
  const selectedTrackMeters = useMemo(() => {
    let meters = 0;
    for (const entry of cartEntries) {
      const p = entry.product;
      if (p.kind !== "TRACK_PROFILE") continue;
      meters += calcTrackProfileMeters(p, entry.qty);
    }
    return meters;
  }, [cartEntries]);

  const selectedPointQty = useMemo(() => {
    let qty = 0;
    for (const entry of cartEntries) {
      const p = entry.product;
      if (p.kind === "SPOT_FIXTURE" || isPanelProduct(p)) qty += entry.qty;
    }
    return qty;
  }, [cartEntries]);

  // targets показываем только если потолок “разрешён к показу” (чтобы не давить в lighting-first)
  const requiredTrackMeters = showCeilingInUi
    ? toNumber(snapshot?.derivedInputs?.trackLengthMeters)
    : 0;
  const requiredPointQty = showCeilingInUi
    ? toNumber(snapshot?.derivedInputs?.pointSpotsQty)
    : 0;

  const progressHasTargets = requiredTrackMeters > 0 || requiredPointQty > 0;
  // ===== Recommendations from Step0 (NOT auto-fill) =====
  // Instead of silently adding items to cart, we show recommendation cards
  // that the user can explicitly accept or dismiss.
  const recommendedTrackProfiles = useMemo(() => {
    if (!showCeilingInUi || requiredTrackMeters <= 0) return [];
    const trackMountType = snapshot?.derivedInputs?.trackMountType ?? "none";

    // built-in → COLIBRI + CLARUS; surface → ART
    const targetSystems: TrackSystemId[] =
      trackMountType === "built-in"
        ? ["COLIBRI_220", "CLARUS_48"]
        : trackMountType === "surface"
          ? ["TRACK_220"]
          : [];

    const results: Array<{ product: FeedCatalogProduct; system: TrackSystemId; qty: number; totalMeters: number }> = [];

    for (const system of targetSystems) {
      const base = TRACK_PROFILE_WHITELIST[system] ?? [];
      const allowed =
        system === "TRACK_220"
          ? new Set([...base, ...ART_TRACK_PROFILE_VENDOR_WHITELIST])
          : new Set(base);

      const profiles = products.filter(
        (p) => p.kind === "TRACK_PROFILE" && p.system === system && p.priceRub > 0 && allowed.has(toText(p.vendorCode))
      );
      if (profiles.length === 0) continue;

      // Sort by price ascending, pick cheapest
      profiles.sort((a, b) => a.priceRub - b.priceRub);
      const best = profiles[0];
      const pieceM = inferPieceLengthMeters(best);
      if (pieceM && pieceM > 0) {
        const qty = Math.ceil(requiredTrackMeters / pieceM);
        results.push({ product: best, system, qty, totalMeters: qty * pieceM });
      }
    }

    return results;
  }, [showCeilingInUi, requiredTrackMeters, snapshot?.derivedInputs, products]);

  const recommendedPointFixtures = useMemo(() => {
    if (!showCeilingInUi || requiredPointQty <= 0) return [];
    const spots = products.filter(
      (p) => p.kind === "SPOT_FIXTURE" && p.priceRub > 0 && !isPanelProduct(p)
    );
    if (spots.length === 0) return [];

    spots.sort((a, b) => a.priceRub - b.priceRub);
    // Return up to 3 cheapest options
    return spots.slice(0, 3).map((p) => ({ product: p }));
  }, [showCeilingInUi, requiredPointQty, products]);

  const hasRecommendations =
    recommendedTrackProfiles.length > 0 || recommendedPointFixtures.length > 0;

  // Track which recommendations were dismissed
  const [dismissedRecs, setDismissedRecs] = useState<Set<string>>(new Set());
  const dismissRec = (key: string) =>
    setDismissedRecs((prev) => new Set(prev).add(key));

  const acceptTrackRecommendation = (rec: typeof recommendedTrackProfiles[number]) => {
    setProductQty(rec.product, rec.qty);
    dismissRec(`track-${rec.system}`);
  };

  const acceptPointRecommendation = (rec: typeof recommendedPointFixtures[number]) => {
    setProductQty(rec.product, requiredPointQty);
    dismissRec(`point-${rec.product.productId}`);
  };

  const acceptAllRecommendations = () => {
    for (const rec of recommendedTrackProfiles) {
      if (!dismissedRecs.has(`track-${rec.system}`)) {
        setProductQty(rec.product, rec.qty);
      }
    }
    for (const rec of recommendedPointFixtures) {
      if (!dismissedRecs.has(`point-${rec.product.productId}`)) {
        setProductQty(rec.product, requiredPointQty);
      }
    }
    setDismissedRecs(new Set()); // clear all dismissals
  };

  const visibleTrackRecs = recommendedTrackProfiles.filter(
    (r) => !dismissedRecs.has(`track-${r.system}`)
  );
  const visiblePointRecs = recommendedPointFixtures.filter(
    (r) => !dismissedRecs.has(`point-${r.product.productId}`)
  );
  const hasVisibleRecs = visibleTrackRecs.length > 0 || visiblePointRecs.length > 0;



  const EPS_METERS = 0.05;
  const trackDone =
    requiredTrackMeters > 0 ? selectedTrackMeters + EPS_METERS >= requiredTrackMeters : true;
  const pointsDone = requiredPointQty > 0 ? selectedPointQty >= requiredPointQty : true;
  const progressDone = progressHasTargets ? trackDone && pointsDone : false;

  const remainingTrackMeters = Math.max(0, requiredTrackMeters - selectedTrackMeters);
  const remainingPointQty = Math.max(0, requiredPointQty - selectedPointQty);

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
    const regular = selectedViewItems.reduce(
      (sum, x) => sum + x.item.qty * x.item.priceRub,
      0
    );
    const discounted = applyLightingDiscount(regular);
    const benefit = Math.max(0, regular - discounted);
    return { regular, discounted, benefit };
  }, [selectedViewItems]);

  // ===== dependencies (закладные/лампы/PSU) =====
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

  const lampOptionsBySocket = useMemo(() => {
    const lamps = products.filter((product) => isLamp(product));
    const byPriceAsc = (a: FeedCatalogProduct, b: FeedCatalogProduct) =>
      toNumber(a.priceRub) - toNumber(b.priceRub);

    return {
      GX53: lamps.filter((lamp) => detectSocket(lamp) === "GX53").sort(byPriceAsc),
      MR16: lamps.filter((lamp) => detectSocket(lamp) === "MR16").sort(byPriceAsc),
    };
  }, [products]);

  const lampRequiredBySocket = useMemo(() => {
    const required: Record<LampSocket, number> = { GX53: 0, MR16: 0 };
    for (const entry of cartEntries) {
      if (entry.product.kind === "LAMP") continue;
      const socket = getRequiredLampSocket(entry.product);
      if (!socket) continue;
      required[socket] = (required[socket] ?? 0) + entry.qty;
    }
    return required;
  }, [cartEntries]);

  const lampCurrentBySocket = useMemo(() => {
    const current: Record<LampSocket, number> = { GX53: 0, MR16: 0 };

    for (const socket of ["GX53", "MR16"] as LampSocket[]) {
      const ids = lampOptionsBySocket[socket].map((lamp) => toText(lamp.productId));
      current[socket] = ids.reduce((sum, id) => sum + toNumber(cartItems[id]), 0);
    }

    return current;
  }, [cartItems, lampOptionsBySocket]);

  // IMPORTANT: закладные можно “подтягивать”, а лампы — НЕТ (свободный выбор).
  useEffect(() => {
    setCartItems((prev) => {
      const next: CartItems = { ...prev };
      let changed = false;

      // mounts (авто-синк только если mount уже в корзине)
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

      return changed ? next : prev;
    });
  }, [mountRequiredByVendor, productIdByVendorCode]);

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

  const hasClarusInSnapshot = useMemo(
    () => products.some((product) => product.system === "CLARUS_48"),
    [products]
  );

  const hasClarusInCart = useMemo(
    () => cartEntries.some((entry) => entry.product.system === "CLARUS_48"),
    [cartEntries]
  );

  const clarusPsuQty = useMemo(() => {
    return cartEntries
      .filter((entry) =>
        CLARUS_PSU_VENDOR_CODES.includes(
          toText(entry.product.vendorCode) as (typeof CLARUS_PSU_VENDOR_CODES)[number]
        )
      )
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

      const current = toNumber(lampCurrentBySocket[socket]);
      if (current < required) out.push({ socket, requiredQty: required, currentQty: current });
    }
    return out;
  }, [lampCurrentBySocket, lampRequiredBySocket]);

  const setCatalogViewAndSync = (view: CatalogView) => {
    setCatalogView(view);
    setStep1CatalogView(view);
  };

  const setProductQty = (product: FeedCatalogProduct, nextQtyRaw: number) => {
  const id = toText(product.productId);
  const nextQty = normalizeQty(nextQtyRaw, product.unit);

  const prevQty = toNumber(cartItems[id]);
  const action: "add" | "remove" | "change" =
    prevQty <= 0 && nextQty > 0 ? "add" : prevQty > 0 && nextQty <= 0 ? "remove" : "change";

  if (prevQty !== nextQty) {
    trackLightingCartChanged({
      action,
      sku: id,
      productKind: String(product.kind),
      qty: nextQty,
      source: String(options?.source ?? "unknown"),
    });
  }

  setCartItems((prev) => {
    const next = { ...prev };
    if (nextQty <= 0) delete next[id];
    else next[id] = nextQty;
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

  // optional helper — добавить недостающее количество самых дешёвых ламп (без удаления других ламп)
  const addCheapestLampsOneToOne = (socket: LampSocket) => {
    const required = toNumber(lampRequiredBySocket[socket]);
    if (required <= 0) return;

    const current = toNumber(lampCurrentBySocket[socket]);
    const missing = Math.max(0, required - current);
    if (missing <= 0) return;

    const cheapest = lampOptionsBySocket[socket][0];
    if (!cheapest) return;

    const id = toText(cheapest.productId);
    if (!id) return;

    setCartItems((prev) => ({
      ...prev,
      [id]: toNumber(prev[id]) + missing,
    }));
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

  const gotoTracks = () => {
    setActiveTab("catalog");
    setCatalogViewAndSync("browse");
    setSection("track-systems");
    setQuery("");
  };

  const gotoTrackProfiles = () => {
    setActiveTab("catalog");
    setCatalogViewAndSync("browse");
    setSection("track-systems");
    setTrackGroup("TRACK_PROFILE");
    setQuery("");
  };

  const gotoPoints = () => {
    setActiveTab("catalog");
    setCatalogViewAndSync("browse");
    setSection("point-fixtures");
    setQuery("");
  };

  const gotoLamps = (socket: LampSocket) => {
    setActiveTab("catalog");
    setCatalogViewAndSync("browse");
    setSection("lamps");
    setLampSocket(socket);
    setQuery("");
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

      const base = TRACK_PROFILE_WHITELIST[system] ?? [];
      const allowed =
        system === "TRACK_220"
          ? new Set([...base, ...ART_TRACK_PROFILE_VENDOR_WHITELIST])
          : new Set(base);

      const hasProfile = cartEntries.some(
        (entry) =>
          entry.product.system === system &&
          entry.product.kind === "TRACK_PROFILE" &&
          allowed.has(toText(entry.product.vendorCode))
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

    const lampQtyBySocket: Record<LampSocket, number> = {
      GX53: toNumber(lampCurrentBySocket.GX53),
      MR16: toNumber(lampCurrentBySocket.MR16),
    };

    return fixtures.every((entry) => {
      const vendorCode = toText(entry.product.vendorCode);

      const mountVendor = POINT_TO_MOUNT_VENDOR_CODE[vendorCode];
      const mountOk = mountVendor
        ? toNumber(cartItems[toText(productIdByVendorCode.get(mountVendor) ?? "")]) >= entry.qty
        : true;

      const socket = getRequiredLampSocket(entry.product);
      const lampOk = socket
        ? lampQtyBySocket[socket] >= toNumber(lampRequiredBySocket[socket])
        : true;

      return mountOk && lampOk;
    });
  }, [cartEntries, cartItems, lampCurrentBySocket, lampRequiredBySocket, productIdByVendorCode]);

  const scopedProducts = useMemo(() => {
    let scoped: FeedCatalogProduct[] = [];

    if (catalogView === "selected") {
      scoped = selectedViewItems.map((item) => item.product);
    } else if (section === "track-systems") {
      if (trackGroup === "TRACK_PROFILE") {
        const base = TRACK_PROFILE_WHITELIST[trackSystem] ?? [];
        const allowed =
          trackSystem === "TRACK_220"
            ? new Set([...base, ...ART_TRACK_PROFILE_VENDOR_WHITELIST])
            : new Set(base);

        scoped = products.filter(
          (product) =>
            product.system === trackSystem &&
            product.kind === "TRACK_PROFILE" &&
            allowed.has(toText(product.vendorCode))
        );
      } else {
        scoped = products.filter(
          (product) => product.system === trackSystem && product.kind === trackGroup
        );
      }
    } else if (section === "point-fixtures") {
      scoped = products.filter((product) => matchesPointSubtype(product, pointSubtype));
    } else if (section === "lamps") {
      scoped = products.filter((product) => isLamp(product) && detectSocket(product) === lampSocket);
    } else {
      scoped = products.filter((product) => isMountsOrGrilles(product));
    }

    const q = toText(query).toLowerCase();
    if (!q) return scoped;

    return scoped.filter((product) => {
      const attrs = pickDisplayAttributes(product)
        .map((a) => `${a.label} ${a.value}`)
        .join(" ");
      const haystack =
        `${toText(product.name)} ${toText(product.vendorCode)} ${toText(
          product.categoryPath
        )} ${attrs}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [
    catalogView,
    lampSocket,
    pointSubtype,
    products,
    query,
    section,
    selectedViewItems,
    trackGroup,
    trackSystem,
  ]);

  const showClarusEmptyMessage =
    section === "track-systems" && trackSystem === "CLARUS_48" && !hasClarusInSnapshot;

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-950">Прогресс по сборке</p>
            <p className="mt-1 text-xs text-slate-600">
              Для трека учитываем метры{" "}
              <span className="font-semibold">профиля/шинопровода</span>.
            </p>
          </div>

          {progressHasTargets && progressDone ? (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              Собрано по расчёту
            </span>
          ) : null}
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <ProgressRow
            label="Профиль трека"
            unit="м"
            current={selectedTrackMeters}
            required={progressHasTargets ? requiredTrackMeters : null}
          />
          <ProgressRow
            label="Точечные"
            unit="шт."
            current={selectedPointQty}
            required={progressHasTargets ? requiredPointQty : null}
          />
        </div>

        {progressHasTargets && !progressDone ? (
          <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-800">
            <p className="font-semibold text-slate-950">
              Осталось добрать (если хотите ровно по расчёту)
            </p>
            <p className="mt-1 text-slate-700">
              Профиль трека:{" "}
              <span className="font-semibold">{fmtMeters(remainingTrackMeters)}</span>{" "}
              м · Точечные:{" "}
              <span className="font-semibold">{fmt(remainingPointQty)}</span> шт.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={gotoTrackProfiles}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Добавить профиль трека
              </button>
              <button
                type="button"
                onClick={gotoPoints}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Добавить точечные
              </button>
            </div>
          </div>
        ) : null}

        {progressHasTargets && progressDone ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="text-sm text-emerald-950">
              <p className="font-semibold">Отлично — комплект собран по расчёту.</p>
              <p className="mt-1 text-xs text-emerald-900/80">
                Можно переходить к завершению.
              </p>
            </div>

            <button
              type="button"
              onClick={() => goToStep(2)}
              className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
            >
              Готово, к итогу →
            </button>
          </div>
        ) : null}

        {!lightingDiscountEligible ? (
          <div className="mt-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
            <p className="font-semibold">Скидка −15% на свет действует при заказе потолка.</p>
            <p className="mt-1 text-blue-900/80">Подтвердите шаг 1 — и скидка применится.</p>
            <button
              type="button"
              onClick={() => goToStep(0)}
              className="mt-3 rounded-xl bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800"
            >
              Рассчитать потолок и получить скидку →
            </button>
          </div>
        ) : null}
      </div>

      {/* P2.1: Tabs in one row: Подбор / Каталог / Выбранное (N) */}
      <div className="flex flex-wrap gap-2">
        <TabButton active={activeTab === "recommendations"} onClick={() => setActiveTab("recommendations")}>
          Подбор
        </TabButton>
        <TabButton active={activeTab === "catalog" && catalogView === "browse"} onClick={() => { setActiveTab("catalog"); setCatalogViewAndSync("browse"); }}>
          Каталог
        </TabButton>
        <TabButton active={catalogView === "selected"} onClick={() => { setActiveTab("catalog"); setCatalogViewAndSync("selected"); }}>
          Выбранное ({selectedViewItems.length})
        </TabButton>
      </div>

      {removedHint ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          Некоторые позиции удалены из ассортимента и автоматически убраны из выбранного.
        </div>
      ) : null}

      {/* мягкая напоминалка про лампы прямо в табе "Каталог" */}
      {activeTab === "catalog" && missingLamps.length > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">Напоминание про лампы</p>
          <p className="mt-1 text-amber-900/80">
            Вы выбрали светильники, которым нужны лампы (1:1), но лампы пока не добавлены в нужном количестве.
          </p>

          <ul className="mt-2 list-disc space-y-1 pl-5">
            {missingLamps.map((m) => (
              <li key={m.socket}>
                Не хватает <span className="font-semibold">{m.socket}</span>: нужно{" "}
                <span className="font-semibold">{m.requiredQty}</span> шт., в корзине{" "}
                <span className="font-semibold">{m.currentQty}</span> шт.
              </li>
            ))}
          </ul>

          <div className="mt-3 flex flex-wrap gap-2">
            {missingLamps.map((m) => (
              <button
                key={`goto-lamps-${m.socket}`}
                type="button"
                onClick={() => gotoLamps(m.socket)}
                className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100"
              >
                Выбрать лампы {m.socket} →
              </button>
            ))}

            {missingLamps.map((m) => (
              <button
                key={`autoadd-lamps-${m.socket}`}
                type="button"
                onClick={() => addCheapestLampsOneToOne(m.socket)}
                className="rounded-xl bg-amber-700 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-800"
              >
                Добавить 1:1 (самые доступные) {m.socket}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setActiveTab("recommendations")}
              className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100"
            >
              Показать рекомендации →
            </button>
          </div>
        </div>
      ) : null}

      {activeTab === "recommendations" ? (
        <div key="rec-tab" className="animate-fade-in space-y-3">
          {/* Context from Step 0 */}
          {hasRecommendations ? (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
              <p className="font-semibold">На основе вашего расчёта потолка</p>
              <p className="mt-1 text-blue-900/80">
                {requiredTrackMeters > 0 ? `Нужно ~${fmtMeters(requiredTrackMeters)} м трекового профиля` : ""}
                {requiredTrackMeters > 0 && requiredPointQty > 0 ? " · " : ""}
                {requiredPointQty > 0 ? `${requiredPointQty} точечных светильников` : ""}
              </p>
              {snapshot?.derivedInputs?.trackMountType === "built-in" ? (
                <p className="mt-1 text-xs text-blue-800/70">Вы выбрали встроенный трек → системы COLIBRI / CLARUS</p>
              ) : snapshot?.derivedInputs?.trackMountType === "surface" ? (
                <p className="mt-1 text-xs text-blue-800/70">Вы выбрали накладной трек → система ART</p>
              ) : null}
            </div>
          ) : null}

          {/* Quick accept all */}
          {hasVisibleRecs && cartEntries.length === 0 ? (
            <button
              type="button"
              onClick={acceptAllRecommendations}
              className="w-full rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
            >
              Добавить все рекомендации
            </button>
          ) : null}

          {/* Track profile recommendations */}
          {visibleTrackRecs.map((rec) => {
            const regular = toNumber(rec.product.priceRub);
            const discounted = getDiscountedPrice(regular);
            const benefit = computeBenefit(regular, discounted);
            const alreadyInCart = toNumber(cartItems[rec.product.productId]) > 0;
            const systemLabel = rec.system === "COLIBRI_220" ? "COLIBRI 220V" : rec.system === "CLARUS_48" ? "CLARUS 48V" : "ART 220V";

            return (
              <div key={`track-rec-${rec.system}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start gap-3">
                  <div className="shrink-0">
                    <ProductImage src={toText(rec.product.coverImage)} alt={toText(rec.product.name)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold text-blue-700">{systemLabel} · Профиль</p>
                        <p className="mt-1 text-sm font-semibold text-slate-950">{toText(rec.product.name)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => dismissRec(`track-${rec.system}`)}
                        className="text-slate-400 hover:text-slate-600 text-xs"
                        aria-label="Убрать рекомендацию"
                      >
                        ✕
                      </button>
                    </div>

                    <p className="mt-1 text-xs text-slate-600">
                      {rec.qty} шт. ≈ {fmtMeters(rec.totalMeters)} м · {fmt(regular)} ₽/шт
                    </p>
                    <p className="mt-1 text-xs">
                      <span className="line-through text-slate-400">{fmt(regular * rec.qty)} ₽</span>
                      {" "}
                      <span className="font-semibold text-emerald-700">{fmt(discounted * rec.qty)} ₽</span>
                      {benefit > 0 ? <span className="text-slate-500"> · выгода {fmt(benefit * rec.qty)} ₽</span> : null}
                      <span className="text-slate-400"> · с потолком</span>
                    </p>

                    <div className="mt-3">
                      {alreadyInCart ? (
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                          ✓ В корзине
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => acceptTrackRecommendation(rec)}
                          className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                        >
                          Добавить {rec.qty} шт.
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Point fixture recommendations */}
          {visiblePointRecs.map((rec) => {
            const regular = toNumber(rec.product.priceRub);
            const discounted = getDiscountedPrice(regular);
            const benefit = computeBenefit(regular, discounted);
            const alreadyInCart = toNumber(cartItems[rec.product.productId]) > 0;

            return (
              <div key={`point-rec-${rec.product.productId}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start gap-3">
                  <div className="shrink-0">
                    <ProductImage src={toText(rec.product.coverImage)} alt={toText(rec.product.name)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold text-slate-500">Точечный светильник</p>
                        <p className="mt-1 text-sm font-semibold text-slate-950">{toText(rec.product.name)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => dismissRec(`point-${rec.product.productId}`)}
                        className="text-slate-400 hover:text-slate-600 text-xs"
                        aria-label="Убрать рекомендацию"
                      >
                        ✕
                      </button>
                    </div>

                    <p className="mt-1 text-xs text-slate-600">
                      {requiredPointQty} шт. · {fmt(regular)} ₽/шт
                    </p>
                    <p className="mt-1 text-xs">
                      <span className="line-through text-slate-400">{fmt(regular * requiredPointQty)} ₽</span>
                      {" "}
                      <span className="font-semibold text-emerald-700">{fmt(discounted * requiredPointQty)} ₽</span>
                      {benefit > 0 ? <span className="text-slate-500"> · выгода {fmt(benefit * requiredPointQty)} ₽</span> : null}
                      <span className="text-slate-400"> · с потолком</span>
                    </p>

                    <div className="mt-3">
                      {alreadyInCart ? (
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                          ✓ В корзине
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => acceptPointRecommendation(rec)}
                          className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                        >
                          Добавить {requiredPointQty} шт.
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* "У меня уже есть" option */}
          {hasRecommendations ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-medium text-slate-700">У меня уже есть освещение</p>
              <p className="mt-1">Если трек или светильники уже куплены — просто пропустите этот шаг. Мы учтём только установку.</p>
              <button
                type="button"
                onClick={() => goToStep(2)}
                className="mt-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Пропустить, к итогу →
              </button>
            </div>
          ) : null}

          {/* No recommendations (lighting-first or no Step0 data) */}
          {!hasRecommendations ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
              <p className="font-semibold text-slate-950">Выберите освещение в каталоге</p>
              <p className="mt-1">Перейдите в каталог, чтобы подобрать трековые системы и светильники.</p>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={gotoTracks}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Трековые системы
                </button>
                <button
                  type="button"
                  onClick={gotoPoints}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Точечные светильники
                </button>
              </div>
            </div>
          ) : null}

          {/* Open catalog link */}
          {hasRecommendations ? (
            <div className="text-center">
              <button
                type="button"
                onClick={() => setActiveTab("catalog")}
                className="text-sm font-medium text-slate-500 underline decoration-slate-300 underline-offset-4 hover:text-slate-800"
              >
                Или выберите в каталоге →
              </button>
            </div>
          ) : null}

          {/* Existing warnings for mounts/lamps/PSU */}
          {missingMounts.map((item) => (
            <div
              key={`${item.fixtureVendorCode}-${item.mountVendorCode}`}
              className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
            >
              <p className="font-semibold">Не хватает закладных 1:1</p>
              <p className="mt-1 text-amber-900/80">
                Для <span className="font-semibold">{item.fixtureName}</span> нужна закладная{" "}
                <span className="font-semibold">{item.mountName}</span>.
              </p>
              <p className="mt-2">
                Нужно: <span className="font-semibold">{item.requiredQty}</span> шт., в корзине:{" "}
                <span className="font-semibold">{item.currentQty}</span> шт.
              </p>
              <button
                type="button"
                onClick={() => addMountOneToOne(item.fixtureVendorCode)}
                className="mt-3 rounded-xl bg-amber-700 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-800"
              >
                Добавить 1:1
              </button>
            </div>
          ))}

          {missingLamps.map((m) => (
            <div
              key={m.socket}
              className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950"
            >
              <p className="font-semibold">Не хватает ламп {m.socket} (1:1)</p>
              <p className="mt-2">
                Нужно: <span className="font-semibold">{m.requiredQty}</span> шт., в корзине:{" "}
                <span className="font-semibold">{m.currentQty}</span> шт.
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => gotoLamps(m.socket)}
                  className="rounded-xl border border-blue-300 bg-white px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-100"
                >
                  Выбрать лампы →
                </button>

                <button
                  type="button"
                  onClick={() => addCheapestLampsOneToOne(m.socket)}
                  className="rounded-xl bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800"
                >
                  Добавить 1:1 (самые доступные)
                </button>
              </div>
            </div>
          ))}

          {hasClarusInCart && clarusPsuQty < 1 ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-950">
              <p className="font-semibold">Для системы CLARUS обязателен минимум 1 блок питания.</p>

              <div className="mt-3 flex flex-wrap gap-2">
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
                      className="rounded-xl bg-rose-700 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-800"
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
        <div key="catalog-tab" className="animate-fade-in space-y-4">
          {catalogView === "selected" ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              {selectedViewItems.length === 0 ? (
                <p className="text-sm text-slate-600">Пока ничего не выбрано.</p>
              ) : (
                <>
                  <ul className="space-y-3">
                    {selectedViewItems.map(({ item, product }) => {
                      const regular = item.priceRub;
                      const discounted = getDiscountedPrice(regular);
                      const productId = toText(product.productId);

                      const pieceMeters =
                        product.kind === "TRACK_PROFILE" && product.unit !== "m"
                          ? inferPieceLengthMeters(product)
                          : null;

                      return (
                        <li
                          key={toText(item.sku)}
                          className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                        >
                          <div className="grid grid-cols-[5.5rem_1fr] gap-3">
                            <ProductImage src={toText(product.coverImage)} alt={toText(product.name)} />

                            <div className="min-w-0">
                              <p className="break-words text-sm font-semibold text-slate-950">
                                {toText(item.name)}
                              </p>
                              <p className="mt-1 break-words text-xs text-slate-600">
                                {pickDisplayAttributes(product)
                                  .map((a) => `${a.label}: ${a.value}`)
                                  .join(" • ")}
                              </p>

                              {product.kind === "TRACK_PROFILE" && product.unit !== "m" ? (
                                pieceMeters ? (
                                  <p className="mt-1 text-xs text-slate-600">
                                    ≈ {pieceMeters.toFixed(2)} м/шт (для прогресса метража)
                                  </p>
                                ) : (
                                  <p className="mt-1 text-xs text-amber-700">
                                    Длина профиля не найдена в данных товара — метры могут не считаться.
                                  </p>
                                )
                              ) : null}

                              <p className="mt-2 text-xs text-slate-700">
                                Qty: {item.qty} • {fmt(regular)} ₽/шт • со скидкой {fmt(discounted)} ₽/шт
                              </p>

                              <button
                                type="button"
                                onClick={() =>
                                  setCartItems((prev) => {
                                    const next = { ...prev };
                                    delete next[productId];
                                    return next;
                                  })
                                }
                                aria-label={`Удалить ${item.name}`}
                                className="mt-2 rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                              >
                                Удалить
                              </button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 text-sm">
                    <p>Итого: {fmt(selectedTotals.regular)} ₽</p>
                    <p className="text-emerald-700">С заказом потолка (−15%): {fmt(selectedTotals.discounted)} ₽</p>
                    <p className="text-slate-500">Ваша выгода: {fmt(selectedTotals.benefit)} ₽</p>
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {CATALOG_SECTIONS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSection(item.id);
                      setQuery("");
                    }}
                    className={[
                      "rounded-xl border border-slate-200 px-3 py-2 text-sm",
                      section === item.id
                        ? "bg-slate-950 text-white"
                        : "bg-white text-slate-700 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {section === "track-systems" ? (
                <div className="flex flex-wrap gap-2">
                  {/* P1.12: Brand hierarchy — COLIBRI recommended (accent), CLARUS/ART outline */}
                  {TRACK_SYSTEMS.map((system) => {
                    const isActive = trackSystem === system.id;
                    const isRecommended = system.id === "COLIBRI_220";
                    return (
                      <button
                        key={system.id}
                        type="button"
                        onClick={() => {
                          setTrackSystem(system.id);
                          setQuery("");
                        }}
                        className={[
                          "rounded-xl border px-3 py-1.5 text-xs transition-colors",
                          isActive
                            ? isRecommended
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-slate-900 text-white border-slate-900"
                            : isRecommended
                              ? "border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-100"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                        ].join(" ")}
                      >
                        {system.label}
                        {isRecommended && !isActive ? (
                          <span className="ml-1 text-[10px] opacity-70">● рек.</span>
                        ) : null}
                      </button>
                    );
                  })}

                  {TRACK_GROUPS.map((group) => (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => {
                        setTrackGroup(group.id);
                        setQuery("");
                      }}
                      className={[
                        "rounded-xl border border-slate-200 px-3 py-1.5 text-xs",
                        trackGroup === group.id
                          ? "bg-slate-900 text-white"
                          : "bg-white text-slate-700",
                      ].join(" ")}
                    >
                      {group.label}
                    </button>
                  ))}
                </div>
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
                      className={[
                        "rounded-xl border border-slate-200 px-3 py-1.5 text-xs",
                        pointSubtype === subtype.id
                          ? "bg-slate-900 text-white"
                          : "bg-white text-slate-700",
                      ].join(" ")}
                    >
                      {subtype.label}
                    </button>
                  ))}
                </div>
              ) : null}

              {section === "lamps" ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {(["GX53", "MR16"] as LampSocket[]).map((socket) => (
                      <button
                        key={socket}
                        type="button"
                        onClick={() => {
                          setLampSocket(socket);
                          setQuery("");
                        }}
                        className={[
                          "rounded-xl border border-slate-200 px-3 py-1.5 text-xs",
                          lampSocket === socket
                            ? "bg-slate-900 text-white"
                            : "bg-white text-slate-700",
                        ].join(" ")}
                      >
                        {socket}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(["GX53", "MR16"] as LampSocket[]).map((socket) => {
                      const required = toNumber(lampRequiredBySocket[socket]);
                      const current = toNumber(lampCurrentBySocket[socket]);
                      const ok = required <= 0 ? true : current >= required;
                      const isActive = lampSocket === socket;

                      return (
                        <div
                          key={`lamp-progress-${socket}`}
                          className={[
                            "rounded-xl px-3 py-2 text-xs",
                            isActive ? "border" : "border border-transparent",
                            ok
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : "bg-amber-50 text-amber-900 border-amber-200",
                          ].join(" ")}
                        >
                          <span className="font-semibold">{socket}</span>
                          <span className="ml-2">
                            Нужно {required} · В корзине {current}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {/* P2.2: Search input with icon */}
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">🔍</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(String(event.target.value ?? ""))}
                  placeholder="Поиск в текущем разделе"
                  className="w-full rounded-2xl border border-slate-300 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                />
              </div>

              {showClarusEmptyMessage ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  Нет данных CLARUS в snapshot
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {scopedProducts.map((product) => {
                  const id = toText(product.productId);
                  const qty = toNumber(cartItems[id]);
                  const step = product.unit === "m" ? 0.5 : 1;

                  return (
                    <ProductCard
                      key={id}
                      product={product}
                      qty={qty}
                      onInc={() => setProductQty(product, qty + step)}
                      onDec={() => setProductQty(product, qty - step)}
                    />
                  );
                })}
              </div>

              {!showClarusEmptyMessage && scopedProducts.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  Ничего не найдено
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {/* Cart summary pill (non-sticky) — shows when items selected */}
      {lightingDraft?.mode === "catalog" && (lightingDraft.items?.length ?? 0) > 0 ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
              {lightingDraft.items?.length ?? 0}
            </span>
            <span className="text-sm font-medium text-slate-950">
              {fmt(lightingDraft.totalRub ?? 0)} ₽
              {lightingDraft.discountedTotalRub != null && lightingDraft.discountedTotalRub < (lightingDraft.totalRub ?? 0) ? (
                <span className="ml-1 text-xs text-emerald-700">−15%</span>
              ) : null}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setCatalogView("selected");
                setActiveTab("catalog");
              }}
              className="rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
            >
              Посмотреть
            </button>
            <button
              type="button"
              onClick={() => goToStep(2)}
              className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
            >
              К итогу →
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
