"use server";

import { submitLeadToProvider } from "@/lib/lead-provider";
import { normalizePhone } from "@/lib/normalize-phone";
import { sanitizeText } from "@/lib/sanitize-text";
import {
  calculatorSnapshotSchema,
  CalculatorSnapshotValues,
  leadFormSchema,
} from "@/lib/validation/lead-form-schema";

export type LeadFormState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: {
    name?: string[];
    phone?: string[];
    address?: string[];
  };
};

export const initialLeadFormState: LeadFormState = {
  status: "idle",
  message: "",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function parseCalculatorSnapshot(raw: string): CalculatorSnapshotValues | null {
  if (!raw) {
    return null;
  }

  try {
    const parsedJson: unknown = JSON.parse(raw);
    const parsed = calculatorSnapshotSchema.safeParse(parsedJson);

    if (!parsed.success) {
      return null;
    }

    return parsed.data;
  } catch {
    return null;
  }
}

function buildLeadMessage(
  snapshot: CalculatorSnapshotValues | null,
  address: string
) {
  const lines = ["Заявка с новой главной страницы"];

  if (address) {
    lines.push("");
    lines.push(`Адрес / район: ${address}`);
  }

  if (!snapshot) {
    return lines.join("\n");
  }

  lines.push("");
  lines.push("Параметры из калькулятора:");
  lines.push(`— Площадь: ${snapshot.area} м²`);
  lines.push(`— Тип потолка: ${snapshot.ceilingTypeLabel}`);
  lines.push(
    `— Полотно: ${snapshot.area} м² × ${formatCurrency(
      snapshot.ceilingBaseRate
    )} ₽ = ${formatCurrency(snapshot.ceilingBaseTotal)} ₽`
  );

  if (
    snapshot.ceilingExtraTotal > 0 &&
    snapshot.ceilingExtraLabel &&
    snapshot.ceilingLength !== null &&
    snapshot.ceilingExtraRatePerMeter !== null
  ) {
    lines.push(
      `— ${snapshot.ceilingExtraLabel}: ${snapshot.ceilingLength} м.п. × ${formatCurrency(
        snapshot.ceilingExtraRatePerMeter
      )} ₽ = ${formatCurrency(snapshot.ceilingExtraTotal)} ₽`
    );
  }

  if (
    snapshot.corniceTotal > 0 &&
    snapshot.corniceLabel &&
    snapshot.corniceLength !== null &&
    snapshot.corniceRatePerMeter !== null
  ) {
    lines.push(
      `— ${snapshot.corniceLabel}: ${snapshot.corniceLength} м.п. × ${formatCurrency(
        snapshot.corniceRatePerMeter
      )} ₽ = ${formatCurrency(snapshot.corniceTotal)} ₽`
    );
  }

  if (
    snapshot.trackTotal > 0 &&
    snapshot.trackLabel &&
    snapshot.trackLength !== null &&
    snapshot.trackRatePerMeter !== null
  ) {
    lines.push(
      `— ${snapshot.trackLabel}: ${snapshot.trackLength} м.п. × ${formatCurrency(
        snapshot.trackRatePerMeter
      )} ₽ = ${formatCurrency(snapshot.trackTotal)} ₽`
    );
  }

  if (
    snapshot.lightsEnabled &&
    snapshot.lightsTotal > 0 &&
    snapshot.lightsCount !== null
  ) {
    lines.push(
      `— Светильники: ${snapshot.lightsCount} шт. × ${formatCurrency(
        snapshot.lightsRatePerUnit
      )} ₽ = ${formatCurrency(snapshot.lightsTotal)} ₽`
    );
  }

  lines.push(`— Итого: ${formatCurrency(snapshot.total)} ₽`);

  return lines.join("\n");
}

export async function submitLeadAction(
  _prevState: LeadFormState,
  formData: FormData
): Promise<LeadFormState> {
  const rawName = sanitizeText(String(formData.get("name") ?? ""));
  const rawPhone = sanitizeText(String(formData.get("phone") ?? ""));
  const rawAddress = sanitizeText(String(formData.get("address") ?? ""));
  const company = sanitizeText(String(formData.get("company") ?? ""));
  const rawCalculatorSnapshot = String(formData.get("calculatorSnapshot") ?? "");

  if (company) {
    return {
      status: "error",
      message: "Не удалось отправить заявку. Попробуйте ещё раз.",
    };
  }

  const normalizedPhone = normalizePhone(rawPhone);

  const parsed = leadFormSchema.safeParse({
    name: rawName,
    phone: normalizedPhone,
    address: rawAddress,
    company,
    calculatorSnapshot: rawCalculatorSnapshot,
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return {
      status: "error",
      message: "Пожалуйста, заполните имя и телефон корректно.",
      fieldErrors: {
        name: fieldErrors.name,
        phone: fieldErrors.phone,
        address: fieldErrors.address,
      },
    };
  }

  const calculatorSnapshot = parseCalculatorSnapshot(
    parsed.data.calculatorSnapshot ?? ""
  );

  try {
    await submitLeadToProvider({
      name: parsed.data.name,
      phone: parsed.data.phone,
      message: buildLeadMessage(calculatorSnapshot, parsed.data.address ?? ""),
    });

    return {
      status: "success",
      message:
        "Спасибо. Я свяжусь с вами, чтобы уточнить задачу и договориться о замере.",
    };
  } catch {
    return {
      status: "error",
      message:
        "Не удалось отправить заявку. Попробуйте ещё раз или свяжитесь со мной по телефону.",
    };
  }
}
