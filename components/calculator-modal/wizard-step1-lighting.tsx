"use client";

import { useEffect, useMemo, useState } from "react";

import type {
  DerivedInputs,
  LightingSnapshot,
} from "@/lib/calculator-modal-types";
import { LIGHTING_KITS, type LightingKit } from "@/lib/lighting-kits";
import { applyLightingDiscount } from "@/lib/lighting-formulas";
import { catalog } from "@/content/eksmarket-assortment";
import { usePriceCalculatorBridge } from "@/components/home/price-calculator-context";
import { useCalculatorModal } from "./calculator-modal-context";

function fmt(n: number) {
  return new Intl.NumberFormat("ru-RU").format(n);
}

/* ─── Recommendation Logic ─── */

function getRecommendedKits(
  derived: DerivedInputs,
  allKits: readonly LightingKit[]
): LightingKit[] {
  const results: LightingKit[] = [];

  if (derived.pointSpotsQty > 0) {
    results.push(
      ...allKits.filter((k) => k.kitCategory === "point").slice(0, 2)
    );
  }

  if (derived.trackMountType === "built-in") {
    results.push(
      ...allKits.filter((k) => k.kitCategory === "track-built-in").slice(0, 2)
    );
  }

  if (derived.trackMountType === "surface") {
    results.push(
      ...allKits.filter((k) => k.kitCategory === "track-surface").slice(0, 1)
    );
  }

  if (results.length === 0) {
    return allKits.slice(0, 3);
  }

  // Deduplicate
  const seen = new Set<string>();
  return results.filter((k) => {
    if (seen.has(k.kitId)) return false;
    seen.add(k.kitId);
    return true;
  });
}

function scaleKitToQty(kit: LightingKit, targetQty: number): LightingSnapshot {
  const items = kit.items.map((item) => {
    if (item.sku === kit.spotsItemSku) {
      return { ...item, qty: targetQty };
    }
    return item;
  });

  const totalRub = items.reduce((sum, i) => sum + i.qty * i.priceRub, 0);

  return {
    mode: "kit",
    kitId: kit.kitId,
    kitName: kit.kitName.replace(/· \d+ спот/, `· ${targetQty} спот`).replace(/· \d+ шт/, `· ${targetQty} шт`),
    items,
    totalRub,
    discountedTotalRub: applyLightingDiscount(totalRub),
    userCustomizedLighting: false,
  };
}

/* ─── Main Component ─── */

