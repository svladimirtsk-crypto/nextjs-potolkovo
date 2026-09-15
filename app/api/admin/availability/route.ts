/**
 * PT-016 · /api/admin/availability — обновление календаря замеров без деплоя.
 *
 * `GET` — что сейчас в календаре (для формы в `/admin/availability`).
 * `PUT` — заменить список дат целиком.
 *
 * Защита — отдельный `AVAILABILITY_TOKEN` (не `CRON_SECRET`): у крона и у
 * календаря разные владельцы и разные последствия утечки. Токен сравнивается
 * побайтово с постоянным временем, чтобы по времени ответа нельзя было
 * подобрать значение.
 *
 * Без заданного токена роут отвечает `503`, а не `401`: «не настроено» и
 * «неверный пароль» — разные ситуации, и владелец должен видеть первую.
 * Ровно так же `POST /api/lead/retry` ведёт себя без `CRON_SECRET`.
 */
import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import {
  buildAvailabilityLabel,
  moscowTodayIso,
  sortSlots,
  toSlotView,
  upcomingSlots,
} from "@/lib/availability/format";
import { normalizeAvailabilityInput } from "@/lib/availability/input";
import {
  describeAvailabilityError,
  invalidateAvailabilitySnapshotCache,
} from "@/lib/availability/snapshot";
import { createAvailabilityStore, type AvailabilityStore } from "@/lib/availability/store";
import { getEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Календарь — десятки коротких строк; больший объём уже не похож на правку дат. */
const MAX_BODY_BYTES = 64 * 1024;

type Denied = { status: number; body: Record<string, unknown> };

function deny(status: number, error: string, message: string): Denied {
  return { status, body: { ok: false, error, message } };
}

function json(denied: Denied) {
  return NextResponse.json(denied.body, {
    status: denied.status,
    headers: { "Cache-Control": "no-store" },
  });
}

function safeEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual бросает исключение на разной длине — проверяем сами.
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function authorize(request: Request): Denied | null {
  const token = getEnv().AVAILABILITY_TOKEN;
  if (!token) {
    return deny(
      503,
      "not_configured",
      "AVAILABILITY_TOKEN не задан на сервере — сохранение календаря недоступно."
    );
  }

  const provided = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!safeEqual(provided, token)) {
    return deny(401, "unauthorized", "Неверный пароль.");
  }

  return null;
}

function resolveStore(): { store: AvailabilityStore } | { denied: Denied } {
  const env = getEnv();

  if (!env.AVAILABILITY_DB_ENABLED) {
    return {
      denied: deny(
        503,
        "disabled",
        "AVAILABILITY_DB_ENABLED=0 — календарь берётся из content/availability.ts, правки через API отключены."
      ),
    };
  }

  if (!env.DATABASE_URL) {
    return {
      denied: deny(503, "no_database", "DATABASE_URL не задан — сохранять даты некуда."),
    };
  }

  return { store: createAvailabilityStore(env.DATABASE_URL) };
}

function fail(error: Error, where: string) {
  console.error(`[availability-admin] ${where}:`, describeAvailabilityError(error));
  return NextResponse.json(
    { ok: false, error: "storage", message: "Не удалось прочитать календарь из базы." },
    { status: 500, headers: { "Cache-Control": "no-store" } }
  );
}

export async function GET(request: Request) {
  const denied = authorize(request);
  if (denied) return json(denied);

  const resolved = resolveStore();
  if ("denied" in resolved) return json(resolved.denied);

  try {
    const now = new Date();
    const state = await resolved.store.read();
    const sorted = sortSlots(state.slots);
    const upcoming = upcomingSlots(sorted, now);
    const upcomingDates = new Set(upcoming.map((slot) => slot.date));
    const expired = sorted.filter((slot) => !upcomingDates.has(slot.date));

    return NextResponse.json({
      ok: true,
      today: moscowTodayIso(now),
      configured: state.configured,
      updatedAt: state.updatedAt,
      /** Что увидит посетитель прямо сейчас. */
      label: buildAvailabilityLabel(upcoming, { now }),
      slots: upcoming.map(toSlotView),
      /** Прошедшие даты — только справочно, в сохранение они не возвращаются. */
      expired: expired.map(toSlotView),
    });
  } catch (error) {
    return fail(error instanceof Error ? error : new Error(String(error)), "GET");
  }
}

export async function PUT(request: Request) {
  const denied = authorize(request);
  if (denied) return json(denied);

  const resolved = resolveStore();
  if ("denied" in resolved) return json(resolved.denied);

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return json(
      deny(413, "too_large", `Тело больше ${MAX_BODY_BYTES} байт — это не похоже на список дат.`)
    );
  }

  /**
   * Тело читаем текстом и меряем сами.
   *
   * Полагаться только на `content-length` нельзя: заголовок может отсутствовать
   * (chunked-запрос) или быть занижен, а разбор JSON целиком помещает тело в
   * память. Ограничение до разбора — дешёвая защита календаря от случайного
   * мегабайтного запроса; общую защиту тела заявки делает PT-021.
   */
  let text: string;
  try {
    text = await request.text();
  } catch {
    return json(deny(400, "bad_json", "Не удалось прочитать тело запроса."));
  }

  if (text.length > MAX_BODY_BYTES) {
    return json(
      deny(413, "too_large", `Тело больше ${MAX_BODY_BYTES} байт — это не похоже на список дат.`)
    );
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return json(deny(400, "bad_json", "Тело запроса не является JSON."));
  }

  const parsed = normalizeAvailabilityInput(raw);
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, error: "validation", issues: parsed.issues },
      { status: 422, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const { updatedAt } = await resolved.store.replace(parsed.slots);

    /**
     * Иначе процесс отдавал бы старый снимок ещё до 30 секунд — владелец
     * сохранил даты, открыл сайт и решил, что ничего не работает.
     */
    invalidateAvailabilitySnapshotCache();

    return NextResponse.json({
      ok: true,
      updatedAt,
      count: parsed.slots.length,
      slots: parsed.slots.map(toSlotView),
      label: buildAvailabilityLabel(parsed.slots),
    });
  } catch (error) {
    return fail(error instanceof Error ? error : new Error(String(error)), "PUT");
  }
}
