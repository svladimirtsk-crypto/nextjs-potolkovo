"use client";

import { useMemo, useState, type FormEvent } from "react";

import { legal } from "@/content/legal";

import { getKitDisplayName } from "@/lib/calculator-modal-types";
import { trackFormSubmitSuccess } from "@/lib/analytics";
import { applyLightingDiscount } from "@/lib/lighting-formulas";

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
  errorMessage: "Не удалось отправить заявку. Проверьте данные и попробуйте ещё раз.",
  submitButtonLabel: "Записаться на замер",
  helperText:
    "Обычно отвечаю быстро. Можно указать район — так проще сориентироваться по выезду.",
  addressFieldHint: "Необязательно. Это поможет быстрее сориентироваться по выезду.",
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

  // 8XXXXXXXXXX -> +7XXXXXXXXXX
  if (digits.startsWith("8") && digits.length === 11) return `+7${digits.slice(1)}`;

  // 7XXXXXXXXXX -> +7XXXXXXXXXX
  if (digits.startsWith("7") && digits.length === 11) return `+${digits}`;

  // generic +<digits>
  if (digits.length >= 10 && digits.length <= 15) return `+${digits}`;

  return value.trim();
}

function isValidPhone(value: string): boolean {
  return /^\+\d{10,15}$/.test(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ru-RU").format(Math.round(value));
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
};

export function ActionForm({ source }: ActionFormProps) {
  const { snapshot, hasInteracted } = usePriceCalculatorBridge();

  const effectiveSource: string = String(snapshot?.leadSource ?? source ?? "");

  const ceilingLines = useMemo(
    () => (hasInteracted ? getCalculatorSummaryLines(snapshot) : []),
    [hasInteracted, snapshot]
  );

  const lightingLines = useMemo(() => getLightingSummaryLines(snapshot), [snapshot]);

  const [name, setName] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [address, setAddress] = useState<string>("");

  const [status, setStatus] = useState<FormStatus>("idle");
  const [message, setMessage] = useState<string>("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isPending, setIsPending] = useState<boolean>(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setStatus("idle");
    setMessage("");
    setFieldErrors({});

    const trimmedName = name.trim();
    const trimmedAddress = address.trim();
    const normalizedPhone = normalizePhone(phone);

    const nextErrors: FieldErrors = {};

    if (!trimmedName) nextErrors.name = "Укажите имя.";
    else if (trimmedName.length > 80) nextErrors.name = "Слишком длинное имя.";

    if (!normalizedPhone || !isValidPhone(normalizedPhone)) {
      nextErrors.phone = "Укажите корректный телефон (например, +79051234567).";
    }

    if (trimmedAddress.length > 160) nextErrors.address = "Слишком длинный адрес или район.";

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setStatus("error");
      setMessage("Пожалуйста, заполните имя и телефон корректно.");
      return;
    }

    const accessKey = process.env.NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY;
    if (!accessKey) {
      setStatus("error");
      setMessage("На клиенте не настроен NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY.");
      return;
    }

    const lightingMode: string = String(snapshot?.lighting?.mode ?? "none");
    const lightingKitDisplay: string = String(
      snapshot?.lighting ? getKitDisplayName(snapshot.lighting) : ""
    );

    const lightingItemsCount = Number(snapshot?.lighting?.items?.length ?? 0);
    const lightingTotalRub = Number(snapshot?.lighting?.totalRub ?? 0);

    const lightingDiscountedRub = Number(
      snapshot?.lighting?.discountedTotalRub ?? applyLightingDiscount(lightingTotalRub)
    );

    const formData = new FormData();
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
    formData.append("lighting_mode", lightingMode);
    formData.append("lighting_kit", lightingKitDisplay);
    formData.append("lighting_items_count", String(lightingItemsCount));
    formData.append("lighting_total_rub", String(lightingTotalRub));
    formData.append("lighting_discounted_total_rub", String(lightingDiscountedRub));

    // legacy compatibility
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
        const errorText: string = String(result?.message ?? result?.error ?? `HTTP ${response.status}`);
        setStatus("error");
        setMessage(`Ошибка отправки в Web3Forms: ${errorText}`);
        return;
      }

      trackFormSubmitSuccess(effectiveSource);

      setStatus("success");
      setMessage("Спасибо. Я свяжусь с вами, чтобы уточнить задачу и договориться о замере.");

      setName("");
      setPhone("");
      setAddress("");
      setFieldErrors({});
    } catch {
      setStatus("error");
      setMessage(COPY.errorMessage);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {status === "success" ? (
        <div
          className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950"
          role="status"
          aria-live="polite"
        >
          <p className="font-medium">{COPY.successTitle}</p>
          <p className="mt-1 text-sm text-emerald-900/80">{message}</p>
        </div>
      ) : null}

      {status === "error" ? (
        <div
          className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-950"
          role="alert"
          aria-live="polite"
        >
          <p className="text-sm">{message || COPY.errorMessage}</p>
        </div>
      ) : null}

      {(ceilingLines.length > 0 || lightingLines.length > 0) && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          {ceilingLines.length > 0 ? (
            <div>
              <p className="text-sm font-medium text-slate-950">
                В заявку попадёт ваш расчёт потолка
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                {ceilingLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {lightingLines.length > 0 ? (
            <div className={ceilingLines.length > 0 ? "mt-4" : ""}>
              <p className="text-sm font-medium text-slate-950">Освещение</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                {lightingLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>

              {snapshot?.lighting?.totalRub != null ? (
                <p className="mt-2 text-xs text-slate-500">
                  Сумма оборудования: {formatCurrency(Number(snapshot.lighting.totalRub))} ₽
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      <div className="grid gap-3">
        <Input
          label="Имя"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Иван"
          autoComplete="name"
          aria-invalid={Boolean(fieldErrors.name) || undefined}
        />
        {fieldErrors.name ? <p className="text-xs text-rose-600">{fieldErrors.name}</p> : null}

        <Input
          label="Телефон"
          name="phone"
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+79051234567"
          autoComplete="tel"
          aria-invalid={Boolean(fieldErrors.phone) || undefined}
        />
        {fieldErrors.phone ? <p className="text-xs text-rose-600">{fieldErrors.phone}</p> : null}

        <Input
          label="Адрес или район (необязательно)"
          name="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Например: Центральный район"
          autoComplete="street-address"
          aria-invalid={Boolean(fieldErrors.address) || undefined}
        />
        <p className="text-xs text-slate-500">{COPY.addressFieldHint}</p>
        {fieldErrors.address ? (
          <p className="text-xs text-rose-600">{fieldErrors.address}</p>
        ) : null}
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Отправляю..." : COPY.submitButtonLabel}
      </Button>

      <p className="text-xs text-slate-500">{COPY.helperText}</p>

      <p className="text-xs text-slate-500">
        {legal.consentTextPrefix}
        <TextLink href={legal.privacyHref}>{legal.privacyLabel}</TextLink>
        {legal.consentTextSuffix}
      </p>
    </form>
  );
}
