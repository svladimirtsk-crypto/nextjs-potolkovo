"use client";

import type { TrackSystemId } from "@/lib/catalog-ui-config";

/**
 * N-051 · Экраны Шага 1, вынесенные из `wizard-step1-lighting.tsx`.
 *
 * Компонент мастера был одним `return` с девятью инлайн-условиями на 750
 * строк JSX. Разметка экранов не зависит от внутреннего состояния мастера —
 * только от переданных данных, поэтому её можно держать отдельно.
 */

/**
 * Экран «нет данных с Шага 0»: трек и точки не заданы, подбирать нечего.
 *
 * Раньше эта разметка была продублирована дословно в двух ветках — для шага
 * `none` и для случая, когда у выбранного типа монтажа нет ни одной системы.
 * Копии успели разойтись: в одной из них клик по «Открыть каталог» не помечал
 * мастер тронутым, из-за чего подсказки комплектующих потом вели себя иначе.
 */
export function ManualPickScreen({
  onOpenCatalog,
  onSkipToSummary,
}: {
  onOpenCatalog: () => void;
  onSkipToSummary: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
      <p className="font-semibold text-slate-950">Освещение можно подобрать вручную</p>
      <p className="mt-1 leading-5">
        На шаге потолка не задан трек или количество точечных светильников. Откройте каталог,
        если хотите добавить свет, или сразу переходите к итогу.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={onOpenCatalog}
          className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Открыть каталог
        </button>
        <button
          type="button"
          onClick={onSkipToSummary}
          className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          К итогу →
        </button>
      </div>
    </div>
  );
}

/** Подпись под названием системы: чем она отличается на практике. */
function systemHint(system: TrackSystemId): string {
  if (system === "COLIBRI_220") return "220V · проще в подборе";
  if (system === "CLARUS_48") return "48V · нужен блок питания";
  return "Накладной · 220V";
}

/** Пояснение к выбору системы под тип монтажа с Шага 0. */
function mountHint(trackMountType: "built-in" | "surface" | "none"): string {
  if (trackMountType === "built-in") return "Для встроенного трека подойдут COLIBRI или CLARUS.";
  if (trackMountType === "surface") return "Для накладного трека используем ART 220V.";
  return "Система определит подходящие профили и светильники.";
}

export function TrackSystemScreen({
  systems,
  trackMountType,
  systemLabel,
  showNoTrackOption,
  onChoose,
  onNoTrack,
  onSkipToSummary,
}: {
  systems: TrackSystemId[];
  trackMountType: "built-in" | "surface" | "none";
  systemLabel: (system: TrackSystemId) => string;
  showNoTrackOption: boolean;
  onChoose: (system: TrackSystemId) => void;
  onNoTrack: () => void;
  onSkipToSummary: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-slate-950 p-4 text-white">
        <p className="text-sm font-semibold">Сначала выберите систему трека</p>
        <p className="mt-1 text-xs text-white/70">{mountHint(trackMountType)}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {systems.map((system) => {
          // COLIBRI проще в монтаже, поэтому для встроенного трека советуем её.
          const isRecommended = system === "COLIBRI_220" && trackMountType === "built-in";
          return (
            <button
              key={system}
              type="button"
              onClick={() => onChoose(system)}
              className={[
                "rounded-2xl border-2 p-4 text-left transition-colors",
                isRecommended
                  ? "border-blue-400 bg-blue-50 hover:border-blue-600"
                  : "border-slate-200 bg-white hover:border-slate-400",
              ].join(" ")}
            >
              <p
                className={
                  isRecommended
                    ? "text-sm font-semibold text-blue-900"
                    : "text-sm font-semibold text-slate-950"
                }
              >
                {systemLabel(system)}
              </p>
              <p className={isRecommended ? "mt-1 text-xs text-blue-700" : "mt-1 text-xs text-slate-500"}>
                {systemHint(system)}
                {isRecommended ? " · рекомендуется" : ""}
              </p>
            </button>
          );
        })}
      </div>

      {showNoTrackOption ? (
        <button
          type="button"
          onClick={onNoTrack}
          className="w-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600 hover:bg-slate-100"
        >
          Без трека — только точечные →
        </button>
      ) : null}

      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
        <p className="font-medium text-slate-700">У меня уже есть освещение</p>
        <p className="mt-1">Если всё куплено — можно пропустить подбор.</p>
        <button
          type="button"
          onClick={onSkipToSummary}
          className="mt-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
        >
          Пропустить, к итогу →
        </button>
      </div>
    </div>
  );
}

/** Форматирование рублей для экранов подбора. */
const fmtRub = (v: number): string => new Intl.NumberFormat("ru-RU").format(Math.round(v));

/**
 * Итоговый экран подбора: комплект собран, но перед переходом к смете
 * показываем то, без чего свет не заработает.
 */
export function KitDoneScreen({
  itemsCount,
  regularTotal,
  effectiveTotal,
  missingMounts,
  clarusPsuOptions,
  onAddMount,
  onPickClarusPsu,
  onEditInCatalog,
  onGoToSummary,
}: {
  itemsCount: number;
  regularTotal: number;
  effectiveTotal: number;
  missingMounts: Array<{
    fixtureVendorCode: string;
    mountVendorCode: string;
    fixtureName: string;
    mountName: string;
  }>;
  /** Пусто, если блок питания уже выбран или CLARUS в наборе нет. */
  clarusPsuOptions: Array<{ productId: string; name: string }>;
  onAddMount: (fixtureVendorCode: string) => void;
  onPickClarusPsu: (productId: string) => void;
  onEditInCatalog: () => void;
  onGoToSummary: () => void;
}) {
  const hasDiscount = regularTotal > 0 && regularTotal > effectiveTotal;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <p className="text-sm font-semibold text-emerald-950">✓ Комплект собран</p>
        <p className="mt-1 text-xs text-emerald-800">
          {itemsCount} поз.
          {regularTotal > 0 ? (
            hasDiscount ? (
              <>
                {" · "}
                <span className="line-through text-emerald-700/50">{fmtRub(regularTotal)} ₽</span>{" "}
                <span className="font-semibold">{fmtRub(effectiveTotal)} ₽</span>
              </>
            ) : (
              <> · {fmtRub(regularTotal)} ₽</>
            )
          ) : (
            ""
          )}
        </p>
      </div>

      {missingMounts.map((item) => (
        <div
          key={`${item.fixtureVendorCode}-${item.mountVendorCode}`}
          className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
        >
          <p className="font-semibold">Не хватает закладных</p>
          <p className="mt-1 text-amber-900/80">
            Для <span className="font-semibold">{item.fixtureName}</span> нужна{" "}
            <span className="font-semibold">{item.mountName}</span>.
          </p>
          <button
            type="button"
            onClick={() => onAddMount(item.fixtureVendorCode)}
            className="mt-2 rounded-xl bg-amber-700 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-800"
          >
            Добавить 1:1
          </button>
        </div>
      ))}

      {clarusPsuOptions.length > 0 ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-950">
          <p className="font-semibold">Для CLARUS обязателен блок питания.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {clarusPsuOptions.map((psu) => (
              <button
                key={psu.productId}
                type="button"
                onClick={() => onPickClarusPsu(psu.productId)}
                className="rounded-xl bg-rose-700 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-800"
              >
                {psu.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={onEditInCatalog}
          className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Изменить в каталоге
        </button>
        <button
          type="button"
          onClick={onGoToSummary}
          className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
        >
          К итогу →
        </button>
      </div>
    </div>
  );
}
