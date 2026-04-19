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
type BuiltInTrackSystem = "colibri" | "clarus";

function fmt(n: number) {
  return new Intl.NumberFormat("ru-RU").format(n);
}

function getBuiltInProfileTable(
  system: BuiltInTrackSystem | null
): readonly ProfileEntry[] {
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

      {selected ? (
        <p className="mt-1 text-xs text-emerald-600 font-medium">✓ Выбран</p>
      ) : null}
    </button>
  );
}

function CatalogTab({
  cartItems,
  onCartChange,
  forcedCategoryId,
}: {
  cartItems: CartItems;
  onCartChange: (next: CartItems) => void;
  forcedCategoryId: string | null;
}) {
  const [activeCategoryId, setActiveCategoryId] = useState(
    forcedCategoryId ?? catalog.categories[0]?.id ?? ""
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    if (!forcedCategoryId) return;
    setActiveCategoryId(forcedCategoryId);
    setSearchQuery("");
  }, [forcedCategoryId]);

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
                <p className="text-sm font-medium text-slate-950 leading-5">
                  {product.title}
                </p>
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
    if (lightingDraft?.mode === "kit" && lightingDraft.kitId?.startsWith("combo:")) {
      const pair = lightingDraft.kitId.replace("combo:", "");
      const [pointId] = pair.split("|");
      return pointId || null;
    }
    return lightingDraft?.mode === "kit" ? (lightingDraft.kitId ?? null) : null;
  });

  const [selectedBuiltInSystem, setSelectedBuiltInSystem] =
    useState<BuiltInTrackSystem>("colibri");

  const [cartItems, setCartItems] = useState<CartItems>(() => {
    if (lightingDraft?.mode === "catalog" && lightingDraft.items?.length) {
      return Object.fromEntries(lightingDraft.items.map((i) => [i.sku, i.qty]));
    }
    return {};
  });

  const [forcedCatalogCategoryId, setForcedCatalogCategoryId] = useState<string | null>(
    null
  );

  const prevInitialLightingRef = useRef<LightingSnapshot | null | undefined>(undefined);

  useEffect(() => {
    const incoming = options?.initialLighting;
    if (incoming === undefined) return;
    if (incoming === prevInitialLightingRef.current) return;

    prevInitialLightingRef.current = incoming;
    if (!incoming) return;

    if (incoming.mode === "catalog" && incoming.items?.length) {
      const next: CartItems = {};
      for (const item of incoming.items) next[item.sku] = item.qty;
      setCartItems(next);
      setSelectedPointKitId(null);
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
        if (found?.kitCategory === "point") {
          setSelectedPointKitId(incoming.kitId);
        }
      }
    }
  }, [options?.initialLighting]);

  useEffect(() => {
    if (derivedInputs.trackMountType !== "built-in") return;
    if (!selectedBuiltInSystem) setSelectedBuiltInSystem("colibri");
  }, [derivedInputs.trackMountType, selectedBuiltInSystem]);

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

    return pieces.map((piece) => ({
      sku: piece.sku,
      name: `Профиль ${piece.lengthMm} мм`,
      qty: piece.qty,
      priceRub: piece.priceRub ?? 0,
    }));
  }, [
    derivedInputs.trackMountType,
    derivedInputs.trackLengthMeters,
    selectedBuiltInSystem,
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

    const totalRub = mergedItems.reduce((sum, i) => sum + i.qty * i.priceRub, 0);
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
  const trackCatalogCategoryId: string =
    derivedInputs.trackMountType === "surface"
      ? "art-220v"
      : selectedBuiltInSystem === "clarus"
      ? "clarus-48v"
      : "colibri-220v";

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
                  setForcedCatalogCategoryId(trackCatalogCategoryId);
                  setActiveTab("catalog");
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
          cartItems={cartItems}
          onCartChange={handleCartChange}
          forcedCategoryId={forcedCatalogCategoryId}
        />
      ) : null}
    </div>
  );
}
