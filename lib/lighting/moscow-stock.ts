/** LED-19 · Supplier feed observations, never a confirmed reservation or delivery promise.
 * Only the Moscow warehouse affects selection. Archived feeds remain archived.
 */
export type MoscowStockState = "unknown" | "reported_zero" | "reported_positive" | "supplier_unavailable";
export type MoscowStock = { moscow: number | null };

type StockInput = {
  available?: unknown;
  stockByWarehouse?: unknown;
  params?: unknown;
};

export function parseMoscowQuantity(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const raw = String(value).trim();
  if (!/^\d+(?:[.,]\d+)?$/.test(raw)) return null;
  const quantity = Number(raw.replace(",", "."));
  return Number.isFinite(quantity) && quantity >= 0 && quantity <= 1e9 ? quantity : null;
}

/** Never fall back to another warehouse or to `available=true` when Moscow is absent. */
export function moscowQuantityOf(input: StockInput): number | null {
  const warehouses = input.stockByWarehouse;
  if (warehouses && typeof warehouses === "object" && !Array.isArray(warehouses) &&
      Object.hasOwn(warehouses, "moscow")) {
    return parseMoscowQuantity((warehouses as { moscow?: unknown }).moscow);
  }
  if (!Array.isArray(input.params)) return null;
  const matches = input.params.filter((param: unknown) => {
    if (!param || typeof param !== "object") return false;
    const record = param as { label?: unknown; name?: unknown };
    return String(record.label ?? record.name ?? "").trim().toLowerCase().replace(/\s+/g, " ") === "остатки мск";
  });
  // Conflicting or duplicated observations are unknown, not a positive count.
  if (matches.length !== 1) return null;
  return parseMoscowQuantity((matches[0] as { value?: unknown }).value);
}

export function hasMoscowObservation(input: StockInput): boolean {
  const warehouses = input.stockByWarehouse;
  if (warehouses && typeof warehouses === "object" && !Array.isArray(warehouses) &&
      Object.hasOwn(warehouses, "moscow")) return true;
  return Array.isArray(input.params) && input.params.some((param: unknown) =>
    param && typeof param === "object" &&
    String((param as { label?: unknown; name?: unknown }).label ??
      (param as { name?: unknown }).name ?? "").trim().toLowerCase().replace(/\s+/g, " ") === "остатки мск");
}

export function supplierAvailableOf(raw: unknown): boolean | null {
  if (raw === true || raw === 1 || /^(true|yes|да|1)$/i.test(String(raw))) return true;
  if (raw === false || raw === 0 || /^(false|no|нет|0)$/i.test(String(raw))) return false;
  return null;
}

export function moscowStockStateOf(input: StockInput): MoscowStockState {
  if (supplierAvailableOf(input.available) === false) return "supplier_unavailable";
  if (supplierAvailableOf(input.available) !== true) return "unknown";
  const quantity = moscowQuantityOf(input);
  if (quantity === null) return "unknown";
  return quantity === 0 ? "reported_zero" : "reported_positive";
}

/** No state means «в наличии»: even a positive feed count needs a fresh supplier check. */
export function moscowStockMessage(input: StockInput): string {
  switch (moscowStockStateOf(input)) {
    case "reported_zero":
      return "В сохранённой выгрузке остаток в Москве — 0. Актуальное наличие уточним перед заказом.";
    case "reported_positive":
      return "В выгрузке указан остаток в Москве. Наличие и резерв уточним перед заказом.";
    case "supplier_unavailable":
      return "Поставщик пометил товар как недоступный. Возможность заказа в Москве уточним.";
    case "unknown":
      return "Наличие на складе в Москве не подтверждено — уточним перед заказом.";
  }
}

/** A known zero must not become a ready-to-buy part of an automatic kit. Unknown
 * observations may remain preliminary candidates, never verified availability. */
export function moscowCandidateAllowed(input: StockInput): boolean {
  const state = moscowStockStateOf(input);
  return state !== "reported_zero" && state !== "supplier_unavailable";
}
