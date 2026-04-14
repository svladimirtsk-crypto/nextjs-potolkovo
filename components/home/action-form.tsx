"use client";

import { useMemo, useState } from "react";

import { homepage } from "@/content/homepage";
import { legal } from "@/content/legal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TextLink } from "@/components/ui/text-link";
import {
  getCalculatorSummaryLines,
  getLightingSummaryLines,
  usePriceCalculatorBridge,
} from "@/components/home/price-calculator-context";

const actionContent = homepage.action;

type FormStatus  = "idle" | "success" | "error";
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
    parts.push(
      "",
      "Параметры из калькулятора:",
      ...ceilingLines.map((l) => `— ${l}`)
    );
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

  const ceilingLines = useMemo(
    () => (hasInteracted ? getCalculatorSummaryLines(snapshot) : []),
    [hasInteracted, snapshot]
  );

  const lightingLines = useMemo(
    () => getLightingSummaryLines(snapshot),
    [snapshot]
  );

  const [name, setName]       = useState("");
  const [phone, setPhone]     = useState("");
  const [address, setAddress] = useState("");
  const [status, setStatus]   = useState<FormStatus>("idle");
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isPending, setIsPending]     = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("idle");
    setMessage("");
    setFieldErrors({});

    const trimmedName    = name.trim();
    const trimmedAddress = address.trim();
    const normalizedPhone = normalizePhone(phone);
    const nextErrors: FieldErrors = {};

    if (!trimmedName) {
      nextErrors.name = "Укажите имя.";
    } else if (trimmedName.length > 80) {
      nextErrors.name = "Слишком длинное имя.";
    }

    if (!normalizedPhone || !isValidPhone(normalizedPhone)) {
      nextErrors.phone = "Укажите корректный телефон.";
    }

    if (trimmedAddress.length > 160) {
      nextErrors.address = "Слишком длинный адрес или район.";
    }

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

    const formData = new FormData();
    formData.append("access_key",  accessKey);
    formData.append("subject",     "Новая заявка с сайта ПОТОЛКОВО");
    formData.append("from_name",   "ПОТОЛКОВО Сайт");
    formData.append("name",        trimmedName);
    formData.append("phone",       normalizedPhone);
    formData.append("address",     trimmedAddress);
    formData.append(
      "message",
      buildLeadMessage(ceilingLines, lightingLines, trimmedAddress, source ?? "")
    );
    formData.append("botcheck", "");
    formData.append("company",  "");

    // Lighting metadata
    formData.append("lighting_mode", snapshot?.lighting?.mode ?? "none");
    formData.append("lighting_kit",  snapshot?.lighting?.kitName ?? "");
    formData.append("lighting_items_count",
      String(snapshot?.lighting?.items?.length ?? 0)
    );
    formData.append("lighting_total",
      String(snapshot?.lighting?.totalRub ?? 0)
    );
    formData.append("lighting_discounted_total",
      String(snapshot?.lighting?.discountedTotalRub ?? 0)
    );
    formData.append("calculator_source", source ?? "");

    setIsPending(true);

    try {
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        body: formData,
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        const errorText =
          result?.message || result?.error || `HTTP ${response.status}`;
        setStatus("error");
        setMessage(`Ошибка отправки в Web3Forms: ${errorText}`);
        return;
      }

      setStatus("success");
      setMessage(
        "Спасибо. Я свяжусь с вами, чтобы уточнить задачу и договориться о замере."
      );
      setName("");
      setPhone("");
      setAddress("");
      setFieldErrors({});
    } catch {
      setStatus("error");
      setMessage(
        "Не удалось отправить заявку. Проверьте соединение и попробуйте ещё раз."
      );
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Status messages */}
      {status === "success" ? (
        <div
          className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          aria-live="polite"
        >
          <p className="font-medium">{actionContent.successTitle}</p>
          <p className="mt-1">{message}</p>
        </div>
      ) : null}

      {status === "error" ? (
        <div
          className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
          aria-live="polite"
        >
          {message || actionContent.errorMessage}
        </div>
      ) : null}

      {/* Ceiling summary */}
      {ceilingLines.length > 0 ? (
        <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-950">
            В заявку попадёт ваш расчёт
          </p>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
            {ceilingLines.map((line) => (
              <li key={line} className="flex gap-2">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-slate-950" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Lighting summary */}
      {lightingLines.length > 0 ? (
        <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-950">Освещение</p>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
            {lightingLines.map((line) => (
              <li key={line} className="flex gap-2">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-slate-950" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Fields */}
      <div>
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
        {fieldErrors.name ? (
          <p className="mt-2 text-sm text-rose-700" aria-live="polite">
            {fieldErrors.name}
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
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        {fieldErrors.phone ? (
          <p className="mt-2 text-sm text-rose-700" aria-live="polite">
            {fieldErrors.phone}
          </p>
        ) : null}
      </div>

      <div>
        <Input
          label={actionContent.addressFieldLabel ?? "Адрес или район"}
          name="address"
          type="text"
          placeholder={
            actionContent.addressFieldPlaceholder ??
            "Например: Химки, Люберцы, м. Сокол"
          }
          autoComplete="street-address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
        <p className="mt-2 text-sm text-slate-500">
          {actionContent.addressFieldHint ??
            "Необязательно. Это поможет быстрее сориентироваться по выезду."}
        </p>
        {fieldErrors.address ? (
          <p className="mt-2 text-sm text-rose-700" aria-live="polite">
            {fieldErrors.address}
          </p>
        ) : null}
      </div>

      {/* Honeypot */}
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

      <p className="text-sm leading-6 text-slate-600">{actionContent.helperText}</p>

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
