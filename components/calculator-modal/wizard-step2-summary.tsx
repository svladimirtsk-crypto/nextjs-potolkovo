"use client";

import { useEffect, useMemo, useState } from "react";

import snapshotData from "@/data/eks-feed2-snapshot.json";
import type { FeedCatalogParam, FeedCatalogProduct } from "@/lib/eks-feed2-catalog";

import { homepage } from "@/content/homepage";
import { applyVendorOverrides } from "@/lib/vendor-code-overrides";
import { calcTrackProfileMeters } from "@/lib/product-length-meters";

import { ActionForm } from "@/components/home/action-form";
import { usePriceCalculatorBridge } from "@/components/home/price-calculator-context";
import { useCalculatorModal } from "@/components/calculator-modal/calculator-modal-context";

function toText(value: unknown): string {
  return String(value ?? "").trim();
}
function toNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
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
    ? ((p as any).images as unknown[]).map((item) => toText(item)).filter(Boolean)
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

function isPanelProduct(product: FeedCatalogProduct): boolean {
  const text = `${toText(product.name)} ${toText(product.categoryPath)}`.toLowerCase();
  return (
    text.includes("панел") ||
    text.includes("panel") ||
    text.includes("600x600") ||
    text.includes("595x595")
  );
}

function sumTrackMetersFromLightingItems(
  items: Array<{ sku: string; qty: number }>,
  byId: Map<string, FeedCatalogProduct>,
  byVendor: Map<string, string>
): number {
  let meters = 0;

  for (const item of items) {
    const sku = toText(item.sku);
    const qty = toNumber(item.qty);

    const byProduct = byId.get(sku);
    const byVendorId = byVendor.get(sku);
    const resolvedId = byProduct ? sku : toText(byVendorId ?? "");
    if (!resolvedId) continue;

    const product = byId.get(resolvedId);
    if (!product) continue;

    if (product.kind !== "TRACK_PROFILE") continue;
    meters += calcTrackProfileMeters(product, qty);
  }

  return meters;
}

function sumPointQtyFromLightingItems(
  items: Array<{ sku: string; qty: number }>,
  byId: Map<string, FeedCatalogProduct>,
  byVendor: Map<string, string>
): number {
  let qtyTotal = 0;

  for (const item of items) {
    const sku = toText(item.sku);
    const qty = toNumber(item.qty);

    const byProduct = byId.get(sku);
    const byVendorId = byVendor.get(sku);
    const resolvedId = byProduct ? sku : toText(byVendorId ?? "");
    if (!resolvedId) continue;

    const product = byId.get(resolvedId);
    if (!product) continue;

    if (product.kind === "SPOT_FIXTURE" || isPanelProduct(product)) qtyTotal += qty;
  }

  return qtyTotal;
}

type Step3Tab = "summary" | "full";

