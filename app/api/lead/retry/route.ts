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

  /**
   * PT-003 · Крон забирает и `pending`, и `failed`.
   *
   * Раньше он смотрел только на `failed`. Задание в статусе `pending`
   * появляется теперь сразу вместе с лидом — и если процесс умер до первой
   * попытки отправки, такое задание не попало бы сюда никогда, а заявка
   * осталась бы недоставленной навсегда.
   *
   * Порядок важен: сначала ни разу не отправленные, потом повторные. Свежая
   * заявка ценнее ретрая, который уже несколько раз не прошёл.
   */
  const pending = await store.listPendingDeliveries(BATCH_SIZE);
  const failedOnes = await store.listFailedDeliveries(Math.max(0, BATCH_SIZE - pending.length));
  const failed = [...pending, ...failedOnes];

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

  // ТЗ v2 N-001 п.4: ответ {retried, sent, failed}. `recovered` сохранён
  // для обратной совместимости с существующим тестом и мониторингом.
  return NextResponse.json({
    ok: true,
    retried,
    sent: recovered,
    failed: retried - recovered,
    recovered,
  });
}
