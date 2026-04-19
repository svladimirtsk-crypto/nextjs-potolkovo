// components/calculator-modal/wizard-step1-lighting.tsx
"use client";

import { useMemo, useRef, useState, useEffect } from "react";

import { catalog } from "@/content/eksmarket-assortment";
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

function fmt(n: number) {
  return new Intl.NumberFormat("ru-RU").format(n);
}

function getProfileTableForKit(kitId: string): readonly ProfileEntry[] {
  if (kitId.includes("clarus")) return CLARUS_PROFILES;
  if (kitId.includes("colibri")) return COLIBRI_PROFILES;
  return [];
}

function withTrackProfilesByLength(
  kitItems: LightingItem[],
  kitId: string,
  trackLengthMeters: number
): LightingItem[] {
  const profileTable = getProfileTableForKit(kitId);
  if (profileTable.length === 0) return kitItems;

  const profileSkuSet = new Set(profileTable.map((p) => p.sku));
  const withoutFixedProfiles = kitItems.filter((item) => !profileSkuSet.has(item.sku));

  const profilePieces = calcProfilesForTrackMeters(trackLengthMeters, profileTable);
  const profileItems: LightingItem[] = profilePieces.map((piece) => ({
    sku: piece.sku,
    name: `Профиль ${piece.lengthMm} мм`,
    qty: piece.qty,
    priceRub: piece.priceRub ?? 0,
  }));

  return [...profileItems, ...withoutFixedProfiles];
}

function mergeItems(groups: LightingItem[][]): LightingItem[] {
  const map = new Map<string, LightingItem>();

  for (const items of groups) {
    for (const item of items) {
      const existing = map.get(item.sku);
      if (existing) {
        map.set(item.sku, { ...existing, qty: existing.qty + item.qty });
      } else {
        map.set(item.sku, { ...item });
      }
    }
  }

  return Array.from(map.values()).filter((item) => item.qty > 0);
}

function getPointRecommendations() {
  return LIGHTING_KITS.filter((k) => k.kitCategory === "point").slice(0, 3);
}

