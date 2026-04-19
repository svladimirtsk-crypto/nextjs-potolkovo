// lib/eks-feed2-catalog.ts
import { cache } from "react";

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
  { id: "191", parentId: "186" },
];

const WHITELIST_BY_ID = new Map(WHITELIST.map((w) => [w.id, w]));

const BANNED_PARAMS = new Set([
  "остатки брн",
  "остатки мск",
  "кол-во в коробке",
  "рабочее напряжение",
  "класс защиты",
]);

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

    if (id && title) {
      out.push({ id, title, parentId });
    }
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

function buildCategoryPath(
  categoryId: string,
  categoriesById: Map<string, RawCategory>
): string {
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
  return rule.parentId === (parentId ?? "");
}

function deriveUnit(name: string): FeedCatalogUnit {
  const lower = name.toLowerCase();
  if (lower.includes("цена за пог м")) return "m";
  return "pcs";
}

function deriveLengthMeters(name: string): number | null {
  const normalized = name.toLowerCase().replace(",", ".");
  const mMatch = normalized.match(/(\d+(?:\.\d+)?)\s*м(?!м)/i);
  if (!mMatch) return null;

  const v = Number(mMatch[1]);
  if (!Number.isFinite(v) || v <= 0) return null;
  return v;
}

function deriveSystem(
  categoryId: string,
  categoryPath: string,
  name: string,
  url: string
): FeedCatalogSystem {
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
  if (
    categoryId === "130" ||
    categoryId === "134" ||
    categoryId === "208" ||
    joined.includes("трек")
  ) {
    return "TRACK_220";
  }

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
    "Напряжение",
    "Световой поток",
    "Тип",
  ];

  const byLabel = new Map<string, FeedCatalogParam>();
  for (const p of params) {
    if (!byLabel.has(p.label)) byLabel.set(p.label, p);
  }

  const picked: FeedCatalogParam[] = [];

  for (const label of priorities) {
    const exact = byLabel.get(label);
    if (exact && picked.length < 4) picked.push(exact);
  }

  if (picked.length < 4) {
    for (const p of params) {
      if (picked.some((x) => x.label === p.label && x.value === p.value)) continue;
      picked.push(p);
      if (picked.length >= 4) break;
    }
  }

  return picked;
}

function toBoolAvailable(raw: string | null): boolean {
  const v = String(raw ?? "").toLowerCase();
  return v === "true" || v === "1" || v === "да" || v === "yes";
}

function parsePrice(raw: string | null): number | null {
  const cleaned = String(raw ?? "").replace(",", ".").replace(/\s+/g, "");
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

const loadCatalogInternal = cache(async (): Promise<FeedCatalogResult> => {
  try {
    const response = await fetch(FEED_URL, {
      next: { revalidate: 60 * 30 },
      cache: "force-cache",
    });

    if (!response.ok) {
      return {
        ok: false,
        updatedAt: new Date().toISOString(),
        source: FEED_URL,
        discountPercentForCeilingOrder: DISCOUNT_PERCENT,
        categories: [],
        products: [],
        errorMessage: `Feed HTTP ${response.status}`,
      };
    }

    const xml = await response.text();
    const categories = extractCategories(xml);
    const categoriesById = new Map(categories.map((c) => [c.id, c]));
    const offerBlocks = xml.match(/<offer\b[\s\S]*?<\/offer>/gi) ?? [];

    const products: FeedCatalogProduct[] = [];
    const usedProductIds = new Set<string>();

    for (const block of offerBlocks) {
      const offerId = block.match(/<offer\b[^>]*\bid="([^"]+)"/i)?.[1] ?? "";
      if (!offerId) continue;

      const categoryId = extractTag(block, "categoryId") ?? "";
      if (!categoryId) continue;

      const cat = categoriesById.get(categoryId);
      if (!cat) continue;
      if (!isWhitelistedCategory(categoryId, cat.parentId)) continue;

      const priceRub = parsePrice(extractTag(block, "price"));
      if (priceRub === null) continue;

      const vendorCodeRaw = extractTag(block, "vendorCode");
      const vendorCode = normalizeSpace(String(vendorCodeRaw ?? offerId));
      if (!vendorCode) continue;

      const name = extractTag(block, "name") ?? `Товар ${vendorCode}`;
      const url = extractTag(block, "url") ?? "https://eksmarket.ru/";
      const pictures = extractTagList(block, "picture");
      const params = extractParams(block);
      const categoryPath = buildCategoryPath(categoryId, categoriesById);
      const available = toBoolAvailable(
        block.match(/<offer\b[^>]*\bavailable="([^"]+)"/i)?.[1] ?? null
      );

      const system = deriveSystem(categoryId, categoryPath, name, url);
      const kind = deriveKind(categoryId, name, categoryPath);
      const unit = deriveUnit(name);
      const lengthMeters = deriveLengthMeters(name);
      const keyAttributes = pickKeyAttributes(params);

      let productId = `eks-${slugSafe(vendorCode) || slugSafe(offerId)}`;
      if (usedProductIds.has(productId)) {
        productId = `${productId}-${slugSafe(offerId)}`;
      }
      usedProductIds.add(productId);

      products.push({
        productId,
        vendorCode,
        offerId,
        name,
        url,
        categoryId,
        categoryPath,
        images: pictures,
        coverImage: pictures[0] ?? "",
        priceRub,
        available,
        params,
        keyAttributes,
        system,
        kind,
        unit,
        lengthMeters,
      });
    }

    const categoryUse = new Set(products.map((p) => p.categoryId));
    const uiCategories = categories
      .filter((c) => categoryUse.has(c.id))
      .map((c) => ({ id: c.id, title: c.title, parentId: c.parentId }));

    return {
      ok: true,
      updatedAt: new Date().toISOString(),
      source: FEED_URL,
      discountPercentForCeilingOrder: DISCOUNT_PERCENT,
      categories: uiCategories,
      products,
    };
  } catch (error) {
    return {
      ok: false,
      updatedAt: new Date().toISOString(),
      source: FEED_URL,
      discountPercentForCeilingOrder: DISCOUNT_PERCENT,
      categories: [],
      products: [],
      errorMessage: error instanceof Error ? error.message : "Unknown feed error",
    };
  }
});

export async function getFeed2Catalog(): Promise<FeedCatalogResult> {
  return loadCatalogInternal();
}
