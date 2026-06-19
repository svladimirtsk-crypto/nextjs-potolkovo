"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";

import { legal } from "@/content/legal";
import { getKitDisplayName } from "@/lib/calculator-modal-types";
import {
  trackFormOpened,
  trackFormSubmitError,
  trackFormSubmitSuccess,
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

type ActionFormProps = {
  source?: string;
  /** В модальном итоге подробный состав уже показан выше — в форме оставляем только компактное подтверждение. */
  compactCalculationSummary?: boolean;
  /** P0.8: callback after successful submit */
  onSuccess?: () => void;
};

export function ActionForm({ source, compactCalculationSummary = false, onSuccess }: ActionFormProps) {
  const { snapshot, hasInteracted } = usePriceCalculatorBridge();

  const effectiveSource: string = String(snapshot?.leadSource ?? source ?? "");

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

  const getPlacement = (): "modal" | "page" => {
    const el = formRef.current;
    if (!el) return "page";
    return el.closest("#modal-action-form") ? "modal" : "page";
  };

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

    const placement = getPlacement();

    const trimmedName = name.trim();
    const trimmedAddress = address.trim();
    const normalizedPhone = normalizePhone(phone);

    const topArea = toNumber(snapshot?.area ?? 0);
    const topLightingTotalRub = toNumber(snapshot?.lighting?.totalRub ?? 0);

    // Empty lead check: area is 0 and lighting total is 0
    if (topArea <= 0 && topLightingTotalRub <= 0) {
      trackFormSubmitError({
        kind: "validation",
        formPlacement: placement,
        source: effectiveSource,
      });

      setStatus("error");
      setMessage("Нельзя отправить пустую заявку. Пожалуйста, укажите площадь потолка или выберите товары в каталоге освещения.");
      return;
    }

    const nextErrors: FieldErrors = {};

    if (!trimmedName) nextErrors.name = "Укажите имя.";
    else if (trimmedName.length > 80) nextErrors.name = "Слишком длинное имя.";

    if (!normalizedPhone || !isValidPhone(normalizedPhone)) {
      nextErrors.phone = "Укажите корректный телефон (например, +79051234567).";
    }

    if (trimmedAddress.length > 160) nextErrors.address = "Слишком длинный адрес или район.";

    if (Object.keys(nextErrors).length > 0) {
      trackFormSubmitError({
        kind: "validation",
        formPlacement: placement,
        source: effectiveSource,
      });

      setFieldErrors(nextErrors);
      setStatus("error");
      setMessage("Пожалуйста, заполните имя и телефон корректно.");
      return;
    }

    const accessKey = process.env.NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY;
    if (!accessKey) {
      trackFormSubmitError({
        kind: "config",
        formPlacement: placement,
        source: effectiveSource,
      });

      setStatus("error");
      setMessage("На клиенте не настроен NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY.");
      return;
    }

    // ===== Lighting numbers =====
    const lightingMode: string = String(snapshot?.lighting?.mode ?? "none");
    const lightingKitDisplay: string = String(snapshot?.lighting ? getKitDisplayName(snapshot.lighting) : "");
    const lightingItemsCount = Number(snapshot?.lighting?.items?.length ?? 0);
    const lightingTotalRub = toNumber(snapshot?.lighting?.totalRub ?? 0);

    const discountMode = String(snapshot?.lightingDiscountMode ?? snapshot?.lighting?.discountMode ?? "none");
    const fallbackLightingDiscountedRub =
      discountMode === "with-ceiling"
        ? applyLightingWithCeilingDiscount(lightingTotalRub)
        : discountMode === "lighting-only"
          ? applyLightingOnlyDiscount(lightingTotalRub)
          : lightingTotalRub;

    const lightingDiscountedRub = toNumber(
      snapshot?.lighting?.discountedTotalRub ?? fallbackLightingDiscountedRub
    );

    const discountApplied = Boolean(snapshot?.lightingDiscountApplied);
    const discountPercentApplied = Number(snapshot?.lightingDiscountPercentApplied ?? snapshot?.lighting?.discountPercentApplied ?? 0);
    const lightingDiscountAmountRub = Math.max(0, lightingTotalRub - lightingDiscountedRub);

    // Effective: what customer actually pays for lighting (with or without discount)
    const lightingEffectiveRub = discountApplied ? lightingDiscountedRub : lightingTotalRub;
    const orderIntent =
      discountMode === "with-ceiling"
        ? "lighting_with_ceiling"
        : discountMode === "lighting-only"
          ? "lighting_only"
          : lightingItemsCount > 0
            ? "lighting"
            : "ceiling_only";

    // ===== Ceiling / works numbers (Step0) =====
    const area = toNumber(snapshot?.area ?? 0);
    const ceilingTypeLabel = String(snapshot?.ceilingTypeLabel ?? "");

    const ceilingWorksTotalRub = toNumber(snapshot?.total ?? 0);
    const ceilingWorksGrandTotalRub = toNumber(snapshot?.grandTotal ?? 0);

    const ceilingExtraInstallRub =
      ceilingWorksGrandTotalRub > ceilingWorksTotalRub + 0.5
        ? Math.max(0, ceilingWorksGrandTotalRub - ceilingWorksTotalRub)
        : 0;

    // Люстры (новый шаг Step0)
    const chandeliersEnabled = Boolean(snapshot?.chandeliersEnabled);
    const chandeliersCount = toNumber(snapshot?.chandeliersCount ?? 0);
    const chandeliersTotalRub = toNumber(snapshot?.chandeliersTotal ?? 0);

    // точечные (монтаж из Step0)
    const spotInstallEnabled = Boolean(snapshot?.lightsEnabled);
    const spotInstallCount = toNumber(snapshot?.lightsCount ?? 0);
    const spotInstallTotalRub = toNumber(snapshot?.lightsTotal ?? 0);

    // трек (монтаж из Step0)
    const trackInstallEnabled = Boolean(snapshot?.trackLabel);
    const trackInstallMeters = toNumber(snapshot?.trackLength ?? 0);
    const trackInstallTotalRub = toNumber(snapshot?.trackTotal ?? 0);

    // ===== Order estimate =====
    const effectiveCeilingRub =
      ceilingWorksGrandTotalRub > 0 ? ceilingWorksGrandTotalRub : ceilingWorksTotalRub;

    // Итого = потолок (с досчётом если есть) + свет (по effective цене, а не всегда скидочной)
    const orderEstimatedGrandRub =
      Math.max(0, effectiveCeilingRub) + Math.max(0, lightingEffectiveRub);

    // ===== attribution from sessionStorage =====
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

    const formData = new FormData();

    const appendIfPresent = (key: string, value: string | undefined) => {
      const v = String(value ?? "").trim();
      if (v) formData.append(key, v);
    };

    formData.append("access_key", String(accessKey));
    formData.append("subject", "Новая заявка с сайта ПОТОЛКОВО");
    formData.append("from_name", "ПОТОЛКОВО Сайт");
    formData.append("name", trimmedName);
    formData.append("phone", normalizedPhone);
    formData.append("address", trimmedAddress);

    formData.append(
      "message",
      buildLeadMessage(ceilingLines, lightingLines, trimmedAddress, effectiveSource)
    );

    // anti-spam
    formData.append("botcheck", "");
    formData.append("company", "");

    // extra fields
    formData.append("calculator_source", effectiveSource);
    for (const [key, value] of Object.entries(attribution)) appendIfPresent(key, value);

    formData.append("calculator_has_interacted", String(Boolean(hasInteracted)));

    formData.append("lighting_mode", lightingMode);
    formData.append("lighting_kit", lightingKitDisplay);
    formData.append("lighting_items_count", String(lightingItemsCount));
    formData.append("lighting_total_rub", String(lightingTotalRub));
    formData.append("lighting_discounted_total_rub", String(lightingDiscountedRub));
    formData.append("lighting_discount_applied", String(discountApplied));
    formData.append("lighting_discount_percent_applied", String(discountPercentApplied));
    formData.append("lighting_discount_mode", discountMode);
    formData.append("lighting_discount_amount_rub", String(lightingDiscountAmountRub));
    formData.append("order_intent", orderIntent);

    formData.append("ceiling_area_m2", String(area));
    formData.append("ceiling_type_label", ceilingTypeLabel);

    formData.append("ceiling_works_total_rub", String(ceilingWorksTotalRub));
    formData.append("ceiling_works_grand_total_rub", String(ceilingWorksGrandTotalRub));
    formData.append("ceiling_extra_install_rub", String(ceilingExtraInstallRub));

    formData.append("install_chandeliers_enabled", String(chandeliersEnabled));
    formData.append("install_chandeliers_count", String(chandeliersCount));
    formData.append("install_chandeliers_total_rub", String(chandeliersTotalRub));

    formData.append("install_spots_enabled", String(spotInstallEnabled));
    formData.append("install_spots_count", String(spotInstallCount));
    formData.append("install_spots_total_rub", String(spotInstallTotalRub));

    formData.append("install_track_enabled", String(trackInstallEnabled));
    formData.append("install_track_meters", String(trackInstallMeters));
    formData.append("install_track_total_rub", String(trackInstallTotalRub));

    formData.append("order_estimated_grand_total_rub", String(orderEstimatedGrandRub));

    // legacy
    formData.append("lighting_total", String(lightingTotalRub));
    formData.append("lighting_discounted_total", String(lightingDiscountedRub));

    setIsPending(true);

    try {
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        body: formData,
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        trackFormSubmitError({
          kind: "provider",
          formPlacement: placement,
          source: effectiveSource,
        });

        const errorText: string = String(
          result?.message ?? result?.error ?? `HTTP ${response.status}`
        );
        setStatus("error");
        setMessage(`Ошибка отправки в Web3Forms: ${errorText}`);
        return;
      }

      trackFormSubmitSuccess(effectiveSource);

      // P0.8: callback для WizardStep2Summary
      onSuccess?.();

      setStatus("success");
      setMessage(COPY.successMessage);

      setName("");
      setPhone("");
      setAddress("");
      setFieldErrors({});
    } catch {
      trackFormSubmitError({
        kind: "network",
        formPlacement: placement,
        source: effectiveSource,
      });

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

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Input
            label="Имя"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {fieldErrors.name ? <p className="mt-1 text-xs text-rose-600">{fieldErrors.name}</p> : null}
        </div>

        <div>
          <Input
            label="Телефон"
            name="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
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
