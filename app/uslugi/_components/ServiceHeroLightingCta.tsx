"use client";

/**
 * T-045 · PT-008 · Вторичное действие героя страницы света.
 *
 * Primary («Собрать комплект») — обычный якорь на каталог `#price`, а здесь
 * открываем калькулятор сразу в режиме lighting-first, чтобы не заставлять
 * человека скроллить и собирать комплект вручную.
 *
 * PT-008: параметры входа берём из `EntryContext` страницы — типизированные
 * `pagePath`, `serviceSlug`, `placement` и происхождение пресета вместо
 * собранной руками строки.
 */
import { useCalculatorModal } from "@/components/calculator-modal/calculator-modal-context";
import { useCalculatorPageContext } from "@/components/calculator-modal/page-context";

export function ServiceHeroLightingCta({ label }: { label: string }) {
  const { openCalculator } = useCalculatorModal();
  const page = useCalculatorPageContext();

  return (
    <button
      type="button"
      data-testid="hero-entry"
      onClick={() =>
        openCalculator(
          page.optionsFor("hero", {
            entryMode: "lighting-first",
            initialStep: 1,
            /**
             * Источник потока продажи треков исторически `track-sale:*` — его
             * читают интро-баннер Шага 0 (`isTrackSaleFlow`) и отчёты по
             * заявкам. PT-008 формат не ломает: строка передаётся явным
             * override, а не собирается в компоненте.
             */
            source: "track-sale:hero",
            /**
             * Пресет страницы света сюда не подмешиваем: вход открывается на
             * Шаге 1 (каталог), а метры трека считаются из подобранных
             * позиций, а не из типового пресета. Поведение до PT-008 — то же.
             */
            preset: undefined,
            presetOrigin: "default",
          })
        )
      }
      className="min-h-11 text-sm font-semibold text-slate-700 underline underline-offset-4 transition-colors hover:text-slate-950"
    >
      {label}
    </button>
  );
}
