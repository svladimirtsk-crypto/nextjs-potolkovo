"use client";

/**
 * PT-013 · Блок «Получение» и «Когда удобно» формы заявки.
 *
 * Вынесен из `components/home/action-form.tsx` без изменения поведения: файл
 * зафиксирован в LEGACY_BUDGET стража размера (PT-013 добавлял в него
 * состояния ошибки, а расти ему нельзя). Заодно блок стало видно целиком —
 * это единственная часть формы, которая появляется только для комплектов света.
 */

/** Способ получения комплекта света. */
export type FulfilmentValue = "pickup" | "delivery";

/** Когда удобно принять звонок (T-047). */
export type PreferredTimeValue = "today" | "tomorrow_morning" | "telegram";

const FULFILMENT_OPTIONS: ReadonlyArray<readonly [FulfilmentValue, string]> = [
  ["pickup", "Самовывоз"],
  ["delivery", "Доставка"],
];

const PREFERRED_TIME_OPTIONS: ReadonlyArray<readonly [PreferredTimeValue, string]> = [
  ["today", "Сегодня до 21:00"],
  ["tomorrow_morning", "Завтра утром"],
  ["telegram", "Лучше напишите в Telegram"],
];

export function LeadFulfilmentFields({
  fulfilment,
  onFulfilmentChange,
  preferredTime,
  onPreferredTimeChange,
  availabilityLabel,
}: {
  fulfilment: FulfilmentValue;
  onFulfilmentChange: (value: FulfilmentValue) => void;
  preferredTime: PreferredTimeValue;
  onPreferredTimeChange: (value: PreferredTimeValue) => void;
  /** `null`/пусто — календарь дат устарел, подписи о датах не показываем (T-047). */
  availabilityLabel: string | null;
}) {
  return (
    <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
      <fieldset>
        <legend className="text-sm font-semibold text-slate-950">Получение</legend>
        <div className="mt-2 space-y-2">
          {FULFILMENT_OPTIONS.map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="fulfilment"
                value={value}
                checked={fulfilment === value}
                onChange={() => onFulfilmentChange(value)}
                className="h-4 w-4"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold text-slate-950">Когда удобно</legend>
        {/* T-047: честный ручной календарь — не показываем, если список устарел */}
        {availabilityLabel ? (
          <p className="mt-1 text-xs text-slate-600">{availabilityLabel}</p>
        ) : null}
        <div className="mt-2 space-y-2">
          {PREFERRED_TIME_OPTIONS.map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="preferredTime"
                value={value}
                checked={preferredTime === value}
                onChange={() => onPreferredTimeChange(value)}
                className="h-4 w-4"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
