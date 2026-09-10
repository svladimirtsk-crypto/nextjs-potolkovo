/**
 * N-040 · Комплект как оффер, а не выгрузка из прайса (F-41).
 *
 * Карточка показывала 6–9 строк вида «KOLIBRI SMART трековый светильник ЛИЦЦИ
 * чёрный, 15W, 4000K, 1000lm, 220V × 3». Это накладная: артикулы нужны при
 * сборке заказа, но не в момент, когда человек решает «подходит или нет».
 *
 * Здесь состав сворачивается в одну строку на языке клиента — «3 м профиля ·
 * 5 светильников · питание · крепёж» — а точный список SKU остаётся доступен
 * по клику.
 */
import type { LightingItem } from "@/lib/calculator-modal-types";

/** Роль позиции в комплекте — по ней собирается человеческая строка состава. */
export type KitPartRole = "profile" | "fixture" | "power" | "lamp" | "hardware";

/**
 * Определяет роль по виду товара из фида.
 *
 * `kind` приходит из нормализованного снапшота, поэтому проверяем именно его,
 * а не название: названия у поставщика меняются от партии к партии.
 */
export function kitPartRole(item: LightingItem): KitPartRole {
  const kind = String(item.kind ?? "");

  if (kind === "TRACK_PROFILE") return "profile";
  if (kind === "TRACK_FIXTURE" || kind === "SPOT_FIXTURE" || kind === "PANEL") return "fixture";
  if (kind === "PSU") return "power";
  if (kind === "LAMP") return "lamp";
  return "hardware";
}

/**
 * Метры профиля в позиции: «Профиль 2 м × 2» = 4 м.
 *
 * У поставщика длина чаще записана габаритами в миллиметрах
 * («КОЛИБРИ трековый профиль ... 2000*62*51 мм»), поэтому сначала пробуем
 * этот формат, и только затем «2 м». Порядок важен: в габаритах первое число
 * и есть длина, а «мм» в конце строки иначе распозналось бы как метры.
 */
function profileMeters(item: LightingItem): number {
  const name = String(item.name);

  const mmMatch = name.match(/(\d{3,5})\s*[*x×]\s*\d+\s*[*x×]\s*\d+/i);
  if (mmMatch) {
    const meters = Number(mmMatch[1]) / 1000;
    return Number.isFinite(meters) ? meters * item.qty : 0;
  }

  const mMatch = name.match(/(\d+(?:[.,]\d+)?)\s*(?:м|m)(?![а-яёa-z])/i);
  if (!mMatch) return 0;

  const meters = Number(mMatch[1].replace(",", "."));
  return Number.isFinite(meters) ? meters * item.qty : 0;
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

/**
 * Состав комплекта одной строкой.
 *
 * Порядок частей неслучаен: сначала то, что определяет размер (метры), потом
 * то, что определяет свет (светильники), и лишь затем обвязка. Мелочь вроде
 * коннекторов сводится в «крепёж» — перечислять её поштучно бессмысленно.
 */
export function kitCompositionLine(items: readonly LightingItem[]): string {
  const parts: string[] = [];

  const meters = items
    .filter((item) => kitPartRole(item) === "profile")
    .reduce((sum, item) => sum + profileMeters(item), 0);
  if (meters > 0) {
    parts.push(`${Number(meters.toFixed(1))} м профиля`);
  }

  const fixtures = items
    .filter((item) => kitPartRole(item) === "fixture")
    .reduce((sum, item) => sum + item.qty, 0);
  if (fixtures > 0) {
    parts.push(`${fixtures} ${plural(fixtures, "светильник", "светильника", "светильников")}`);
  }

  const lamps = items
    .filter((item) => kitPartRole(item) === "lamp")
    .reduce((sum, item) => sum + item.qty, 0);
  if (lamps > 0) {
    parts.push(`${lamps} ${plural(lamps, "лампа", "лампы", "ламп")}`);
  }

  if (items.some((item) => kitPartRole(item) === "power")) {
    parts.push("питание");
  }

  if (items.some((item) => kitPartRole(item) === "hardware")) {
    parts.push("крепёж");
  }

  return parts.join(" · ");
}

/** Сколько позиций скрыто под «Состав по артикулам». */
export function kitSkuCount(items: readonly LightingItem[]): number {
  return items.length;
}
