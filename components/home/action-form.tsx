"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";

import { buildLeadSnapshotV2 } from "@/lib/calculator/types";
import { resolveStep2Copy, type Step2Intent } from "@/lib/calculator-flow";
import { useAvailabilityLabel } from "@/lib/availability/use-availability-label";
import {
  trackFormOpened,
  trackFormSubmitError,
  trackFormSubmitSuccess,
  trackLeadError,
  trackLeadSubmit,
  trackPhoneValidated,
} from "@/lib/analytics";
import {
  collectLeadAttribution,
  resolveLeadEntry,
  resolveOrderIntent,
  toLeadErrorMetricKind,
} from "@/lib/lead/submit-lead";
import { submitLeadWithRetry } from "@/lib/lead/submit-retry";
import {
  describeClientValidation,
  describeLeadFailure,
  type LeadFieldErrors,
  type LeadFailureView,
} from "@/lib/lead/failure-view";
import { focusLeadField, leadFieldAriaProps } from "@/lib/lead/focus-lead-field";
import { formatPhoneInput } from "@/lib/lead/phone-input";
import { useConsentCapture } from "@/lib/lead/use-consent-capture";
import { isValidPhone, normalizePhone } from "@/lib/normalize-phone";
import {
} from "@/lib/lighting-formulas";

import { calcLeadCeilingTotal } from "@/lib/calculator/pricing";
import { LeadSuccessNote } from "@/components/home/lead-success-note";
import { LeadConsentCheckbox } from "@/components/home/lead-consent-checkbox";
import { LeadFormAlert } from "@/components/home/lead-form-alert";
import {
  LeadFulfilmentFields,
  type FulfilmentValue,
  type PreferredTimeValue,
} from "@/components/home/lead-fulfilment-fields";
import { useCalculatorStore } from "@/lib/calculator/store";
import {
  getCalculatorSummaryLines,
  getLightingSummaryLines,
} from "@/lib/calculator/summary-lines";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const COPY = {
  successTitle: "Заявка отправлена",
  successMessage: "Спасибо!\nПерезвоню в ближайшее время — уточню детали и предложу решение.",
  submitButtonLabel: "Записаться на бесплатный замер",
  submitButtonLabelPending: "Отправляю...",
  helperText:
    "Перезвоню, чтобы уточнить детали. Можно указать район — так проще сориентироваться.",
  addressFieldHint: "Необязательно.\nПоможет быстрее сориентироваться по выезду.",
} as const;

type FormStatus = "idle" | "success" | "error";

function toNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function pluralRu(count: number, one: string, few: string, many: string): string {
  const abs = Math.abs(Math.trunc(count));
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function buildLeadMessage(
  ceilingLines: string[],
  lightingLines: string[],
  address: string,
  source: string
): string {
  const parts: string[] = ["Заявка с сайта ПОТОЛКОВО"];

  if (source) parts.push(`Источник: ${source}`);
  if (address.trim()) parts.push("", `Адрес / район: ${address.trim()}`);

  if (ceilingLines.length) {
    parts.push("", "Параметры из калькулятора:", ...ceilingLines.map((l) => `- ${l}`));
  }

  if (lightingLines.length) {
    parts.push("", ...lightingLines);
  }

  return parts.join("\n");
}

export type ActionFormPlacement = "home" | "service-page" | "modal";
export type LeadKind = "direct" | "calculator" | "lighting-only";

type ActionFormProps = {
  source: string;
  placement: ActionFormPlacement;
  leadKind?: LeadKind;
  /** T-028: интент заказа задаёт копирайт формы (таблица 6.3 ТЗ). */
  intent?: Step2Intent;
  /**
   * PT-004: как человек вошёл в калькулятор — попадает в `snapshot.entry`.
   *
   * Раньше форма ставила `ceiling-first` всем заявкам из модалки, включая вход
   * «сначала свет»: в БД поле `entry` переставало описывать реальность. Теперь
   * правило одно на все формы (`resolveLeadEntry`), и rescue-заявка с основной
   * формой записывают его одинаково.
   */
  entryMode?: string | null;
  /** В модальном итоге подробный состав уже показан выше — в форме оставляем только компактное подтверждение. */
  compactCalculationSummary?: boolean;
  /** P0.8: callback after successful submit. T-028: отдаёт номер заявки и окно перезвона. */
  onSuccess?: (result: { leadId: string | null; callbackWindow: string }) => void;
};

export function ActionForm({
  source,
  placement,
  leadKind,
  intent,
  entryMode,
  compactCalculationSummary = false,
  onSuccess,
}: ActionFormProps) {
  const { snapshot, hasInteracted } = useCalculatorStore();

  // T-002: приоритет пропса над snapshot.leadSource
  const effectiveSource: string = String(source || snapshot?.leadSource || "");

  const hasRooms = toNumber(snapshot?.area ?? 0) > 0;
  const hasLighting = Number(snapshot?.lighting?.items?.length ?? 0) > 0;
  const effectiveLeadKind: LeadKind =
    leadKind ?? (hasRooms ? "calculator" : hasLighting ? "lighting-only" : "direct");

  // T-027: снапшот лида в формате LeadSnapshotV2
  const leadSnapshot = useMemo(
    () =>
      hasInteracted && snapshot
        ? buildLeadSnapshotV2({
            snapshot,
            // ActionForm живёт и вне модалки, поэтому суммы берём из снапшота.
            // N-050: при заказе «только свет» потолок в сумму не входит.
            ceilingEffectiveTotal: calcLeadCeilingTotal({ snapshot }),
            lightingRegularTotal: toNumber(snapshot.lighting?.totalRub),
            lightingEffectiveTotal: toNumber(
              snapshot.lighting?.discountedTotalRub ?? snapshot.lighting?.totalRub
            ),
            source: effectiveSource,
            entry: resolveLeadEntry({ placement, entryMode }),
          })
        : undefined,
    [hasInteracted, snapshot, effectiveSource, placement, entryMode]
  );

  const [leadResult, setLeadResult] = useState<{
    leadId: string | null;
    callbackWindow: string;
  } | null>(null);

  // T-028: интент либо приходит сверху, либо выводится из состава расчёта.
  const resolvedIntent: Step2Intent =
    intent ??
    (placement === "modal"
      ? snapshot?.lightingDiscountMode === "lighting-only"
        ? "lighting_only"
        : snapshot?.lightingDiscountMode === "with-ceiling"
          ? "lighting_with_ceiling"
          : "ceiling_only"
      : "direct");
  const copy = resolveStep2Copy(resolvedIntent);

  /** Только для комплектов света: как получить и когда удобно. */
  const [fulfilment, setFulfilment] = useState<FulfilmentValue>("pickup");
  /** T-047: согласие на обработку данных — явный чекбокс, а не «по факту отправки». */
  /**
   * PT-014 · Согласие — факт, а не константа: хук хранит и момент клика, и
   * редакцию политики, которая была показана рядом с чекбоксом.
   */
  const consent = useConsentCapture();
  const availabilityLabel = useAvailabilityLabel();
  const [preferredTime, setPreferredTime] = useState<PreferredTimeValue>("today");

  const ceilingLines = useMemo(
    () => (hasInteracted ? getCalculatorSummaryLines(snapshot) : []),
    [hasInteracted, snapshot]
  );

  const lightingLines = useMemo(() => getLightingSummaryLines(snapshot), [snapshot]);
  const calculationLinesCount = ceilingLines.length + lightingLines.length;
  const calculationLinesLabel = pluralRu(calculationLinesCount, "пункт", "пункта", "пунктов");

  // ===== refs for metrika placement (NO querySelector) =====
  const formRef = useRef<HTMLFormElement | null>(null);
  const openedOnceRef = useRef(false);
  const phoneValidatedOnceRef = useRef(false);

  // Метрика различает только modal/page
  const getPlacement = (): "modal" | "page" =>
    placement === "modal" ? "modal" : "page";

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const [status, setStatus] = useState<FormStatus>("idle");
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<LeadFieldErrors>({});
  /** PT-013: разбор отказа — из него рисуется плашка и подсветка полей. */
  const [failure, setFailure] = useState<LeadFailureView | null>(null);
  const [isPending, setIsPending] = useState(false);

  /** PT-013 · Отказ до отправки: те же состояния и та же плашка, что и при ответе сервера. */
  function failBeforeSubmit(errors: LeadFieldErrors, text: string) {
    const view = describeClientValidation(errors, text);
    setFieldErrors(errors);
    setFailure(view);
    setStatus("error");
    focusLeadField(formRef.current, view.invalidFields[0]);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    setStatus("idle");
    setMessage("");
    setFieldErrors({});
    setFailure(null);

    const metrikaPlacement = getPlacement();

    const trimmedName = name.trim();
    const trimmedAddress = address.trim();
    const normalizedPhone = normalizePhone(phone);

    const nextErrors: LeadFieldErrors = {};

    if (!trimmedName) nextErrors.name = "Как к вам обращаться?";
    else if (trimmedName.length > 80) nextErrors.name = "Слишком длинное имя.";

    if (!normalizedPhone || !isValidPhone(normalizedPhone)) {
      nextErrors.phone = "Проверьте номер: нужно 10 цифр после +7.";
    }

    if (trimmedAddress.length > 160) nextErrors.address = "Слишком длинный адрес — сократите до 160 символов.";

    if (Object.keys(nextErrors).length > 0) {
      trackFormSubmitError({
        kind: "validation",
        formPlacement: metrikaPlacement,
        source: effectiveSource,
      });
      trackLeadError({ kind: "validation", placement });

      failBeforeSubmit(nextErrors, "Проверьте имя и телефон — без них не смогу перезвонить.");
      return;
    }

    // T-047: без явного согласия заявку не отправляем.
    if (!consent.given) {
      trackLeadError({ kind: "validation", placement });
      failBeforeSubmit(
        { consent: "Без согласия на обработку данных заявку не отправить." },
        "Отметьте согласие на обработку персональных данных."
      );
      return;
    }

    // PT-004: сбор атрибуции общий с rescue-заявкой (и переживает заблокированный
    // sessionStorage — полностью эта задача закрыта в PT-012).
    const attribution = collectLeadAttribution();

    // T-027: интент заказа определяем по составу расчёта
    const lightingItemsCount = Number(snapshot?.lighting?.items?.length ?? 0);
    const orderIntent = resolveOrderIntent({
      discountMode: snapshot?.lightingDiscountMode ?? snapshot?.lighting?.discountMode ?? "none",
      lightingItemsCount,
      hasRooms,
    });

    const orderEstimatedGrandRub = leadSnapshot?.totals.grand ?? 0;

    // T-027: единый payload для /api/lead (zod-схема lib/lead/schema.ts)
    const leadPayload = {
      name: trimmedName,
      phone: normalizedPhone,
      address: trimmedAddress || undefined,
      preferredTime: copy.showFulfilment ? preferredTime : undefined,
      consent: consent.given,
      consentVersion: consent.version,
      consentAt: consent.at ?? undefined,
      botcheck: "" as const,
      source: effectiveSource,
      placement,
      pagePath: typeof window !== "undefined" ? window.location.pathname : "",
      serviceSlug: placement === "service-page" ? effectiveSource : undefined,
      leadKind: effectiveLeadKind,
      orderIntent,
      attribution: copy.showFulfilment ? { ...attribution, fulfilment } : attribution,
      snapshot: leadSnapshot,
      totals: leadSnapshot?.totals,
    };

    setIsPending(true);

    /**
     * PT-004: отправка через общий сервис.
     *
     * Поведение основной формы не меняется — она и раньше проверяла
     * `response.ok && body.ok`. Меняется то, что проверка теперь одна на все
     * формы: rescue-заявка больше не может «успешно» закрыться после `500`.
     * `submitLead` не бросает исключений, поэтому `try/catch` вокруг отправки
     * не нужен — все исходы приходят значением.
     */
    const { result } = await submitLeadWithRetry(leadPayload);

    if (!result.ok) {
      trackFormSubmitError({
        kind: result.kind === "network" || result.kind === "timeout" ? "network" : "provider",
        formPlacement: metrikaPlacement,
        source: effectiveSource,
      });
      trackLeadError({ kind: toLeadErrorMetricKind(result.kind), placement });

      // PT-013 · `422` подсвечивает названное сервером поле, `429` показывает срок
      // из `Retry-After`, обрыв связи предлагает повтор (один уже выполнен).
      const view = describeLeadFailure(result);
      setFieldErrors(view.fieldErrors);
      setFailure(view);
      setStatus("error");
      focusLeadField(formRef.current, view.invalidFields[0]);
      setIsPending(false);
      return;
    }

    trackFormSubmitSuccess(effectiveSource);

    // T-025: единая цель лида + параметр визита lead_total
    trackLeadSubmit({
      placement,
      leadKind: effectiveLeadKind,
      orderIntent,
      grandTotal: orderEstimatedGrandRub,
      rooms: Number(snapshot?.roomBreakdown?.length ?? 0),
      lightingItems: lightingItemsCount,
      source: effectiveSource,
      pagePath: typeof window !== "undefined" ? window.location.pathname : "",
      leadId: result.leadId,
    });

    // P0.8: callback для WizardStep2Summary
    onSuccess?.({
      leadId: result.leadId,
      callbackWindow: result.callbackWindow,
    });

    setLeadResult({
      leadId: result.leadId,
      callbackWindow: result.callbackWindow,
    });
    setStatus("success");
    setMessage(
      result.callbackWindow
        ? `Заявка сохранена. Перезвоню ${result.callbackWindow}.`
        : COPY.successMessage
    );

    setName("");
    setPhone("");
    setAddress("");
    setFieldErrors({});
    setIsPending(false);
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      onFocusCapture={() => {
        if (openedOnceRef.current) return;
        openedOnceRef.current = true;

        trackFormOpened({ formPlacement: getPlacement(), source: effectiveSource });
      }}
      className="space-y-4"
    >
      {/* T-028: экран успеха — номер заявки, окно перезвона, телефон и Telegram. */}
      {status === "success" ? (
        <LeadSuccessNote
          leadId={leadResult?.leadId ?? null}
          title={COPY.successTitle}
          message={message}
        />
      ) : null}

      {/* T-028: для комплектов света уточняем способ получения и удобное время. */}
      {copy.showFulfilment ? (
        <LeadFulfilmentFields
          fulfilment={fulfilment}
          onFulfilmentChange={setFulfilment}
          preferredTime={preferredTime}
          onPreferredTimeChange={setPreferredTime}
          availabilityLabel={availabilityLabel}
        />
      ) : null}

      {status === "error" && failure ? (
        <LeadFormAlert
          view={failure}
          isPending={isPending}
          onRetry={() => formRef.current?.requestSubmit()}
        />
      ) : null}

      {(ceilingLines.length > 0 || lightingLines.length > 0) ? (
        compactCalculationSummary ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-950">
            К заявке приложу этот расчёт
          </div>
        ) : (
          <details className="rounded-2xl border border-slate-200 bg-slate-50">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-950">
              Расчёт будет приложен к заявке: {calculationLinesCount} {calculationLinesLabel}
            </summary>
            <div className="border-t border-slate-200 px-4 py-3 text-sm text-slate-700">
              {ceilingLines.length > 0 ? (
                <ul className="list-disc space-y-1 pl-5">
                  {ceilingLines.map((line, idx) => (
                    <li key={`ceiling-${idx}`}>{line}</li>
                  ))}
                </ul>
              ) : null}
              {lightingLines.length > 0 ? (
                <div className={ceilingLines.length > 0 ? "mt-3" : ""}>
                  <ul className="list-disc space-y-1 pl-5">
                    {lightingLines.map((line, idx) => (
                      <li key={`lighting-${idx}`} className="whitespace-pre-line">
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </details>
        )
      ) : null}

      {placement === "modal" && !hasRooms && !hasLighting ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Расчёт не приложится — это нормально, уточню по телефону.
        </p>
      ) : null}

      <input
        type="text"
        name="botcheck"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
        defaultValue=""
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Input
            label="Имя"
            name="name"
            data-testid="lead-name"
            {...leadFieldAriaProps("name", fieldErrors)}
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {fieldErrors.name ? <p id="lead-name-error" className="mt-1 text-xs text-rose-600">{fieldErrors.name}</p> : null}
        </div>

        <div>
          <Input
            label="Телефон"
            name="phone"
            data-testid="lead-phone"
            {...leadFieldAriaProps("phone", fieldErrors)}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
            onBlur={() => {
              if (phoneValidatedOnceRef.current) return;

              const normalized = normalizePhone(phone);
              if (!normalized || !isValidPhone(normalized)) return;

              phoneValidatedOnceRef.current = true;
              trackPhoneValidated({ formPlacement: getPlacement(), source: effectiveSource });
            }}
            placeholder="+7 (___) ___-__-__"
          />
          {fieldErrors.phone ? <p id="lead-phone-error" className="mt-1 text-xs text-rose-600">{fieldErrors.phone}</p> : null}
        </div>
      </div>

      <div>
        <Input
          label="Район или метро (необязательно)"
          name="address"
          data-testid="lead-address"
          {...leadFieldAriaProps("address", fieldErrors)}
          autoComplete="address-level2"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
        <p className="mt-1 whitespace-pre-line text-xs text-slate-500">{COPY.addressFieldHint}</p>
        {fieldErrors.address ? <p id="lead-address-error" className="mt-1 text-xs text-rose-600">{fieldErrors.address}</p> : null}
      </div>

      {/* P2.18: loading state on submit button */}
      <Button type="submit" className="w-full" data-testid="lead-submit" disabled={isPending || !consent.given}>
        {isPending ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {COPY.submitButtonLabelPending}
          </span>
        ) : (
          copy.submitLabel || COPY.submitButtonLabel
        )}
      </Button>

      <LeadConsentCheckbox given={consent.given} onChange={consent.onChange} />

      <p className="text-xs text-slate-500">{COPY.helperText}</p>
    </form>
  );
}