function getTrackRecommendations(trackMountType: "built-in" | "surface" | "none") {
  if (trackMountType === "built-in") {
    return LIGHTING_KITS.filter((k) => k.kitCategory === "track-built-in").slice(0, 3);
  }
  if (trackMountType === "surface") {
    return LIGHTING_KITS.filter((k) => k.kitCategory === "track-surface").slice(0, 3);
  }
  return [];
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
  kit: typeof LIGHTING_KITS[number];
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
  cartItems,
  onCartChange,
}: {
  cartItems: CartItems;
  onCartChange: (next: CartItems) => void;
}) {
  const [activeCategoryId, setActiveCategoryId] = useState(
    catalog.categories[0]?.id ?? ""
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const HITS_COUNT = 4;

  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return catalog.products.filter(
      (p) =>
        p.categoryId === activeCategoryId &&
        (q === "" || p.title.toLowerCase().includes(q))
    );
  }, [activeCategoryId, searchQuery]);

  const isExpanded = expandedCategories.has(activeCategoryId);
  const visibleProducts = isExpanded
    ? filteredProducts
    : filteredProducts.slice(0, HITS_COUNT);

  const setQty = (sku: string, qty: number) => {
    onCartChange({ ...cartItems, [sku]: Math.max(0, qty) });
  };

  return (
    <div className="space-y-4">
      <input
        type="search"
        placeholder="Поиск по каталогу..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
        aria-label="Поиск по каталогу"
      />

      <div className="flex flex-wrap gap-2">
        {catalog.categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => {
              setActiveCategoryId(cat.id);
              setSearchQuery("");
            }}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              activeCategoryId === cat.id
                ? "border-slate-950 bg-slate-950 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
            }`}
          >
            {cat.title}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {visibleProducts.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center">Ничего не найдено</p>
        ) : null}

        {visibleProducts.map((product) => {
          const qty = cartItems[product.id] ?? 0;
          const hasPrice = product.priceRub !== null;
          const profileLengthMm = product.lengthMm ?? null;

          return (
            <div
              key={product.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-950 leading-5">{product.title}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {profileLengthMm != null ? (
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                      {profileLengthMm} мм
                    </span>
                  ) : null}
                  {hasPrice ? (
                    <span className="text-xs text-slate-500">
                      {fmt(product.priceRub!)} ₽ / шт.
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">Цена по запросу</span>
                  )}
                </div>
              </div>

              {hasPrice ? (
                qty === 0 ? (
                  <button
                    type="button"
                    onClick={() => setQty(product.id, 1)}
                    className="shrink-0 rounded-full border border-slate-950 bg-slate-950 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
                  >
                    + Добавить
                  </button>
                ) : (
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setQty(product.id, qty - 1)}
                      className="h-7 w-7 rounded-full border border-slate-200 bg-white text-sm font-semibold text-slate-950 hover:bg-slate-50 transition-colors"
                      aria-label="Уменьшить количество"
                    >
                      −
                    </button>
                    <span className="w-5 text-center text-sm font-semibold text-slate-950">
                      {qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQty(product.id, qty + 1)}
                      className="h-7 w-7 rounded-full border border-slate-200 bg-white text-sm font-semibold text-slate-950 hover:bg-slate-50 transition-colors"
                      aria-label="Увеличить количество"
                    >
                      +
                    </button>
                  </div>
                )
              ) : (
                <span className="shrink-0 text-xs text-slate-400">—</span>
              )}
            </div>
          );
        })}

        {filteredProducts.length > HITS_COUNT && !isExpanded ? (
          <button
            type="button"
            onClick={() =>
              setExpandedCategories((prev) => new Set([...prev, activeCategoryId]))
            }
            className="w-full rounded-2xl border border-dashed border-slate-200 py-2.5 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-700 transition-colors"
          >
            Показать ещё {filteredProducts.length - HITS_COUNT} позиций
          </button>
        ) : null}
      </div>

      <p className="text-xs text-slate-400">{catalog.disclaimer}</p>
    </div>
  );
}

export function WizardStep1Lighting() {
  const { lightingDraft, setLightingDraft, options } = useCalculatorModal();
  const { snapshot } = usePriceCalculatorBridge();

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
    if (lightingDraft?.mode !== "kit" || !lightingDraft.kitId) return null;
    if (!lightingDraft.kitId.startsWith("combo:")) return lightingDraft.kitId;
    const pair = lightingDraft.kitId.replace("combo:", "");
    const [pointId] = pair.split("|");
    return pointId || null;
  });

  const [selectedTrackKitId, setSelectedTrackKitId] = useState<string | null>(() => {
    if (lightingDraft?.mode !== "kit" || !lightingDraft.kitId) return null;
    if (!lightingDraft.kitId.startsWith("combo:")) return null;
    const pair = lightingDraft.kitId.replace("combo:", "");
    const [, trackId] = pair.split("|");
    return trackId || null;
  });

  const [cartItems, setCartItems] = useState<CartItems>(() => {
    if (lightingDraft?.mode === "catalog" && lightingDraft.items?.length) {
      return Object.fromEntries(lightingDraft.items.map((i) => [i.sku, i.qty]));
    }
    return {};
  });

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
      setSelectedTrackKitId(null);
    } else if (incoming.mode === "kit" && incoming.kitId) {
      if (incoming.kitId.startsWith("combo:")) {
        const pair = incoming.kitId.replace("combo:", "");
        const [pointId, trackId] = pair.split("|");
        setSelectedPointKitId(pointId || null);
        setSelectedTrackKitId(trackId || null);
      } else {
        const found = LIGHTING_KITS.find((k) => k.kitId === incoming.kitId);
        if (found?.kitCategory === "point") setSelectedPointKitId(incoming.kitId);
        if (
          found?.kitCategory === "track-built-in" ||
          found?.kitCategory === "track-surface"
        ) {
          setSelectedTrackKitId(incoming.kitId);
        }
      }
    }
  }, [options?.initialLighting]);

  const pointKits = useMemo(() => getPointRecommendations(), []);
  const trackKits = useMemo(
    () => getTrackRecommendations(derivedInputs.trackMountType),
    [derivedInputs.trackMountType]
  );

  const selectedPointKit = useMemo(
    () => LIGHTING_KITS.find((k) => k.kitId === selectedPointKitId) ?? null,
    [selectedPointKitId]
  );
  const selectedTrackKit = useMemo(
    () => LIGHTING_KITS.find((k) => k.kitId === selectedTrackKitId) ?? null,
    [selectedTrackKitId]
  );

  const pointKitData = useMemo(() => {
    if (!selectedPointKit) return null;
    const targetQty = derivedInputs.pointSpotsQty || selectedPointKit.defaultSpotsQty;
    const scaled = scaleKit(selectedPointKit, targetQty);
    const displayName = `${selectedPointKit.kitBaseName} · ${scaled.scaledSpotsQty} шт.`;
    return { ...scaled, displayName };
  }, [selectedPointKit, derivedInputs.pointSpotsQty]);

  const trackKitData = useMemo(() => {
    if (!selectedTrackKit) return null;
    const targetQty =
      derivedInputs.recommendedTrackSpotsQty || selectedTrackKit.defaultSpotsQty;
    const scaled = scaleKit(selectedTrackKit, targetQty);
    const normalizedItems = withTrackProfilesByLength(
      scaled.items,
      selectedTrackKit.kitId,
      derivedInputs.trackLengthMeters
    );
    const totalRub = normalizedItems.reduce((sum, item) => sum + item.qty * item.priceRub, 0);
    const displayName = `${selectedTrackKit.kitBaseName} · ${scaled.scaledSpotsQty} шт.`;
    return {
      items: normalizedItems,
      totalRub,
      scaledSpotsQty: scaled.scaledSpotsQty,
      displayName,
    };
  }, [
    selectedTrackKit,
    derivedInputs.recommendedTrackSpotsQty,
    derivedInputs.trackLengthMeters,
  ]);

  const catalogExtrasItems = useMemo<LightingItem[]>(() => {
    return Object.entries(cartItems)
      .filter(([, qty]) => qty > 0)
      .map(([sku, qty]) => {
        const product = catalog.products.find((p) => p.id === sku);
        return {
          sku,
          name: product?.title ?? sku,
          qty,
          priceRub: product?.priceRub ?? 0,
        };
      });
  }, [cartItems]);

  const mergedItems = useMemo(() => {
    return mergeItems([
      pointKitData?.items ?? [],
      trackKitData?.items ?? [],
      catalogExtrasItems,
    ]);
  }, [pointKitData, trackKitData, catalogExtrasItems]);

  useEffect(() => {
    const hasPointKit = selectedPointKit !== null;
    const hasTrackKit = selectedTrackKit !== null;
    const hasAnyKit = hasPointKit || hasTrackKit;
    const hasCatalogExtras = catalogExtrasItems.length > 0;

    if (!hasAnyKit && !hasCatalogExtras) {
      setLightingDraft({ mode: "none", userCustomizedLighting: false });
      return;
    }

    const totalRub = mergedItems.reduce((sum, item) => sum + item.qty * item.priceRub, 0);
    const discountedTotalRub = applyLightingDiscount(totalRub);

    if (hasAnyKit) {
      const parts: string[] = [];
      if (pointKitData) parts.push(`Точечные: ${pointKitData.displayName}`);
      if (trackKitData) parts.push(`Трек: ${trackKitData.displayName}`);

      const kitBaseName: string = parts.join(" + ");
      const kitId: string = `combo:${selectedPointKitId ?? ""}|${selectedTrackKitId ?? ""}`;

      const nextDraft: LightingSnapshot = {
        mode: "kit",
        kitId,
        kitBaseName,
        scaledSpotsQty: (pointKitData?.scaledSpotsQty ?? 0) + (trackKitData?.scaledSpotsQty ?? 0),
        items: mergedItems,
        totalRub,
        discountedTotalRub,
        userCustomizedLighting: hasCatalogExtras,
        derivedInputsSnapshot: { ...derivedInputs },
      };
      setLightingDraft(nextDraft);
      return;
    }

    const nextDraft: LightingSnapshot = {
      mode: "catalog",
      items: mergedItems,
      totalRub,
      discountedTotalRub,
      userCustomizedLighting: true,
      derivedInputsSnapshot: { ...derivedInputs },
    };
    setLightingDraft(nextDraft);
  }, [
    selectedPointKit,
    selectedTrackKit,
    selectedPointKitId,
    selectedTrackKitId,
    pointKitData,
    trackKitData,
    catalogExtrasItems,
    mergedItems,
    derivedInputs,
    setLightingDraft,
  ]);

  const handleCartChange = (next: CartItems) => {
    setCartItems(next);
  };

  const handleNoLighting = () => {
    setSelectedPointKitId(null);
    setSelectedTrackKitId(null);
    setCartItems({});
    setLightingDraft({ mode: "none", userCustomizedLighting: false });
  };

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
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-950">Трековое освещение</p>
                <button
                  type="button"
                  onClick={() => setSelectedTrackKitId(null)}
                  className="text-xs text-slate-500 hover:text-slate-900 transition-colors"
                >
                  Без трека
                </button>
              </div>

              {trackKits.map((kit) => (
                <KitCard
                  key={kit.kitId}
                  kit={kit}
                  selected={selectedTrackKitId === kit.kitId}
                  scaledQty={derivedInputs.recommendedTrackSpotsQty || kit.defaultSpotsQty}
                  onSelect={() =>
                    setSelectedTrackKitId((prev) => (prev === kit.kitId ? null : kit.kitId))
                  }
                />
              ))}
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
        <CatalogTab cartItems={cartItems} onCartChange={handleCartChange} />
      ) : null}
    </div>
  );
}
