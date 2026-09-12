/**
 * T-027 · POST /api/lead — единственная точка приёма заявок.
 *
 * Порядок: honeypot → готовность хранилища → rate-limit → zod →
 * идемпотентность (PT-009) → дедуп → запись → доставка
 * (Telegram основной, Web3Forms дубль). Ошибка доставки не роняет ответ:
 * заявка уже сохранена, неудачные каналы уходят в ретрай (`/api/lead/retry`).
 */
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

import { resolveCallbackWindow } from "@/lib/lead/callback-window";
import { DELIVERY_CHANNELS, deliverAll } from "@/lib/lead/deliver-all";
import {
  checkRateLimit,
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
} from "@/lib/lead/rate-limit";
import { hashLeadPayload } from "@/lib/lead/payload-hash";
import { LeadPayloadSchema } from "@/lib/lead/schema";
import { getLeadStore, isLeadStorageReady } from "@/lib/lead/store";
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

/**
 * PT-009 · Ответ «заявка уже есть».
 *
 * Один и тот же код заявки отдаётся и при дедупе, и при идемпотентном
 * повторе: человек, который диктует код по телефону, получает то, что реально
 * записано в базе, а не вторую строку, которой там нет.
 */
function leadAlreadyExists(leadId: string, callbackWindow: string, replayed: boolean) {
  return NextResponse.json({
    ok: true,
    leadId,
    callbackWindow,
    // 200, а не 201: новой заявки не создано.
    ...(replayed ? { idempotentReplay: true } : { deduped: true }),
  });
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

  /**
   * PT-002 · Хранилище недоступно — отказываем честно, до любой обработки.
   *
   * Раньше при пустом DATABASE_URL в проде заявка уходила в память процесса и
   * исчезала при первом же рестарте, а клиент видел «Заявка принята». Молчание
   * здесь опаснее отказа: человек уверен, что ему перезвонят, и не звонит сам.
   *
   * Проверка стоит перед rate-limit и валидацией намеренно: если принять
   * заявку всё равно некуда, нет смысла тратить лимит и разбирать payload.
   */
  if (!isLeadStorageReady()) {
    return NextResponse.json(
      { ok: false, error: "storage_unavailable" },
      { status: 503, headers: { "Retry-After": "300" } }
    );
  }

  const ip = clientIp(request);
  const ipHash = hashIp(ip);

  // Первый рубеж — память процесса: мгновенный и бесплатный.
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

  /**
   * PT-009 · Отпечаток содержимого заявки.
   *
   * Считается от zod-разобранного payload: телефон нормализован, дефолты
   * подставлены, неизвестные ключи отброшены схемой. Один и тот же состав,
   * присланный дважды, даёт один и тот же хеш — на этом держатся и
   * идемпотентность, и честный дедуп.
   */
  const payloadHash = hashLeadPayload(payload as unknown as Record<string, unknown>);
  const requestId = payload.requestId?.trim() || null;

  /**
   * PT-009 · Идемпотентность — строго раньше серверного rate-limit.
   *
   * Повтор — это НЕ новая заявка: человек нажал «Отправить» второй раз, потому
   * что первый ответ до него не дошёл (таймаут, обрыв сети, перезагрузка).
   * Если такой повтор упрётся в лимит и получит `429`, клиент решит, что заявка
   * не прошла, хотя она уже записана и доставляется. Это хуже дубля: дубль
   * видно в CRM, а ложный отказ заставляет человека звонить и отправлять снова.
   */
  /**
   * PT-009 · Флаг аварийного отката (правило 8 раздела 2 ТЗ).
   *
   * `0` возвращает поведение до задачи: повтор `requestId` не проверяется,
   * дублем считается любая недавняя заявка с тем же телефоном. Обработка гонки
   * unique-индексом ниже остаётся включённой всегда: само ограничение в БД
   * флагом не выключается, а необработанный конфликт дал бы `500` вместо ответа.
   */
  const idempotencyEnabled = getEnv().LEAD_IDEMPOTENCY_ENABLED;

  if (idempotencyEnabled && requestId) {
    const previous = await store.findLeadByRequestId(requestId);
    if (previous) {
      if (previous.payloadHash === payloadHash) {
        return leadAlreadyExists(previous.publicCode, callbackWindow, true);
      }
      /**
       * Тот же ключ с другим содержимым. При корректном клиенте не случается:
       * `requestId` меняется вместе с payload (раздел 3.5). Отвечаем `409`, а не
       * создаём вторую заявку под чужим ключом и не подменяем результат первой —
       * иначе расхождение между ключом и содержимым прошло бы незамеченным.
       */
      return NextResponse.json(
        {
          ok: false,
          error: "request_id_conflict",
          message: "Заявка уже отправлена. Обновите страницу и попробуйте ещё раз.",
        },
        { status: 409 }
      );
    }
  }

  // Второй рубеж — БД. Память процесса на serverless обнуляется при каждом
  // холодном старте, поэтому без этой проверки лимит обходится тривиально.
  // Ошибку БД здесь глотаем: потерять заявку из-за недоступного лимитера хуже,
  // чем пропустить лишний запрос.
  try {
    const recentFromIp = await store.countRecentByIpHash(ipHash, RATE_LIMIT_WINDOW_MS);
    if (recentFromIp >= RATE_LIMIT_MAX) {
      return NextResponse.json(
        { ok: false, error: "rate_limited" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)) } }
      );
    }
  } catch (error) {
    console.error("[lead] серверный rate-limit недоступен:", error);
  }

  /**
   * Дедуп: не плодим одинаковые заявки, если человек нажал дважды.
   *
   * PT-009: к телефону добавлен отпечаток payload. Прежний поиск по одному
   * телефону возвращал ЛЮБУЮ недавнюю заявку с этим номером, поэтому полная
   * заявка, отправленная через минуту после rescue, молча получала код короткой
   * rescue-заявки — а её состав не сохранялся нигде. Терялась ровно та
   * информация, ради которой человек досчитывал комплектацию.
   *
   * Анти-спам функция сохраняется: тот же состав с того же номера в пределах
   * окна по-прежнему не плодит записи.
   */
  const duplicate = await store.findRecentDuplicate(
    payload.phone,
    idempotencyEnabled ? payloadHash : null,
    DEDUPE_WINDOW_MS
  );
  if (duplicate) {
    return leadAlreadyExists(duplicate.publicCode, callbackWindow, false);
  }

  const grandTotal =
    payload.snapshot?.totals.grand ?? payload.totals?.grand ?? payload.grandTotal ?? 0;

  /**
   * PT-003 · Заявка и задания на доставку — одной транзакцией.
   *
   * Раньше здесь шло: createLead → await двух сетевых вызовов →
   * recordDelivery. Две проблемы разом:
   *
   * 1. Остановка процесса между записью лида и recordDelivery оставляла
   *    заявку без единой строки о доставке. Крон ретрая ищет `failed`, а
   *    строки не было вовсе — заявка молча выпадала навсегда.
   * 2. Клиент физически ждал ответа Telegram и Web3Forms. При их
   *    деградации форма «висела», хотя заявка уже сохранена.
   *
   * Теперь задания создаются в статусе `pending` вместе с лидом, до любой
   * попытки отправки. Даже если процесс умрёт сразу после ответа — крон
   * подхватит задание.
   */
  let lead;
  try {
    lead = await store.createLeadWithDeliveries(
      {
        status: payload.leadKind === "rescue" ? "rescue" : "new",
        payload,
        grandTotal,
        ipHash,
        userAgent: request.headers.get("user-agent") ?? undefined,
        requestId: requestId ?? undefined,
        payloadHash,
      },
      DELIVERY_CHANNELS
    );
  } catch (error) {
    /**
     * PT-009 · Гонка двух параллельных отправок с одним ключом.
     *
     * Оба запроса проходят проверку «существует ли заявка» до вставки, и ловит
     * их unique-индекс `leads_request_id_key`, а не проверка. Проигравший не
     * должен отвечать `500`: заявка создана, доставка поставлена в очередь — это
     * ровно тот результат, который ждёт клиент. Перечитываем по ключу и отдаём
     * прежний код. Если перечитать нечего (ошибка была не про уникальный ключ),
     * пробрасываем дальше — в общий обработчик.
     */
    if (requestId) {
      const raced = await store.findLeadByRequestId(requestId).catch(() => null);
      if (raced && raced.payloadHash === payloadHash) {
        return leadAlreadyExists(raced.publicCode, callbackWindow, true);
      }
    }
    throw error;
  }

  /**
   * Доставка запускается, но ответ её НЕ ждёт: заявка уже в базе, а
   * «сохранено» честнее и быстрее, чем «доставлено мастеру».
   *
   * Ошибки проглатываются намеренно — статусы пишет сама deliverAll, а
   * необработанный reject здесь уронил бы процесс после успешного ответа.
   */
  void deliverAll(store, lead.id, payload, lead.publicCode).catch(() => {});

  return NextResponse.json(
    {
      ok: true,
      leadId: lead.publicCode,
      callbackWindow,
      /**
       * PT-003: раньше здесь стоял `delivered` с результатами отправки.
       * Теперь ответ уходит до её завершения, и честный статус — «принято
       * и поставлено в очередь», а не «доставлено мастеру». Обещать второе,
       * не дождавшись ответа Telegram, значит врать клиенту.
       */
      status: "queued",
    },
    { status: 201 }
  );
}
