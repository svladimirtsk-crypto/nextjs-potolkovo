"use client";
import type { LightingItem } from "@/lib/calculator-modal-types";
import { isRetiredCatalogProduct } from "@/lib/catalog-retirement";
import { StatePanel } from "@/components/brand/state-panel";
import { Button } from "@/components/ui/button";

export function retiredLightingItems(items: readonly LightingItem[]): LightingItem[] {
  return items.filter(item => isRetiredCatalogProduct({ vendorCode: item.vendorCode ?? item.sku, productId: item.sku }));
}

/** Keep an old quote visible as history, never silently substitute or sell its withdrawn item. */
export function RetiredCatalogNotice({ items, onRemove, onReview }: {
  items: readonly LightingItem[];
  onRemove?: (sku: string) => void;
  onReview?: () => void;
}) {
  const withdrawn = retiredLightingItems(items);
  if (!withdrawn.length) return null;
  return <StatePanel tone="warning" testId="retired-catalog-notice" title="В расчёте есть снятые позиции"
    description="Они больше не используются и не предлагаются к заказу. Сохранённая сумма может включать их стоимость — проверьте состав. Автоматически ничего не заменяем.">
    <ul className="space-y-3">
      {withdrawn.map(item => <li key={item.sku} className="flex flex-wrap items-center justify-between gap-2">
        <span>{item.name}{item.vendorCode ? ` · ${item.vendorCode}` : ""}</span>
        {onRemove && <Button variant="secondary" size="sm" onClick={() => onRemove(item.sku)}>Убрать из расчёта</Button>}
      </li>)}
    </ul>
    {onReview && <Button className="mt-3" variant="secondary" size="sm" onClick={onReview}>Проверить снятые позиции</Button>}
  </StatePanel>;
}
