import { applyMinimumOrder, pricing } from "@/content/pricing";
import type { CalculatorRoomBreakdown } from "@/lib/calculator/snapshot-types";
import { ledRoleOf, type LedRole } from "@/lib/lighting/led-hardware";
import { LED_RULES_VERSION } from "@/lib/lighting/led-project";
import { projectLightingTasks } from "@/lib/lighting/project-lighting-tasks";

/**
 * LED-21/23 · Решение владельца от 23.10.2026, не паспорт EKS и не счёт.
 * Лента/управление — отдельно для парящего, линий и карниза; монтаж LED ещё
 * нужно согласовать. Исключение: действующая ставка карниза 1 500 ₽ за БП —
 * стоимость самого БП. Только ЯВНО привязанный к задаче SKU заменяет эту
 * часть ставки; без привязки мы не вычитаем ничего и предупреждаем о риске
 * двойного начисления. Скидки 10/25 % не меняются.
 */
export const LED_COMPOSITION_VERSION = "led-composition-owner-2026-10-23-v1";
export const LED_QUOTE_RULES_VERSION = "led-intake-1";

export type LedPsuAssignment = { taskId: string; sku: string; qty: number };
/** Declared UI intent, NOT verified geometry/zone wiring or an accepted BOM. */
export type LedPlanningDraft = {
  taskId: string | null;
  meters: number | null;
  rows: number;
  zones: number;
  stripSku: string | null;
  source: "task" | "manual";
  confirmed: false;
};
export type LedCommercialItem = {
  sku: string;
  name: string;
  qty: number;
  priceRub: number;
  kind?: string;
  system?: string;
  unit?: string;
  packQty?: number | null;
  moscowStock?: number | null;
  availabilityState?: "unknown" | "reported_zero" | "reported_positive" | "supplier_unavailable";
};
export type LedCommercialLighting = {
  items?: readonly LedCommercialItem[];
  ledPsuAssignments?: readonly LedPsuAssignment[];
  ledPlanning?: readonly LedPlanningDraft[];
  catalogVersion?: string;
  discountMode?: string;
};
export type LedCommercialRoom = Pick<CalculatorRoomBreakdown,
  "id" | "label" | "floatingEnabled" | "floatingLength" | "lightLinesEnabled" | "lightLinesLength" |
  "corniceType" | "corniceLightingEnabled" | "corniceLightingLength" | "corniceLightingPowerSupplies">;

function commercialRoleOf(item: LedCommercialItem): LedRole | null {
  // A lead's `kind` is an untrusted string. Do not coerce a track PSU into
  // the LED group because its name happens to contain «блок питания».
  return ledRoleOf({ name: item.name, kind: item.kind === "LED_STRIP" ? "LED_STRIP" : undefined,
    system: item.system === "LED_STRIP" ? "LED_STRIP" : undefined });
}

export type LedPsuReplacement = {
  /** Снимается с сырой суммы потолка, ДО повторного применения минимального заказа. */
  includedRub: number;
  assignments: LedPsuAssignment[];
  issues: string[];
};

