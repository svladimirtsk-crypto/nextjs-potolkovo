"use client";

import { useActionState, useEffect, useMemo, useState } from "react";

import {
  initialLeadFormState,
  submitLeadAction,
} from "@/actions/submit-lead";
import { homepage } from "@/content/homepage";
import { legal } from "@/content/legal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TextLink } from "@/components/ui/text-link";
import {
  getCalculatorSummaryLines,
  serializeCalculatorSnapshot,
  usePriceCalculatorBridge,
} from "./price-calculator-context";

const actionContent = homepage.action;

const addressFieldLabel = "Адрес или район";
const addressFieldPlaceholder =
  "Например: Химки, Люберцы, м. Сокол или ул. Ленина, 12";
const addressFieldHint =
  "Необязательно. Это поможет быстрее сориентироваться по выезду.";

export function ActionForm() {
  const { snapshot, hasInteracted } = usePriceCalculatorBridge();

  const [state, formAction, isPending] = useActionState(
    submitLeadAction,
    initialLeadFormState
  );
  const [formKey, setFormKey] = useState(0);

  const calculatorSummaryLines = useMemo(
    () => (hasInteracted ? getCalculatorSummaryLines(snapshot) : []),
    [hasInteracted, snapshot]
  );

  const calculatorSnapshotValue = useMemo(
    () => (hasInteracted ? serializeCalculatorSnapshot(snapshot) : ""),
    [hasInteracted, snapshot]
  );

  useEffect(() => {
    if (state.status === "success") {
      setFormKey((prev) => prev + 1);
    }
  }, [state.status]);

  return (
    <form key={formKey} action={formAction} className="space-y-5">
      {state.status === "success" ? (
        <div
          className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          aria-live="polite"
        >
          <p className="font-medium">{actionContent.successTitle}</p>
          <p className="mt-1">{state.message}</p>
        </div>
      ) : null}

      {state.status === "error" && !state.fieldErrors ? (
        <div
          className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
          aria-live="polite"
        >
          {state.message || actionContent.errorMessage}
        </div>
      ) : null}

      {calculatorSummaryLines.length ? (
        <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-950">
            В заявку попадёт ваш расчёт
          </p>

          <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
            {calculatorSummaryLines.map((line) => (
              <li key={line} className="flex gap-2">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-slate-950" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <Input
          label={actionContent.nameFieldLabel}
          name="name"
          type="text"
          placeholder={actionContent.nameFieldPlaceholder}
          autoComplete="name"
          required
        />

        {state.fieldErrors?.name?.length ? (
          <p className="mt-2 text-sm text-rose-700" aria-live="polite">
            {state.fieldErrors.name[0]}
          </p>
        ) : null}
      </div>

      <div>
        <Input
          label={actionContent.phoneFieldLabel}
          name="phone"
          type="tel"
          placeholder={actionContent.phoneFieldPlaceholder}
          autoComplete="tel"
          inputMode="tel"
          required
        />

        {state.fieldErrors?.phone?.length ? (
          <p className="mt-2 text-sm text-rose-700" aria-live="polite">
            {state.fieldErrors.phone[0]}
          </p>
        ) : null}
      </div>

      <div>
        <Input
          label={addressFieldLabel}
          name="address"
          type="text"
          placeholder={addressFieldPlaceholder}
          autoComplete="street-address"
        />

        <p className="mt-2 text-sm text-slate-500">{addressFieldHint}</p>

        {state.fieldErrors?.address?.length ? (
          <p className="mt-2 text-sm text-rose-700" aria-live="polite">
            {state.fieldErrors.address[0]}
          </p>
        ) : null}
      </div>

      <input
        type="hidden"
        name="calculatorSnapshot"
        value={calculatorSnapshotValue}
        readOnly
      />

      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden="true"
      />

      <Button
        type="submit"
        className="w-full justify-center"
        disabled={isPending}
      >
        {isPending ? "Отправляю..." : actionContent.submitButtonLabel}
      </Button>

      <p className="text-sm leading-6 text-slate-600">
        {actionContent.helperText}
      </p>

      <p className="text-xs leading-5 text-slate-500">
        {legal.consentTextPrefix}{" "}
        <TextLink href={legal.privacyHref} className="text-xs">
          {legal.privacyLabel}
        </TextLink>{" "}
        {legal.consentTextSuffix}
      </p>
    </form>
  );
}
