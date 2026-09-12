/**
 * PT-004 · Rescue-заявка: полный снапшот, проверка ответа, реальное согласие.
 *
 * Что было не так (подтверждено чтением кода на HEAD, находки `A-03`, `T-307`):
 *
 * 1. В `/api/lead` уходило только `{ phone, consent: true, source, placement:
 *    "rescue", leadKind: "rescue", pagePath, grandTotal }`. Мастер получал
 *    сумму без состава: ни комнат, ни площадей, ни профилей, ни корзины света.
 *    Чтобы перезвонить по делу, расчёт приходилось восстанавливать со слов.
 * 2. Ответ сервера не проверялся вовсе — `markLeadSubmitted()` вызывался после
 *    любого статуса (см. `lib/lead/submit-lead.ts`).
 * 3. `consent: true` было захардкоженной константой: человек не видел текста
 *    согласия и не отмечал его.
 *
 * Здесь — только данные и транспорт. Состояние диалога (ожидание, ошибка,
 * повтор) живёт в `components/ui/confirm-dialog.tsx`, а склейка с контекстом
 * калькулятора — в `components/calculator-modal/use-rescue-lead.ts`.
 */
import { contacts } from "@/content/contacts";
import { trackLeadError, trackLeadSubmit } from "@/lib/analytics";
import type { CalculatorLeadSnapshot } from "@/lib/calculator/snapshot-types";
import { buildLeadSnapshotV2, type LeadSnapshotV2 } from "@/lib/calculator/types";
import { isValidPhone, normalizePhone } from "@/lib/normalize-phone";

import {
  collectLeadAttribution,
  leadSubmitFailureReason,
  resolveLeadEntry,
  resolveOrderIntent,
  submitLead,
  toLeadErrorMetricKind,
  type LeadSubmitFailureKind,
  type SubmitLeadOptions,
} from "./submit-lead";

export const RESCUE_PLACEMENT = "rescue" as const;
export const RESCUE_LEAD_KIND = "rescue" as const;

export type RescueLeadInput = {
  /** Номер, введённый в rescue-диалоге. Нормализуется здесь же. */
  phone: string;
  source: string;
  pagePath: string;
  entryMode?: string | null;
  snapshot: CalculatorLeadSnapshot | null;
  /** Итог потолка с минимумом и монтажом — из контекста модалки. */
  ceilingEffectiveTotal: number;
  lightingRegularTotal: number;
  lightingEffectiveTotal: number;
  /** Сумма, которую видел человек в момент закрытия. Фолбэк и сверка. */
  grandTotal: number;
};

export type RescueLeadPayload = {
  phone: string;
  consent: true;
  botcheck: "";
  source: string;
  placement: typeof RESCUE_PLACEMENT;
  leadKind: typeof RESCUE_LEAD_KIND;
  orderIntent: ReturnType<typeof resolveOrderIntent>;
  pagePath: string;
  attribution: Record<string, string>;
  snapshot?: LeadSnapshotV2;
  totals?: LeadSnapshotV2["totals"];
  grandTotal: number;
};

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Есть ли в расчёте что прикладывать.
 *
 * Намеренно НЕ используем флаг `hasInteracted` из стора калькулятора: он
 * ставится только на переходе Шаг 0 → 1/2, а rescue как раз и показывают
 * человеку, который дошёл до сводки Шага 0 и закрывает модалку, не дойдя до
 * формы. Основная форма таким флагом отсечь снапшот не может (там он
 * обязателен), а в rescue это означало бы ровно тот баг, который чиним:
 * сумма есть, состава нет.
 */
export function hasRescueCalculation(snapshot: CalculatorLeadSnapshot | null): boolean {
  if (!snapshot) return false;
  if (toNumber(snapshot.total) > 0) return true;
  if (toNumber(snapshot.lighting?.items?.length) > 0) return true;
  return toNumber(snapshot.lighting?.totalRub) > 0;
}