/** Нельзя подменить включённый БП «произвольной коробкой» или вычесть его дважды. */
export function evaluateLedPsuReplacement(input: {
  rooms: readonly LedCommercialRoom[];
  lighting: LedCommercialLighting | null | undefined;
}): LedPsuReplacement {
  const { rooms, lighting } = input;
  const reported = lighting?.ledPsuAssignments ?? [];
  if (reported.length === 0) return { includedRub: 0, assignments: [], issues: [] };
  if (lighting?.discountMode === "lighting-only") {
    return { includedRub: 0, assignments: [], issues: ["Заказ только света: потолочная ставка не применяется, заменять БП в ней нельзя."] };
  }

  const tasks = projectLightingTasks(rooms).filter((task) => task.feature === "cornice");
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const roomById = new Map(rooms.map((room) => [room.id, room]));
  const itemsBySku = new Map((lighting?.items ?? []).map((item) => [item.sku, item]));
  const perTask = new Map<string, number>();
  const perSku = new Map<string, number>();
  const pairs = new Set<string>();
  const issues: string[] = [];

  if (taskById.size !== tasks.length || roomById.size !== rooms.length ||
      itemsBySku.size !== (lighting?.items ?? []).length) {
    issues.push("Повторяются идентификаторы комнаты, задачи или позиции — нельзя однозначно заменить включённый БП.");
  }
  for (const assignment of reported) {
    const task = taskById.get(assignment.taskId);
    const room = task && roomById.get(task.roomId);
    const item = itemsBySku.get(assignment.sku);
    const pair = `${assignment.taskId}\u0000${assignment.sku}`;
    if (!task || !room || room.corniceLightingEnabled !== true || room.corniceType === "none") {
      issues.push(`Задача «${assignment.taskId}» не является действующей подсветкой карниза.`);
      continue;
    }
    if (!item || commercialRoleOf(item) !== "psu" || item.unit !== "pcs") {
      issues.push(`SKU «${assignment.sku}» не является выбранным штучным LED-БП.`);
      continue;
    }
    if (item.availabilityState === "supplier_unavailable" || item.availabilityState === "reported_zero" ||
        item.moscowStock === 0) {
      issues.push(`БП «${assignment.sku}»: известный ноль в Москве или пометка недоступности — замена ставки без подтверждения запрещена.`);
      continue;
    }
    if (!Number.isInteger(assignment.qty) || assignment.qty <= 0 || pairs.has(pair)) {
      issues.push(`Неверная или повторная привязка БП «${assignment.sku}» к «${assignment.taskId}».`);
      continue;
    }
    pairs.add(pair);
    perTask.set(task.id, (perTask.get(task.id) ?? 0) + assignment.qty);
    perSku.set(item.sku, (perSku.get(item.sku) ?? 0) + assignment.qty);
    const allowanceCount = room.corniceLightingPowerSupplies;
    if (!Number.isInteger(allowanceCount) || (allowanceCount ?? -1) < 0 ||
        (perTask.get(task.id) ?? 0) > (allowanceCount ?? 0)) {
      issues.push(`В задаче «${task.id}» привязано больше БП, чем заложено в потолочной ставке.`);
    }
    if (!Number.isInteger(item.qty) || (perSku.get(item.sku) ?? 0) > item.qty) {
      issues.push(`SKU «${item.sku}» привязан к задачам чаще, чем выбран в корзине.`);
    }
  }

  // All-or-nothing: нельзя применять часть вычета, если остальные связи
  // противоречивы. Контакт пользователя принимаем; сумму проверяет специалист.
  if (issues.length) return { includedRub: 0, assignments: [], issues: [...new Set(issues)] };
  return {
    includedRub: reported.reduce((sum, assignment) => sum + assignment.qty * pricing.corniceLighting.psu, 0),
    assignments: reported.map((assignment) => ({ ...assignment })),
    issues: [],
  };
}

/** Минимальный заказ считается заново: вычет из суммы ПОСЛЕ минимума неверен. */
export function ceilingAfterLedReplacement(rawCeilingRub: number, replacedRub: number) {
  return applyMinimumOrder(Math.max(0, rawCeilingRub - replacedRub));
}

export type LedIntakeReview = {
  status: "needs_review";
  commercialStatus: "needs_review";
  quoteVersion: string;
  rulesVersion: string;
  compositionVersion: string;
  equipment: "extra_except_linked_cornice_psu";
  installation: "unknown";
  tasks: Array<{ id: string; roomId: string; roomLabel: string; feature: "floating" | "light-lines" | "cornice"; geometryMeters: number | null }>;
  planning: LedPlanningDraft[];
  bom: Array<{ sku: string; name: string; role: LedRole; qty: number; unit: string; priceRub: number; taskId: string | null; availabilityState: NonNullable<LedCommercialItem["availabilityState"]> }>;
  assignments: LedPsuAssignment[];
  replacedCeilingRub: number;
  unlinkedCornicePsuQty: number;
  questions: string[];
};

/** Revision fingerprint, НЕ подпись и не подтверждение цены: сервер пересчитывает заново. */
function revision(value: unknown): string {
  const text = JSON.stringify(value);
  let one = 0x811c9dc5;
  let two = 0x93e95ecb;
  for (let i = 0; i < text.length; i += 1) {
    one = Math.imul(one ^ text.charCodeAt(i), 0x01000193);
    two = Math.imul(two ^ text.charCodeAt(i), 0x01000193);
  }
  return `${(one >>> 0).toString(16).padStart(8, "0")}${(two >>> 0).toString(16).padStart(8, "0")}`;
}

/**
 * LED-22/23 · Честный intake, не электрически/коммерчески подтверждённая смета.
 * Геометрию комнаты и состав корзины сохраняем раздельно: без явной привязки
 * нельзя объявить один SKU ленты подходящим ко всем зонам. Вопросы и BOM
 * сохраняются даже при отсутствии части оборудования (lead не теряем).
 */
