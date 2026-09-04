"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";

import { contacts } from "@/content/contacts";
import { buildLeadSnapshotV2 } from "@/lib/calculator/types";
import { legal } from "@/content/legal";
import { getKitDisplayName } from "@/lib/calculator-modal-types";
import {
  trackFormOpened,
  trackFormSubmitError,
  trackFormSubmitSuccess,
  trackLeadError,
  trackLeadSubmit,
  trackPhoneValidated,
} from "@/lib/analytics";
import {
  applyLightingOnlyDiscount,
  applyLightingWithCeilingDiscount,
} from "@/lib/lighting-formulas";

import {
  getCalculatorSummaryLines,
  getLightingSummaryLines,
  usePriceCalculatorBridge,
} from "@/components/home/price-calculator-context";

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
  /** В модальном итоге подробный состав уже показан выше — в форме оставляем только компактное подтверждение. */
  compactCalculationSummary?: boolean;
  /** P0.8: callback after successful submit */
  onSuccess?: () => void;
};

export function ActionForm({
  source,
  placement,
  leadKind,
  compactCalculationSummary = false,
  onSuccess,
}: ActionFormProps) {
  const { snapshot, hasInteracted } = usePriceCalculatorBridge();

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
      consent: true as const,
      botcheck: "" as const,
      source: effectiveSource,
      placement,
      pagePath: typeof window !== "undefined" ? window.location.pathname : "",
      serviceSlug: placement === "service-page" ? effectiveSource : undefined,
      leadKind: effectiveLeadKind,
      orderIntent,
      attribution,
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
      onSuccess?.();

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
      {status === "success" ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
          <p className="font-semibold">{COPY.successTitle}</p>
          <p className="mt-2 whitespace-pre-line">{message}</p>
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
            Расчёт будет приложен к заявке: {calculationLinesCount} {calculationLinesLabel}
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
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {COPY.submitButtonLabelPending}
          </span>
        ) : (
          COPY.submitButtonLabel
        )}
      </Button>

      <p className="text-xs text-slate-500">
        {COPY.helperText}
        <br />
        {legal.consentTextPrefix}{" "}
        <TextLink href={legal.privacyHref}>{legal.privacyLabel}</TextLink>{" "}
        {legal.consentTextSuffix}
      </p>
    </form>
  );
}
