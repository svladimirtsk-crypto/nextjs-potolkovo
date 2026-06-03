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

import { detectSocket, getRequiredLampSocket } from "@/lib/feed2-products";
import type { LampSocket } from "@/lib/catalog-ui-config";

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

function resolveProductFromSku(
  skuRaw: string,
  byId: Map<string, FeedCatalogProduct>,
  byVendor: Map<string, string>
): FeedCatalogProduct | null {
  const sku = toText(skuRaw);
  if (!sku) return null;

  const direct = byId.get(sku);
  if (direct) return direct;

  const resolvedId = toText(byVendor.get(sku) ?? "");
  if (!resolvedId) return null;

  return byId.get(resolvedId) ?? null;
}

function sumTrackMetersFromLightingItems(
  items: Array<{ sku: string; qty: number }>,
  byId: Map<string, FeedCatalogProduct>,
  byVendor: Map<string, string>
): number {
  let meters = 0;
  for (const item of items) {
    const qty = toNumber(item.qty);
    if (qty <= 0) continue;

    const product = resolveProductFromSku(item.sku, byId, byVendor);
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
    const qty = toNumber(item.qty);
    if (qty <= 0) continue;

    const product = resolveProductFromSku(item.sku, byId, byVendor);
    if (!product) continue;

    if (product.kind === "SPOT_FIXTURE" || isPanelProduct(product)) qtyTotal += qty;
  }
  return qtyTotal;
}

type Step3Tab = "summary" | "full";

export function WizardStep2Summary() {
  // в проекте контекст расширялся; избегаем расхождения типов
  const modal = useCalculatorModal() as any;

  const goToStep: (n: 0 | 1 | 2) => void = modal.goToStep;
  const setStep1CatalogView: (view: "selected" | "browse" | null) => void =
    modal.setStep1CatalogView;

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

  const { snapshot, setSnapshot } = usePriceCalculatorBridge();

  const lighting = snapshot?.lighting ?? lightingDraft ?? null;

  const lightingItems: CatalogLightingItem[] = useMemo(() => {
    const items = lighting?.mode === "catalog" ? (lighting.items ?? []) : [];
    // нормализуем до нужных типов
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

  // ===== Reminder: lamps 1:1 =====
  const missingLamps = useMemo(() => {
    const required: Record<LampSocket, number> = { GX53: 0, MR16: 0 };
    const current: Record<LampSocket, number> = { GX53: 0, MR16: 0 };

    for (const item of lightingItems) {
      const qty = toNumber(item.qty);
      if (qty <= 0) continue;

      const product = resolveProductFromSku(item.sku, byId, byVendor);
      if (!product) continue;

      // (1) лампы в корзине
      if (product.kind === "LAMP" && product.available !== false && toNumber(product.priceRub) > 0) {
        const sock = detectSocket(product);
        if (sock === "GX53" || sock === "MR16") current[sock] += qty;
      }

      // (2) светильники, которым нужны лампы
      const requiredSocket = getRequiredLampSocket(product);
      if (requiredSocket === "GX53" || requiredSocket === "MR16") {
        required[requiredSocket] += qty;
      }
    }

    const out: Array<{ socket: LampSocket; requiredQty: number; currentQty: number }> = [];
    (["GX53", "MR16"] as LampSocket[]).forEach((socket) => {
      const req = toNumber(required[socket]);
      if (req <= 0) return;

      const cur = toNumber(current[socket]);
      if (cur >= req) return;

      out.push({ socket, requiredQty: req, currentQty: cur });
    });

    return out;
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <TabButton id="summary" label="Коротко" />
          <TabButton id="full" label="Подробно" />
        </div>

        <button
          type="button"
          onClick={handleEditLighting}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50"
        >
          Редактировать свет
        </button>
      </div>

      {!lightingDiscountEligible ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
          <p className="font-semibold">Скидка −15% на свет действует при заказе потолка.</p>
          <p className="mt-2">
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

      {missingLamps.length > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">Напоминание про лампы</p>
          <p className="mt-2 text-amber-900/90">
            Вы выбрали светильники, которым нужны лампы (1:1), но лампы пока не добавлены в нужном количестве.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {missingLamps.map((m) => (
              <li key={m.socket}>
                Не хватает ламп <span className="font-semibold">{m.socket}</span>: нужно{" "}
                <span className="font-semibold">{m.requiredQty}</span> шт., в корзине{" "}
                <span className="font-semibold">{m.currentQty}</span> шт.
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={handleEditLighting}
            className="mt-3 rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100"
          >
            Вернуться к свету и добавить лампы →
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
            <p>
              {showCeilingInUi ? (
                <>Потолок: {fmt(ceilingTotal)} ₽</>
              ) : (
                <>Потолок: — (после шага 1)</>
              )}
            </p>

            {canReconcileInstall && extraInstallTotal > 0 ? (
              <p>Досчёт монтажа: {fmt(extraInstallTotal)} ₽</p>
            ) : null}

            <p className="text-xs text-slate-500">
              В корзине: профиль трека ~{selectedTrackMeters.toFixed(1)} м · точечные {selectedPointQty} шт.
              <br />
              По потолку: трек {derivedTrackFromStep0} м · точечные {derivedPointFromStep0} шт.
            </p>

            <div className="pt-2">
              <p className="font-semibold text-slate-950">Освещение (товары)</p>
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
              ) : (
                <p className="mt-2 text-slate-600">Освещение не выбрано — можно продолжить.</p>
              )}
            </div>

            <div className="border-t border-slate-200 pt-3">
              <p className="text-sm font-semibold text-slate-950">Итого: ~{fmt(grandTotal)} ₽</p>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <p className="font-semibold text-slate-950">Что дальше</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Оставьте заявку — уточним задачу и договоримся о бесплатном замере.</li>
          <li>После замера подтвердим комплектацию и точную стоимость.</li>
          <li>Если нужно — поможем подобрать освещение под ваш интерьер и сценарии.</li>
        </ul>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-base font-semibold text-slate-950">Оставить заявку</p>
        <p className="mt-2 text-sm text-slate-600">
          Можно указать район/метро — так быстрее сориентируемся по выезду.
        </p>
        <div className="mt-4">
          <ActionForm />
        </div>
      </div>
    </div>
  );
}
