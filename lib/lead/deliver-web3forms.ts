/**
 * T-027 · Дубль заявки в Web3Forms (страховка на случай падения Telegram).
 * Ключ ТОЛЬКО серверный: `WEB3FORMS_ACCESS_KEY`.
 */
import { formatLeadBody, formatLeadSubject } from "./format-lead";
import type { LeadPayload } from "./schema";
import type { DeliveryResult } from "./deliver-telegram";
import { getEnv } from "@/lib/env";

export async function deliverToWeb3Forms(
  payload: LeadPayload,
  leadCode: string
): Promise<DeliveryResult> {
  const accessKey = getEnv().WEB3FORMS_ACCESS_KEY;
  if (!accessKey) return { ok: false, error: "WEB3FORMS_ACCESS_KEY is not configured" };

  try {
    const response = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        access_key: accessKey,
        subject: formatLeadSubject(payload),
        from_name: "ПОТОЛКОВО Сайт",
        name: payload.name ?? "",
        phone: payload.phone,
        message: formatLeadBody(payload, leadCode),
      }),
    });

    const result = (await response.json().catch(() => null)) as { success?: boolean } | null;
    if (!response.ok || !result?.success) {
      return { ok: false, error: `HTTP ${response.status}` };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "network error" };
  }
}
