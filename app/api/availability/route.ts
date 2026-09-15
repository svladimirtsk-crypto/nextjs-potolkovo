/**
 * PT-016 · GET /api/availability — публичный календарь свободных дат замера.
 *
 * Публичный намеренно: это те же данные, что уже напечатаны на главной и в
 * форме, секретов здесь нет. Секретный только соседний
 * `PUT /api/admin/availability`.
 *
 * Ответ держит и `label` (готовая строка), и `slots` (даты с подписями) —
 * сейчас клиенту нужен только `label`, но отдавать разобранные даты дешевле,
 * чем потом добавлять второе поле и вторую версию кэша.
 */
import { NextResponse } from "next/server";

import {
  SNAPSHOT_CACHE_MS,
  describeAvailabilityError,
  readAvailabilitySnapshot,
} from "@/lib/availability/snapshot";

export const runtime = "nodejs";
/**
 * Без этого Next может закэшировать ответ на этапе сборки — и календарь
 * снова «замёрзнет», ровно как в `content/availability.ts` до задачи.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await readAvailabilitySnapshot();

    return NextResponse.json(
      {
        ok: true,
        label: snapshot.label,
        slots: snapshot.slots,
        source: snapshot.source,
        configured: snapshot.configured,
        validUntil: snapshot.validUntil,
        updatedAt: snapshot.updatedAt,
        generatedAt: snapshot.generatedAt,
      },
      {
        headers: {
          /**
           * Кэш короткий: владелец ждёт появления новых дат в течение
           * полуминуты после сохранения, а снимок в памяти процесса
           * (`SNAPSHOT_CACHE_MS`) уже защищает БД от частых запросов.
           */
          "Cache-Control": `public, max-age=0, s-maxage=${Math.round(
            SNAPSHOT_CACHE_MS / 1000
          )}, stale-while-revalidate=300`,
        },
      }
    );
  } catch (error) {
    // Хук клиента на не-200 отвечает запасной строкой из файла, поэтому
    // падение этого роута не оставляет сайт без блока и без правды.
    console.error(
      "[availability] не удалось собрать снимок календаря:",
      describeAvailabilityError(error)
    );
    return NextResponse.json(
      { ok: false, error: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
