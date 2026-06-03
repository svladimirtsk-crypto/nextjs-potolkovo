import type { FeedCatalogParam, FeedCatalogProduct } from "@/lib/eks-feed2-catalog";

function toText(value: unknown): string {
  return String(value ?? "").trim();
}

function parseNumberLoose(raw: string): number | null {
  const s = toText(raw)
    .replace(/\s+/g, "")
    .replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseMetersFromText(raw: string): number | null {
  const s = toText(raw).toLowerCase().replace(/\s+/g, " ");

  // mm
  const mm = s.match(/(\d+(?:[.,]\d+)?)\s*(мм|mm)\b/);
  if (mm) {
    const v = Number(mm[1].replace(",", "."));
    if (Number.isFinite(v) && v > 0) return v / 1000;
  }

  // cm
  const cm = s.match(/(\d+(?:[.,]\d+)?)\s*(см|cm)\b/);
  if (cm) {
    const v = Number(cm[1].replace(",", "."));
    if (Number.isFinite(v) && v > 0) return v / 100;
  }

  // m
  const m = s.match(/(\d+(?:[.,]\d+)?)\s*(м|m)\b/);
  if (m) {
    const v = Number(m[1].replace(",", "."));
    if (Number.isFinite(v) && v > 0) return v;
  }

  return null;
}

function labelImpliesMm(label: string) {
  const l = label.toLowerCase();
  return l.includes("мм") || l.includes("mm") || l.includes("миллиметр");
}
function labelImpliesCm(label: string) {
  const l = label.toLowerCase();
  return l.includes("см") || l.includes("cm") || l.includes("сантиметр");
}
function labelImpliesM(label: string) {
  const l = label.toLowerCase();
  return (
    l.includes("м.п") ||
    l.includes("м п") ||
    l.includes("м.") ||
    l.includes("м ") ||
    l.endsWith(" м") ||
    l.includes("meter") ||
    l.includes("метр")
  );
}

function parseLengthMetersFromParam(param: FeedCatalogParam): number | null {
  const label = toText(param.label);
  const value = toText(param.value);
  if (!label && !value) return null;

  // 1) если значение само содержит единицы — парсим напрямую
  const fromValue = parseMetersFromText(value);
  if (fromValue && fromValue > 0) return fromValue;

  // 2) если единицы в label, а value — число
  const numeric = parseNumberLoose(value);
  if (numeric == null || numeric <= 0) return null;

  if (labelImpliesMm(label)) return numeric / 1000;
  if (labelImpliesCm(label)) return numeric / 100;
  if (labelImpliesM(label)) return numeric;

  return null;
}

/**
 * Пытаемся извлечь длину 1 штуки профиля/шинопровода в метрах.
 * Возвращает null, если длину определить нельзя.
 */
export function inferPieceLengthMeters(product: FeedCatalogProduct): number | null {
  if (typeof product.pieceLengthMeters === "number" && product.pieceLengthMeters > 0) return product.pieceLengthMeters;
  if (typeof product.lengthMeters === "number" && product.lengthMeters > 0) return product.lengthMeters;

  const attrs: FeedCatalogParam[] = [...(product.keyAttributes ?? []), ...(product.params ?? [])];

  // сначала ищем “похожие на длину” лейблы, но без строгой привязки
  for (const a of attrs) {
    const label = toText(a.label).toLowerCase();
    if (!label) continue;

    const looksLikeLength =
      label.includes("длина") ||
      label.includes("length") ||
      label.includes("размер") ||
      label.includes("метраж") ||
      label.includes("l,") ||
      label.includes("l ");

    if (!looksLikeLength) continue;

    const meters = parseLengthMetersFromParam(a);
    if (meters && meters > 0) return meters;
  }

  // если не нашли по “длина” — пробуем любые params (бывает “2000 мм” просто в значении)
  for (const a of attrs) {
    const meters = parseLengthMetersFromParam(a);
    if (meters && meters > 0) return meters;
  }

  // fallback: имя
  const fromName = parseMetersFromText(toText(product.name));
  if (fromName && fromName > 0) return fromName;

  return null;
}

/**
 * Считает вклад профиля/шинопровода в метры по qty.
 * - unit === "m": qty уже метры
 * - unit === "pcs": qty * длина_штуки (если длина определена)
 */
export function calcTrackProfileMeters(product: FeedCatalogProduct, qty: number): number {
  if (product.unit === "m") return qty;

  const piece = inferPieceLengthMeters(product);
  if (!piece || piece <= 0) return 0;

  return qty * piece;
}
