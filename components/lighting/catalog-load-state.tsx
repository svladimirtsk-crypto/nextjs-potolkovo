"use client";
import { StatePanel } from "@/components/brand/state-panel";
import { Button } from "@/components/ui/button";

export function CatalogLoadState({ loading, onRetry, onBack }: {
  loading: boolean; onRetry: () => void; onBack: () => void;
}) {
  return <StatePanel tone={loading ? "loading" : "error"} announce={loading ? "polite" : "assertive"}
    testId="catalog-load-state" title={loading ? "Загружаем каталог света" : "Каталог не удалось загрузить"}
    description={loading ? "Подождите немного — проверяем данные для показа товаров."
      : "Это ошибка загрузки, а не отсутствие товаров. Повторите попытку без перезагрузки страницы или вернитесь к расчёту потолка."}>
    {loading ? <div className="pk-state-skeleton" aria-hidden="true"><span /><span /><span /></div>
      : <div className="pk-state-actions">
        <Button size="sm" onClick={onRetry}>Повторить загрузку</Button>
        <Button size="sm" variant="secondary" onClick={onBack}>Вернуться к потолку</Button>
      </div>}
  </StatePanel>;
}
