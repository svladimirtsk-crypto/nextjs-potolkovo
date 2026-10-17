/**
 * PT-021 · Чтение тела запроса с жёстким лимитом до JSON/Zod.
 *
 * `await request.json()` читает поток целиком и только потом падает на разборе.
 * Значит тело в сотни мегабайт успевает занять память процесса — на serverless
 * это OOM до того, как сработает хоть одна проверка. Отдельно плохо, что
 * `Content-Length` — не граница: его можно не прислать (chunked), занизить или
 * соврать, а тело всё равно придёт.
 *
 * Поэтому считаем **фактически прочитанные байты** и обрываем чтение сразу,
 * как только их больше лимита. `Content-Length` используется только как
 * ранний выход, когда он честно больше лимита, — доверять ему как
 * единственной защите нельзя.
 */
import { NextResponse } from "next/server";

/** Лимит тела заявки. Снапшот на несколько комнат и десятки SKU — это десятки КБ. */
export const LEAD_MAX_BODY_BYTES = 256 * 1024;

export type JsonBodyResult =
  | { ok: true; value: unknown; bytes: number }
  | { ok: false; reason: "too_large"; bytes: number; limit: number }
  | { ok: false; reason: "invalid_json"; bytes: number }
  | { ok: false; reason: "unreadable"; bytes: number };

/**
 * Читает JSON-тело, не превышая `limit` байт.
 *
 * Декодер работает в потоковом режиме: многобайтный UTF-8 (кириллица),
 * разрезанный между чанками, не превращается в «крякозябры» и не даёт ложный
 * `invalid_json`.
 */
export async function readJsonBody(
  request: Request,
  limit: number = LEAD_MAX_BODY_BYTES
): Promise<JsonBodyResult> {
  const declared = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > limit) {
    // Ранний выход: тело можно не читать вовсе. Но решение об отказе держится
    // и на реальных байтах ниже — заниженный или отсутствующий заголовок
    // защиту не выключает.
    return { ok: false, reason: "too_large", bytes: declared, limit };
  }

  const body = request.body;
  if (!body) return { ok: false, reason: "invalid_json", bytes: 0 };

  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8");
  let bytes = 0;
  let text = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value as Uint8Array;
      bytes += chunk.byteLength;
      if (bytes > limit) {
        await reader.cancel();
        return { ok: false, reason: "too_large", bytes, limit };
      }
      text += decoder.decode(chunk, { stream: true });
    }
    text += decoder.decode();
  } catch {
    try {
      await reader.cancel();
    } catch {
      // поток уже закрыт — второй ошибки не добавляем
    }
    return { ok: false, reason: "unreadable", bytes };
  }

  try {
    return { ok: true, value: JSON.parse(text), bytes };
  } catch {
    return { ok: false, reason: "invalid_json", bytes };
  }
}

/**
 * Единый ответ на непрочитанное тело.
 *
 * `413` — не `400`: размер это отдельная ошибка, и клиенту нужно понять, что
 * дело не в синтаксисе. Заявка при этом не сохраняется и не отправляется —
 * ответ формируется до всей обработки.
 */
export function bodyErrorResponse(result: Extract<JsonBodyResult, { ok: false }>) {
  if (result.reason === "too_large") {
    return NextResponse.json(
      {
        ok: false,
        error: "payload_too_large",
        message: "Слишком большой запрос. Обновите страницу и отправьте заявку снова.",
        limitBytes: result.limit,
      },
      { status: 413 }
    );
  }
  return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
}
