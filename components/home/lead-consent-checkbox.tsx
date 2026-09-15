"use client";

/**
 * PT-014 · Чекбокс согласия основной формы заявки.
 *
 * Вынесен из `components/home/action-form.tsx`: файл зафиксирован в
 * LEGACY_BUDGET стража размера, а PT-014 добавляет в форму версию и момент
 * согласия. Поведение прежнее (T-047: согласие — явное действие, а не строка
 * мелким шрифтом под кнопкой), текст и ссылка — из единого `content/legal.ts`.
 */
import { legal } from "@/content/legal";

import { TextLink } from "@/components/ui/text-link";

export function LeadConsentCheckbox({
  given,
  onChange,
  disabled,
}: {
  given: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-start gap-2.5 text-xs leading-5 text-slate-600">
      <input
        type="checkbox"
        data-testid="lead-consent"
        checked={given}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-slate-950"
      />
      <span>
        {legal.consentTextPrefix}
        <TextLink href={legal.privacyHref}>{legal.privacyLabel}</TextLink>
        {legal.consentTextSuffix}
      </span>
    </label>
  );
}
