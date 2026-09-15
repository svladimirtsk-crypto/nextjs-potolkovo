/**
 * PT-016 · Хук клиента: строка календаря свободных дат замера.
 *
 * Почему запрос из браузера, а не чтение БД в серверном компоненте:
 * календарь показывается в `action-form` и в Шаге 2 калькулятора — оба
 * клиентские, а модалка калькулятора вообще висит в `app/providers.tsx`,
 * то есть выше любой страницы. Читать БД в `layout.tsx` означало бы сделать
 * динамическим весь сайт и потерять статическую генерацию ради одной строки.
 *
 * Поведение сознательно «сначала как было, потом уточняем»:
 *
 * - первый рендер (и серверный, и клиентский) — запасная строка из
 *   `content/availability.ts`. HTML не меняется, блок не прыгает;
 * - после гидрации приходит `GET /api/availability`. Если в БД календарь
 *   заполнен — строка заменяется настоящими датами, а при нуле будущих окон
 *   блок исчезает (это и есть автоскрытие просроченных дат без деплоя);
 * - запрос не удался, истёк таймаут, ответ не похож на ожидаемый — остаётся
 *   запасная строка. Календарь не стоит того, чтобы из-за него пропадал блок
 *   «почему сейчас» у каждого посетителя с плохой связью.
 *
 * Один запрос на страницу: три компонента делят модульный `inflight`, а
 * повторные открытия в той же вкладке в течение минуты берут значение из
 * `sessionStorage` (через безопасную обёртку PT-012 — приватный режим Safari
 * не должен ронять страницу).
 */
import { useEffect, useState } from "react";

import { getAvailabilityLabel } from "@/content/availability";
import { readWebStorage, writeWebStorage } from "@/lib/safe-storage";

const ENDPOINT = "/api/availability";
const STORAGE_KEY = "potolkovo.availability.v1";
/** Сколько секунд доверять значению из хранилища вкладки. */
const STORAGE_TTL_MS = 60_000;
/** Таймаут запроса: строка второстепенная, ждать её долго нельзя. */
const REQUEST_TIMEOUT_MS = 4_000;

type Remote = { label: string | null };
type Cached = { at: number; label: string | null };

let inflight: Promise<Remote | null> | null = null;

function readCached(): Cached | null {
  const raw = readWebStorage("session", STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Cached>;
    if (typeof parsed.at !== "number") return null;
    if (typeof parsed.label !== "string" && parsed.label !== null) return null;
    if (Date.now() - parsed.at > STORAGE_TTL_MS) return null;
    return { at: parsed.at, label: parsed.label };
  } catch {
    // Мусор в хранилище — как будто значения нет.
    return null;
  }
}

function writeCached(label: string | null): void {
  writeWebStorage("session", STORAGE_KEY, JSON.stringify({ at: Date.now(), label }));
}

async function requestRemote(): Promise<Remote | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(ENDPOINT, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!response.ok) return null;

    const data = (await response.json()) as { ok?: boolean; label?: unknown };
    if (!data || data.ok !== true) return null;
    if (typeof data.label !== "string" && data.label !== null) return null;

    return { label: data.label };
  } catch {
    // Сеть, таймаут, не-JSON — остаёмся на запасной строке.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function loadRemote(): Promise<Remote | null> {
  if (!inflight) {
    inflight = requestRemote().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

/**
 * Строка календаря либо `null`, если показывать нечего.
 *
 * Значение меняется асинхронно: сначала запасное из файла, затем — из БД.
 */
export function useAvailabilityLabel(): string | null {
  const [remote, setRemote] = useState<Remote | null>(null);

  useEffect(() => {
    let cancelled = false;

    const apply = (value: Remote | null) => {
      if (!cancelled && value) setRemote(value);
    };

    const cached = readCached();
    if (cached) {
      apply({ label: cached.label });
      return () => {
        cancelled = true;
      };
    }

    void loadRemote().then((value) => {
      apply(value);
      if (value) writeCached(value.label);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return remote ? remote.label : getAvailabilityLabel();
}
