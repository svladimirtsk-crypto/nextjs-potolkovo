"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TextLink } from "@/components/ui/text-link";
import { homepage } from "@/content/homepage";
import { legal } from "@/content/legal";
import { trackFormSubmitSuccess } from "@/lib/analytics";
import { applyLightingDiscount } from "@/lib/lighting-formulas";
import {
  getCalculatorSummaryLines,
  getLightingSummaryLines,
  usePriceCalculatorBridge,
} from "@/components/home/price-calculator-context";

type FormStatus = "idle" | "success" | "error";
type FieldErrors = { name?: string; phone?: string; address?: string };

function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("8") && digits.length === 11) return `+7${digits.slice(1)}`;
  if (digits.startsWith("7") && digits.length === 11) return `+${digits}`;
  if (digits.length >= 10 && digits.length <= 15) return `+${digits}`;
  return value.trim();
}

function isValidPhone(value: string): boolean {
  return /^\+\d{10,15}$/.test(value);
}

function buildMessage(
  ceilingLines: string[],
  lightingLines: string[],
  address: string,
  source: string
): string {
  const parts: string[] = ["Заявка с трековой страницы ПОТОЛКОВО"];

  if (source) parts.push(`Источник: ${source}`);
  if (address.trim()) parts.push("", `Адрес / район: ${address.trim()}`);
  if (ceilingLines.length) parts.push("", "Потолок:", ...ceilingLines.map((x) => `- ${x}`));
  if (lightingLines.length) parts.push("", "Освещение:", ...lightingLines.map((x) => `- ${x}`));

  return parts.join("\n");
}

type TrackSaleActionFormProps = {
  source?: string;
};

export function TrackSaleActionForm({ source }: TrackSaleActionFormProps) {
  const actionContent = homepage.action;
  const { snapshot, hasInteracted } = usePriceCalculatorBridge();

  const effectiveSource: string = String(snapshot?.leadSource ?? source ?? "catalog_trek_page");

  const ceilingLines = useMemo(
    () => (hasInteracted ? getCalculatorSummaryLines(snapshot) : []),
    [hasInteracted, snapshot]
  );
  const lightingLines = useMemo(() => getLightingSummaryLines(snapshot), [snapshot]);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setStatus("idle");
    setMessage("");
    setErrors({});

    const trimmedName = name.trim();
    const trimmedAddress = address.trim();
    const normalizedPhone = normalizePhone(phone);

    const nextErrors: FieldErrors = {};
    if (!trimmedName) nextErrors.name = "Укажите имя.";
    if (!normalizedPhone || !isValidPhone(normalizedPhone)) {
      nextErrors.phone = "Укажите корректный телефон.";
    }
    if (trimmedAddress.length > 160) {
      nextErrors.address = "Слишком длинный адрес или район.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setStatus("error");
      setMessage("Проверьте поля формы.");
      return;
    }

    const accessKey = process.env.NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY;
    if (!accessKey) {
      setStatus("error");
      setMessage("Не настроен NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY.");
      return;
    }

    const lightingTotalRub = Number(snapshot?.lighting?.totalRub ?? 0);
    const lightingDiscountedRub = Number(
      snapshot?.lighting?.discountedTotalRub ??
        applyLightingDiscount(Number(snapshot?.lighting?.totalRub ?? 0))
    );

    const formData = new FormData();
    formData.append("access_key", String(accessKey ?? ""));
    formData.append("subject", String("Новая заявка с трековой страницы ПОТОЛКОВО"));
    formData.append("from_name", String("ПОТОЛКОВО - Трековая страница"));
    formData.append("name", String(trimmedName ?? ""));
    formData.append("phone", String(normalizedPhone ?? ""));
    formData.append("address", String(trimmedAddress ?? ""));
    formData.append(
      "message",
      String(buildMessage(ceilingLines, lightingLines, trimmedAddress, effectiveSource) ?? "")
    );
    formData.append("botcheck", String("" ?? ""));
    formData.append("company", String("" ?? ""));

    formData.append("lighting_mode", String(snapshot?.lighting?.mode ?? "none"));
    formData.append("lighting_items_count", String(snapshot?.lighting?.items?.length ?? 0));
    formData.append("lighting_total_rub", String(lightingTotalRub ?? 0));
    formData.append("lighting_discounted_total_rub", String(lightingDiscountedRub ?? 0));
    formData.append("lighting_total", String(lightingTotalRub ?? 0));
    formData.append("lighting_discounted_total", String(lightingDiscountedRub ?? 0));
    formData.append("calculator_source", String(effectiveSource ?? ""));

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
        setMessage(`Ошибка отправки: ${errorText}`);
        return;
      }

      trackFormSubmitSuccess(effectiveSource);
      setStatus("success");
      setMessage("Спасибо. Мы свяжемся с вами для уточнения деталей и замера.");
      setName("");
      setPhone("");
      setAddress("");
      setErrors({});
    } catch {
      setStatus("error");
      setMessage("Не удалось отправить заявку. Проверьте соединение и попробуйте еще раз.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {status === "success" ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      ) : null}

      {status === "error" ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {message}
        </div>
      ) : null}

      <Input
        label={actionContent.nameFieldLabel}
        name="name"
        type="text"
        placeholder={actionContent.nameFieldPlaceholder}
        autoComplete="name"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      {errors.name ? <p className="text-sm text-rose-700">{errors.name}</p> : null}

      <Input
        label={actionContent.phoneFieldLabel}
        name="phone"
        type="tel"
        placeholder={actionContent.phoneFieldPlaceholder}
        autoComplete="tel"
        inputMode="tel"
        required
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />
      {errors.phone ? <p className="text-sm text-rose-700">{errors.phone}</p> : null}

      <Input
        label={actionContent.addressFieldLabel ?? "Адрес или район"}
        name="address"
        type="text"
        placeholder={actionContent.addressFieldPlaceholder ?? "Например: Химки, Люберцы"}
        autoComplete="street-address"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
      />
      {errors.address ? <p className="text-sm text-rose-700">{errors.address}</p> : null}

      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden="true"
      />

      <Button type="submit" className="w-full justify-center" disabled={isPending}>
        {isPending ? "Отправляю..." : actionContent.submitButtonLabel}
      </Button>

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
