// lib/eks-feed2-catalog.ts
import { cache } from "react";
import snapshotData from "@/data/eks-feed2-snapshot.json";

export type FeedCatalogParam = {
  label: string;
  value: string;
};

export type FeedCatalogSystem =
  | "COLIBRI_220"
  | "CLARUS_48"
  | "TRACK_220"
  | "SMART_HOME"
  | "UNKNOWN";

export type FeedCatalogKind =
  | "TRACK_PROFILE"
  | "TRACK_ACCESSORY"
  | "TRACK_FIXTURE"
  | "SPOT_FIXTURE"
  | "LAMP"
  | "PSU"
  | "CONTROL"
  | "LED_STRIP"
  | "CEILING_COMPONENT"
  | "OTHER";

export type FeedCatalogUnit = "pcs" | "m";

export type FeedCatalogProduct = {
  productId: string;
  vendorCode: string;
  offerId: string;
  name: string;
  url: string;
  categoryId: string;
  categoryPath: string;
  images: string[];
  coverImage: string;
  priceRub: number;
  available: boolean;
  params: FeedCatalogParam[];
  keyAttributes: FeedCatalogParam[];
  system: FeedCatalogSystem;
  kind: FeedCatalogKind;
  unit: FeedCatalogUnit;
  lengthMeters: number | null;
  pieceLengthMeters: number | null;
};

export type FeedCatalogCategory = {
  id: string;
  title: string;
  parentId: string | null;
};

export type FeedCatalogResult = {
  ok: boolean;
  updatedAt: string;
  source: string;
  discountPercentForCeilingOrder: number;
  categories: FeedCatalogCategory[];
  products: FeedCatalogProduct[];
  errorMessage?: string;
};

type RawCategory = {
  id: string;
  title: string;
  parentId: string | null;
};

type WhitelistMeta = {
  id: string;
  parentId?: string;
};

const FEED_URL = "https://eksmarket.ru/api/personal/feed2/";
const DISCOUNT_PERCENT = 15;

const WHITELIST: readonly WhitelistMeta[] = [
  { id: "21" },
  { id: "40" },
  { id: "43" },
  { id: "130" },
  { id: "131" },
  { id: "133" },
  { id: "213" },
  { id: "46", parentId: "21" },
  { id: "177", parentId: "21" },
  { id: "185", parentId: "21" },
  { id: "41", parentId: "40" },
  { id: "42", parentId: "40" },
  { id: "210", parentId: "40" },
  { id: "209", parentId: "50" },
  { id: "211", parentId: "50" },
  { id: "212", parentId: "50" },
  { id: "204", parentId: "61" },
  { id: "205", parentId: "61" },
  { id: "206", parentId: "61" },
  { id: "208", parentId: "61" },
  { id: "134", parentId: "130" },
  { id: "135", parentId: "130" },
  { id: "145", parentId: "130" },
  { id: "146", parentId: "130" },
  { id: "50", parentId: "131" },
  { id: "61", parentId: "131" },
  { id: "170", parentId: "131" },
  { id: "22", parentId: "133" },
  { id: "186", parentId: "133" },
  { id: "199", parentId: "133" },
  { id: "190", parentId: "186" },
  { id: "191", parentId: "186" }
];

const WHITELIST_BY_ID = new Map(WHITELIST.map((w) => [w.id, w]));

const BANNED_PARAMS = new Set([
  "остатки брн",
  "остатки мск",
  "кол-во в коробке",
  "рабочее напряжение",
  "класс защиты"
]);

function toSafeString(x: unknown): string {
  return String(x ?? "").trim();
}

function decodeXml(str: string): string {
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&quot;/g, "\"")
    .replace(/&amp;quot;/g, "\"")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function normalizeSpace(str: string): string {
  return str.replace(/\s+/g, " ").trim();
}

function slugSafe(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9а-яё_-]+/gi, "-")
    .replace(/^-+|-+$/g, "");
}

function extractTag(block: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = block.match(re);
  if (!match) return null;
  return normalizeSpace(decodeXml(match[1]));
}

function extractTagList(block: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  const out: string[] = [];
  let match: RegExpExecArray | null = re.exec(block);

  while (match) {
    const value = normalizeSpace(decodeXml(match[1]));
    if (value) out.push(value);
    match = re.exec(block);
  }

  return out;
}

