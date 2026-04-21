"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import snapshotData from "@/data/eks-feed2-snapshot.json";
import type { FeedCatalogProduct, FeedCatalogSystem } from "@/lib/eks-feed2-catalog";
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
type CartItems = Record<string, number>;

type CatalogSection = "track-systems" | "point-fixtures";
type TrackSystemUi = "COLIBRI_220" | "CLARUS_48" | "TRACK_220";
type TrackGroupUi = "TRACK_FIXTURE" | "TRACK_PROFILE" | "TRACK_ACCESSORY";

function fmt(n: number) {
  return new Intl.NumberFormat("ru-RU").format(Math.round(n));
}

function stepByUnit(unit: "pcs" | "m"): number {
  return unit === "m" ? 0.5 : 1;
}

function minByUnit(unit: "pcs" | "m"): number {
  return unit === "m" ? 0.5 : 1;
}

function normalizeQty(value: number, unit: "pcs" | "m"): number {
  const step = stepByUnit(unit);
  return Math.max(0, Math.round(value / step) * step);
}

function pickDisplayAttributes(product: FeedCatalogProduct) {
  if (Array.isArray(product.keyAttributes) && product.keyAttributes.length > 0) {
    return product.keyAttributes.slice(0, 4);
  }
  return (product.params ?? []).slice(0, 4);
}

function inferProfileLengthMm(product: FeedCatalogProduct): number {
  const texts = [
    product.name,
    product.vendorCode,
    ...(product.params ?? []).map((p) => `${p.label} ${p.value}`),
  ].join(" ");

  const mmMatch = texts.match(/(\d{3,4})\s*мм/i);
  if (mmMatch) return Number(mmMatch[1]);

  const meterMatch = texts.match(/([123])\s*м(?![а-я])/i);
  if (meterMatch) return Number(meterMatch[1]) * 1000;

  const hard = texts.match(/(?:^|\D)(1000|2000|3000)(?:\D|$)/);
  if (hard) return Number(hard[1]);

  return 1000;
}

function calcProfilesForTrackMeters(trackMeters: number, profiles: FeedCatalogProduct[]): LightingItem[] {
  if (trackMeters <= 0 || profiles.length === 0) return [];
  const targetMm = Math.max(0, Math.round(trackMeters * 1000));
  if (targetMm <= 0) return [];

  const candidates = profiles
    .map((p) => ({ product: p, lengthMm: inferProfileLengthMm(p) }))
    .filter((x) => Number.isFinite(x.lengthMm) && x.lengthMm > 0)
    .sort((a, b) => b.lengthMm - a.lengthMm);

  if (candidates.length === 0) return [];

  let left = targetMm;
  const result = new Map<string, LightingItem>();

  for (const candidate of candidates) {
    if (left <= 0) break;
    const qty = Math.floor(left / candidate.lengthMm);
    if (qty <= 0) continue;

    result.set(candidate.product.productId, {
      sku: candidate.product.productId,
      name: candidate.product.name,
      qty,
      priceRub: candidate.product.priceRub,
    });

    left -= qty * candidate.lengthMm;
  }

  if (left > 0) {
    const smallest = candidates[candidates.length - 1];
    const prev = result.get(smallest.product.productId);
    if (prev) {
      result.set(smallest.product.productId, { ...prev, qty: prev.qty + 1 });
    } else {
      result.set(smallest.product.productId, {
        sku: smallest.product.productId,
        name: smallest.product.name,
        qty: 1,
        priceRub: smallest.product.priceRub,
      });
    }
  }

  return Array.from(result.values());
}

function mergeItems(groups: LightingItem[][]): LightingItem[] {
  const bySku = new Map<string, LightingItem>();

  for (const group of groups) {
    for (const item of group) {
      const prev = bySku.get(item.sku);
      if (prev) {
        bySku.set(item.sku, { ...prev, qty: prev.qty + item.qty });
      } else {
        bySku.set(item.sku, { ...item });
      }
    }
  }

  return Array.from(bySku.values()).filter((item) => item.qty > 0);
}

function isPointFixture(product: FeedCatalogProduct): boolean {
  return product.kind === "SPOT_FIXTURE";
}

function isLamp(product: FeedCatalogProduct): boolean {
  return product.kind === "LAMP";
}

