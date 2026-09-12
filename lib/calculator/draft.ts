/**
 * T-023 · Черновик расчёта в `sessionStorage`.
 *
 * Хранит минимум, нужный чтобы предложить «продолжить прошлый расчёт»:
 * комнаты, сценарий и корзину света. Ключ версионирован — при смене
 * структуры старые черновики просто игнорируются.
 */
import type { LightingSnapshot, SolutionScenario } from "@/lib/calculator-modal-types";
import type { V2RoomConfig } from "@/lib/calculator/room-snapshot";

export const CALC_DRAFT_STORAGE_KEY = "potolkovo:calc-draft:v2";

/** Черновик живёт в пределах вкладки; старше 12 часов — не предлагаем. */
export const CALC_DRAFT_TTL_MS = 12 * 60 * 60 * 1000;

export type CalcDraft = {
  version: 2;
  savedAt: number;
  scenario: SolutionScenario;
  scope: "room" | "object";
  rooms: V2RoomConfig[];
  cart: LightingSnapshot | null;
  totalArea: number;
  totalRub: number;
};

export type CalcDraftInput = Omit<CalcDraft, "version" | "savedAt">;

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function saveCalcDraft(input: CalcDraftInput): void {
  const store = storage();
  if (!store) return;
  if (!input.rooms.length) return;
  const draft: CalcDraft = { version: 2, savedAt: Date.now(), ...input };
  try {
    store.setItem(CALC_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // приватный режим / переполнение — черновик не критичен
  }
}

/**
 * Результат чтения черновика.
 *
 * PT-007 (раздел 3.2 ТЗ): «неизвестная версия — безопасный отказ с явным
 * выбором „начать новый расчёт“, не молчаливая перезапись и не падение UI».
 * Прежний `readCalcDraft` возвращал `null` и за чужую версию, и за битые
 * данные, и за их отсутствие — вызывающий не мог отличить «черновика нет» от
 * «черновик есть, но не читается» и молча перезаписывал его новым расчётом.
 *
 * Просроченный черновик (старше `CALC_DRAFT_TTL_MS`) намеренно считается
 * `empty`: правило «старше 12 часов — не предлагаем» означает, что предлагать
 * его продолжить нельзя, а значит и показывать отказ незачем.
 */
export type CalcDraftRead =
  | { status: "empty" }
  | { status: "ok"; draft: CalcDraft }
  | { status: "unreadable"; reason: "unknown-version" | "corrupt" };

export function inspectCalcDraft(now: number = Date.now()): CalcDraftRead {
  const store = storage();
  if (!store) return { status: "empty" };
  let raw: string | null = null;
  try {
    raw = store.getItem(CALC_DRAFT_STORAGE_KEY);
  } catch {
    return { status: "empty" };
  }
  if (!raw) return { status: "empty" };

  let parsed: Partial<CalcDraft>;
  try {
    parsed = JSON.parse(raw) as Partial<CalcDraft>;
  } catch {
    return { status: "unreadable", reason: "corrupt" };
  }

  /**
   * Ключ версионирован (`:v2`), поэтому черновик прежней схемы лежит под своим
   * ключом и сюда не попадает — мигрировать нечего. Неизвестная версия здесь —
   * это запись, которую оставил более новый код; молча затирать её нельзя.
   */
  if (parsed?.version !== 2) return { status: "unreadable", reason: "unknown-version" };
  if (!Array.isArray(parsed.rooms) || parsed.rooms.length === 0) {
    return { status: "unreadable", reason: "corrupt" };
  }

  const savedAt = Number(parsed.savedAt ?? 0);
  if (!Number.isFinite(savedAt) || now - savedAt > CALC_DRAFT_TTL_MS) {
    clearCalcDraft();
    return { status: "empty" };
  }

  return {
    status: "ok",
    draft: {
      version: 2,
      savedAt,
      scenario: (parsed.scenario ?? "standard") as SolutionScenario,
      scope: parsed.scope === "object" ? "object" : "room",
      rooms: parsed.rooms as V2RoomConfig[],
      cart: (parsed.cart ?? null) as LightingSnapshot | null,
      totalArea: Number(parsed.totalArea ?? 0),
      totalRub: Number(parsed.totalRub ?? 0),
    },
  };
}

export function readCalcDraft(now: number = Date.now()): CalcDraft | null {
  const result = inspectCalcDraft(now);
  return result.status === "ok" ? result.draft : null;
}

export function clearCalcDraft(): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(CALC_DRAFT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** «Продолжить прошлый расчёт (48 м², 72 000 ₽)?» */
export function describeCalcDraft(draft: CalcDraft): string {
  const area = new Intl.NumberFormat("ru-RU").format(Math.round(draft.totalArea));
  const total = new Intl.NumberFormat("ru-RU").format(Math.round(draft.totalRub));
  return `${area} м², ${total} ₽`;
}
