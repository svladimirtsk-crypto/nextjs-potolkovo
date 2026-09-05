/**
 * N-001 · GET /api/lead/:code — внутренний поиск заявки по короткому коду.
 *
 * Ради этого сценария и заводилась БД: клиент называет по телефону «заявка
 * K7F3Q», и мастер должен её найти. Ответ содержит персональные данные,
 * поэтому endpoint защищён тем же `CRON_SECRET` и никогда не кэшируется.
 */
import { NextResponse } from "next/server";

import { getEnv } from "@/lib/env";
import { getLeadStore } from "@/lib/lead/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> }
) {
  const secret = getEnv().CRON_SECRET;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!secret || provided !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { code } = await context.params;
  const lead = await getLeadStore().getLeadByPublicCode(code);

  if (!lead) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    lead: {
      publicCode: lead.publicCode,
      createdAt: new Date(lead.createdAt).toISOString(),
      status: lead.status,
      grandTotal: lead.grandTotal,
      name: lead.payload.name ?? null,
      phone: lead.payload.phone,
      source: lead.payload.source,
      leadKind: lead.payload.leadKind,
      orderIntent: lead.payload.orderIntent,
      snapshot: lead.payload.snapshot ?? null,
    },
  });
}
