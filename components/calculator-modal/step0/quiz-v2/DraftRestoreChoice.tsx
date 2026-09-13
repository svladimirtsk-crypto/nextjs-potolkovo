"use client";

/**
 * PT-007 · Явный выбор «продолжить черновик» или «начать новый расчёт».
 *
 * Раздел 3.2 ТЗ: черновик не перезаписывается и не применяется, пока
 * пользователь явно не выбрал. До этого экрана ни пресет страницы, ни
 * сохранение нового черновика не выполняются — иначе решение принималось бы за
 * пользователя, а сохранённые комнаты и корзина света затирались.
 *
 * Экран показывается при любом происхождении пресета, но подписи различаются:
 * при обычном входе (`default`) альтернатива черновику — пустой расчёт, а при
 * входе со страницы услуги или кейса (`page` / `explicit`) — расчёт по
 * предложенному кейсу.
 */
type Props = {
  /** `offer` — черновик прочитан; `unreadable` — запись есть, но не читается. */
  variant: "offer" | "unreadable";
  /** Краткое описание черновика: «48 м², 72 000 ₽». */
  summary?: string;
  origin: "default" | "page" | "explicit";
  /** Сколько позиций света в черновике — упоминаем, чтобы выбор был осмысленным. */
  lightingItemsCount?: number;
  onContinue?: () => void;
  onStartNew: () => void;
};

export function DraftRestoreChoice({
  variant,
  summary,
  origin,
  lightingItemsCount = 0,
  onContinue,
  onStartNew,
}: Props) {
  const startNewLabel =
    origin === "default" ? "Начать новый расчёт" : "Начать расчёт по этому кейсу";

  return (
    <div
      className="rounded-2xl border border-slate-200 bg-white p-5"
      data-draft-choice={variant}
      data-draft-origin={origin}
    >
      {variant === "offer" ? (
        <>
          <p className="text-base font-semibold text-slate-950">
            Продолжить прошлый расчёт{summary ? ` (${summary})` : ""}?
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Мы сохранили параметры, которые вы уже указали в этой вкладке
            {lightingItemsCount > 0
              ? `, включая подобранный свет (${lightingItemsCount} поз.)`
              : ""}
            . Ничего автоматически не восстанавливаем — решите сами.
          </p>
          {origin !== "default" && (
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Вы открыли расчёт со страницы с готовым примером. Если продолжить
              черновик, параметры этого примера применены не будут.
            </p>
          )}
        </>
      ) : (
        <>
          <p className="text-base font-semibold text-slate-950">
            Прошлый расчёт не удалось открыть
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Сохранённые параметры не читаются — вероятно, расчёт создан другой
            версией калькулятора. Ничего не сломалось: начните заново, прежняя
            запись будет удалена.
          </p>
        </>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        {variant === "offer" && onContinue && (
          <button
            type="button"
            onClick={onContinue}
            data-draft-action="continue"
            className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Продолжить расчёт
          </button>
        )}
        <button
          type="button"
          onClick={onStartNew}
          data-draft-action="start-new"
          className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          {startNewLabel}
        </button>
      </div>
    </div>
  );
}
