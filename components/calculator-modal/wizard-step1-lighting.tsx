"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import snapshotData from "@/data/eks-feed2-snapshot.json";
import type { FeedCatalogProduct, FeedCatalogResult, FeedCatalogSystem } from "@/lib/eks-feed2-catalog";
import {
  LIGHTING_KITS,
  COLIBRI_PROFILES,
  CLARUS_PROFILES,
  calcProfilesForTrackMeters,
  scaleKit,
  type ProfileEntry,
} from "@/lib/lighting-kits";
import type { LightingItem, LightingSnapshot } from "@/lib/calculator-modal-types";
import { applyLightingDiscount } from "@/lib/lighting-formulas";
import { useCalculatorModal } from "./calculator-modal-context";
import { usePriceCalculatorBridge } from "@/components/home/price-calculator-context";

type Tab = "recommendations" | "catalog";
type CartItems = Record<string, number>;
type BuiltInTrackSystem = "colibri" | "clarus";
type KindFilter = "all" | FeedCatalogProduct["kind"];

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

function getBuiltInProfileTable(system: BuiltInTrackSystem | null): readonly ProfileEntry[] {
  if (system === "clarus") return CLARUS_PROFILES;
  if (system === "colibri") return COLIBRI_PROFILES;
  return [];
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

function getPointKits() {
  return LIGHTING_KITS.filter((k) => k.kitCategory === "point").slice(0, 3);
}

function normalizeSystemFromTrack(
  trackMountType: "built-in" | "surface" | "none",
  builtInSystem: BuiltInTrackSystem
): FeedCatalogSystem {
  if (trackMountType === "surface") return "TRACK_220";
  return builtInSystem === "clarus" ? "CLARUS_48" : "COLIBRI_220";
}

function stepByUnit(unit: "pcs" | "m"): number {
  return unit === "m" ? 0.5 : 1;
}

function minByUnit(unit: "pcs" | "m"): number {
  return unit === "m" ? 0.5 : 1;
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

function getKindLabel(kind: FeedCatalogProduct["kind"]): string {
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

function pickDisplayAttributes(product: FeedCatalogProduct) {
  if (Array.isArray(product.keyAttributes) && product.keyAttributes.length > 0) {
    return product.keyAttributes.slice(0, 4);
  }
  return (product.params ?? []).slice(0, 4);
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-xl py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-slate-950 text-white"
          : "bg-transparent text-slate-600 hover:text-slate-950"
      }`}
    >
      {children}
    </button>
  );
}

function KitCard({
  kit,
  selected,
  scaledQty,
  onSelect,
}: {
  kit: (typeof LIGHTING_KITS)[number];
  selected: boolean;
  scaledQty: number;
  onSelect: () => void;
}) {
  const { items, totalRub, scaledSpotsQty } = scaleKit(kit, scaledQty);
  const discounted = applyLightingDiscount(totalRub);
  const displayName = `${kit.kitBaseName} · ${scaledSpotsQty} шт.`;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`w-full text-left rounded-2xl border p-4 transition-all focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
        selected
          ? "border-slate-950 bg-slate-50 ring-1 ring-slate-950"
          : "border-slate-200 bg-white hover:border-slate-400"
      }`}
    >
      <p className="text-sm font-semibold text-slate-950">{displayName}</p>

      <div className="mt-2 space-y-1">
        {items.map((item) => (
          <p key={item.sku} className="text-xs text-slate-500">
            {item.name} &times; {item.qty} — {fmt(item.priceRub)} ₽/шт.
          </p>
        ))}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <p className="text-sm font-bold text-slate-950">{fmt(discounted)} ₽</p>
        <p className="text-xs text-slate-400 line-through">{fmt(totalRub)} ₽</p>
        <span className="text-xs text-emerald-600 font-medium">−15%</span>
      </div>

      {selected ? <p className="mt-1 text-xs text-emerald-600 font-medium">✓ Выбран</p> : null}
    </button>
  );
}

function CatalogTab({
  products,
  cartItems,
  onCartChange,
  systemFilter,
  kindFilter,
  searchQuery,
  onSystemFilterChange,
  onKindFilterChange,
  onSearchQueryChange,
}: {
  products: FeedCatalogProduct[];
  cartItems: CartItems;
  onCartChange: (next: CartItems) => void;
  systemFilter: FeedCatalogSystem | "all";
  kindFilter: KindFilter;
  searchQuery: string;
  onSystemFilterChange: (next: FeedCatalogSystem | "all") => void;
  onKindFilterChange: (next: KindFilter) => void;
  onSearchQueryChange: (next: string) => void;
}) {
  const systems = useMemo(
    () => Array.from(new Set(products.map((p) => p.system))),
    [products]
  );

  const kinds = useMemo(
    () => Array.from(new Set(products.map((p) => p.kind))),
    [products]
  );

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return products.filter((p) => {
      if (systemFilter !== "all" && p.system !== systemFilter) return false;
      if (kindFilter !== "all" && p.kind !== kindFilter) return false;
      if (!q) return true;

      const hay = `${p.name} ${p.vendorCode}`.toLowerCase();
      return hay.includes(q);
    });
  }, [products, searchQuery, systemFilter, kindFilter]);

  const setQty = (product: FeedCatalogProduct, qty: number) => {
    const step = stepByUnit(product.unit);
    const normalized = Math.max(0, Math.round(qty / step) * step);

    onCartChange(
      normalized <= 0
        ? Object.fromEntries(Object.entries(cartItems).filter(([k]) => k !== product.productId))
        : { ...cartItems, [product.productId]: normalized }
    );
  };

  return (
    <div className="space-y-4">
      <input
        type="search"
        placeholder="Поиск по каталогу..."
        value={searchQuery}
        onChange={(e) => onSearchQueryChange(e.target.value)}
        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
        aria-label="Поиск по каталогу"
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onSystemFilterChange("all")}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            systemFilter === "all"
              ? "border-slate-950 bg-slate-950 text-white"
              : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
          }`}
        >
          Все системы
        </button>
        {systems.map((system) => (
          <button
            key={system}
            type="button"
            onClick={() => onSystemFilterChange(system)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              systemFilter === system
                ? "border-slate-950 bg-slate-950 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
            }`}
          >
            {getSystemLabel(system)}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onKindFilterChange("all")}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            kindFilter === "all"
              ? "border-slate-950 bg-slate-950 text-white"
              : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
          }`}
        >
          Все типы
        </button>
        {kinds.map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => onKindFilterChange(kind)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              kindFilter === kind
                ? "border-slate-950 bg-slate-950 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
            }`}
          >
            {getKindLabel(kind)}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filteredProducts.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center">Ничего не найдено</p>
        ) : null}

        {filteredProducts.map((product) => {
          const qty = cartItems[product.productId] ?? 0;
          const regular = product.priceRub;
          const discounted = applyLightingDiscount(regular);
          const benefit = Math.max(0, regular - discounted);
          const src: string = String(product.coverImage || IMG_FALLBACK);

          return (
            <div
              key={product.productId}
              className="rounded-2xl border border-slate-200 bg-white p-3"
            >
              <div className="flex gap-3">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-100 bg-slate-50">
                  <img
                    src={src}
                    alt={product.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      const img = e.currentTarget;
                      img.onerror = null;
                      img.src = IMG_FALLBACK;
                    }}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-950 leading-5">{product.name}</p>
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
                    onClick={() => setQty(product, minByUnit(product.unit))}
                    className="shrink-0 rounded-full border border-slate-950 bg-slate-950 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
                  >
                    + Добавить
                  </button>
                ) : (
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setQty(product, qty - stepByUnit(product.unit))}
                      className="h-7 w-7 rounded-full border border-slate-200 bg-white text-sm font-semibold text-slate-950 hover:bg-slate-50 transition-colors"
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
                      onClick={() => setQty(product, qty + stepByUnit(product.unit))}
                      className="h-7 w-7 rounded-full border border-slate-200 bg-white text-sm font-semibold text-slate-950 hover:bg-slate-50 transition-colors"
                      aria-label="Увеличить количество"
                    >
                      +
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function WizardStep1Lighting() {
  const { lightingDraft, setLightingDraft, options } = useCalculatorModal();
  const { snapshot } = usePriceCalculatorBridge();

  const snapshotCatalog = snapshotData as FeedCatalogResult;
  const products = useMemo(
    () =>
      (snapshotCatalog.products ?? []).filter(
        (p) => Number.isFinite(p.priceRub) && p.priceRub > 0
      ) as FeedCatalogProduct[],
    [snapshotCatalog.products]
  );

  const productsById = useMemo(
    () => new Map(products.map((p) => [p.productId, p])),
    [products]
  );

  const derivedInputs = snapshot?.derivedInputs ?? {
    pointSpotsQty: 0,
    trackMountType: "none" as const,
    trackLengthMeters: 0,
    recommendedTrackSpotsQty: 0,
  };

  const initialTab: Tab =
    options?.initialLightingTab === "catalog" ? "catalog" : "recommendations";

  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  const [selectedPointKitId, setSelectedPointKitId] = useState<string | null>(() => {
    if (lightingDraft?.mode !== "kit") return null;
    if (!lightingDraft.kitId) return null;
    if (!lightingDraft.kitId.startsWith("combo:")) return lightingDraft.kitId;

    const pair = lightingDraft.kitId.replace("combo:", "");
    const [pointId] = pair.split("|");
    return pointId || null;
  });

  const [selectedBuiltInSystem, setSelectedBuiltInSystem] =
    useState<BuiltInTrackSystem>("colibri");

  const [cartItems, setCartItems] = useState<CartItems>(() => {
    if (lightingDraft?.items?.length) {
      return Object.fromEntries(lightingDraft.items.map((i) => [i.sku, i.qty]));
    }
    return {};
  });

  const [systemFilter, setSystemFilter] = useState<FeedCatalogSystem | "all">("all");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

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
      setSelectedPointKitId(null);
      setActiveTab("catalog");
      return;
    }

    if (incoming.mode === "kit" && incoming.kitId) {
      if (incoming.kitId.startsWith("combo:")) {
        const pair = incoming.kitId.replace("combo:", "");
        const [pointId, systemId] = pair.split("|");
        setSelectedPointKitId(pointId || null);
        if (systemId === "clarus" || systemId === "colibri") {
          setSelectedBuiltInSystem(systemId);
        }
      } else {
        const found = LIGHTING_KITS.find((k) => k.kitId === incoming.kitId);
        if (found?.kitCategory === "point") setSelectedPointKitId(incoming.kitId);
      }
    }
  }, [options?.initialLighting]);

  const pointKits = useMemo(() => getPointKits(), []);

  const selectedPointKit = useMemo(
    () => LIGHTING_KITS.find((k) => k.kitId === selectedPointKitId) ?? null,
    [selectedPointKitId]
  );

  const pointKitItems = useMemo(() => {
    if (!selectedPointKit) return [] as LightingItem[];
    const targetQty = derivedInputs.pointSpotsQty || selectedPointKit.defaultSpotsQty;
    return scaleKit(selectedPointKit, targetQty).items;
  }, [selectedPointKit, derivedInputs.pointSpotsQty]);

  const trackProfileItems = useMemo(() => {
    if (derivedInputs.trackMountType !== "built-in") return [] as LightingItem[];
    if (derivedInputs.trackLengthMeters <= 0) return [] as LightingItem[];

    const table = getBuiltInProfileTable(selectedBuiltInSystem);
    const pieces = calcProfilesForTrackMeters(derivedInputs.trackLengthMeters, table);

    return pieces.map((piece) => {
      const product = productsById.get(piece.sku);
      return {
        sku: piece.sku,
        name: product?.name ?? `Профиль ${piece.lengthMm} мм`,
        qty: piece.qty,
        priceRub: product?.priceRub ?? piece.priceRub ?? 0,
      };
    });
  }, [
    derivedInputs.trackMountType,
    derivedInputs.trackLengthMeters,
    selectedBuiltInSystem,
    productsById,
  ]);

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
  }, [cartItems, productsById, lightingDraft?.items]);

  const mergedItems = useMemo(
    () => mergeItems([pointKitItems, trackProfileItems, catalogExtrasItems]),
    [pointKitItems, trackProfileItems, catalogExtrasItems]
  );

  useEffect(() => {
    const hasPointKit = selectedPointKit !== null;
    const hasTrackInfrastructure = trackProfileItems.length > 0;
    const hasCatalogExtras = catalogExtrasItems.length > 0;

    if (!hasPointKit && !hasTrackInfrastructure && !hasCatalogExtras) {
      setLightingDraft({ mode: "none", userCustomizedLighting: false });
      return;
    }

    const totalRub = mergedItems.reduce((sum, item) => sum + item.qty * item.priceRub, 0);
    const discountedTotalRub = applyLightingDiscount(totalRub);

    if (hasPointKit || hasTrackInfrastructure) {
      const kitParts: string[] = [];

      if (selectedPointKit) {
        const targetQty = derivedInputs.pointSpotsQty || selectedPointKit.defaultSpotsQty;
        kitParts.push(`Точечные: ${selectedPointKit.kitBaseName} · ${targetQty} шт.`);
      }

      if (hasTrackInfrastructure && derivedInputs.trackMountType === "built-in") {
        const sys = selectedBuiltInSystem === "clarus" ? "CLARUS" : "COLIBRI";
        const mm = Math.round(derivedInputs.trackLengthMeters * 1000);
        kitParts.push(`Трек: ${sys} профили ${mm} мм`);
      }

      const kitBaseName: string = kitParts.join(" + ");
      const kitId: string = `combo:${selectedPointKitId ?? ""}|${
        hasTrackInfrastructure ? selectedBuiltInSystem : ""
      }`;

      const draft: LightingSnapshot = {
        mode: "kit",
        kitId,
        kitBaseName,
        items: mergedItems,
        totalRub,
        discountedTotalRub,
        userCustomizedLighting: hasCatalogExtras,
        derivedInputsSnapshot: { ...derivedInputs },
      };

      setLightingDraft(draft);
      return;
    }

    const draft: LightingSnapshot = {
      mode: "catalog",
      items: mergedItems,
      totalRub,
      discountedTotalRub,
      userCustomizedLighting: true,
      derivedInputsSnapshot: { ...derivedInputs },
    };

    setLightingDraft(draft);
  }, [
    selectedPointKit,
    selectedPointKitId,
    selectedBuiltInSystem,
    derivedInputs,
    trackProfileItems,
    catalogExtrasItems,
    mergedItems,
    setLightingDraft,
  ]);

  const handleCartChange = (next: CartItems) => {
    setCartItems(next);
  };

  const handleNoLighting = () => {
    setSelectedPointKitId(null);
    setCartItems({});
    setLightingDraft({ mode: "none", userCustomizedLighting: false });
  };

  const recommendedPowerW = Math.ceil((derivedInputs.trackLengthMeters ?? 0) * 20);

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
        <TabButton
          active={activeTab === "recommendations"}
          onClick={() => setActiveTab("recommendations")}
        >
          Рекомендации
        </TabButton>
        <TabButton active={activeTab === "catalog"} onClick={() => setActiveTab("catalog")}>
          Каталог
        </TabButton>
      </div>

      {activeTab === "recommendations" ? (
        <div className="space-y-5">
          <p className="text-xs text-slate-500">
            Подбор по параметрам: {derivedInputs.pointSpotsQty} точечных, трек{" "}
            {derivedInputs.trackLengthMeters} м.п.
          </p>

          {derivedInputs.pointSpotsQty > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-950">Точечные светильники</p>
                <button
                  type="button"
                  onClick={() => setSelectedPointKitId(null)}
                  className="text-xs text-slate-500 hover:text-slate-900 transition-colors"
                >
                  Без точечных
                </button>
              </div>

              {pointKits.map((kit) => (
                <KitCard
                  key={kit.kitId}
                  kit={kit}
                  selected={selectedPointKitId === kit.kitId}
                  scaledQty={derivedInputs.pointSpotsQty || kit.defaultSpotsQty}
                  onSelect={() =>
                    setSelectedPointKitId((prev) => (prev === kit.kitId ? null : kit.kitId))
                  }
                />
              ))}
            </div>
          ) : null}

          {derivedInputs.trackMountType !== "none" && derivedInputs.trackLengthMeters > 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <p className="text-sm font-semibold text-slate-950">Трековая инфраструктура</p>

              {derivedInputs.trackMountType === "built-in" ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedBuiltInSystem("colibri")}
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
                    onClick={() => setSelectedBuiltInSystem("clarus")}
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
                Профили подобраны по длине трека: {Math.round(derivedInputs.trackLengthMeters * 1000)} мм.
              </p>
              <p className="text-xs text-slate-600">
                Рекомендуемая суммарная мощность трековых светильников: не меньше{" "}
                <span className="font-semibold">{recommendedPowerW} Вт</span>.
              </p>

              <button
                type="button"
                onClick={() => {
                  const forcedSystem = normalizeSystemFromTrack(
                    derivedInputs.trackMountType,
                    selectedBuiltInSystem
                  );
                  setActiveTab("catalog");
                  setSystemFilter(forcedSystem);
                  setKindFilter("TRACK_FIXTURE");
                  setSearchQuery("");
                }}
                className="rounded-full border border-slate-950 bg-slate-950 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
              >
                Выбрать трековые светильники в каталоге
              </button>
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleNoLighting}
            className={`w-full text-left rounded-2xl border p-4 transition-all text-sm ${
              lightingDraft?.mode === "none" || !lightingDraft
                ? "border-slate-950 bg-slate-950 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
            }`}
          >
            Без освещения — только потолок
          </button>

          <p className="text-xs text-slate-400">
            Скидка 15% на всё оборудование при заказе натяжного потолка
          </p>
        </div>
      ) : null}

      {activeTab === "catalog" ? (
        <CatalogTab
          products={products}
          cartItems={cartItems}
          onCartChange={handleCartChange}
          systemFilter={systemFilter}
          kindFilter={kindFilter}
          searchQuery={searchQuery}
          onSystemFilterChange={setSystemFilter}
          onKindFilterChange={setKindFilter}
          onSearchQueryChange={setSearchQuery}
        />
      ) : null}
    </div>
  );
}
