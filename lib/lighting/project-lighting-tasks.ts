import type { CalculatorLeadSnapshot, CalculatorRoomBreakdown } from "@/lib/calculator/snapshot-types";
import { pricing } from "@/content/pricing";

export type ProjectLightingTask = {
  id: string;
  roomId: string;
  roomLabel: string;
  feature: "floating" | "light-lines" | "cornice";
  title: string;
  geometryMeters: number | null;
  status: "needs_review";
};
type TaskRoom = Pick<CalculatorRoomBreakdown, "id" | "label" | "floatingEnabled" | "floatingLength" | "lightLinesEnabled" | "lightLinesLength" | "corniceLightingEnabled" | "corniceLightingLength" | "corniceType">;
const meters = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
const selected = (flag: boolean | undefined, length: unknown) => flag === true || (flag === undefined && meters(length) !== null);

/** Projection of existing room data, not an electrical BOM, SKU selection or price calculator. */
export function projectLightingTasks(rooms: readonly TaskRoom[]): ProjectLightingTask[] {
  return rooms.flatMap(room => {
    const tasks: ProjectLightingTask[] = [];
    const add = (feature: ProjectLightingTask["feature"], title: string, value: unknown) => tasks.push({
      id: `${room.id}:${feature}`, roomId: room.id, roomLabel: room.label, feature, title, geometryMeters: meters(value), status: "needs_review",
    });
    if (selected(room.floatingEnabled, room.floatingLength)) add("floating", "Парящий контур", room.floatingLength);
    if (selected(room.lightLinesEnabled, room.lightLinesLength)) add("light-lines", "Световые линии", room.lightLinesLength);
    if (room.corniceType !== "none" && selected(room.corniceLightingEnabled, room.corniceLightingLength)) add("cornice", "Подсветка карниза", room.corniceLightingLength);
    return tasks;
  });
}

/**
 * LED-04 · Путь к каталогу из КОНКРЕТНОЙ задачи комнаты, не ко всему проекту.
 * Имя комнаты не пишем в URL (оно может содержать личные данные); roomId нужен
 * лишь для сопоставления с открытым расчётом в этой вкладке. При reload без
 * снапшота каталог не будет утверждать, что восстановил комнату/комплект.
 */
export function ledCatalogHrefForTask(task: ProjectLightingTask): string {
  const params = new URLSearchParams({ led: "1", room: task.roomId, feature: task.feature });
  const metersValue = task.geometryMeters;
  if (metersValue !== null && Number.isFinite(metersValue) && metersValue > 0 && metersValue <= 300) {
    const roundedUp = Math.ceil(metersValue * 100 - 1e-9) / 100;
    if (roundedUp <= 300) params.set("meters", String(roundedUp));
  }
  return `/uslugi/prodazha-trekovogo-osveshcheniya?${params.toString()}#price`;
}

export function snapshotLightingTasks(snapshot: CalculatorLeadSnapshot | null | undefined): ProjectLightingTask[] {
  if (!snapshot) return [];
  if (snapshot.roomBreakdown?.length) return projectLightingTasks(snapshot.roomBreakdown);
  if (snapshot.roomBreakdown || snapshot.area <= 0) return [];
  return projectLightingTasks([{ id: "legacy-object", label: "Сохранённый расчёт", floatingEnabled: snapshot.floatingEnabled,
    floatingLength: snapshot.floatingLength, lightLinesEnabled: snapshot.lightLinesEnabled, lightLinesLength: snapshot.lightLinesLength,
    corniceLightingEnabled: snapshot.corniceLightingEnabled, corniceLightingLength: snapshot.corniceLightingLength }]);
}

export function lightingTaskLines(rooms: readonly TaskRoom[]): string[] {
  const tasks = projectLightingTasks(rooms);
  if (!tasks.length) return [];
  return ["LED-ЗАДАЧИ ПО ПОМЕЩЕНИЯМ — НУЖЕН ПОДБОР", ...tasks.map(task =>
    `${task.roomLabel} · ${task.title} · ${task.geometryMeters === null ? "метраж уточнить" : `${task.geometryMeters} м конструкции`}`),
    "Лента, число рядов, блоки питания и управление не подобраны и не проверены. Геометрический метраж не равен закупке ленты.",
    ...(tasks.some((task) => task.feature === "cornice")
      ? [`По решению владельца LED-оборудование отдельно, кроме ${pricing.corniceLighting.psu} ₽ за сам БП в ставке карниза; при явной привязке выбранной модели заменить эту часть ставки, не начислять дважды. Монтаж уточнить.`]
      : ["LED-оборудование считается отдельно, монтаж уточнить."])];
}
