"use client";

import { useState, useSyncExternalStore, type FormEvent } from "react";

import {
  MAX_DAYS_AHEAD,
  addDaysIso,
  buildAvailabilityLabel,
  formatSlot,
  isIsoDate,
  moscowTodayIso,
  sortSlots,
} from "@/lib/availability/format";
import { MAX_NOTE_LENGTH, MAX_SLOTS_PER_UPDATE } from "@/lib/availability/input";
import type { AvailabilitySlot, AvailabilitySlotView } from "@/lib/availability/types";
import { readWebStorage, removeWebStorage, writeWebStorage } from "@/lib/safe-storage";

/**
 * PT-016 · Форма владельца: свободные даты замера.
 *
 * Расчёт на правку с телефона за 20 секунд: пароль ввёл (или он подставился из
 * вкладки) → «Загрузить» → добавил даты → «Сохранить». Деплой не нужен.
 *
 * Список заменяется целиком (`PUT`), поэтому правки сначала копятся локально и
 * уходят одним сохранением: обрыв связи на половине списка не оставит сайт с
 * половинами дат. Строка-превью «как это увидит клиент» считается той же
 * чистой функцией, что и на сервере (`buildAvailabilityLabel`).
 *
 * Сохранённый пароль вкладки читается через `useSyncExternalStore`, а не через
 * `setState` в эффекте: `sessionStorage` — внешний источник, которого нет при
 * серверном рендере, и React 19 требует для него именно подписку на снимок
 * (правило 0.7 ТЗ и линтер реакт-компилятора запрещают синхронный `setState`
 * в эффекте — он даёт кадр с рассогласованным состоянием).
 */

const ENDPOINT = "/api/admin/availability";
const TOKEN_KEY = "potolkovo.availability.token";

type Message = { kind: "ok" | "error"; text: string } | null;

type CalendarState = {
  today: string;
  label: string | null;
  slots: AvailabilitySlot[];
  expired: AvailabilitySlotView[];
  updatedAt: string | null;
  configured: boolean;
};

type CallResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; status: number; message: string };

function describeError(data: unknown, status: number): string {
  const body = (data ?? {}) as { message?: unknown; issues?: unknown };

  if (typeof body.message === "string" && body.message) return body.message;

  if (Array.isArray(body.issues)) {
    const text = body.issues
      .map((issue) => {
        const item = issue as { path?: unknown; message?: unknown };
        return `${String(item.path ?? "")}: ${String(item.message ?? "")}`.trim();
      })
      .filter(Boolean)
      .join(" · ");
    if (text) return text;
  }

  if (status === 401) return "Неверный пароль.";
  if (status === 503)
    return "Сервер не настроен для правки календаря: нет AVAILABILITY_TOKEN или DATABASE_URL.";
  return status ? `Ошибка ${status}.` : "Сервер не ответил — проверьте связь.";
}