export function WizardStep1Lighting() {
  const { snapshot } = usePriceCalculatorBridge();
  const { lightingDraft, setLightingDraft, options } = useCalculatorModal();

  const derivedInputs = snapshot?.derivedInputs;

  const initialTab = options?.initialLightingTab ?? "recommendations";
  const [activeTab, setActiveTab] = useState<"recommendations" | "catalog">(
    initialTab
  );

  // Catalog state
  const [activeCategory, setActiveCategory] = useState<string>(
    catalog.categories[0]?.id ?? "all"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [cartItems, setCartItems] = useState<Record<string, number>>(() => {
    if (lightingDraft?.mode === "catalog" && lightingDraft.items) {
      const cart: Record<string, number> = {};
      lightingDraft.items.forEach((i) => {
        cart[i.sku] = i.qty;
      });
      return cart;
    }
    return {};
  });
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});

  // Recommendations
  const recommendedKits = useMemo(
    () => getRecommendedKits(derivedInputs ?? { pointSpotsQty: 0, trackMountType: "none", trackLengthMeters: 0, recommendedSpotsQty: 0 }, LIGHTING_KITS),
    [derivedInputs]
  );

  const targetQty = useMemo(() => {
    if (!derivedInputs) return 0;
    if (derivedInputs.pointSpotsQty > 0) return derivedInputs.pointSpotsQty;
    if (derivedInputs.recommendedSpotsQty > 0)
      return derivedInputs.recommendedSpotsQty;
    return 0;
  }, [derivedInputs]);

  // Banner: inputs changed
  const inputsChanged =
    lightingDraft?.userCustomizedLighting === true &&
    lightingDraft?.derivedInputsSnapshot !== undefined &&
    derivedInputs !== undefined &&
    (lightingDraft.derivedInputsSnapshot.pointSpotsQty !==
      derivedInputs.pointSpotsQty ||
      lightingDraft.derivedInputsSnapshot.trackMountType !==
      derivedInputs.trackMountType ||
      lightingDraft.derivedInputsSnapshot.trackLengthMeters !==
      derivedInputs.trackLengthMeters);

  const handleResetToRecommendations = () => {
    setLightingDraft(null);
  };

  // Catalog filtering
  const filteredProducts = useMemo(() => {
    return catalog.products.filter((p) => {
      const matchesCategory =
        activeCategory === "all" || p.categoryId === activeCategory;
      const matchesSearch =
        searchQuery === "" ||
        p.title.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  // Sync cart to lightingDraft
  useEffect(() => {
    if (activeTab !== "catalog") return;

    const items = Object.entries(cartItems)
      .filter(([, qty]) => qty > 0)
      .map(([sku, qty]) => {
        const product = catalog.products.find((p) => p.id === sku);
        if (!product || product.priceRub == null) return null;
        return {
          sku,
          name: product.title,
          qty,
          priceRub: product.priceRub,
        };
      })
      .filter(Boolean) as LightingSnapshot["items"];

    if (!items || items.length === 0) {
      if (lightingDraft?.mode === "catalog") {
        setLightingDraft({ ...lightingDraft, items: [], totalRub: 0, discountedTotalRub: 0 });
      }
      return;
    }

    const totalRub = items.reduce((sum, i) => sum + i.qty * i.priceRub, 0);

    setLightingDraft({
      mode: "catalog",
      items,
      totalRub,
      discountedTotalRub: applyLightingDiscount(totalRub),
      userCustomizedLighting: true,
      derivedInputsSnapshot: derivedInputs,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartItems, activeTab]);

  const handleKitSelect = (kit: LightingKit) => {
    const qty = targetQty > 0 ? targetQty : kit.defaultSpotsQty;
    const draft = scaleKitToQty(kit, qty);
    draft.derivedInputsSnapshot = derivedInputs;
    setLightingDraft(draft);
  };

  const handleCartChange = (sku: string, delta: number, priceRub: number | null) => {
    if (priceRub == null) return;
    setCartItems((prev) => {
      const next = { ...prev };
      const current = next[sku] ?? 0;
      const updated = Math.max(0, current + delta);
      if (updated === 0) {
        delete next[sku];
      } else {
        next[sku] = updated;
      }
      return next;
    });
  };

  const toggleExpandCat = (catId: string) => {
    setExpandedCats((prev) => ({ ...prev, [catId]: !prev[catId] }));
  };

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 rounded-2xl bg-slate-100 p-1">
        <TabButton
          active={activeTab === "recommendations"}
          onClick={() => setActiveTab("recommendations")}
          label="Рекомендации"
        />
        <TabButton
          active={activeTab === "catalog"}
          onClick={() => setActiveTab("catalog")}
          label="Каталог"
        />
      </div>

      {/* Banner */}
      {inputsChanged && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 flex items-center justify-between gap-3">
          <span>Параметры потолка изменились</span>
          <button
            type="button"
            onClick={handleResetToRecommendations}
            className="shrink-0 text-xs font-semibold underline underline-offset-2 hover:text-amber-700"
          >
            Обновить
          </button>
        </div>
      )}

      {/* Tab: Recommendations */}
      {activeTab === "recommendations" && (
        <div className="space-y-3">
          {recommendedKits.length === 0 ? (
            <p className="text-sm text-slate-500">
              Задайте параметры потолка на шаге 1, чтобы получить рекомендации.
            </p>
          ) : (
            recommendedKits.map((kit) => {
              const qty = targetQty > 0 ? targetQty : kit.defaultSpotsQty;
              const scaled = scaleKitToQty(kit, qty);
              const selected = lightingDraft?.kitId === kit.kitId && !lightingDraft?.userCustomizedLighting;

              return (
                <div
                  key={kit.kitId}
                  className={`rounded-2xl border p-4 transition-all ${
                    selected
                      ? "border-slate-950 bg-slate-50 ring-1 ring-slate-950"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <p className="text-sm font-semibold text-slate-950 mb-2">
                    {scaled.kitName}
                  </p>
                  <ul className="space-y-1 mb-3">
                    {scaled.items?.map((item) => (
                      <li key={item.sku} className="text-xs text-slate-600 flex justify-between">
                        <span>{item.name}</span>
                        <span className="text-slate-400">× {item.qty}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-slate-950">
                      {fmt(scaled.totalRub ?? 0)} ₽{" "}
                      <span className="text-xs font-normal text-emerald-600">
                        −15%: {fmt(scaled.discountedTotalRub ?? 0)} ₽
                      </span>
                    </p>
                    <button
                      type="button"
                      onClick={() => handleKitSelect(kit)}
                      className={`rounded-xl px-4 py-2 text-sm font-medium min-h-[48px] transition-colors ${
                        selected
                          ? "bg-slate-950 text-white"
                          : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {selected ? "✓ Выбран" : "Выбрать"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab: Catalog */}
      {activeTab === "catalog" && (
        <div className="space-y-4">
          <input
            type="search"
            placeholder="Поиск по названию..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full min-h-[48px] rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
          />

          <div className="flex flex-wrap gap-2">
            <CatTab
              active={activeCategory === "all"}
              onClick={() => setActiveCategory("all")}
              label="Все"
            />
            {catalog.categories.map((cat) => (
              <CatTab
                key={cat.id}
                active={activeCategory === cat.id}
                onClick={() => setActiveCategory(cat.id)}
                label={cat.title}
              />
            ))}
          </div>

          {catalog.categories.map((cat) => {
            const catProducts = filteredProducts.filter(
              (p) => activeCategory === "all" || p.categoryId === cat.id
            );
            if (catProducts.length === 0) return null;

            const isExpanded = expandedCats[cat.id] ?? false;
            const visibleProducts = isExpanded
              ? catProducts
              : catProducts.slice(0, 4);

            return (
              <div key={cat.id} className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  {cat.title}
                </p>
                {visibleProducts.map((product) => {
                  const qty = cartItems[product.id] ?? 0;
                  const noPrice = product.priceRub == null;

                  return (
                    <div
                      key={product.id}
                      className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-950 truncate">
                          {product.title}
                        </p>
                        <p className="text-xs text-slate-500">
                          {noPrice
                            ? "Цена по запросу"
                            : `${fmt(product.priceRub ?? 0)} ₽`}
                        </p>
                      </div>

                      {noPrice ? (
                        <span className="text-xs text-slate-400 px-2">—</span>
                      ) : qty === 0 ? (
                        <button
                          type="button"
                          onClick={() => handleCartChange(product.id, 1, product.priceRub)}
                          className="shrink-0 rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 min-h-[48px]"
                        >
                          Добавить
                        </button>
                      ) : (
                        <div className="shrink-0 flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleCartChange(product.id, -1, product.priceRub)}
                            className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100"
                          >
                            −
                          </button>
                          <span className="w-8 text-center text-sm font-semibold text-slate-950">
                            {qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCartChange(product.id, 1, product.priceRub)}
                            className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100"
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {catProducts.length > 4 && !isExpanded && activeCategory === "all" && (
                  <button
                    type="button"
                    onClick={() => toggleExpandCat(cat.id)}
                    className="text-xs text-slate-500 underline underline-offset-2 hover:text-slate-700"
                  >
                    Показать все ({catProducts.length})
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors min-h-[48px] ${
        active
          ? "bg-white text-slate-950 shadow-sm"
          : "text-slate-600 hover:text-slate-900"
      }`}
    >
      {label}
    </button>
  );
}

function CatTab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 rounded-full text-xs font-medium transition-colors min-h-[48px] ${
        active
          ? "bg-slate-950 text-white"
          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
      }`}
    >
      {label}
    </button>
  );
}
