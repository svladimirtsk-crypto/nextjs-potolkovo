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

export function readCalcDraft(now: number = Date.now()): CalcDraft | null {
  const store = storage();
  if (!store) return null;
  let raw: string | null = null;
  try {
    raw = store.getItem(CALC_DRAFT_STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<CalcDraft>;
    if (parsed?.version !== 2) return null;
    if (!Array.isArray(parsed.rooms) || parsed.rooms.length === 0) return null;
    const savedAt = Number(parsed.savedAt ?? 0);
    if (!Number.isFinite(savedAt) || now - savedAt > CALC_DRAFT_TTL_MS) {
      clearCalcDraft();
      return null;
    }
    return {
      version: 2,
      savedAt,
      scenario: (parsed.scenario ?? "standard") as SolutionScenario,
      scope: parsed.scope === "object" ? "object" : "room",
      rooms: parsed.rooms as V2RoomConfig[],
      cart: (parsed.cart ?? null) as LightingSnapshot | null,
      totalArea: Number(parsed.totalArea ?? 0),
      totalRub: Number(parsed.totalRub ?? 0),
    };
  } catch {
    return null;
  }
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
