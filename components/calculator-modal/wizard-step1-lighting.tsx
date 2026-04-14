"use client";

import { useMemo, useState } from "react";

import { catalog } from "@/content/eksmarket-assortment";
import { LIGHTING_KITS } from "@/lib/lighting-kits";
import type { LightingItem, LightingSnapshot } from "@/lib/calculator-modal-types";
import {
  applyLightingDiscount,
  scaleKitItemQty,
} from "@/lib/lighting-formulas";
import { useCalculatorModal } from "./calculator-modal-context";
import { usePriceCalculatorBridge } from "@/components/home/price-calculator-context";

type Tab = "recommendations" | "catalog";

function fmt(n: number) {
  return new Intl.NumberFormat("ru-RU").format(n);
}

// ── Kit recommendation logic ──────────────────────────────────────────────────

function getRecommendedKits(
  pointSpotsQty: number,
  trackMountType: "built-in" | "surface" | "none"
) {
  const results: typeof LIGHTING_KITS[number][] = [];

  if (pointSpotsQty > 0) {
    const pointKits = LIGHTING_KITS.filter((k) => k.kitCategory === "point");
    results.push(...pointKits.slice(0, 2));
  }

  if (trackMountType === "built-in") {
    const builtInKits = LIGHTING_KITS.filter((k) => k.kitCategory === "track-built-in");
    results.push(...builtInKits.slice(0, 2));
  }

  if (trackMountType === "surface") {
    const surfaceKits = LIGHTING_KITS.filter((k) => k.kitCategory === "track-surface");
    results.push(...surfaceKits.slice(0, 2));
  }

  if (results.length === 0) {
    return LIGHTING_KITS.slice(0, 3);
  }

  // deduplicate by kitId
  const seen = new Set<string>();
  return results.filter((k) => {
    if (seen.has(k.kitId)) return false;
    seen.add(k.kitId);
    return true;
  });
}