function extractCategories(xml: string): RawCategory[] {
  const re = /<category\b([^>]*)>([\s\S]*?)<\/category>/gi;
  const out: RawCategory[] = [];
  let match: RegExpExecArray | null = re.exec(xml);

  while (match) {
    const attrs = match[1] ?? "";
    const title = normalizeSpace(decodeXml(match[2] ?? ""));
    const id = attrs.match(/\bid="([^"]+)"/i)?.[1] ?? "";
    const parentId = attrs.match(/\bparentId="([^"]+)"/i)?.[1] ?? null;

    if (id && title) out.push({ id, title, parentId });
    match = re.exec(xml);
  }

  return out;
}

function extractParams(offerBlock: string): FeedCatalogParam[] {
  const re = /<param\b([^>]*)>([\s\S]*?)<\/param>/gi;
  const out: FeedCatalogParam[] = [];
  let match: RegExpExecArray | null = re.exec(offerBlock);

  while (match) {
    const attrs = match[1] ?? "";
    const rawLabel = attrs.match(/\bname="([^"]+)"/i)?.[1] ?? "";
    const rawValue = match[2] ?? "";
    const label = normalizeSpace(decodeXml(rawLabel));
    const value = normalizeSpace(decodeXml(rawValue));

    if (!label || !value) {
      match = re.exec(offerBlock);
      continue;
    }

    if (BANNED_PARAMS.has(label.toLowerCase())) {
      match = re.exec(offerBlock);
      continue;
    }

    out.push({ label, value });
    match = re.exec(offerBlock);
  }

  return out;
}

function buildCategoryPath(categoryId: string, categoriesById: Map<string, RawCategory>): string {
  const parts: string[] = [];
  let currentId: string | null = categoryId;
  const guard = new Set<string>();

  while (currentId) {
    if (guard.has(currentId)) break;
    guard.add(currentId);

    const cat = categoriesById.get(currentId);
    if (!cat) break;

    parts.unshift(cat.title);
    currentId = cat.parentId;
  }

  return parts.join(" / ");
}

function isWhitelistedCategory(categoryId: string, parentId: string | null): boolean {
  const rule = WHITELIST_BY_ID.get(categoryId);
  if (!rule) return false;
  if (!rule.parentId) return true;
  return rule.parentId === toSafeString(parentId);
}

function deriveUnit(name: string): FeedCatalogUnit {
  return name.toLowerCase().includes("цена за пог м") ? "m" : "pcs";
}

function deriveLengthMeters(name: string): number | null {
  const normalized = name.toLowerCase().replace(",", ".");
  const mMatch = normalized.match(/(\d+(?:\.\d+)?)\s*м(?!м)/i);
  if (!mMatch) return null;
  const v = Number(mMatch[1]);
  if (!Number.isFinite(v) || v <= 0) return null;
  return v;
}

function derivePieceLengthMeters(name: string): number | null {
  const normalized = name.toLowerCase().replace(",", ".");
  const mmMatch = normalized.match(/(\d{3,4})\s*мм/i);
  if (mmMatch) {
    const mm = Number(mmMatch[1]);
    if (Number.isFinite(mm) && mm > 0) return mm / 1000;
  }
  return deriveLengthMeters(name);
}

function deriveSystem(categoryId: string, categoryPath: string, name: string, url: string): FeedCatalogSystem {
  const joined = `${categoryPath} ${name} ${url}`.toLowerCase();

  if (joined.includes("clarus") || categoryId === "146") return "CLARUS_48";
  if (joined.includes("colibri") || categoryId === "135") return "COLIBRI_220";
  if (
    categoryId === "145" ||
    categoryId === "177" ||
    categoryId === "185" ||
    joined.includes("smart") ||
    joined.includes("wi-fi") ||
    joined.includes("умный дом")
  ) {
    return "SMART_HOME";
  }
  if (categoryId === "130" || categoryId === "134" || joined.includes("трек")) return "TRACK_220";
  return "UNKNOWN";
}

function deriveKind(categoryId: string, name: string, path: string): FeedCatalogKind {
  const joined = `${name} ${path}`.toLowerCase();

  if (categoryId === "41" || categoryId === "42" || categoryId === "210") return "LAMP";
  if (categoryId === "46" || joined.includes("блок питания")) return "PSU";
  if (categoryId === "177" || categoryId === "185" || categoryId === "145") return "CONTROL";
  if (categoryId === "213" || joined.includes("лента")) return "LED_STRIP";
  if (
    categoryId === "133" ||
    categoryId === "22" ||
    categoryId === "186" ||
    categoryId === "190" ||
    categoryId === "191" ||
    categoryId === "199"
  ) {
    return "CEILING_COMPONENT";
  }
  if (categoryId === "208") return "TRACK_FIXTURE";
  if (
    categoryId === "209" ||
    categoryId === "211" ||
    categoryId === "212" ||
    categoryId === "204" ||
    categoryId === "205" ||
    categoryId === "206" ||
    categoryId === "170"
  ) {
    return "SPOT_FIXTURE";
  }
  if (categoryId === "134" || categoryId === "135" || categoryId === "146") {
    if (joined.includes("профил")) return "TRACK_PROFILE";
    if (joined.includes("светильник")) return "TRACK_FIXTURE";
    return "TRACK_ACCESSORY";
  }

  return "OTHER";
}