export function buildLedIntakeReview(input: {
  rooms: readonly LedCommercialRoom[];
  lighting: LedCommercialLighting | null | undefined;
  catalogVersion?: string | null;
}): LedIntakeReview | null {
  const { rooms, lighting } = input;
  const tasks = projectLightingTasks(rooms).map(({ id, roomId, roomLabel, feature, geometryMeters }) =>
    ({ id, roomId, roomLabel, feature, geometryMeters }));
  const selected = (lighting?.items ?? []).flatMap((item) => {
    const role = commercialRoleOf(item);
    return role && item.qty > 0 ? [{ item, role }] : [];
  });
  const planning = (lighting?.ledPlanning ?? []).map((item) => ({ ...item }));
  if (!tasks.length && !selected.length && !(lighting?.ledPsuAssignments?.length) && !planning.length) return null;

  const replacement = evaluateLedPsuReplacement({ rooms, lighting });
  const assignments = replacement.assignments;
  const questions: string[] = [
    ...replacement.issues,
    ...tasks.map((task) => `${task.roomLabel} · ${task.feature}: подтвердить ряды ленты, модель и мощность, зоны/цепи, БП и управление по паспортам.`),
  ];
  if (!tasks.length) questions.push("Указать помещение, длину и схему для выбранного LED-оборудования.");
  if (selected.length && tasks.length) questions.push("Связать выбранные позиции с конкретными зонами и проверить метраж/покупные единицы.");
  for (const intent of planning) {
    const task = tasks.find((candidate) => candidate.id === intent.taskId);
    if (intent.taskId && !task) questions.push(`Задача ${intent.taskId} отсутствует в текущих помещениях — не переносить назначение автоматически.`);
    if (task && intent.meters !== null && task.geometryMeters !== null &&
        Math.abs(intent.meters - task.geometryMeters) > 0.02) {
      questions.push(`${task.roomLabel}: введённый метраж ${intent.meters} м отличается от задачи ${task.geometryMeters} м — подтвердить источник.`);
    }
    if (intent.zones > 1) questions.push(`Зон управления ${intent.zones}: проверить схему, отдельный контроллер на каждую зону и совместимость цепей.`);
    if (intent.stripSku && !(lighting?.items ?? []).some((item) => item.sku === intent.stripSku)) {
      questions.push(`Лента ${intent.stripSku} указана в черновике подбора, но не добавлена в корзину — не включать в цену или BOM без выбора.`);
    }
  }
  let unlinkedCornicePsuQty = 0;
  if (lighting?.discountMode !== "lighting-only" && tasks.some((task) => task.feature === "cornice")) {
    for (const { item, role } of selected) {
      if (role !== "psu") continue;
      const linkedQty = assignments.filter((assignment) => assignment.sku === item.sku)
        .reduce((sum, assignment) => sum + assignment.qty, 0);
      if (linkedQty < item.qty) {
        unlinkedCornicePsuQty += item.qty - linkedQty;
        questions.push(`БП ${item.sku}: ${item.qty - linkedQty} шт. не привязаны к задаче карниза. В ставке уже есть БП: проверить двойное начисление и назначение SKU до коммерческой сметы.`);
      }
    }
  }
  questions.push("Уточнить состав монтажа LED и единицу цены/упаковку EKS; наличие и резерв только в Москве. До сверки это не коммерческий счёт.");
  const bom: LedIntakeReview["bom"] = selected.map(({ item, role }) => ({
    sku: item.sku, name: item.name, role, qty: item.qty, unit: item.unit ?? "",
    priceRub: item.priceRub,
    taskId: assignments.find((assignment) => assignment.sku === item.sku)?.taskId ?? null,
    availabilityState: item.availabilityState ?? (item.moscowStock === 0 ? "reported_zero" : "unknown"),
  }));
  const quoteVersion = `ledq1-${revision({
    rules: LED_QUOTE_RULES_VERSION, engineering: LED_RULES_VERSION,
    composition: LED_COMPOSITION_VERSION, includedPsuRub: pricing.corniceLighting.psu,
    catalog: selected.length ? (input.catalogVersion !== undefined ? input.catalogVersion : lighting?.catalogVersion ?? null) : null,
    tasks: [...tasks].sort((a, b) => a.id.localeCompare(b.id)),
    planning: [...planning].sort((a, b) => (a.taskId ?? "").localeCompare(b.taskId ?? "")),
    bom: [...bom].sort((a, b) => a.sku.localeCompare(b.sku)),
    reportedAssignments: [...(lighting?.ledPsuAssignments ?? [])].sort((a, b) =>
      a.taskId.localeCompare(b.taskId) || a.sku.localeCompare(b.sku)),
    mode: lighting?.discountMode ?? "none",
  })}`;
  return {
    status: "needs_review", commercialStatus: "needs_review", quoteVersion,
    rulesVersion: `${LED_QUOTE_RULES_VERSION}+${LED_RULES_VERSION}`,
    compositionVersion: LED_COMPOSITION_VERSION,
    equipment: "extra_except_linked_cornice_psu", installation: "unknown",
    tasks, planning, bom, assignments, replacedCeilingRub: replacement.includedRub, unlinkedCornicePsuQty,
    questions: [...new Set(questions)],
  };
}
