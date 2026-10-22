"use client";

import { useMemo, useState } from "react";

import type { LightingSnapshot } from "@/lib/calculator-modal-types";
import { getCatalogIndex } from "@/lib/lighting/catalog-index";
import { useCatalogProducts } from "@/lib/lighting/use-catalog-products";
import {
  compareCatalogDraft, acceptCatalogDraftReview, type DraftChange,
} from "@/lib/lighting/catalog-draft-review";

const FIELD_LABELS: Record<DraftChange["field"], string> = {
  missing: "Позиция",
  identity: "Идентификатор товара",
  priceRub: "Цена за единицу",
  vendorCode: "Артикул",
  unit: "Единица продажи",
  packQty: "Упаковка поставщика",
  moscowStock: "Остаток Москвы",
};

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "неизвестно";
  if (typeof value === "number") return new Intl.NumberFormat("ru-RU").format(value);
  return String(value);
}

/** No draft/cart state is changed until this entire review has been accepted. */
export function DraftCatalogReview({
  cart, onAccepted, onBack, onStartNew,
}: {
  cart: LightingSnapshot;
  onAccepted: (cart: LightingSnapshot) => void;
  onBack: () => void;
  onStartNew: () => void;
}) {
  const { index, isLoading, error: loadError, retry } = useCatalogProducts();
  const [actionError, setActionError] = useState<string | null>(null);
  // Derive the comparison from the shared, lazy index. In particular do not
  // mirror the current catalog into useEffect state: it shows stale prices.
  const review = useMemo(() => index ? compareCatalogDraft(cart, index) : null, [cart, index]);

  const accept = async () => {
    if (!review || !review.canApply || loadError || actionError) return;
    try {
      const latest = await getCatalogIndex();
      const accepted = acceptCatalogDraftReview(cart, latest, review, new Date().toISOString());
      if (!accepted) {
        setActionError("Каталог изменился во время проверки. Вернитесь и откройте расчёт снова.");
        return;
      }
      onAccepted(accepted);
    } catch {
      setActionError("Не получилось повторно проверить каталог. Черновик не изменён.");
    }
  };

  return (
    <section data-testid="catalog-draft-review" className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-slate-900">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">Сверка с каталогом · Москва</p>
        <h2 className="mt-1 text-xl font-semibold">Проверьте сохранённый свет</h2>
        <p className="mt-2 text-sm leading-relaxed">
          Цены и наличие поставщика могли измениться. Прежде чем продолжить расчёт, сверим позиции.
          Это не подтверждение склада, резерва или цены окончательного счёта.
        </p>
      </div>

      {isLoading && <p role="status" className="text-sm">Загружаем текущую версию каталога…</p>}
      {loadError && (
        <div role="alert" className="space-y-2 text-sm text-rose-800">
          <p>Каталог не загрузился. Черновик не изменён.</p>
          <button type="button" className="underline" onClick={() => void retry()}>Попробовать снова</button>
        </div>
      )}
      {actionError && <p role="alert" className="text-sm text-rose-800">{actionError}</p>}
      {review && (
        <>
          <p className="break-all text-xs text-slate-600">
            Было: {displayValue(review.fromVersion)} · Сейчас: {displayValue(review.toVersion)}
          </p>
          {review.changes.length > 0 ? (
            <ul className="max-h-72 space-y-2 overflow-y-auto" aria-label="Изменения в сохранённом расчёте">
              {review.changes.map((change, position) => (
                <li key={`${change.sku}-${change.field}-${position}`} data-testid="catalog-draft-diff"
                  className="rounded-xl bg-white p-3 text-sm leading-relaxed ring-1 ring-amber-100">
                  <strong>{change.name}</strong> · {FIELD_LABELS[change.field]}:
                  {" "}{displayValue(change.before)} → {displayValue(change.after)}
                </li>
              ))}
            </ul>
          ) : <p className="text-sm">В выбранных позициях изменений нет. Наличие и резерв всё равно уточним.</p>}
          {!review.canApply && (
            <p role="alert" className="text-sm font-medium text-rose-800">
              Одна из позиций исчезла, помечена недоступной либо изменилась единица/упаковка. Автоматически перенести расчёт нельзя.
              Сохранённый черновик не удалён — вернитесь к выбору или начните новый подбор.
            </p>
          )}
          {review.canApply ? (
            <button type="button" data-testid="catalog-draft-accept" disabled={Boolean(actionError)}
              onClick={() => void accept()} className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
              {review.changes.length > 0 ? "Принять изменения и продолжить" : "Продолжить расчёт"}
            </button>
          ) : (
            <button type="button" data-testid="catalog-draft-start-new" onClick={onStartNew}
              className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">
              Начать новый подбор
            </button>
          )}
        </>
      )}
      <button type="button" data-testid="catalog-draft-back" onClick={onBack}
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium">
        Вернуться к выбору
      </button>
    </section>
  );
}