function pickKeyAttributes(params: FeedCatalogParam[]): FeedCatalogParam[] {
  const priorities = [
    "Управление",
    "Длина",
    "Мощность",
    "Температура",
    "Цветовая температура",
    "Цвет",
    "Тип",
    "Световой поток"
  ];
  const byLabel = new Map<string, FeedCatalogParam>();
  for (const p of params) {
    if (!byLabel.has(p.label)) byLabel.set(p.label, p);
  }

  const picked: FeedCatalogParam[] = [];
  for (const label of priorities) {
    const x = byLabel.get(label);
    if (x && picked.length < 4) picked.push(x);
  }

  if (picked.length < 4) {
    for (const p of params) {
      if (picked.some((k) => k.label === p.label && k.value === p.value)) continue;
      picked.push(p);
      if (picked.length >= 4) break;
    }
  }

  return picked;
}

function parsePrice(raw: string | null): number | null {
  const cleaned = toSafeString(raw).replace(",", ".").replace(/\s+/g, "");
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

function toBoolAvailable(raw: string | null): boolean {
  const v = toSafeString(raw).toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "да";
}

function normalizeSnapshot(input: unknown): FeedCatalogResult {
  const s = input as FeedCatalogResult;
  const categories = Array.isArray(s?.categories) ? s.categories : [];
  const products = Array.isArray(s?.products) ? s.products : [];

  const normalizedProducts = products
    .filter((p) => Number.isFinite(p.priceRub) && p.priceRub > 0)
    .filter((p) => WHITELIST_BY_ID.has(String(p.categoryId)))
    .map((p) => ({
      ...p,
      productId: toSafeString(p.productId),
      vendorCode: toSafeString(p.vendorCode),
      offerId: toSafeString(p.offerId),
      name: toSafeString(p.name),
      url: toSafeString(p.url),
      categoryId: toSafeString(p.categoryId),
      categoryPath: toSafeString(p.categoryPath),
      images: Array.isArray(p.images) ? p.images.map((x) => toSafeString(x)).filter(Boolean) : [],
      coverImage: toSafeString(p.coverImage),
      params: Array.isArray(p.params) ? p.params.filter((x) => !BANNED_PARAMS.has(toSafeString(x.label).toLowerCase())) : [],
      keyAttributes: Array.isArray(p.keyAttributes) ? p.keyAttributes : [],
      priceRub: Math.round(p.priceRub),
      available: Boolean(p.available),
      unit: p.unit === "m" ? "m" : "pcs",
      lengthMeters: p.lengthMeters ?? null,
      pieceLengthMeters: p.pieceLengthMeters ?? null
    }));

  return {
    ok: normalizedProducts.length > 0,
    updatedAt: toSafeString(s?.updatedAt) || new Date().toISOString(),
    source: toSafeString(s?.source) || "snapshot",
    discountPercentForCeilingOrder: Number.isFinite(s?.discountPercentForCeilingOrder)
      ? s.discountPercentForCeilingOrder
      : DISCOUNT_PERCENT,
    categories: categories.map((c) => ({
      id: toSafeString(c.id),
      title: toSafeString(c.title),
      parentId: c.parentId ? toSafeString(c.parentId) : null
    })),
    products: normalizedProducts,
    errorMessage: normalizedProducts.length > 0 ? undefined : "Snapshot has zero products"
  };
}

async function loadLiveFeed2(): Promise<FeedCatalogResult> {
  try {
    const startedAt = Date.now();
    const response = await fetch(FEED_URL, { cache: "no-store" });

    const contentType: string = String(response.headers.get("content-type") ?? "");
    const text = await response.text();
    const head = String(text.slice(0, 350) ?? "");
    console.info("[feed2] status=", response.status, "contentType=", contentType, "len=", text.length);
    console.info("[feed2] head=", head);

    if (!response.ok) {
      return {
        ok: false,
        updatedAt: new Date().toISOString(),
        source: "live-feed2",
        discountPercentForCeilingOrder: DISCOUNT_PERCENT,
        categories: [],
        products: [],
        errorMessage: `HTTP ${response.status}`
      };
    }

    const categories = extractCategories(text);
    const categoriesById = new Map(categories.map((c) => [c.id, c]));
    const offerBlocks = text.match(/<offer\b[\s\S]*?<\/offer>/gi) ?? [];
    const usedIds = new Set<string>();
    const products: FeedCatalogProduct[] = [];

    for (const block of offerBlocks) {
      const offerId = block.match(/<offer\b[^>]*\bid="([^"]+)"/i)?.[1] ?? "";
      if (!offerId) continue;

      const categoryId = extractTag(block, "categoryId") ?? "";
      if (!categoryId) continue;

      const categoryMeta = categoriesById.get(categoryId);
      if (!categoryMeta) continue;
      if (!isWhitelistedCategory(categoryId, categoryMeta.parentId)) continue;

      const priceRub = parsePrice(extractTag(block, "price"));
      if (priceRub === null) continue;

      const vendorCode = toSafeString(extractTag(block, "vendorCode") ?? offerId);
      if (!vendorCode) continue;

      const name = toSafeString(extractTag(block, "name") ?? `Товар ${vendorCode}`);
      const url = toSafeString(extractTag(block, "url") ?? "https://eksmarket.ru/");
      const images = extractTagList(block, "picture");
      const params = extractParams(block);
      const categoryPath = buildCategoryPath(categoryId, categoriesById);

      let productId = `eks-${slugSafe(vendorCode) || slugSafe(offerId)}`;
      if (usedIds.has(productId)) productId = `${productId}-${slugSafe(offerId)}`;
      usedIds.add(productId);

      const product: FeedCatalogProduct = {
        productId,
        vendorCode,
        offerId,
        name,
        url,
        categoryId,
        categoryPath,
        images,
        coverImage: images[0] ?? "",
        priceRub,
        available: toBoolAvailable(
          block.match(/<offer\b[^>]*\bavailable="([^"]+)"/i)?.[1] ?? null
        ),
        params,
        keyAttributes: pickKeyAttributes(params),
        system: deriveSystem(categoryId, categoryPath, name, url),
        kind: deriveKind(categoryId, name, categoryPath),
        unit: deriveUnit(name),
        lengthMeters: deriveLengthMeters(name),
        pieceLengthMeters: derivePieceLengthMeters(name)
      };

      products.push(product);
    }

    const categoryUsed = new Set(products.map((p) => p.categoryId));
    const normalizedCategories: FeedCatalogCategory[] = categories
      .filter((c) => categoryUsed.has(c.id))
      .map((c) => ({ id: c.id, title: c.title, parentId: c.parentId }));

    const elapsed = Date.now() - startedAt;
    console.info(
      "[feed2] parsed categories=",
      categories.length,
      "offers=",
      offerBlocks.length,
      "products=",
      products.length,
      "ms=",
      elapsed
    );

    if (products.length === 0) {
      return {
        ok: false,
        updatedAt: new Date().toISOString(),
        source: "live-feed2",
        discountPercentForCeilingOrder: DISCOUNT_PERCENT,
        categories: normalizedCategories,
        products: [],
        errorMessage: "Live feed parsed but returned zero products"
      };
    }

    return {
      ok: true,
      updatedAt: new Date().toISOString(),
      source: "live-feed2",
      discountPercentForCeilingOrder: DISCOUNT_PERCENT,
      categories: normalizedCategories,
      products
    };
  } catch (error) {
    console.error("[feed2] fetch failed:", error);
    return {
      ok: false,
      updatedAt: new Date().toISOString(),
      source: "live-feed2",
      discountPercentForCeilingOrder: DISCOUNT_PERCENT,
      categories: [],
      products: [],
      errorMessage: error instanceof Error ? error.message : "Unknown live feed error"
    };
  }
}

const getCatalogDataCached = cache(async (): Promise<FeedCatalogResult> => {
  const snapshot = normalizeSnapshot(snapshotData);

  const liveEnabled = toSafeString(process.env.CATALOG_LIVE_FEED2_ENABLED) === "1";
  if (!liveEnabled) {
    if (!snapshot.ok) {
      console.error("[catalog] snapshot invalid:", snapshot.errorMessage);
    }
    return snapshot;
  }

  const live = await loadLiveFeed2();
  if (live.ok && live.products.length > 0) return live;

  console.warn("[catalog] live feed unavailable, fallback to snapshot:", live.errorMessage);

  if (snapshot.ok && snapshot.products.length > 0) return snapshot;

  return {
    ok: false,
    updatedAt: new Date().toISOString(),
    source: "fallback-error",
    discountPercentForCeilingOrder: DISCOUNT_PERCENT,
    categories: [],
    products: [],
    errorMessage: "Both live feed and snapshot are empty"
  };
});

export async function getCatalogData(): Promise<FeedCatalogResult> {
  return getCatalogDataCached();
}