function scaleKit(
  kit: typeof LIGHTING_KITS[number],
  targetQty: number
): { items: LightingItem[]; totalRub: number } {
  if (targetQty <= 0 || kit.defaultSpotsQty <= 0) {
    return {
      items: kit.items.map((i) => ({ ...i })),
      totalRub: kit.totalRub,
    };
  }

  const items: LightingItem[] = kit.items.map((i) => {
    const qty =
      i.sku === kit.spotsItemSku
        ? scaleKitItemQty(i.qty, kit.defaultSpotsQty, targetQty)
        : i.qty;
    return { ...i, qty };
  });

  const totalRub = items.reduce((sum, i) => sum + i.qty * i.priceRub, 0);
  return { items, totalRub };
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

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
  const { items, totalRub } = scaleKit(kit, scaledQty);
  const discounted = applyLightingDiscount(totalRub);
  const isScaled = scaledQty > 0 && scaledQty !== kit.defaultSpotsQty;

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
      <p className="text-sm font-semibold text-slate-950">{kit.kitName}</p>

      {isScaled ? (
        <p className="mt-1 text-xs text-blue-600 font-medium">
          Подобрано под {scaledQty} шт.
        </p>
      ) : null}

      <div className="mt-2 space-y-1">
        {items.map((item) => (
          <p key={item.sku} className="text-xs text-slate-500">
            {item.name} × {item.qty} — {fmt(item.priceRub)} ₽/шт.
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

// ── Catalog tab ───────────────────────────────────────────────────────────────

type CartItems = Record<string, number>;

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
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set()
  );

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
      {/* Search */}
      <input
        type="search"
        placeholder="Поиск по каталогу..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
        aria-label="Поиск по каталогу"
      />

      {/* Category tabs */}
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

      {/* Products */}
      <div className="space-y-2">
        {visibleProducts.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center">
            Ничего не найдено
          </p>
        ) : null}

        {visibleProducts.map((product) => {
          const qty = cartItems[product.id] ?? 0;
          const hasPrice = product.priceRub !== null;

          return (
            <div
              key={product.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-950 leading-5">
                  {product.title}
                </p>
                {hasPrice ? (
                  <p className="text-xs text-slate-500 mt-0.5">
                    {fmt(product.priceRub!)} ₽ / шт.
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 mt-0.5">Цена по запросу</p>
                )}
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

      <p className="text-xs text-slate-400">
        {catalog.disclaimer}
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

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
  const [selectedKitId, setSelectedKitId] = useState<string | null>(
    lightingDraft?.mode === "kit" ? (lightingDraft.kitId ?? null) : null
  );
  const [cartItems, setCartItems] = useState<CartItems>(() => {
    if (
      lightingDraft?.mode === "catalog" &&
      lightingDraft.items?.length
    ) {
      return Object.fromEntries(
        lightingDraft.items.map((i) => [i.sku, i.qty])
      );
    }
    return {};
  });

  const recommendedKits = useMemo(
    () =>
      getRecommendedKits(
        derivedInputs.pointSpotsQty,
        derivedInputs.trackMountType
      ),
    [derivedInputs.pointSpotsQty, derivedInputs.trackMountType]
  );

  // Detect if derivedInputs changed since last user customization
  const inputsChanged =
    lightingDraft?.userCustomizedLighting === true &&
    lightingDraft.derivedInputsSnapshot !== undefined &&
    (lightingDraft.derivedInputsSnapshot.pointSpotsQty !== derivedInputs.pointSpotsQty ||
      lightingDraft.derivedInputsSnapshot.trackMountType !== derivedInputs.trackMountType ||
      lightingDraft.derivedInputsSnapshot.trackLengthMeters !== derivedInputs.trackLengthMeters);

  const handleKitSelect = (kit: typeof LIGHTING_KITS[number]) => {
    setSelectedKitId(kit.kitId);

    const targetQty =
      kit.kitCategory === "point"
        ? derivedInputs.pointSpotsQty || kit.defaultSpotsQty
        : derivedInputs.recommendedTrackSpotsQty || kit.defaultSpotsQty;

    const { items, totalRub } = scaleKit(kit, targetQty);
    const discountedTotalRub = applyLightingDiscount(totalRub);

    const draft: LightingSnapshot = {
      mode: "kit",
      kitId: kit.kitId,
      kitName: kit.kitName,
      items,
      totalRub,
      discountedTotalRub,
      userCustomizedLighting: false,
      derivedInputsSnapshot: { ...derivedInputs },
    };
    setLightingDraft(draft);
  };

  const handleCartChange = (next: CartItems) => {
    setCartItems(next);
    setSelectedKitId(null);

    const items: LightingItem[] = Object.entries(next)
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

    const totalRub = items.reduce((sum, i) => sum + i.qty * i.priceRub, 0);
    const discountedTotalRub = applyLightingDiscount(totalRub);

    if (items.length === 0) {
      setLightingDraft({ mode: "none", userCustomizedLighting: false });
      return;
    }

    const draft: LightingSnapshot = {
      mode: "catalog",
      items,
      totalRub,
      discountedTotalRub,
      userCustomizedLighting: true,
      derivedInputsSnapshot: { ...derivedInputs },
    };
    setLightingDraft(draft);
  };

  const handleResetCustomization = () => {
    setSelectedKitId(null);
    if (lightingDraft) {
      setLightingDraft({ ...lightingDraft, userCustomizedLighting: false });
    }
  };

  const handleNoLighting = () => {
    setSelectedKitId(null);
    setCartItems({});
    setLightingDraft({ mode: "none", userCustomizedLighting: false });
  };

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
        <TabButton
          active={activeTab === "recommendations"}
          onClick={() => setActiveTab("recommendations")}
        >
          Рекомендации
        </TabButton>
        <TabButton
          active={activeTab === "catalog"}
          onClick={() => setActiveTab("catalog")}
        >
          Каталог
        </TabButton>
      </div>

      {/* Inputs changed banner */}
      {inputsChanged && activeTab === "recommendations" ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-800 font-medium">
            Параметры потолка изменились
          </p>
          <p className="text-xs text-amber-700 mt-1">
            Обновить подбор под новые параметры?
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleResetCustomization}
              className="rounded-full border border-amber-800 px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition-colors"
            >
              Обновить
            </button>
            <button
              type="button"
              onClick={() => {
                if (lightingDraft) {
                  setLightingDraft({
                    ...lightingDraft,
                    derivedInputsSnapshot: { ...derivedInputs },
                  });
                }
              }}
              className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Оставить
            </button>
          </div>
        </div>
      ) : null}

      {/* Recommendations tab */}
      {activeTab === "recommendations" ? (
        <div className="space-y-3">
          {derivedInputs.trackMountType !== "none" || derivedInputs.pointSpotsQty > 0 ? (
            <p className="text-xs text-slate-500">
              Подобрано по параметрам:{" "}
              {derivedInputs.pointSpotsQty > 0
                ? `${derivedInputs.pointSpotsQty} точечных`
                : null}
              {derivedInputs.pointSpotsQty > 0 && derivedInputs.trackMountType !== "none"
                ? ", "
                : null}
              {derivedInputs.trackMountType !== "none"
                ? `трек ${derivedInputs.trackLengthMeters} м.п.`
                : null}
            </p>
          ) : (
            <p className="text-xs text-slate-500">
              Укажите треки или светильники на шаге потолка — подберём точнее.
            </p>
          )}

          {recommendedKits.map((kit) => {
            const targetQty =
              kit.kitCategory === "point"
                ? derivedInputs.pointSpotsQty || kit.defaultSpotsQty
                : derivedInputs.recommendedTrackSpotsQty || kit.defaultSpotsQty;

            return (
              <KitCard
                key={kit.kitId}
                kit={kit}
                selected={selectedKitId === kit.kitId}
                scaledQty={targetQty}
                onSelect={() => handleKitSelect(kit)}
              />
            );
          })}

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

      {/* Catalog tab */}
      {activeTab === "catalog" ? (
        <CatalogTab cartItems={cartItems} onCartChange={handleCartChange} />
      ) : null}
    </div>
  );
}
