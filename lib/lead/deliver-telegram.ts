/**
 * T-027 · Доставка заявки в Telegram.
 */
import { formatLeadForTelegram } from "./format-lead";
import type { LeadPayload } from "./schema";

export type DeliveryResult = { ok: true } | { ok: false; error: string };

export async function deliverToTelegram(
  payload: LeadPayload,
  leadCode: string
): Promise<DeliveryResult> {
  if (process.env.TELEGRAM_LEADS_ENABLED === "0") {
    return { ok: false, error: "TELEGRAM_LEADS_ENABLED=0" };
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { ok: false, error: "Telegram is not configured" };

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        chat_id: chatId,
        text: formatLeadForTelegram(payload, leadCode),
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return { ok: false, error: `HTTP ${response.status} ${text}`.trim() };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "network error" };
  }
}
