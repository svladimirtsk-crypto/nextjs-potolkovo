/**
 * T-027 · POST /api/lead/retry — повторная доставка упавших заявок.
 * Вызывается кроном; защищён `CRON_SECRET`.
 */
import { NextResponse } from "next/server";

import { deliverToTelegram } from "@/lib/lead/deliver-telegram";
import { deliverToWeb3Forms } from "@/lib/lead/deliver-web3forms";
import { getLeadStore } from "@/lib/lead/store";
import { getEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 20;

export async function POST(request: Request) {
  const secret = getEnv().CRON_SECRET;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!secret || provided !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const store = getLeadStore();
  const failed = await store.listFailedDeliveries(BATCH_SIZE);

  let retried = 0;
  let recovered = 0;

  for (const delivery of failed) {
    if (delivery.attempts >= MAX_ATTEMPTS) continue;
    const lead = await store.getLead(delivery.leadId);
    if (!lead) continue;

    retried += 1;
    const result =
      delivery.channel === "telegram"
        ? await deliverToTelegram(lead.payload, lead.publicCode)
        : await deliverToWeb3Forms(lead.payload, lead.publicCode);

    await store.recordDelivery(
      lead.id,
      delivery.channel,
      result.ok ? "sent" : "failed",
      result.ok ? undefined : result.error
    );
    if (result.ok) recovered += 1;
  }

  return NextResponse.json({ ok: true, retried, recovered });
}
