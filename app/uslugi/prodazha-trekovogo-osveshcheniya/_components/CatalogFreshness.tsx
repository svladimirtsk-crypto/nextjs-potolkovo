/**
 * N-041 · Свежесть прайса над каталогом (F-44).
 *
 * Пока прайс свежий — мелкая сноска про источник. Когда он перевалил за
 * порог, дата сама по себе клиенту ничего не говорит: нужна не отметка
 * времени, а предупреждение, что цифры могли уехать.
 */
import { isStale } from "@/lib/lighting/catalog-index";

export function CatalogFreshness({ updatedAt }: { updatedAt: string }) {
  if (isStale(updatedAt)) {
    return (
      <p
        data-testid="catalog-stale"
        className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900 ring-1 ring-amber-200"
      >
        Цены могли измениться — уточню перед счётом.
      </p>
    );
  }

  const parsed = new Date(updatedAt);
  const label = Number.isNaN(parsed.getTime())
    ? "актуальную дату уточню"
    : parsed.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

  return (
    <p className="mt-3 text-xs leading-5 text-slate-600">
      Цены и наличие по прайсу поставщика EKS Market на {label}; уточню перед счётом.
    </p>
  );
}
