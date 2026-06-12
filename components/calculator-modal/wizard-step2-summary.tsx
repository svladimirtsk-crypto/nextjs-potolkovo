"use client";

import { useEffect, useMemo, useState } from "react";

import snapshotData from "@/data/eks-feed2-snapshot.json";
import type { FeedCatalogParam, FeedCatalogProduct } from "@/lib/eks-feed2-catalog";
import { homepage } from "@/content/homepage";

import { applyVendorOverrides } from "@/lib/vendor-code-overrides";
import { calcTrackProfileMeters } from "@/lib/product-length-meters";

import { contacts } from "@/content/contacts";

import { ActionForm } from "@/components/home/action-form";
import { usePriceCalculatorBridge } from "@/components/home/price-calculator-context";
import { useCalculatorModal } from "@/components/calculator-modal/calculator-modal-context";

import { getKitDisplayName } from "@/lib/calculator-modal-types";

type CatalogLightingItem = {
  sku: string;
  name: string;
  qty: number;
  priceRub: number;
};

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
  const modal = useCalculatorModal() as any;

  const goToStep: (n: 0 | 1 | 2) => void = modal.goToStep;
  const setStep1CatalogView: (view: "selected" | "browse" | null) => void =
    modal.setStep1CatalogView;
  const closeCalculator: () => void = modal.closeCalculator;

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

  const ceilingTotal: number = typeof modal.ceilingTotal === "number" ? modal.ceilingTotal : 0;

  const grandTotal: number =
    typeof modal.grandTotal === "number"
      ? modal.grandTotal
      : (showCeilingInUi ? ceilingTotal : 0) + lightingEffectiveTotal;

  const [tab, setTab] = useState<Step3Tab>("summary");
  const [showResult, setShowResult] = useState(false);

  const { snapshot, setSnapshot } = usePriceCalculatorBridge();
  const lighting = snapshot?.lighting ?? lightingDraft ?? null;

  const kitDisplayName = useMemo(() => getKitDisplayName(lighting), [lighting]);

  const lightingItems: CatalogLightingItem[] = useMemo(() => {
    const items = lighting?.mode === "catalog" ? (lighting.items ?? []) : [];
    return (items as any[]).map((x) => ({
      sku: toText((x as any)?.sku),
      name: toText((x as any)?.name),
      qty: toNumber((x as any)?.qty),
      priceRub: toNumber((x as any)?.priceRub),
    }));
  }, [lighting]);

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
    desiredTrackInstallMeters > 0
      ? Math.max(0, desiredTrackInstallCost - includedTrackInstall)
      : 0;
  const extraSpotInstall =
    desiredSpotInstallQty > 0 ? Math.max(0, desiredSpotInstallCost - includedSpotInstall) : 0;

  const extraInstallTotal = extraTrackInstall + extraSpotInstall;

  useEffect(() => {
    if (!canReconcileInstall) return;

    setSnapshot((prev) => {
      if (!prev) return prev;
      const base = toNumber(prev.total);
      const nextGrand = base + extraInstallTotal;
      // Guard: don't mutate if value unchanged (prevents infinite re-renders)
      const prevGrand = toNumber(prev.grandTotal);
      if (Math.abs(prevGrand - nextGrand) < 0.5) return prev;
      return { ...prev, grandTotal: nextGrand };
    });
  }, [canReconcileInstall, extraInstallTotal, setSnapshot]);

  const handleEditLighting = () => {
    setStep1CatalogView("selected");
    goToStep(1);
  };

  const handleGoToCeiling = () => goToStep(0);

  const scrollToInlineForm = () => {
    const el = document.getElementById("modal-action-form");
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <TabButton id="summary" label="Коротко" />
          <TabButton id="full" label="Подробно" />
        </div>

        <button
          type="button"
          onClick={handleEditLighting}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 8h12M8 2v12" />
          </svg>
          Изменить свет
        </button>
      </div>

      {!lightingDiscountEligible ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
          <p className="font-semibold">Свет дешевле с натяжным потолком</p>
          <p className="mt-2">
            При заказе потолка скидка −15% на всё освещение. Укажите параметры потолка — скидка применится автоматически.
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
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          <p className="text-base font-semibold text-slate-950">Итог расчёта</p>

          <div className="mt-3 space-y-2">
            {showCeilingInUi ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <span>Потолок</span>
                  <span className="font-semibold text-slate-950">{fmt(ceilingTotal)} ₽</span>
                </div>

                {canReconcileInstall && extraInstallTotal > 0 ? (
                  <div className="flex items-center justify-between gap-3">
                    <span>Монтаж по свету (досчёт)</span>
                    <span className="font-semibold text-slate-950">{fmt(extraInstallTotal)} ₽</span>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <span>Потолок</span>
                <span className="text-slate-600">— (после шага 1)</span>
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <span>
                Свет{lightingDiscountEligible ? " (со скидкой)" : ""}{" "}
                {!lightingDiscountEligible ? <span className="text-slate-500">(без скидки)</span> : null}
              </span>
              <span className="font-semibold text-slate-950">{fmt(lightingEffectiveTotal)} ₽</span>
            </div>

            <div className="border-t border-slate-200 pt-3">
              <div className="flex items-center justify-between gap-3 text-sm font-semibold text-slate-950">
                <span>Итого</span>
                <span>~{fmt(grandTotal)} ₽</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          <p className="text-base font-semibold text-slate-950">Полный расчёт</p>

          <div className="mt-3 space-y-2">
            <p className="font-semibold text-slate-950">Потолок</p>
            <p>{showCeilingInUi ? <>Потолок: {fmt(ceilingTotal)} ₽</> : <>Потолок: — (после шага 1)</>}</p>

            {canReconcileInstall && extraInstallTotal > 0 ? (
              <p>Досчёт монтажа: {fmt(extraInstallTotal)} ₽</p>
            ) : null}

            {/* P2.6: hide row when both are zero */}
            {(selectedTrackMeters > 0 || selectedPointQty > 0 || derivedTrackFromStep0 > 0 || derivedPointFromStep0 > 0) ? (
              <p className="text-xs text-slate-500">
                {selectedTrackMeters > 0 || selectedPointQty > 0 ? `В корзине: ${selectedTrackMeters > 0 ? `профиль трека ~${selectedTrackMeters.toFixed(1)} м` : ""}${selectedTrackMeters > 0 && selectedPointQty > 0 ? " · " : ""}${selectedPointQty > 0 ? `точечные ${selectedPointQty} шт.` : ""}` : ""}
                {derivedTrackFromStep0 > 0 || derivedPointFromStep0 > 0 ? (
                  <><br />По потолку: {derivedTrackFromStep0 > 0 ? `трек ${derivedTrackFromStep0} м` : ""}{derivedTrackFromStep0 > 0 && derivedPointFromStep0 > 0 ? " · " : ""}{derivedPointFromStep0 > 0 ? `точечные ${derivedPointFromStep0} шт.` : ""}</>
                ) : null}
              </p>
            ) : null}

            <div className="pt-2">
              <p className="font-semibold text-slate-950">
                Освещение (товары){kitDisplayName ? ` — ${kitDisplayName}` : ""}
              </p>

              {/* P2.19: условный рендер только если есть товары */}
              {lightingItems.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {lightingItems.map((item) => (
                    <li key={`${item.sku}-${item.name}`}>
                      <span className="font-medium text-slate-950">{toText(item.name)}</span>
                      <span className="text-slate-600">
                        {" "}
                        — {toNumber(item.qty)} шт. · {fmt(toNumber(item.priceRub))} ₽/шт
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className="border-t border-slate-200 pt-3">
              <p className="text-sm font-semibold text-slate-950">Итого: ~{fmt(grandTotal)} ₽</p>
            </div>
          </div>
        </div>
      )}

      {/* P1.6: Показать kitBaseName */}
      {lighting?.kitBaseName ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <div className="text-xs text-blue-600 font-medium uppercase tracking-wide">
            Готовый комплект
          </div>
          <div className="text-base font-semibold text-slate-950 mt-1">
            {lighting.kitBaseName}
            {lighting.scaledSpotsQty != null ? ` · ${lighting.scaledSpotsQty} шт.` : ""}
          </div>
        </div>
      ) : null}

      {/* P2.13: "Что входит" секция */}
      <details className="rounded-2xl border border-slate-200 bg-white">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-950">
          Что входит в расчёт
        </summary>
        <div className="border-t border-slate-200 px-4 py-3">
          <div className="flex flex-wrap gap-2">
            {["Договор", "Гарантия 2 года", "Монтаж за 1 день", "Уборка после"].map((item) => (
              <span
                key={item}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700"
              >
                ✓ {item}
              </span>
            ))}
          </div>
        </div>
      </details>

      {/* V-35: WhatsApp/Telegram alternative with icons */}
      <div className="flex items-center justify-center gap-4 text-sm">
        <span className="text-slate-500">или напишите</span>
        <a
          href={`https://wa.me/${contacts.phoneDisplay.replace(/\D/g, "")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 01-4.243-1.214L4 20l1.214-3.757A8 8 0 1112 20z"/></svg>
          WhatsApp
        </a>
        <a
          href={contacts.telegramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 font-medium text-blue-600 transition-colors hover:bg-blue-100"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
          Telegram
        </a>
      </div>

      {/* P2.7: "В заявку попадёт ваш расчёт" — accordion */}
      <details className="rounded-2xl border border-slate-200 bg-slate-50">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-950">
          Показать, что попадёт в заявку
        </summary>
        <div className="border-t border-slate-200 px-4 py-3 text-sm text-slate-700">
          <ul className="list-disc space-y-1 pl-5">
            {showCeilingInUi ? (
              <li>Потолок: {fmt(ceilingTotal)} ₽</li>
            ) : null}
            {lightingItems.length > 0 ? (
              <li>Освещение: {lightingItems.length} позиций</li>
            ) : null}
            <li>Итого: ~{fmt(grandTotal)} ₽</li>
          </ul>
        </div>
      </details>

      {/* P1: "What happens next" trust section */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-950">Что происходит дальше</p>
        <div className="mt-3 space-y-2">
          <div className="flex items-start gap-2.5 text-sm text-slate-600">
            <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-slate-950 text-xs font-semibold text-white flex items-center justify-center">1</span>
            <span>Перезвоню, уточню детали и предложу вариант</span>
          </div>
          <div className="flex items-start gap-2.5 text-sm text-slate-600">
            <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-slate-950 text-xs font-semibold text-white flex items-center justify-center">2</span>
            <span>Бесплатный замер — зафиксирую точную стоимость</span>
          </div>
          <div className="flex items-start gap-2.5 text-sm text-slate-600">
            <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-slate-950 text-xs font-semibold text-white flex items-center justify-center">3</span>
            <span>Договор, монтаж за 1 день, гарантия 2 года</span>
          </div>
        </div>
      </div>

      {showResult ? (
        /* P0.8: Success state */
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center" aria-live="polite">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white text-2xl font-bold">
            ✓
          </div>
          <p className="text-lg font-semibold text-emerald-950">Спасибо!</p>
          <p className="mt-1 text-sm text-emerald-800">Перезвоню в течение 15 минут</p>
          <button
            type="button"
            onClick={closeCalculator}
            className="mt-4 rounded-xl bg-emerald-700 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            Хорошо, жду
          </button>
        </div>
      ) : (
        <>
          <div id="modal-action-form" className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-base font-semibold text-slate-950">Записаться на бесплатный замер</p>
            <p className="mt-2 text-sm text-slate-600">
              Оставьте имя и телефон — перезвоню, уточню детали и предложу решение. Можно указать район для быстрой ориентировки по выезду.
            </p>
            <div className="mt-4">
              <ActionForm onSuccess={() => setShowResult(true)} />
            </div>
          </div>

          {/* Price summary line before form — clear context */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center">
            <span className="text-sm text-slate-600">Итого к расчёту: </span>
            <span className="text-lg font-bold text-slate-950">~{fmt(grandTotal)} ₽</span>
            {lightingDiscountEligible ? (
              <span className="ml-2 text-xs font-medium text-emerald-700">скидка −15% на свет</span>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
