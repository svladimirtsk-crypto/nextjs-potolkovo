"use server";

import { submitLeadToProvider } from "@/lib/lead-provider";
import { normalizePhone } from "@/lib/normalize-phone";
import { sanitizeText } from "@/lib/sanitize-text";
import { leadFormSchema } from "@/lib/validation/lead-form-schema";

export type LeadFormState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: {
    name?: string[];
    phone?: string[];
  };
};

export const initialLeadFormState: LeadFormState = {
  status: "idle",
  message: "",
};

export async function submitLeadAction(
  _prevState: LeadFormState,
  formData: FormData
): Promise<LeadFormState> {
  const rawName = sanitizeText(String(formData.get("name") ?? ""));
  const rawPhone = sanitizeText(String(formData.get("phone") ?? ""));
  const company = sanitizeText(String(formData.get("company") ?? ""));

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
    company,
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return {
      status: "error",
      message: "Пожалуйста, заполните имя и телефон корректно.",
      fieldErrors: {
        name: fieldErrors.name,
        phone: fieldErrors.phone,
      },
    };
  }

  try {
    await submitLeadToProvider({
      name: parsed.data.name,
      phone: parsed.data.phone,
      message: "Заявка с новой главной страницы",
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
