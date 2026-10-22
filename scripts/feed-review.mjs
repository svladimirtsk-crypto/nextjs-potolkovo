import { createHash } from "node:crypto";

/** LED-20 · Content identity is not a price, warehouse or engineering approval.
 * Ignore a claimed input version so a supplier cannot set the output revision.
 */
export function catalogVersionOf(feed) {
  const content = { ...feed };
  delete content.catalogVersion;
  const digest = createHash("sha256").update(JSON.stringify(content)).digest("hex");
  return `cat-sha256-${digest}`;
}

function text(value) { return String(value ?? "").trim(); }
function plain(value) { return text(value).replace(/[\r\n\x00-\x1f|]+/g, " ").slice(0, 145); }
function valueOf(p, field) {
  if (field === "moscowStock") return p.stockByWarehouse?.moscow ?? null;
  return p[field] ?? null;
}

/** Diff by productId, never by mutable vendorCode. An offerId match with a new
 * productId is a migration CANDIDATE, not permission to merge identities. */
export function diffCatalog(before, after) {
  const fields = ["priceRub", "vendorCode", "offerId", "unit", "priceUnit", "packQty", "moscowStock", "available"];
  const oldById = new Map((before.products ?? []).map(p => [text(p.productId), p]));
  const oldByOffer = new Map((before.products ?? []).filter(p => text(p.offerId)).map(p => [text(p.offerId), p]));
  const changes = [];
  const added = [];
  for (const current of after.products ?? []) {
    const productId = text(current.productId);
    const previous = oldById.get(productId);
    if (!previous) {
      added.push({ productId, offerId: text(current.offerId), vendorCode: text(current.vendorCode),
        possiblePreviousProductId: text(oldByOffer.get(text(current.offerId))?.productId) || null });
      continue;
    }
    oldById.delete(productId);
    for (const field of fields) {
      const from = valueOf(previous, field);
      const to = valueOf(current, field);
      if (from !== to) changes.push({ productId, offerId: text(current.offerId),
        name: plain(current.name), field, from, to });
    }
  }
  const removed = [...oldById.values()].map(p => ({
    productId: text(p.productId), offerId: text(p.offerId), vendorCode: text(p.vendorCode),
  }));
  return {
    schemaVersion: 1,
    fromVersion: catalogVersionOf(before),
    toVersion: catalogVersionOf(after),
    changes,
    added,
    removed,
    requiresReview: catalogVersionOf(before) !== catalogVersionOf(after),
  };
}

/** Full safety-relevant diff for the PR, not just a top-N price sample. */
export function formatCatalogReview(diff) {
  const counts = Object.fromEntries(
    ["priceRub", "vendorCode", "offerId", "unit", "priceUnit", "packQty", "moscowStock", "available"]
      .map(field => [field, diff.changes.filter(change => change.field === field).length])
  );
  const lines = [
    `Каталог: ${diff.fromVersion} → ${diff.toVersion}`,
    `Добавлено: ${diff.added.length}; исчезло: ${diff.removed.length}; изменений полей: ${diff.changes.length}.`,
    `Цена: ${counts.priceRub}; артикул: ${counts.vendorCode}; offerId: ${counts.offerId}; единица: ${counts.unit}; priceUnit: ${counts.priceUnit}; упаковка: ${counts.packQty}; Москва: ${counts.moscowStock}; флаг поставщика: ${counts.available}.`,
    "Все изменения требуют ручной сверки до merge/deploy; положительный остаток — не резерв.",
  ];
  if (diff.changes.length) {
    lines.push("", "Изменения по стабильному productId (полный перечень):");
    for (const c of diff.changes) lines.push(`- ${plain(c.productId)} / ${plain(c.offerId)} · ${plain(c.name)} · ${c.field}: ${plain(c.from ?? "неизвестно")} → ${plain(c.to ?? "неизвестно")}`);
  }
  if (diff.added.length) {
    lines.push("", "Добавлено (совпадение offerId — только кандидат на миграцию):");
    for (const p of diff.added) lines.push(`- ${plain(p.productId)} · ${plain(p.vendorCode)}${p.possiblePreviousProductId ? ` · прежний productId по offerId: ${plain(p.possiblePreviousProductId)}` : ""}`);
  }
  if (diff.removed.length) {
    lines.push("", "Исчезло из выгрузки (не удалять из черновика молча):");
    for (const p of diff.removed) lines.push(`- ${plain(p.productId)} · ${plain(p.vendorCode)}`);
  }
  return lines.join("\n");
}