/** Полный payload rescue-заявки — тот же контракт, что у основной формы. */
export function buildRescueLeadPayload(input: RescueLeadInput): RescueLeadPayload {
  const { snapshot } = input;

  const leadSnapshot = hasRescueCalculation(snapshot)
    ? buildLeadSnapshotV2({
        snapshot,
        ceilingEffectiveTotal: input.ceilingEffectiveTotal,
        lightingRegularTotal: input.lightingRegularTotal,
        lightingEffectiveTotal: input.lightingEffectiveTotal,
        source: input.source,
        entry: resolveLeadEntry({
          placement: RESCUE_PLACEMENT,
          entryMode: input.entryMode,
        }),
      })
    : undefined;

  const lightingItemsCount = toNumber(snapshot?.lighting?.items?.length);
  const hasRooms = toNumber(snapshot?.area) > 0;

  return {
    phone: normalizePhone(input.phone),
    consent: true,
    botcheck: "",
    source: input.source,
    placement: RESCUE_PLACEMENT,
    leadKind: RESCUE_LEAD_KIND,
    orderIntent: resolveOrderIntent({
      discountMode: snapshot?.lightingDiscountMode ?? snapshot?.lighting?.discountMode ?? "none",
      lightingItemsCount,
      hasRooms,
    }),
    pagePath: input.pagePath,
    attribution: collectLeadAttribution(),
    ...(leadSnapshot ? { snapshot: leadSnapshot, totals: leadSnapshot.totals } : {}),
    /**
     * Сумма дублируется отдельным полем: если снапшота нет (человек закрыл
     * модалку до первого расчёта, но корзина света была не пуста в
     * несовместимом состоянии), мастер всё равно видит ориентир.
     */
    grandTotal: leadSnapshot?.totals.grand ?? toNumber(input.grandTotal),
  };
}

export type RescueSubmitOutcome =
  | { ok: true; message: string; leadId: string | null; callbackWindow: string }
  | { ok: false; kind: LeadSubmitFailureKind; message: string };

/**
 * Текст отказа: причина плюс конкретный запасной путь.
 *
 * «Попробуйте позже» в rescue-сценарии не работает: человек уже закрывает
 * сайт, второй попытки у нас, скорее всего, не будет. Поэтому сразу даём
 * телефон — это единственный канал, который не зависит от упавшего API.
 */
export function rescueFailureMessage(failure: {
  kind: LeadSubmitFailureKind;
  retryAfterSec?: number | null;
}): string {
  return `${leadSubmitFailureReason(failure)} Позвоните ${contacts.phoneDisplay} — расчёт продиктуете за минуту.`;
}

export type SubmitRescueLeadOptions = SubmitLeadOptions & {
  /** Выключить аналитику (тесты, где `window.ym` не нужен). */
  silent?: boolean;
};

/**
 * Отправляет rescue-заявку и возвращает исход для диалога.
 *
 * Аналитика здесь, а не в компоненте: `lead_submit` обязан считаться только
 * после подтверждённого сервером успеха, а `lead_error` — только после
 * реального отказа. Раньше rescue не отправлял `lead_submit` вообще, и в
 * Метрике заявки из «спасалки» были видны только по `lead_rescue_accepted`,
 * то есть по нажатию кнопки, а не по принятой заявке.
 */
export async function submitRescueLead(
  input: RescueLeadInput,
  options: SubmitRescueLeadOptions = {}
): Promise<RescueSubmitOutcome> {
  const normalized = normalizePhone(input.phone);

  if (!isValidPhone(normalized)) {
    return {
      ok: false,
      kind: "validation",
      message: "Проверьте номер: нужно 10 цифр после +7.",
    };
  }

  const payload = buildRescueLeadPayload({ ...input, phone: normalized });
  const result = await submitLead(payload, options);

  if (result.ok) {
    if (!options.silent) {
      trackLeadSubmit({
        placement: RESCUE_PLACEMENT,
        leadKind: RESCUE_LEAD_KIND,
        orderIntent: payload.orderIntent,
        grandTotal: payload.grandTotal,
        rooms: payload.snapshot?.rooms.length ?? 0,
        lightingItems: payload.snapshot?.lighting?.items.length ?? 0,
        source: payload.source,
        pagePath: payload.pagePath,
        leadId: result.leadId,
      });
    }

    return {
      ok: true,
      leadId: result.leadId,
      callbackWindow: result.callbackWindow,
      message: result.leadId
        ? `Заявка №${result.leadId} сохранена${result.callbackWindow ? `. Перезвоню ${result.callbackWindow}` : ""}.`
        : "Заявка сохранена.",
    };
  }

  if (!options.silent) {
    trackLeadError({
      kind: toLeadErrorMetricKind(result.kind),
      placement: RESCUE_PLACEMENT,
    });
  }

  return { ok: false, kind: result.kind, message: rescueFailureMessage(result) };
}
