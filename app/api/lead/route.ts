/**
 * T-027 · POST /api/lead — единственная точка приёма заявок.
 *
 * Порядок: honeypot → rate-limit → zod → дедуп → запись → доставка
 * (Telegram основной, Web3Forms дубль). Ошибка доставки не роняет ответ:
 * заявка уже сохранена, неудачные каналы уходят в ретрай (`/api/lead/retry`).
 */
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

import { resolveCallbackWindow } from "@/lib/lead/callback-window";
import { deliverToTelegram } from "@/lib/lead/deliver-telegram";
import { deliverToWeb3Forms } from "@/lib/lead/deliver-web3forms";
import { checkRateLimit } from "@/lib/lead/rate-limit";
import { LeadPayloadSchema } from "@/lib/lead/schema";
import { getLeadStore } from "@/lib/lead/store";
import { getEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Дедуп: та же заявка с того же телефона в пределах окна. */
const DEDUPE_WINDOW_MS = 10 * 60 * 1000;

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

export async function POST(request: Request) {
  if (!getEnv().LEAD_API_ENABLED) {
    return NextResponse.json({ ok: false, error: "disabled" }, { status: 503 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  // Honeypot: боты заполняют скрытое поле — отвечаем как успехом, но ничего не пишем.
  if (typeof raw === "object" && raw !== null && String((raw as Record<string, unknown>).botcheck ?? "")) {
    return NextResponse.json({ ok: true, leadId: null, callbackWindow: resolveCallbackWindow() });
  }

  const ip = clientIp(request);
  const limit = checkRateLimit(ip);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    );
  }

  const parsed = LeadPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "validation", issues: parsed.error.issues.map((i) => i.path.join(".")) },
      { status: 422 }
    );
  }

  const payload = parsed.data;
  const store = getLeadStore();
  const callbackWindow = resolveCallbackWindow();

  // Дедуп: не плодим одинаковые заявки, если человек нажал дважды.
  const duplicate = await store.findRecentByPhone(payload.phone, DEDUPE_WINDOW_MS);
  if (duplicate) {
    return NextResponse.json({
      ok: true,
      leadId: duplicate.publicCode,
      callbackWindow,
      deduped: true,
    });
  }

  const grandTotal =
    payload.snapshot?.totals.grand ?? payload.totals?.grand ?? payload.grandTotal ?? 0;

  const lead = await store.createLead({
    status: payload.leadKind === "rescue" ? "rescue" : "new",
    payload,
    grandTotal,
    ipHash: hashIp(ip),
    userAgent: request.headers.get("user-agent") ?? undefined,
  });

  const [telegram, web3forms] = await Promise.all([
    deliverToTelegram(payload, lead.publicCode),
    deliverToWeb3Forms(payload, lead.publicCode),
  ]);

  await store.recordDelivery(
    lead.id,
    "telegram",
    telegram.ok ? "sent" : "failed",
    telegram.ok ? undefined : telegram.error
  );
  await store.recordDelivery(
    lead.id,
    "web3forms",
    web3forms.ok ? "sent" : "failed",
    web3forms.ok ? undefined : web3forms.error
  );

  return NextResponse.json(
    {
      ok: true,
      leadId: lead.publicCode,
      callbackWindow,
      delivered: { telegram: telegram.ok, web3forms: web3forms.ok },
    },
    { status: 201 }
  );
}
