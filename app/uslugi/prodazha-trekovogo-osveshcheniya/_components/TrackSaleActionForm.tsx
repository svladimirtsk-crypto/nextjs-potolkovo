"use client";

import { useMemo, useState } from "react";

import { trackFormSubmitSuccess } from "@/lib/analytics";
import { homepage } from "@/content/homepage";
import { legal } from "@/content/legal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TextLink } from "@/components/ui/text-link";
import {
  getCalculatorSummaryLines,
  usePriceCalculatorBridge,
} from "@/components/home/price-calculator-context";
import {
  useTrackSaleIntent,
  type SelectedProduct,
} from "./TrackSaleIntentContext";

const actionContent = homepage.action;

type FormStatus = "idle" | "success" | "error";

type FieldErrors = {
  name?: string;
  phone?: string;
  address?: string;
};

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("8") && digits.length === 11) return `+7${digits.slice(1)}`;
  if (digits.startsWith("7") && digits.length === 11) return `+${digits}`;
  if (digits.length >= 10 && digits.length <= 15) return `+${digits}`;
  return value.trim();
}

function isValidPhone(value: string) {
  return /^\+\d{10,15}$/.test(value);
}

function formatProductLine(p: SelectedProduct, idx: number) {
  const parts = [`${idx + 1}. ${p.title}`];
  parts.push(`   Артикул: ${p.sku}`);
  if (p.priceRetail != null) parts.push(`   Цена EKS: ${p.priceRetail} ₽`);
  if (p.priceWithCeiling != null) parts.push(`   Со скидкой: ${p.priceWithCeiling} ₽`);
  if (p.providerUrl) parts.push(`   Ссылка: ${p.providerUrl}`);
  return parts.join("\n");
}

function buildLeadMessage(
  lines: string[],
  address: string,
  selectedProducts: SelectedProduct[],
  mode: "install" | "buy"
) {
  const modeLabel = mode === "install" ? "С установкой в потолок" : "Только купить свет";
  const parts: string[] = [`Заявка с страницы «Продажа трекового освещения»`, `Режим: ${modeLabel}`];

  if (address.trim()) {
    parts.push("", `Адрес / район: ${address.trim()}`);
  }

  if (selectedProducts.length > 0) {
    parts.push("", `Выбранные позиции трек-света (${selectedProducts.length}):`);
    selectedProducts.forEach((p, i) => parts.push(formatProductLine(p, i)));
    parts.push("", "Количество/длины уточнить при подтверждении.");
  }

  if (lines.length) {
    parts.push("", "Параметры из калькулятора:", ...lines.map((line) => `— ${line}`));
  }

  return parts.join("\n");
}

export function TrackSaleActionForm() {
  const { snapshot, hasInteracted } = usePriceCalculatorBridge();
  const { selectedProducts, mode } = useTrackSaleIntent();
  const effectiveSource =
  snapshot?.leadSource ?? (mode === "install" ? "track-sale-install" : "track-sale-buy");

  const calculatorSummaryLines = useMemo(
    () => (hasInteracted ? getCalculatorSummaryLines(snapshot) : []),
    [hasInteracted, snapshot]
  );

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isPending, setIsPending] = useState(false);

  const submitLabel =
    mode === "install"
      ? "Записаться на замер"
      : "Проверить наличие / получить счёт";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();
  setStatus("idle");
  setMessage("");
  setFieldErrors({});

  const trimmedName = name.trim();
  const trimmedAddress = address.trim();
  const normalizedPhoneValue = normalizePhone(phone);

  const nextErrors: FieldErrors = {};
  if (!trimmedName) nextErrors.name = "Укажите имя.";
  else if (trimmedName.length > 80) nextErrors.name = "Слишком длинное имя.";
  if (!normalizedPhoneValue || !isValidPhone(normalizedPhoneValue))
    nextErrors.phone = "Укажите корректный телефон.";
  if (trimmedAddress.length > 160)
    nextErrors.address = "Слишком длинный адрес или район.";

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
  formData.append("access_key", accessKey);
  formData.append("subject", "Новая заявка с сайта ПОТОЛКОВО");
  formData.append("from_name", "ПОТОЛКОВО Сайт");
  formData.append("name", trimmedName);
  formData.append("phone", normalizedPhoneValue);
  formData.append("address", trimmedAddress);
  formData.append(
    "message",
    buildLeadMessage(calculatorSummaryLines, trimmedAddress, selectedProducts, mode)
  );
  formData.append("botcheck", "");
  formData.append("company", "");
  formData.append("calculator_source", effectiveSource); // ← NEW

  setIsPending(true);

  try {
    const response = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      body: formData,
    });
    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.success) {
      const errorText = result?.message || result?.error || `HTTP ${response.status}`;
      setStatus("error");
      setMessage(`Ошибка отправки: ${errorText}`);
      return;
    }

    trackFormSubmitSuccess(effectiveSource); // ← NEW

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

      {selectedProducts.length > 0 ? (
        <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-950">
            В заявке: {selectedProducts.length}{" "}
            {selectedProducts.length === 1
              ? "позиция"
              : selectedProducts.length < 5
              ? "позиции"
              : "позиций"}{" "}
            трек-света
          </p>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
            {selectedProducts.map((p) => (
              <li key={p.sku} className="flex gap-2">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-slate-950" />
                <span className="min-w-0">
                  <span className="font-medium text-slate-900">{p.title}</span>
                  <span className="text-slate-400 ml-1.5 text-xs">
                    {p.sku}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-400">
            Количество/длины уточним при подтверждении
          </p>
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
          value={name}
          onChange={(event) => setName(event.target.value)}
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
          onChange={(event) => setPhone(event.target.value)}
        />
        {fieldErrors.phone ? (
          <p className="mt-2 text-sm text-rose-700" aria-live="polite">
            {fieldErrors.phone}
          </p>
        ) : null}
      </div>

      <div>
        <Input
          label="Адрес или район"
          name="address"
          type="text"
          placeholder="Например: Химки, Люберцы, м. Сокол или ул. Ленина, 12"
          autoComplete="street-address"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
        />
        <p className="mt-2 text-sm text-slate-500">
          Необязательно. Это поможет быстрее сориентироваться по выезду.
        </p>
        {fieldErrors.address ? (
          <p className="mt-2 text-sm text-rose-700" aria-live="polite">
            {fieldErrors.address}
          </p>
        ) : null}
      </div>

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
        {isPending ? "Отправляю..." : submitLabel}
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
