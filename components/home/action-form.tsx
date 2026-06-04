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
  errorMessage: "Не удалось отправить заявку.\nПроверьте данные и попробуйте ещё раз.",
  submitButtonLabel: "Записаться на замер",
  helperText:
    "Обычно отвечаю быстро. Можно указать район — так проще сориентироваться по выезду.",
  addressFieldHint: "Необязательно.\nЭто поможет быстрее сориентироваться по выезду.",
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

type ActionFormProps = { source?: string };

export function ActionForm({ source }: ActionFormProps) {
  const { snapshot, hasInteracted } = usePriceCalculatorBridge();

  const effectiveSource: string = String(snapshot?.leadSource ?? source ?? "");

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
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent) {
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

    // ===== Lighting numbers =====
    const lightingMode: string = String(snapshot?.lighting?.mode ?? "none");
    const lightingKitDisplay: string = String(
      snapshot?.lighting ? getKitDisplayName(snapshot.lighting) : ""
    );

    const lightingItemsCount = Number(snapshot?.lighting?.items?.length ?? 0);
    const lightingTotalRub = toNumber(snapshot?.lighting?.totalRub ?? 0);

    // ВАЖНО: если discountedTotalRub уже сохранён в snapshot — используем его.
    // Иначе считаем “потенциальную скидку” (это число полезно для менеджера).
    const lightingDiscountedRub = toNumber(
      snapshot?.lighting?.discountedTotalRub ?? applyLightingDiscount(lightingTotalRub)
    );

    const discountApplied = Boolean(snapshot?.lightingDiscountApplied);
    const discountPercentApplied = Number(snapshot?.lightingDiscountPercentApplied ?? 0);

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

    // ===== Order estimate (not authoritative) =====
    // Это удобная оценка для менеджера: потолок (с досчётом, если он был) + свет (со скидкой как в snapshot)
    const effectiveCeilingRub =
      ceilingWorksGrandTotalRub > 0 ? ceilingWorksGrandTotalRub : ceilingWorksTotalRub;

    const orderEstimatedGrandRub = Math.max(0, effectiveCeilingRub) + Math.max(0, lightingDiscountedRub);

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

    // ===== Extra fields (structured) =====

    // meta
    formData.append("calculator_source", effectiveSource);
    formData.append("calculator_has_interacted", String(Boolean(hasInteracted)));

    // lighting
    formData.append("lighting_mode", lightingMode);
    formData.append("lighting_kit", lightingKitDisplay);
    formData.append("lighting_items_count", String(lightingItemsCount));
    formData.append("lighting_total_rub", String(lightingTotalRub));
    formData.append("lighting_discounted_total_rub", String(lightingDiscountedRub));
    formData.append("lighting_discount_applied", String(discountApplied));
    formData.append("lighting_discount_percent_applied", String(discountPercentApplied));

    // ceiling / works
    formData.append("ceiling_area_m2", String(area));
    formData.append("ceiling_type_label", ceilingTypeLabel);

    formData.append("ceiling_works_total_rub", String(ceilingWorksTotalRub));
    formData.append("ceiling_works_grand_total_rub", String(ceilingWorksGrandTotalRub));
    formData.append("ceiling_extra_install_rub", String(ceilingExtraInstallRub));

    // step0 work breakdown (important for монтаж/люстры)
    formData.append("install_chandeliers_enabled", String(chandeliersEnabled));
    formData.append("install_chandeliers_count", String(chandeliersCount));
    formData.append("install_chandeliers_total_rub", String(chandeliersTotalRub));

    formData.append("install_spots_enabled", String(spotInstallEnabled));
    formData.append("install_spots_count", String(spotInstallCount));
    formData.append("install_spots_total_rub", String(spotInstallTotalRub));

    formData.append("install_track_enabled", String(trackInstallEnabled));
    formData.append("install_track_meters", String(trackInstallMeters));
    formData.append("install_track_total_rub", String(trackInstallTotalRub));

    // order estimate
    formData.append("order_estimated_grand_total_rub", String(orderEstimatedGrandRub));

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
        const errorText: string = String(
          result?.message ?? result?.error ?? `HTTP ${response.status}`
        );
        setStatus("error");
        setMessage(`Ошибка отправки в Web3Forms: ${errorText}`);
        return;
      }

      trackFormSubmitSuccess(effectiveSource);

      setStatus("success");
      setMessage("Спасибо.\nЯ свяжусь с вами, чтобы уточнить задачу и договориться о замере.");

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

      {(ceilingLines.length > 0 || lightingLines.length > 0) && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          {ceilingLines.length > 0 ? (
            <>
              <p className="font-semibold text-slate-950">
                В заявку попадёт ваш расчёт потолка
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {ceilingLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </>
          ) : null}

          {lightingLines.length > 0 ? (
            <div className={ceilingLines.length > 0 ? "mt-4" : ""}>
              <p className="font-semibold text-slate-950">И выбранное освещение</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {lightingLines.map((line) => (
                  <li key={line} className="whitespace-pre-line">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Input
            label="Имя"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Имя"
          />
          {fieldErrors.name ? (
            <p className="mt-1 text-xs text-rose-600">{fieldErrors.name}</p>
          ) : null}
        </div>

        <div>
          <Input
            label="Телефон"
            name="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Телефон (например, +7905…)"
          />
          {fieldErrors.phone ? (
            <p className="mt-1 text-xs text-rose-600">{fieldErrors.phone}</p>
          ) : null}
        </div>
      </div>

      <div>
        <Input
          label="Район / ближайшее метро (необязательно)"
          name="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Район / ближайшее метро (необязательно)"
        />
        <p className="mt-1 whitespace-pre-line text-xs text-slate-500">
          {COPY.addressFieldHint}
        </p>
        {fieldErrors.address ? (
          <p className="mt-1 text-xs text-rose-600">{fieldErrors.address}</p>
        ) : null}
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Отправляю..." : COPY.submitButtonLabel}
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
