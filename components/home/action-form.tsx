"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";

import { contacts } from "@/content/contacts";
import { buildLeadSnapshotV2 } from "@/lib/calculator/types";
import { resolveStep2Copy, type Step2Intent } from "@/lib/calculator-flow";
import { legal } from "@/content/legal";
import { getAvailabilityLabel } from "@/content/availability";
import {
  trackFormOpened,
  trackFormSubmitError,
  trackFormSubmitSuccess,
  trackLeadError,
  trackLeadSubmit,
  trackPhoneValidated,
} from "@/lib/analytics";
import {
} from "@/lib/lighting-formulas";

import { useCalculatorStore } from "@/lib/calculator/store";
import {
  getCalculatorSummaryLines,
  getLightingSummaryLines,
} from "@/lib/calculator/summary-lines";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TextLink } from "@/components/ui/text-link";

const COPY = {
  successTitle: "Заявка отправлена",
  successMessage: "Спасибо!\nПерезвоню в ближайшее время — уточню детали и предложу решение.",
  errorMessage:
    "Не удалось отправить заявку.\nПроверьте данные и попробуйте ещё раз.",
  submitButtonLabel: "Записаться на бесплатный замер",
  submitButtonLabelPending: "Отправляю...",
  helperText:
    "Перезвоню, чтобы уточнить детали. Можно указать район — так проще сориентироваться.",
  addressFieldHint: "Необязательно.\nПоможет быстрее сориентироваться по выезду.",
} as const;

type FormStatus = "idle" | "success" | "error";

type FieldErrors = {
  name?: string;
  phone?: string;
  address?: string;
};

function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";

  // 10 digits -> +7XXXXXXXXXX
  if (digits.length === 10) return `+7${digits}`;

  // 8XXXXXXXXXX -> +7XXXXXXXXXX
  if (digits.startsWith("8") && digits.length === 11) return `+7${digits.slice(1)}`;

  // 7XXXXXXXXXX -> +7XXXXXXXXXX
  if (digits.startsWith("7") && digits.length === 11) return `+${digits}`;

  // generic +
  if (digits.length >= 10 && digits.length <= 15) return `+${digits}`;

  return value.trim();
}

/** T-015: маска +7 (___) ___-__-__ без внешних зависимостей. */
function formatPhoneInput(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits[0] === "8") digits = `7${digits.slice(1)}`;
  if (digits[0] !== "7") digits = `7${digits}`;
  digits = digits.slice(0, 11);

  const rest = digits.slice(1);
  let out = "+7";
  if (rest.length > 0) out += ` (${rest.slice(0, 3)}`;
  if (rest.length >= 3) out += ") ";
  if (rest.length > 3) out += rest.slice(3, 6);
  if (rest.length > 6) out += `-${rest.slice(6, 8)}`;
  if (rest.length > 8) out += `-${rest.slice(8, 10)}`;
  return out;
}