async function callAdmin(
  method: "GET" | "PUT",
  token: string,
  body?: { slots: AvailabilitySlot[] }
): Promise<CallResult> {
  try {
    const response = await fetch(ENDPOINT, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;

    if (!response.ok || !data || data.ok !== true) {
      return { ok: false, status: response.status, message: describeError(data, response.status) };
    }

    return { ok: true, data };
  } catch {
    return { ok: false, status: 0, message: "Сервер не ответил — проверьте связь." };
  }
}

/**
 * Подписка на `sessionStorage` не нужна: значения меняем только мы и только в
 * этой вкладке (событие `storage` приходит лишь из других вкладок, а
 * `sessionStorage` у вкладки свой). React перечитывает снимок при каждом
 * рендере, которого достаточно — его запускает ввод пароля или ответ сервера.
 */
function subscribeTokenStorage(): () => void {
  return () => {};
}

function readTokenSnapshot(): string {
  return readWebStorage("session", TOKEN_KEY) ?? "";
}

/** На сервере хранилища вкладки нет — там пароль всегда пустой. */
function readTokenServerSnapshot(): string {
  return "";
}

const fieldClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-base text-slate-900 outline-none focus:border-slate-900";
const buttonClass =
  "rounded-xl bg-slate-950 px-4 py-3 text-base font-semibold text-white disabled:opacity-50";

export function AvailabilityAdmin() {
  const storedToken = useSyncExternalStore(
    subscribeTokenStorage,
    readTokenSnapshot,
    readTokenServerSnapshot
  );
  /** `null` — человек ещё не трогал поле, показываем сохранённый пароль вкладки. */
  const [tokenDraft, setTokenDraft] = useState<string | null>(null);
  const token = tokenDraft ?? storedToken;
  const [state, setState] = useState<CalendarState | null>(null);
  const [busy, setBusy] = useState<"load" | "save" | null>(null);
  const [message, setMessage] = useState<Message>(null);
  const [dateInput, setDateInput] = useState("");
  const [noteInput, setNoteInput] = useState("");

  /** Замена списка с пересчётом превью той же функцией, что и на сервере. */
  function applySlots(next: AvailabilitySlot[]) {
    const slots = sortSlots(next);
    setState((prev) => (prev ? { ...prev, slots, label: buildAvailabilityLabel(slots) } : prev));
  }

  async function handleLoad(event: FormEvent) {
    event.preventDefault();
    const value = token.trim();
    if (!value) {
      setMessage({ kind: "error", text: "Введите пароль (AVAILABILITY_TOKEN)." });
      return;
    }

    setBusy("load");
    setMessage(null);
    const result = await callAdmin("GET", value);
    setBusy(null);

    if (!result.ok) {
      if (result.status === 401) removeWebStorage("session", TOKEN_KEY);
      setMessage({ kind: "error", text: result.message });
      return;
    }

    const data = result.data as unknown as {
      today: string;
      label: string | null;
      slots: AvailabilitySlotView[];
      expired: AvailabilitySlotView[];
      updatedAt: string | null;
      configured: boolean;
    };

    writeWebStorage("session", TOKEN_KEY, value);
    setState({
      today: data.today,
      label: data.label,
      slots: data.slots.map(({ date, note }) => ({ date, note })),
      expired: data.expired ?? [],
      updatedAt: data.updatedAt,
      configured: data.configured,
    });
    setMessage(null);
  }

  function handleAdd(event: FormEvent) {
    event.preventDefault();
    if (!state) return;

    const date = dateInput.trim();
    const today = state.today || moscowTodayIso();

    if (!isIsoDate(date)) {
      setMessage({ kind: "error", text: "Выберите дату замера." });
      return;
    }
    if (date < today) {
      setMessage({ kind: "error", text: `${date} уже прошла — выберите дату не раньше ${today}.` });
      return;
    }
    if (date > addDaysIso(today, MAX_DAYS_AHEAD)) {
      setMessage({
        kind: "error",
        text: `${date} дальше ${MAX_DAYS_AHEAD} дней — максимум ${addDaysIso(today, MAX_DAYS_AHEAD)}.`,
      });
      return;
    }
    if (state.slots.some((slot) => slot.date === date)) {
      setMessage({ kind: "error", text: `${formatSlot(date)} уже в списке.` });
      return;
    }
    if (state.slots.length >= MAX_SLOTS_PER_UPDATE) {
      setMessage({ kind: "error", text: `Больше ${MAX_SLOTS_PER_UPDATE} дат добавить нельзя.` });
      return;
    }

    const note = noteInput.trim().slice(0, MAX_NOTE_LENGTH);
    applySlots([...state.slots, { date, note: note || null }]);
    setDateInput("");
    setNoteInput("");
    setMessage(null);
  }

  async function handleSave() {
    if (!state) return;

    setBusy("save");
    setMessage(null);
    const result = await callAdmin("PUT", token.trim(), { slots: state.slots });
    setBusy(null);

    if (!result.ok) {
      setMessage({ kind: "error", text: result.message });
      return;
    }

    const data = result.data as unknown as {
      count: number;
      label: string | null;
      updatedAt: string;
      slots: AvailabilitySlotView[];
    };

    setState((prev) =>
      prev
        ? {
            ...prev,
            slots: data.slots.map(({ date, note }) => ({ date, note })),
            label: data.label,
            updatedAt: data.updatedAt,
            configured: true,
            expired: [],
          }
        : prev
    );
    setMessage({
      kind: "ok",
      text: data.count
        ? `Сохранено дат: ${data.count}. На сайте: «${data.label ?? "блок скрыт"}».`
        : "Список очищен — блок «свободные даты» на сайте скрыт.",
    });
  }

  function handleSignOut() {
    removeWebStorage("session", TOKEN_KEY);
    setTokenDraft("");
    setState(null);
    setMessage(null);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto w-full max-w-xl space-y-5">
        <header>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">Календарь замеров</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Свободные даты замера. Сохранение меняет сайт сразу, без деплоя: у посетителей строка
            обновится в течение минуты.
          </p>
        </header>

        {!state ? (
          <form
            onSubmit={handleLoad}
            className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5"
          >
            <label className="block text-sm font-semibold text-slate-900" htmlFor="admin-token">
              Пароль (AVAILABILITY_TOKEN)
            </label>
            <input
              id="admin-token"
              type="password"
              autoComplete="current-password"
              className={fieldClass}
              value={token}
              onChange={(event) => setTokenDraft(event.target.value)}
              placeholder="Введите пароль календаря"
            />
            <button type="submit" className={buttonClass} disabled={busy === "load"}>
              {busy === "load" ? "Загрузка…" : "Загрузить календарь"}
            </button>
            <p className="text-xs leading-5 text-slate-500">
              Пароль хранится только в этой вкладке браузера и стирается при её закрытии.
            </p>
          </form>
        ) : (
          <>
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Как это видит клиент
              </p>
              <p className="mt-2 text-base font-medium leading-7 text-slate-900">
                {state.label ?? "Блок «свободные даты» скрыт — будущих окон нет."}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                {state.configured
                  ? `Источник: база. Обновлено: ${state.updatedAt ?? "—"}.`
                  : "Источник: файл content/availability.ts (в базе ещё не сохраняли)."}
              </p>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-900">
                Свободные даты ({state.slots.length})
              </h2>

              {state.slots.length === 0 ? (
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Пока ни одной даты. Добавьте первую — или сохраните пустой список, если окон нет.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-slate-100">
                  {state.slots.map((slot) => (
                    <li key={slot.date} className="flex items-center gap-3 py-2.5">
                      <span className="flex-1 text-base text-slate-900">
                        {formatSlot(slot.date, slot.note)}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          applySlots(state.slots.filter((item) => item.date !== slot.date))
                        }
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600"
                      >
                        Убрать
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <form onSubmit={handleAdd} className="mt-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Дата
                    </span>
                    <input
                      type="date"
                      className={fieldClass}
                      value={dateInput}
                      min={state.today || moscowTodayIso()}
                      max={addDaysIso(state.today || moscowTodayIso(), MAX_DAYS_AHEAD)}
                      onChange={(event) => setDateInput(event.target.value)}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Подпись (необязательно)
                    </span>
                    <input
                      type="text"
                      className={fieldClass}
                      value={noteInput}
                      maxLength={MAX_NOTE_LENGTH}
                      placeholder="утро, после 17:00"
                      onChange={(event) => setNoteInput(event.target.value)}
                    />
                  </label>
                </div>
                <button
                  type="submit"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-900"
                >
                  Добавить в список
                </button>
              </form>
            </section>

            <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
              <button
                type="button"
                onClick={handleSave}
                className={`${buttonClass} w-full`}
                disabled={busy === "save"}
              >
                {busy === "save" ? "Сохранение…" : "Сохранить на сайте"}
              </button>

              {message ? (
                <p
                  data-testid="admin-message"
                  className={
                    message.kind === "ok"
                      ? "rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm leading-6 text-emerald-900 ring-1 ring-emerald-200"
                      : "rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm leading-6 text-rose-900 ring-1 ring-rose-200"
                  }
                >
                  {message.text}
                </p>
              ) : null}

              {state.expired.length > 0 ? (
                <p className="text-xs leading-5 text-slate-500">
                  Прошедшие даты ({state.expired.length}):{" "}
                  {state.expired.map((slot) => slot.display).join(", ")}. На сайте они уже не
                  показываются и при сохранении не отправляются.
                </p>
              ) : null}

              <button
                type="button"
                onClick={handleSignOut}
                className="text-sm font-medium text-slate-500 underline"
              >
                Сменить пароль
              </button>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