export function WizardStep2Summary() {
  // NOTE: контекст в проекте мог расширяться; чтобы не ловить TS-регрессии на несовпадении типов,
  // читаем нужные поля через any (UI/логика при этом корректные).
  const modal = useCalculatorModal() as any;

  const goToStep: (n: 0 | 1 | 2) => void = modal.goToStep;
  const setStep1CatalogView: (view: "selected" | "browse" | null) => void = modal.setStep1CatalogView;

  const step0AreaConfirmed: boolean = Boolean(modal.step0AreaConfirmed);
  const step0SessionInteracted: boolean = Boolean(modal.step0SessionInteracted);
  const options: { entryMode?: string } | null = modal.options ?? null;

  const lightingDraft = modal.lightingDraft ?? null;

  const showCeilingInUi: boolean =
    typeof modal.showCeilingInUi === "boolean"
      ? modal.showCeilingInUi
      : options?.entryMode !== "lighting-first" || step0SessionInteracted;

  const lightingEffectiveTotal: number =
    typeof modal.lightingEffectiveTotal === "number"
      ? modal.lightingEffectiveTotal
      : toNumber(modal.lightingDiscountedTotal);

  const lightingDiscountEligible: boolean = Boolean(modal.lightingDiscountEligible);

  const ceilingTotal: number =
    typeof modal.ceilingTotal === "number" ? modal.ceilingTotal : 0;

  const grandTotal: number =
    typeof modal.grandTotal === "number"
      ? modal.grandTotal
      : (showCeilingInUi ? ceilingTotal : 0) + lightingEffectiveTotal;

  const [tab, setTab] = useState<Step3Tab>("summary");

  const { snapshot, setSnapshot } = usePriceCalculatorBridge();

  const lighting = snapshot?.lighting ?? lightingDraft ?? null;
  const lightingItems = lighting?.mode === "catalog" ? (lighting.items ?? []) : [];

  const catalogProducts = useMemo(() => {
    const rawProducts = (snapshotData as { products?: unknown[] })?.products ?? [];
    return rawProducts
      .map((x) => normalizeProduct(x))
      .filter((x): x is FeedCatalogProduct => Boolean(x))
      .map((p) => applyVendorOverrides(p));
  }, []);

  const byId = useMemo(() => {
    const map = new Map<string, FeedCatalogProduct>();
    for (const p of catalogProducts) map.set(toText(p.productId), p);
    return map;
  }, [catalogProducts]);

  const byVendor = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of catalogProducts) {
      const v = toText(p.vendorCode);
      const id = toText(p.productId);
      if (v && id) map.set(v, id);
    }
    return map;
  }, [catalogProducts]);

  const selectedTrackMeters = useMemo(() => {
    return sumTrackMetersFromLightingItems(
      lightingItems.map((i) => ({ sku: i.sku, qty: i.qty })),
      byId,
      byVendor
    );
  }, [byId, byVendor, lightingItems]);

  const selectedPointQty = useMemo(() => {
    return sumPointQtyFromLightingItems(
      lightingItems.map((i) => ({ sku: i.sku, qty: i.qty })),
      byId,
      byVendor
    );
  }, [byId, byVendor, lightingItems]);

  const derivedPointFromStep0 = toNumber(snapshot?.derivedInputs?.pointSpotsQty);
  const derivedTrackFromStep0 = toNumber(snapshot?.derivedInputs?.trackLengthMeters);
  const trackMountType = (snapshot?.derivedInputs?.trackMountType ?? "none") as
    | "built-in"
    | "surface"
    | "none";

  // СТРОГО: досчёт только если Step0 подтверждён (0->1)
  const canReconcileInstall = step0AreaConfirmed;

  const trackRates = homepage.price.calculator.tracks;
  const builtInRate = trackRates.find((t) => t.slug === "built-in")?.ratePerMeter ?? 0;
  const surfaceRate = trackRates.find((t) => t.slug === "surface")?.ratePerMeter ?? 0;
  const resolvedTrackRate = trackMountType === "surface" ? surfaceRate : builtInRate;

  const spotInstallRate = homepage.price.calculator.lights.ratePerUnit;

  const includedTrackInstall = toNumber(snapshot?.trackTotal);
  const includedSpotInstall = toNumber(snapshot?.lightsTotal);

  const desiredTrackInstallMeters = selectedTrackMeters > 0 ? selectedTrackMeters : 0;
  const desiredSpotInstallQty = selectedPointQty > 0 ? selectedPointQty : 0;

  const desiredTrackInstallCost =
    desiredTrackInstallMeters > 0 ? desiredTrackInstallMeters * resolvedTrackRate : 0;
  const desiredSpotInstallCost =
    desiredSpotInstallQty > 0 ? desiredSpotInstallQty * spotInstallRate : 0;

  const extraTrackInstall =
    desiredTrackInstallMeters > 0 ? Math.max(0, desiredTrackInstallCost - includedTrackInstall) : 0;
  const extraSpotInstall =
    desiredSpotInstallQty > 0 ? Math.max(0, desiredSpotInstallCost - includedSpotInstall) : 0;

  const extraInstallTotal = extraTrackInstall + extraSpotInstall;

  // Пишем snapshot.grandTotal = snapshot.total + extraInstallTotal (только если Step0 подтверждён)
  useEffect(() => {
    if (!canReconcileInstall) return;

    setSnapshot((prev) => {
      if (!prev) return prev;
      const base = toNumber(prev.total);
      const nextGrand = base + extraInstallTotal;
      return { ...prev, grandTotal: nextGrand };
    });
  }, [canReconcileInstall, extraInstallTotal, setSnapshot]);

  const handleEditLighting = () => {
    setStep1CatalogView("selected");
    goToStep(1);
  };

  const handleGoToCeiling = () => goToStep(0);

  function TabButton({ id, label }: { id: Step3Tab; label: string }) {
    const active = tab === id;
    return (
      <button
        type="button"
        onClick={() => setTab(id)}
        className={[
          "rounded-xl px-3 py-2 text-xs font-semibold transition-colors",
          active
            ? "bg-slate-950 text-white"
            : "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50",
        ].join(" ")}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <TabButton id="summary" label="Итог" />
        <TabButton id="full" label="Полный расчёт" />
      </div>

      {!lightingDiscountEligible ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
          <p className="font-semibold">Скидка −15% на свет действует при заказе потолка.</p>
          <p className="mt-1 text-blue-900/80">
            Если хотите — подтвердите параметры потолка на шаге 1, и скидка применится автоматически.
          </p>
          <button
            type="button"
            onClick={handleGoToCeiling}
            className="mt-3 rounded-xl bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800"
          >
            Перейти к потолку →
          </button>
        </div>
      ) : null}

      {tab === "summary" ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-base font-semibold text-slate-950">Итог расчёта</p>

          <div className="mt-3 space-y-1 text-sm">
            {showCeilingInUi ? (
              <>
                <p className="text-slate-800">
                  Потолок: <span className="font-semibold text-slate-950">{fmt(ceilingTotal)} ₽</span>
                </p>

                {canReconcileInstall && extraInstallTotal > 0 ? (
                  <p className="text-slate-800">
                    Монтаж по свету (досчёт):{" "}
                    <span className="font-semibold text-slate-950">{fmt(extraInstallTotal)} ₽</span>
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-slate-800">
                Потолок: <span className="font-semibold text-slate-950">—</span>{" "}
                <span className="text-xs text-slate-500">(после шага 1)</span>
              </p>
            )}

            <p className={lightingDiscountEligible ? "text-emerald-700" : "text-slate-800"}>
              Свет{lightingDiscountEligible ? " (со скидкой)" : ""}:{" "}
              <span className="font-semibold">{fmt(lightingEffectiveTotal)} ₽</span>
              {!lightingDiscountEligible ? <span className="text-xs text-slate-500"> (без скидки)</span> : null}
            </p>

            <p className="mt-2 text-base font-semibold text-slate-950">Итого: ~{fmt(grandTotal)} ₽</p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="text-base font-semibold text-slate-950">Полный расчёт</p>

            <button
              type="button"
              onClick={handleEditLighting}
              className="shrink-0 rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Редактировать свет
            </button>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-950">Потолок</p>

              <p className="mt-2 text-sm text-slate-700">
                {showCeilingInUi ? (
                  <>
                    Потолок: <span className="font-semibold text-slate-950">{fmt(ceilingTotal)} ₽</span>
                  </>
                ) : (
                  <>
                    Потолок: <span className="font-semibold text-slate-950">—</span>{" "}
                    <span className="text-xs text-slate-500">(после шага 1)</span>
                  </>
                )}
              </p>

              {canReconcileInstall && extraInstallTotal > 0 ? (
                <p className="mt-1 text-sm text-slate-700">
                  Досчёт монтажа: <span className="font-semibold text-slate-950">{fmt(extraInstallTotal)} ₽</span>
                </p>
              ) : null}

              <p className="mt-3 text-xs text-slate-500">
                В корзине: профиль трека ~{selectedTrackMeters.toFixed(1)} м · точечные {selectedPointQty} шт.
              </p>

              <p className="mt-1 text-xs text-slate-500">
                По потолку: трек {derivedTrackFromStep0} м · точечные {derivedPointFromStep0} шт.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-950">Освещение (товары)</p>

              {lightingItems.length > 0 ? (
                <ul className="mt-2 space-y-2 text-sm text-slate-800">
                  {lightingItems.map((item) => (
                    <li key={toText(item.sku)} className="rounded-xl border border-slate-200 bg-white p-3">
                      <p className="font-medium text-slate-950 break-words">{toText(item.name)}</p>
                      <p className="mt-2 text-xs text-slate-700">
                        Кол-во: <span className="font-semibold">{toNumber(item.qty)}</span> · Цена:{" "}
                        <span className="font-semibold">{fmt(toNumber(item.priceRub))} ₽</span>
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-slate-600">Освещение не выбрано — можно продолжить.</p>
              )}
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-950">Итого</p>
            <p className="mt-2 text-base font-semibold text-slate-950">~{fmt(grandTotal)} ₽</p>
          </div>
        </div>
      )}

      {/* B6: “что дальше” — без обещаний сроков/гарантий */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-950">Что дальше</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li>Оставьте заявку — уточним задачу и договоримся о бесплатном замере.</li>
          <li>После замера подтвердим комплектацию и точную стоимость.</li>
          <li>Если нужно — поможем подобрать освещение под ваш интерьер и сценарии.</li>
        </ul>
      </div>

      {/* A2: inline форма внутри модалки */}
      <div id="modal-action-form" className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-base font-semibold text-slate-950">Оставить заявку</p>
        <p className="mt-1 text-sm text-slate-600">
          Можно указать район/метро — так быстрее сориентируемся по выезду.
        </p>

        <div className="mt-4">
          <ActionForm source="calculator-modal" />
        </div>
      </div>
    </div>
  );
}