function isValidPhone(value: string): boolean {
  return /^\+\d{10,15}$/.test(value);
}

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
  compactCalculationSummary = false,
  onSuccess,
}: ActionFormProps) {
  const { snapshot, hasInteracted } = useCalculatorStore();

  // T-002: приоритет пропса над snapshot.leadSource
  const effectiveSource: string = String(source || snapshot?.leadSource || "");
  const calculatorSource: string = String(snapshot?.leadSource ?? "");

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
            // ActionForm живёт и вне модалки, поэтому суммы берём из снапшота
            ceilingEffectiveTotal:
              toNumber(snapshot.total) + Math.max(0, toNumber(snapshot.extraInstallRub)),
            lightingRegularTotal: toNumber(snapshot.lighting?.totalRub),
            lightingEffectiveTotal: toNumber(
              snapshot.lighting?.discountedTotalRub ?? snapshot.lighting?.totalRub
            ),
            source: effectiveSource,
            entry: placement === "modal" ? "ceiling-first" : "direct",
          })
        : undefined,
    [hasInteracted, snapshot, effectiveSource, placement]
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
  const [fulfilment, setFulfilment] = useState<"pickup" | "delivery">("pickup");
  /** T-047: согласие на обработку данных — явный чекбокс, а не «по факту отправки». */
  const [consentGiven, setConsentGiven] = useState(false);
  const availabilityLabel = useMemo(() => getAvailabilityLabel(), []);
  const [preferredTime, setPreferredTime] = useState<"today" | "tomorrow_morning" | "telegram">(
    "today"
  );

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
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    setStatus("idle");
    setMessage("");
    setFieldErrors({});

    const metrikaPlacement = getPlacement();

    const trimmedName = name.trim();
    const trimmedAddress = address.trim();
    const normalizedPhone = normalizePhone(phone);

    const topArea = toNumber(snapshot?.area ?? 0);
    const topLightingTotalRub = toNumber(snapshot?.lighting?.totalRub ?? 0);

    const nextErrors: FieldErrors = {};

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

      setFieldErrors(nextErrors);
      setStatus("error");
      setMessage("Проверьте имя и телефон — без них не смогу перезвонить.");
      return;
    }

    // T-047: без явного согласия заявку не отправляем.
    if (!consentGiven) {
      trackLeadError({ kind: "validation", placement });
      setStatus("error");
      setMessage("Отметьте согласие на обработку персональных данных.");
      return;
    }

    const attribution: Record<string, string> = {};
    if (typeof window !== "undefined") {
      const keys = [
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_content",
        "utm_term",
        "yclid",
        "gclid",
        "_openstat",
        "fbclid",
      ];
      for (const key of keys) {
        const v = sessionStorage.getItem(key);
        if (v && v.trim()) attribution[key] = v.trim();
      }
      const firstLanding = sessionStorage.getItem("first_landing");
      if (firstLanding && firstLanding.trim()) attribution["first_landing"] = firstLanding.trim();
      const firstReferrer = sessionStorage.getItem("first_referrer");
      if (firstReferrer && firstReferrer.trim()) attribution["first_referrer"] = firstReferrer.trim();
    }

    // T-027: интент заказа определяем по составу расчёта
    const lightingItemsCount = Number(snapshot?.lighting?.items?.length ?? 0);
    const discountMode = String(
      snapshot?.lightingDiscountMode ?? snapshot?.lighting?.discountMode ?? "none"
    );
    const orderIntent: "ceiling_only" | "lighting_with_ceiling" | "lighting_only" | "advanced" =
      discountMode === "with-ceiling"
        ? "lighting_with_ceiling"
        : discountMode === "lighting-only" || (lightingItemsCount > 0 && !hasRooms)
          ? "lighting_only"
          : "ceiling_only";

    const orderEstimatedGrandRub = leadSnapshot?.totals.grand ?? 0;

    // T-027: единый payload для /api/lead (zod-схема lib/lead/schema.ts)
    const leadPayload = {
      name: trimmedName,
      phone: normalizedPhone,
      address: trimmedAddress || undefined,
      preferredTime: copy.showFulfilment ? preferredTime : undefined,
      consent: true as const,
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

    try {
      const response = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(leadPayload),
      });

      const result = (await response.json().catch(() => null)) as
        | { ok?: boolean; leadId?: string | null; callbackWindow?: string }
        | null;

      if (!response.ok || !result?.ok) {
        trackFormSubmitError({
          kind: "provider",
          formPlacement: metrikaPlacement,
          source: effectiveSource,
        });
        trackLeadError({ kind: response.status === 429 ? "ratelimit" : "server", placement });

        setStatus("error");
        setMessage(
          `Не получилось отправить — позвоните ${contacts.phoneDisplay} или напишите в Telegram.`
        );
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
        leadId: result?.leadId ?? null,
      });

      // P0.8: callback для WizardStep2Summary
      onSuccess?.({
        leadId: result?.leadId ?? null,
        callbackWindow: String(result?.callbackWindow ?? ""),
      });

      setLeadResult({
        leadId: result?.leadId ?? null,
        callbackWindow: String(result?.callbackWindow ?? ""),
      });
      setStatus("success");
      setMessage(
        result?.callbackWindow
          ? `Заявка принята. Перезвоню ${result.callbackWindow}.`
          : COPY.successMessage
      );

      setName("");
      setPhone("");
      setAddress("");
      setFieldErrors({});
    } catch {
      trackFormSubmitError({
        kind: "network",
        formPlacement: metrikaPlacement,
        source: effectiveSource,
      });
      trackLeadError({ kind: "network", placement });

      setStatus("error");
      setMessage(COPY.errorMessage);
    } finally {
      setIsPending(false);
    }
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
        <div
          className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950"
          aria-live="polite"
        >
          <p className="font-semibold">
            {leadResult?.leadId ? `Заявка №${leadResult.leadId} принята` : COPY.successTitle}
          </p>
          <p className="mt-2 whitespace-pre-line">{message}</p>
          <p className="mt-3 flex flex-wrap items-center gap-2">
            <a href={contacts.phoneHref} className="font-semibold underline underline-offset-2">
              {contacts.phoneDisplay}
            </a>
            <span aria-hidden="true">·</span>
            <a
              href={contacts.telegramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-blue-700 underline underline-offset-2"
            >
              Написать в Telegram
            </a>
          </p>
        </div>
      ) : null}

      {/* T-028: для комплектов света уточняем способ получения и удобное время. */}
      {copy.showFulfilment ? (
        <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
          <fieldset>
            <legend className="text-sm font-semibold text-slate-950">Получение</legend>
            <div className="mt-2 space-y-2">
              {(
                [
                  ["pickup", "Самовывоз"],
                  ["delivery", "Доставка"],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="fulfilment"
                    value={value}
                    checked={fulfilment === value}
                    onChange={() => setFulfilment(value)}
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
              {(
                [
                  ["today", "Сегодня до 21:00"],
                  ["tomorrow_morning", "Завтра утром"],
                  ["telegram", "Лучше напишите в Telegram"],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="preferredTime"
                    value={value}
                    checked={preferredTime === value}
                    onChange={() => setPreferredTime(value)}
                    className="h-4 w-4"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      ) : null}

      {status === "error" ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-950">
          <p className="whitespace-pre-line">{message || COPY.errorMessage}</p>
        </div>
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
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {fieldErrors.name ? <p className="mt-1 text-xs text-rose-600">{fieldErrors.name}</p> : null}
        </div>

        <div>
          <Input
            label="Телефон"
            name="phone"
            data-testid="lead-phone"
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
          {fieldErrors.phone ? <p className="mt-1 text-xs text-rose-600">{fieldErrors.phone}</p> : null}
        </div>
      </div>

      <div>
        <Input
          label="Район или метро (необязательно)"
          name="address"
          autoComplete="address-level2"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
        <p className="mt-1 whitespace-pre-line text-xs text-slate-500">{COPY.addressFieldHint}</p>
        {fieldErrors.address ? <p className="mt-1 text-xs text-rose-600">{fieldErrors.address}</p> : null}
      </div>

      {/* P2.18: loading state on submit button */}
      <Button type="submit" className="w-full" data-testid="lead-submit" disabled={isPending || !consentGiven}>
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

      {/*
        T-047: согласие стало явным действием. Раньше это была строка мелким
        шрифтом под кнопкой — формально согласие «по факту отправки», что для
        персональных данных слабое основание.
      */}
      <label className="flex items-start gap-2.5 text-xs leading-5 text-slate-600">
        <input
          type="checkbox"
          data-testid="lead-consent"
          checked={consentGiven}
          onChange={(event) => setConsentGiven(event.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-slate-950"
        />
        <span>
          {legal.consentTextPrefix}
          <TextLink href={legal.privacyHref}>{legal.privacyLabel}</TextLink>
          {legal.consentTextSuffix}
        </span>
      </label>

      <p className="text-xs text-slate-500">{COPY.helperText}</p>
    </form>
  );
}