function seededShuffle<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let s = Math.abs(seed) || 1;
  for (let i = out.length - 1; i > 0; i -= 1) {
    s = (s * 1103515245 + 12345) % 2147483647;
    const j = s % (i + 1);
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

function pickRandomProducts<T>(items: T[], seed: number, min = 4, max = 6): T[] {
  if (items.length <= min) return items;
  const count = Math.min(max, Math.max(min, items.length >= max ? max : items.length));
  return seededShuffle(items, seed).slice(0, count);
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
      className={`flex-1 rounded-xl py-2 text-sm font-medium transition-colors ${
        active ? "bg-slate-950 text-white" : "bg-transparent text-slate-600 hover:text-slate-950"
      }`}
    >
      {children}
    </button>
  );
}

function ProductRow({
  product,
  qty,
  onInc,
  onDec,
  children,
}: {
  product: FeedCatalogProduct;
  qty: number;
  onInc: () => void;
  onDec: () => void;
  children?: ReactNode;
}) {
  const regular = product.priceRub;
  const discounted = getDiscountedPrice(regular);
  const benefit = computeBenefit(regular, discounted);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="flex gap-3">
        <ProductImage
          src={product.coverImage}
          alt={product.name}
          containerClassName="h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-2 sm:h-28 sm:w-28"
          className="h-full w-full object-contain"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-5 text-slate-950">{product.name}</p>
          <ul className="mt-1 space-y-0.5">
            {pickDisplayAttributes(product).map((attr) => (
              <li
                key={`${product.productId}-${attr.label}-${attr.value}`}
                className="text-xs text-slate-500"
              >
                {attr.label}: {attr.value}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">
            Цена: {fmt(regular)} ₽{product.unit === "m" ? " / м" : ""}
          </p>
          <p className="text-xs font-semibold text-emerald-700">
            Со скидкой: {fmt(discounted)} ₽{product.unit === "m" ? " / м" : ""}
          </p>
          <p className="text-xs text-emerald-600">Выгода: {fmt(benefit)} ₽</p>
        </div>

        {qty <= 0 ? (
          <button
            type="button"
            onClick={onInc}
            className="shrink-0 rounded-full border border-slate-950 bg-slate-950 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-slate-800"
          >
            + Добавить
          </button>
        ) : (
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onDec}
              className="h-7 w-7 rounded-full border border-slate-200 bg-white text-sm font-semibold text-slate-950 transition-colors hover:bg-slate-50"
              aria-label="Уменьшить количество"
            >
              −
            </button>
            <span className="min-w-[64px] text-center text-sm font-semibold text-slate-950">
              {qty}
              {product.unit === "m" ? " м" : " шт"}
            </span>
            <button
              type="button"
              onClick={onInc}
              className="h-7 w-7 rounded-full border border-slate-200 bg-white text-sm font-semibold text-slate-950 transition-colors hover:bg-slate-50"
              aria-label="Увеличить количество"
            >
              +
            </button>
          </div>
        )}
      </div>

      {children}
    </div>
  );
}

export function WizardStep1Lighting() {
  const { lightingDraft, setLightingDraft, options, goToStep } = useCalculatorModal();
  const { snapshot } = usePriceCalculatorBridge();

  type SnapshotCatalogShape = { products?: FeedCatalogProduct[] };
  const snapshotCatalog = snapshotData as unknown as SnapshotCatalogShape;

  const products = useMemo(
    () =>
      (snapshotCatalog.products ?? []).filter(
        (p) => Number.isFinite(p.priceRub) && p.priceRub > 0
      ) as FeedCatalogProduct[],
    [snapshotCatalog.products]
  );

  const productsById = useMemo(() => buildProductsIndex(products), [products]);

  const derivedInputs = snapshot?.derivedInputs ?? {
    pointSpotsQty: 0,
    trackMountType: "none" as const,
    trackLengthMeters: 0,
    recommendedTrackSpotsQty: 0,
  };

  const initialTab: Tab = options?.initialLightingTab === "catalog" ? "catalog" : "recommendations";
  const initialCatalogView: CatalogView =
    options?.initialLightingView === "selected" ? "selected" : "browse";

  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [catalogView, setCatalogView] = useState<CatalogView>(initialCatalogView);

  const [cartItems, setCartItems] = useState<CartItems>(() => {
    if (lightingDraft?.items?.length) {
      return Object.fromEntries(lightingDraft.items.map((i) => [i.sku, i.qty]));
    }
    return {};
  });

  const [catalogSection, setCatalogSection] = useState<CatalogSection>("track-systems");
  const [trackSystem, setTrackSystem] = useState<TrackSystemUi>("COLIBRI_220");
  const [trackGroup, setTrackGroup] = useState<TrackGroupUi>("TRACK_FIXTURE");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBuiltInSystem, setSelectedBuiltInSystem] = useState<"colibri" | "clarus">("colibri");

  const [pointSeed, setPointSeed] = useState<number>(Date.now());
  const [trackSeed, setTrackSeed] = useState<number>(Date.now() + 777);
  const [lastAddedPointSku, setLastAddedPointSku] = useState<string | null>(null);

  const prevInitialLightingRef = useRef<LightingSnapshot | null | undefined>(undefined);

  useEffect(() => {
    const incoming = options?.initialLighting;
    if (incoming === undefined) return;
    if (incoming === prevInitialLightingRef.current) return;

    prevInitialLightingRef.current = incoming;
    if (!incoming) return;

    if (incoming.mode === "catalog" && incoming.items?.length) {
      const next: CartItems = {};
      for (const item of incoming.items) {
        next[item.sku] = item.qty;
      }
      setCartItems(next);
      setActiveTab("catalog");
      setCatalogView(options?.initialLightingView === "selected" ? "selected" : "browse");
    }
  }, [options?.initialLighting, options?.initialLightingView]);

  const currentTrackSystemFromInputs: FeedCatalogSystem = useMemo(() => {
    if (derivedInputs.trackMountType === "surface") return "TRACK_220";
    return selectedBuiltInSystem === "clarus" ? "CLARUS_48" : "COLIBRI_220";
  }, [derivedInputs.trackMountType, selectedBuiltInSystem]);

  const trackProfilesForSystem = useMemo(() => {
    return products.filter(
      (p) => p.system === currentTrackSystemFromInputs && p.kind === "TRACK_PROFILE" && p.available !== false
    );
  }, [products, currentTrackSystemFromInputs]);

  const trackProfileItems = useMemo(() => {
    if (derivedInputs.trackMountType === "none") return [] as LightingItem[];
    if (derivedInputs.trackLengthMeters <= 0) return [] as LightingItem[];
    return calcProfilesForTrackMeters(derivedInputs.trackLengthMeters, trackProfilesForSystem);
  }, [derivedInputs.trackLengthMeters, derivedInputs.trackMountType, trackProfilesForSystem]);

  const catalogExtrasItems = useMemo<LightingItem[]>(() => {
    const fallbackItems = lightingDraft?.items ?? [];

    return Object.entries(cartItems)
      .filter(([, qty]) => qty > 0)
      .map(([sku, qty]) => {
        const product = productsById.get(sku);
        if (product) {
          return {
            sku,
            name: product.name,
            qty,
            priceRub: product.priceRub,
          };
        }

        const fromDraft = fallbackItems.find((i) => i.sku === sku);
        if (fromDraft) {
          return {
            sku,
            name: fromDraft.name,
            qty,
            priceRub: fromDraft.priceRub,
          };
        }

        return {
          sku,
          name: sku,
          qty,
          priceRub: 0,
        };
      });
  }, [cartItems, lightingDraft?.items, productsById]);

  const mergedItems = useMemo(
    () => mergeItems([trackProfileItems, catalogExtrasItems]),
    [trackProfileItems, catalogExtrasItems]
  );

  useEffect(() => {
    const hasTrackInfrastructure = trackProfileItems.length > 0;
    const hasCatalogExtras = catalogExtrasItems.length > 0;

    if (!hasTrackInfrastructure && !hasCatalogExtras) {
      setLightingDraft({ mode: "none", userCustomizedLighting: false });
      return;
    }

    const totalRub = mergedItems.reduce((sum, item) => sum + item.qty * item.priceRub, 0);
    const discountedTotalRub = applyLightingDiscount(totalRub);

    const draft: LightingSnapshot = {
      mode: "catalog",
      items: mergedItems,
      totalRub,
      discountedTotalRub,
      userCustomizedLighting: true,
      derivedInputsSnapshot: { ...derivedInputs },
    };

    setLightingDraft(draft);
  }, [trackProfileItems, catalogExtrasItems, mergedItems, derivedInputs, setLightingDraft]);

  const setProductQty = (product: FeedCatalogProduct, nextQty: number) => {
    const normalized = normalizeQty(nextQty, product.unit);

    setCartItems((prev) => {
      if (normalized <= 0) {
        return Object.fromEntries(Object.entries(prev).filter(([k]) => k !== product.productId));
      }
      return { ...prev, [product.productId]: normalized };
    });

    if (normalized > 0 && isPointFixture(product)) {
      setLastAddedPointSku(product.productId);
    }
  };

  const selectedViewItems = useMemo(() => {
    return catalogExtrasItems.map((item) => {
      const product = productsById.get(item.sku);
      return { item, product };
    });
  }, [catalogExtrasItems, productsById]);

  const selectedTotals = useMemo(() => {
    const regular = selectedViewItems.reduce((sum, x) => sum + x.item.qty * x.item.priceRub, 0);
    const discounted = getDiscountedPrice(regular);
    return { regular, discounted, benefit: computeBenefit(regular, discounted) };
  }, [selectedViewItems]);

  const lampCandidatesBySocket = useMemo(() => {
    const allLamps = products.filter((p) => isLamp(p) && p.available !== false);
    return {
      GX53: allLamps.filter((p) => detectSocket(p) === "GX53").slice(0, 4),
      MR16: allLamps.filter((p) => detectSocket(p) === "MR16").slice(0, 4),
    };
  }, [products]);

  const pointFixtures = useMemo(() => {
    return products
      .filter((p) => isPointFixture(p))
      .sort((a, b) => {
        const avA = a.available === false ? 0 : 1;
        const avB = b.available === false ? 0 : 1;
        if (avA !== avB) return avB - avA;
        return a.priceRub - b.priceRub;
      });
  }, [products]);

  const browseProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const scoped =
      catalogSection === "track-systems"
        ? products.filter(
            (p) => p.system === trackSystem && p.kind === trackGroup && p.available !== false
          )
        : pointFixtures;

    if (!q) return scoped;

    return scoped.filter((p) => `${p.name} ${p.vendorCode}`.toLowerCase().includes(q));
  }, [catalogSection, pointFixtures, products, searchQuery, trackGroup, trackSystem]);

  const recommendationsPoint = useMemo(
    () => pickRandomProducts(pointFixtures, pointSeed, 4, 6),
    [pointFixtures, pointSeed]
  );

  const recommendationsTrack = useMemo(() => {
    const inSystem = products.filter(
      (p) => p.system === trackSystem && p.kind === "TRACK_FIXTURE" && p.available !== false
    );
    return pickRandomProducts(inSystem, trackSeed, 4, 6);
  }, [products, trackSeed, trackSystem]);

  const handleOpenCatalogTrackFixtures = (system: FeedCatalogSystem) => {
    setActiveTab("catalog");
    setCatalogView("browse");
    setCatalogSection("track-systems");
    setTrackSystem(system === "CLARUS_48" ? "CLARUS_48" : system === "TRACK_220" ? "TRACK_220" : "COLIBRI_220");
    setTrackGroup("TRACK_FIXTURE");
    setSearchQuery("");
  };

  const handleNoLighting = () => {
    setCartItems({});
    setLightingDraft({ mode: "none", userCustomizedLighting: false });
  };

  const recommendationGiftSet = useMemo(() => {
    const pool = recommendationsTrack.concat(recommendationsPoint);
    return new Set(pool.slice(0, 3).map((p) => p.productId));
  }, [recommendationsPoint, recommendationsTrack]);

  const showSelectedFirst =
    activeTab === "catalog" &&
    catalogView === "selected" &&
    (options?.initialLightingView === "selected" || options?.source === "catalog_trek_page") &&
    selectedViewItems.length > 0;

  const recommendedPowerW = Math.ceil((derivedInputs.trackLengthMeters ?? 0) * 20);

  const renderLampSuggestion = (fixture: FeedCatalogProduct, fixtureQty: number) => {
    if (!isPointFixture(fixture) || fixtureQty <= 0) return null;
    const socket = detectSocket(fixture);
    if (!socket) return null;

    const lamps = socket === "GX53" ? lampCandidatesBySocket.GX53 : lampCandidatesBySocket.MR16;
    if (lamps.length === 0) return null;

    return (
      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-medium text-slate-800">
          Подобрать лампы ({socket}): выберите вариант и добавьте 1:1 к корпусам
        </p>
        <div className="mt-2 space-y-2">
          {lamps.map((lamp) => (
            <div
              key={lamp.productId}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-slate-900">{lamp.name}</p>
                <p className="text-xs text-slate-500">
                  {fmt(lamp.priceRub)} ₽ / шт, со скидкой {fmt(getDiscountedPrice(lamp.priceRub))} ₽
                </p>
              </div>
              <button
                type="button"
                onClick={() => setProductQty(lamp, fixtureQty)}
                className="shrink-0 rounded-full border border-slate-900 bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Добавить 1:1
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

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
        <div className="space-y-5">
          <p className="text-xs text-slate-500">
            Подбор по параметрам: {derivedInputs.pointSpotsQty} точечных, трек {derivedInputs.trackLengthMeters} м.п.
          </p>

          {derivedInputs.trackMountType !== "none" && derivedInputs.trackLengthMeters > 0 ? (
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-950">Трековая инфраструктура</p>

              {derivedInputs.trackMountType === "built-in" ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedBuiltInSystem("colibri");
                      setTrackSystem("COLIBRI_220");
                    }}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      selectedBuiltInSystem === "colibri"
                        ? "border-slate-950 bg-slate-950 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
                    }`}
                  >
                    COLIBRI 220V
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedBuiltInSystem("clarus");
                      setTrackSystem("CLARUS_48");
                    }}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      selectedBuiltInSystem === "clarus"
                        ? "border-slate-950 bg-slate-950 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
                    }`}
                  >
                    CLARUS 48V
                  </button>
                </div>
              ) : null}

              <p className="text-xs text-slate-600">
                Профили рассчитаны по длине трека: {Math.round(derivedInputs.trackLengthMeters * 1000)} мм.
              </p>
              <p className="text-xs text-slate-600">
                Рекомендуемая суммарная мощность трековых светильников: не меньше{" "}
                <span className="font-semibold">{recommendedPowerW} Вт</span>.
              </p>

              <button
                type="button"
                onClick={() => handleOpenCatalogTrackFixtures(currentTrackSystemFromInputs)}
                className="rounded-full border border-slate-950 bg-slate-950 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800"
              >
                Выбрать трековые светильники в каталоге
              </button>
            </div>
          ) : null}

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-950">Точечные (рандом)</p>
              <button
                type="button"
                onClick={() => setPointSeed(Date.now())}
                className="text-xs text-slate-600 hover:text-slate-900"
              >
                Показать другие
              </button>
            </div>

            {recommendationsPoint.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm text-slate-600">Не нашли вариант? Откройте каталог точечных.</p>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("catalog");
                    setCatalogView("browse");
                    setCatalogSection("point-fixtures");
                    setSearchQuery("");
                  }}
                  className="mt-2 rounded-full border border-slate-900 px-3 py-1 text-xs font-semibold text-slate-900"
                >
                  Открыть каталог
                </button>
              </div>
            ) : null}

            {recommendationsPoint.map((product) => {
              const qty = cartItems[product.productId] ?? 0;
              return (
                <ProductRow
                  key={product.productId}
                  product={product}
                  qty={qty}
                  onInc={() => setProductQty(product, qty + stepByUnit(product.unit))}
                  onDec={() => setProductQty(product, qty - stepByUnit(product.unit))}
                >
                  {recommendationGiftSet.has(product.productId) ? (
                    <p className="mt-2 text-xs font-medium text-emerald-700">
                      1 светильник в подарок при заказе потолка
                    </p>
                  ) : null}
                  {renderLampSuggestion(product, qty)}
                </ProductRow>
              );
            })}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-950">Трековые (рандом)</p>
              <button
                type="button"
                onClick={() => setTrackSeed(Date.now())}
                className="text-xs text-slate-600 hover:text-slate-900"
              >
                Показать другие
              </button>
            </div>

            {recommendationsTrack.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm text-slate-600">Не нашли вариант? Откройте каталог трековых.</p>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("catalog");
                    setCatalogView("browse");
                    setCatalogSection("track-systems");
                    setTrackGroup("TRACK_FIXTURE");
                    setSearchQuery("");
                  }}
                  className="mt-2 rounded-full border border-slate-900 px-3 py-1 text-xs font-semibold text-slate-900"
                >
                  Открыть каталог
                </button>
              </div>
            ) : null}

            {recommendationsTrack.map((product) => {
              const qty = cartItems[product.productId] ?? 0;
              return (
                <ProductRow
                  key={product.productId}
                  product={product}
                  qty={qty}
                  onInc={() => setProductQty(product, qty + stepByUnit(product.unit))}
                  onDec={() => setProductQty(product, qty - stepByUnit(product.unit))}
                >
                  {recommendationGiftSet.has(product.productId) ? (
                    <p className="mt-2 text-xs font-medium text-emerald-700">
                      1 светильник в подарок при заказе потолка
                    </p>
                  ) : null}
                </ProductRow>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleNoLighting}
            className={`w-full rounded-2xl border p-4 text-left text-sm transition-all ${
              lightingDraft?.mode === "none" || !lightingDraft
                ? "border-slate-950 bg-slate-950 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
            }`}
          >
            Без освещения - только потолок
          </button>

          <p className="text-xs text-slate-400">
            Скидка 15% на всё оборудование при заказе натяжного потолка
          </p>
        </div>
      ) : null}

      {activeTab === "catalog" ? (
        <div className="space-y-4">
          {showSelectedFirst ? (
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-950">Вы выбрали</p>

              {selectedViewItems.map(({ item, product }) => {
                const regular = item.priceRub;
                const discounted = getDiscountedPrice(regular);
                const benefit = computeBenefit(regular, discounted);

                return (
                  <div key={item.sku} className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="flex gap-3">
                      <ProductImage
                        src={product?.coverImage}
                        alt={item.name}
                        containerClassName="h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-2 sm:h-28 sm:w-28"
                        className="h-full w-full object-contain"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-950">{item.name}</p>
                        {product ? (
                          <ul className="mt-1 space-y-0.5">
                            {pickDisplayAttributes(product).map((attr) => (
                              <li
                                key={`${product.productId}-${attr.label}-${attr.value}`}
                                className="text-xs text-slate-500"
                              >
                                {attr.label}: {attr.value}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        <p className="mt-2 text-xs text-slate-500">Qty: {item.qty}</p>
                        <p className="text-xs text-slate-500">Цена: {fmt(regular)} ₽</p>
                        <p className="text-xs font-semibold text-emerald-700">Со скидкой: {fmt(discounted)} ₽</p>
                        <p className="text-xs text-emerald-600">Выгода: {fmt(benefit)} ₽</p>
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800">
                <p>Итого без скидки: {fmt(selectedTotals.regular)} ₽</p>
                <p className="font-semibold text-emerald-700">
                  Итого со скидкой: {fmt(selectedTotals.discounted)} ₽
                </p>
                <p className="text-emerald-600">Ваша выгода: {fmt(selectedTotals.benefit)} ₽</p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCatalogView("browse")}
                  className="flex-1 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:border-slate-500"
                >
                  Добавить еще
                </button>
                <button
                  type="button"
                  onClick={() => goToStep(2)}
                  className="flex-1 rounded-full border border-slate-950 bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Далее
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-3">
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
                      {(["COLIBRI_220", "CLARUS_48", "TRACK_220"] as TrackSystemUi[]).map((sys) => (
                        <button
                          key={sys}
                          type="button"
                          onClick={() => setTrackSystem(sys)}
                          className={`rounded-full border px-3 py-1 text-xs font-medium ${
                            trackSystem === sys
                              ? "border-slate-950 bg-slate-950 text-white"
                              : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
                          }`}
                        >
                          {sys === "COLIBRI_220"
                            ? "COLIBRI 220V (встраиваемая)"
                            : sys === "CLARUS_48"
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
                          className={`rounded-full border px-3 py-1 text-xs font-medium ${
                            trackGroup === group
                              ? "border-slate-950 bg-slate-950 text-white"
                              : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
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
                  placeholder="Поиск в текущем разделе..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                  aria-label="Поиск по каталогу"
                />
              </div>

              <div className="space-y-2">
                {browseProducts.length === 0 ? (
                  <p className="py-4 text-center text-sm text-slate-500">Ничего не найдено</p>
                ) : null}

                {browseProducts.map((product) => {
                  const qty = cartItems[product.productId] ?? 0;

                  return (
                    <ProductRow
                      key={product.productId}
                      product={product}
                      qty={qty}
                      onInc={() => setProductQty(product, qty + stepByUnit(product.unit))}
                      onDec={() => setProductQty(product, qty - stepByUnit(product.unit))}
                    >
                      {renderLampSuggestion(product, qty)}
                    </ProductRow>
                  );
                })}
              </div>
            </>
          )}
        </div>
      ) : null}

      {lastAddedPointSku ? (
        <p className="text-xs text-slate-500">
          Для точечных корпусов можно сразу добавить совместимые лампы 1:1.
        </p>
      ) : null}
    </div>
  );
}
