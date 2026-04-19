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

export type FeedCatalogDebug = {
  enabled: string;
  strict: string;
  selectedSource: "snapshot" | "live" | "live-strict-error" | "snapshot-fallback";
  status?: number;
  contentType?: string;
  bodyLength?: number;
  responseHead?: string;
  categoriesCount?: number;
  offerBlocksCount?: number;
  productsParsed?: number;
  productsKept?: number;
  skippedNoCategoryId?: number;
  skippedUnknownCategory?: number;
  skippedNotWhitelisted?: number;
  skippedNoPrice?: number;
  skippedNoVendorCode?: number;
  fetchedAt: string;
  errorMessage?: string;
};

export type FeedCatalogResult = {
  ok: boolean;
  updatedAt: string;
  source: string;
  discountPercentForCeilingOrder: number;
  categories: FeedCatalogCategory[];
  products: FeedCatalogProduct[];
  errorMessage?: string;
  debug?: FeedCatalogDebug;
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

type ParseCounters = {
  categoriesCount: number;
  offerBlocksCount: number;
  productsParsed: number;
  productsKept: number;
  skippedNoCategoryId: number;
  skippedUnknownCategory: number;
  skippedNotWhitelisted: number;
  skippedNoPrice: number;
  skippedNoVendorCode: number;
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

function s(x: unknown): string {
  return String(x ?? "").trim();
}

function toUnit(x: unknown): FeedCatalogUnit {
  return s(x) === "m" ? "m" : "pcs";
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

function norm(str: string): string {
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
  const m = block.match(re);
  if (!m) return null;
  return norm(decodeXml(m[1]));
}

function extractTagList(block: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null = re.exec(block);
  while (m) {
    const v = norm(decodeXml(m[1]));
    if (v) out.push(v);
    m = re.exec(block);
  }
  return out;
}

function extractCategories(xml: string): RawCategory[] {
  const re = /<category\b([^>]*)>([\s\S]*?)<\/category>/gi;
  const out: RawCategory[] = [];
  let m: RegExpExecArray | null = re.exec(xml);

  while (m) {
    const attrs = m[1] ?? "";
    const title = norm(decodeXml(m[2] ?? ""));
    const id = attrs.match(/\bid="([^"]+)"/i)?.[1] ?? "";
    const parentId = attrs.match(/\bparentId="([^"]+)"/i)?.[1] ?? null;
    if (id && title) out.push({ id, title, parentId });
    m = re.exec(xml);
  }

  return out;
}

function extractParams(offerBlock: string): FeedCatalogParam[] {
  const re = /<param\b([^>]*)>([\s\S]*?)<\/param>/gi;
  const out: FeedCatalogParam[] = [];
  let m: RegExpExecArray | null = re.exec(offerBlock);

  while (m) {
    const attrs = m[1] ?? "";
    const rawLabel = attrs.match(/\bname="([^"]+)"/i)?.[1] ?? "";
    const label = norm(decodeXml(rawLabel));
    const value = norm(decodeXml(m[2] ?? ""));
    if (!label || !value) {
      m = re.exec(offerBlock);
      continue;
    }
    if (BANNED_PARAMS.has(label.toLowerCase())) {
      m = re.exec(offerBlock);
      continue;
    }
    out.push({ label, value });
    m = re.exec(offerBlock);
  }

  return out;
}

function buildCategoryPath(categoryId: string, byId: Map<string, RawCategory>): string {
  const parts: string[] = [];
  let current: string | null = categoryId;
  const guard = new Set<string>();

  while (current) {
    if (guard.has(current)) break;
    guard.add(current);
    const cat = byId.get(current);
    if (!cat) break;
    parts.unshift(cat.title);
    current = cat.parentId;
  }

  return parts.join(" / ");
}

function isWhitelistedCategory(categoryId: string, parentId: string | null): boolean {
  const rule = WHITELIST_BY_ID.get(categoryId);
  if (!rule) return false;
  if (!rule.parentId) return true;
  return rule.parentId === s(parentId);
}

function deriveUnit(name: string): FeedCatalogUnit {
  return name.toLowerCase().includes("цена за пог м") ? "m" : "pcs";
}

function deriveLengthMeters(name: string): number | null {
  const normalized = name.toLowerCase().replace(",", ".");
  const m = normalized.match(/(\d+(?:\.\d+)?)\s*м(?!м)/i);
  if (!m) return null;
  const v = Number(m[1]);
  return Number.isFinite(v) && v > 0 ? v : null;
}

function derivePieceLengthMeters(name: string): number | null {
  const normalized = name.toLowerCase().replace(",", ".");
  const mm = normalized.match(/(\d{3,4})\s*мм/i);
  if (mm) {
    const v = Number(mm[1]);
    if (Number.isFinite(v) && v > 0) return v / 1000;
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
    "Световой поток",
  ];

  const byLabel = new Map<string, FeedCatalogParam>();
  for (const p of params) if (!byLabel.has(p.label)) byLabel.set(p.label, p);

  const picked: FeedCatalogParam[] = [];
  for (const label of priorities) {
    const found = byLabel.get(label);
    if (found && picked.length < 4) picked.push(found);
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

function parsePrice(raw: string | null): number | null {
  const cleaned = s(raw).replace(",", ".").replace(/\s+/g, "");
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

function toBoolAvailable(raw: string | null): boolean {
  const v = s(raw).toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "да";
}

function normalizeSnapshot(input: unknown): FeedCatalogResult {
  const src = input as Partial<FeedCatalogResult>;
  const categories = Array.isArray(src.categories) ? src.categories : [];
  const products = Array.isArray(src.products) ? src.products : [];

  const normalizedProducts: FeedCatalogProduct[] = products
    .filter((p) => Number.isFinite(p.priceRub) && p.priceRub > 0)
    .filter((p) => WHITELIST_BY_ID.has(String(p.categoryId)))
    .map((p): FeedCatalogProduct => ({
      ...p,
      productId: s(p.productId),
      vendorCode: s(p.vendorCode),
      offerId: s(p.offerId),
      name: s(p.name),
      url: s(p.url),
      categoryId: s(p.categoryId),
      categoryPath: s(p.categoryPath),
      images: Array.isArray(p.images) ? p.images.map((x) => s(x)).filter(Boolean) : [],
      coverImage: s(p.coverImage),
      params: Array.isArray(p.params)
        ? p.params.filter((x) => !BANNED_PARAMS.has(s(x.label).toLowerCase()))
        : [],
      keyAttributes: Array.isArray(p.keyAttributes) ? p.keyAttributes : [],
      priceRub: Math.round(p.priceRub),
      available: Boolean(p.available),
      system: (p.system as FeedCatalogSystem) ?? "UNKNOWN",
      kind: (p.kind as FeedCatalogKind) ?? "OTHER",
      unit: toUnit(p.unit),
      lengthMeters: p.lengthMeters ?? null,
      pieceLengthMeters: p.pieceLengthMeters ?? null,
    }));

  return {
    ok: normalizedProducts.length > 0,
    updatedAt: s(src.updatedAt) || new Date().toISOString(),
    source: "snapshot:file",
    discountPercentForCeilingOrder: Number.isFinite(src.discountPercentForCeilingOrder)
      ? Number(src.discountPercentForCeilingOrder)
      : DISCOUNT_PERCENT,
    categories: categories.map((c) => ({
      id: s(c.id),
      title: s(c.title),
      parentId: c.parentId ? s(c.parentId) : null,
    })),
    products: normalizedProducts,
    errorMessage: normalizedProducts.length > 0 ? undefined : "Snapshot has zero products",
    debug: {
      enabled: "0",
      strict: "0",
      selectedSource: "snapshot",
      fetchedAt: new Date().toISOString(),
    },
  };
}

async function fetchLive(): Promise<{
  ok: boolean;
  status: number;
  contentType: string;
  body: string;
  errorMessage?: string;
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const res = await fetch(FEED_URL, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/xml,text/xml,*/*",
        "User-Agent": "nextjs-potolkovo-catalog/1.0 (+vercel)",
      },
    });
    const contentType = String(res.headers.get("content-type") ?? "");
    const body = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      contentType,
      body,
      errorMessage: res.ok ? undefined : `HTTP ${res.status}`,
    };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      contentType: "",
      body: "",
      errorMessage: e instanceof Error ? e.message : "live fetch failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}

function parseLiveFeed(xml: string): { result: FeedCatalogResult; counters: ParseCounters } {
  const categories = extractCategories(xml);
  const byId = new Map(categories.map((c) => [c.id, c]));
  const offers = xml.match(/<offer\b[\s\S]*?<\/offer>/gi) ?? [];

  const counters: ParseCounters = {
    categoriesCount: categories.length,
    offerBlocksCount: offers.length,
    productsParsed: 0,
    productsKept: 0,
    skippedNoCategoryId: 0,
    skippedUnknownCategory: 0,
    skippedNotWhitelisted: 0,
    skippedNoPrice: 0,
    skippedNoVendorCode: 0,
  };

  const products: FeedCatalogProduct[] = [];
  const used = new Set<string>();

  for (const block of offers) {
    counters.productsParsed += 1;

    const offerId = block.match(/<offer\b[^>]*\bid="([^"]+)"/i)?.[1] ?? "";
    if (!offerId) continue;

    const categoryId = extractTag(block, "categoryId") ?? "";
    if (!categoryId) {
      counters.skippedNoCategoryId += 1;
      continue;
    }

    const cat = byId.get(categoryId);
    if (!cat) {
      counters.skippedUnknownCategory += 1;
      continue;
    }

    if (!isWhitelistedCategory(categoryId, cat.parentId)) {
      counters.skippedNotWhitelisted += 1;
      continue;
    }

    const priceRub = parsePrice(extractTag(block, "price"));
    if (priceRub === null) {
      counters.skippedNoPrice += 1;
      continue;
    }

    const vendorCode = s(extractTag(block, "vendorCode") ?? offerId);
    if (!vendorCode) {
      counters.skippedNoVendorCode += 1;
      continue;
    }

    const name = s(extractTag(block, "name") ?? `Товар ${vendorCode}`);
    const url = s(extractTag(block, "url") ?? "https://eksmarket.ru/");
    const images = extractTagList(block, "picture");
    const params = extractParams(block);
    const categoryPath = buildCategoryPath(categoryId, byId);

    let productId = `eks-${slugSafe(vendorCode) || slugSafe(offerId)}`;
    if (used.has(productId)) productId = `${productId}-${slugSafe(offerId)}`;
    used.add(productId);

    products.push({
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
      available: toBoolAvailable(block.match(/<offer\b[^>]*\bavailable="([^"]+)"/i)?.[1] ?? null),
      params,
      keyAttributes: pickKeyAttributes(params),
      system: deriveSystem(categoryId, categoryPath, name, url),
      kind: deriveKind(categoryId, name, categoryPath),
      unit: deriveUnit(name),
      lengthMeters: deriveLengthMeters(name),
      pieceLengthMeters: derivePieceLengthMeters(name),
    });
  }

  counters.productsKept = products.length;

  const usedCategoryIds = new Set(products.map((p) => p.categoryId));
  const normalizedCategories: FeedCatalogCategory[] = categories
    .filter((c) => usedCategoryIds.has(c.id))
    .map((c) => ({ id: c.id, title: c.title, parentId: c.parentId }));

  const xmlLike =
    xml.includes("<offer") || xml.includes("<categories") || xml.includes("<yml_catalog");

  const invalid =
    !xmlLike ||
    counters.categoriesCount === 0 ||
    counters.offerBlocksCount === 0 ||
    products.length === 0;

  if (invalid) {
    return {
      counters,
      result: {
        ok: false,
        updatedAt: new Date().toISOString(),
        source: "live-feed2",
        discountPercentForCeilingOrder: DISCOUNT_PERCENT,
        categories: normalizedCategories,
        products: [],
        errorMessage: "Live feed invalid: xml/offer/category/products validation failed",
      },
    };
  }

  return {
    counters,
    result: {
      ok: true,
      updatedAt: new Date().toISOString(),
      source: "live-feed2",
      discountPercentForCeilingOrder: DISCOUNT_PERCENT,
      categories: normalizedCategories,
      products,
    },
  };
}

export async function getCatalogData(): Promise<FeedCatalogResult> {
  const enabled = s(process.env.CATALOG_LIVE_FEED2_ENABLED);
  const strict = s(process.env.CATALOG_LIVE_FEED2_STRICT);

  const liveEnabled = enabled === "1";
  const liveStrict = strict === "1";
  const fetchedAt = new Date().toISOString();

  const snapshot = normalizeSnapshot(snapshotData);

  if (!liveEnabled) {
    return {
      ...snapshot,
      debug: {
        ...(snapshot.debug ?? {
          enabled: "0",
          strict: "0",
          selectedSource: "snapshot",
          fetchedAt,
        }),
        enabled,
        strict,
        selectedSource: "snapshot",
        fetchedAt,
      },
    };
  }

  console.info("[catalog] env", { enabled, strict, url: FEED_URL });

  const live = await fetchLive();
  const head = String((live.body ?? "").slice(0, 350));

  console.info("[catalog] live response", {
    status: live.status,
    contentType: live.contentType,
    bodyLength: live.body.length,
    head,
  });

  if (!live.ok) {
    const failResult: FeedCatalogResult = {
      ok: false,
      updatedAt: fetchedAt,
      source: "live-feed2",
      discountPercentForCeilingOrder: DISCOUNT_PERCENT,
      categories: [],
      products: [],
      errorMessage: live.errorMessage ?? "Live fetch failed",
      debug: {
        enabled,
        strict,
        selectedSource: "live-strict-error",
        fetchedAt,
        status: live.status,
        contentType: live.contentType,
        bodyLength: live.body.length,
        responseHead: head,
        errorMessage: live.errorMessage ?? "Live fetch failed",
      },
    };

    if (liveStrict) return failResult;

    return {
      ...snapshot,
      debug: {
        enabled,
        strict,
        selectedSource: "snapshot-fallback",
        fetchedAt,
        status: live.status,
        contentType: live.contentType,
        bodyLength: live.body.length,
        responseHead: head,
        errorMessage: failResult.errorMessage,
      },
    };
  }

  const parsed = parseLiveFeed(live.body);

  console.info("[catalog] live parse counters", parsed.counters);

  if (parsed.result.ok) {
    return {
      ...parsed.result,
      debug: {
        enabled,
        strict,
        selectedSource: "live",
        fetchedAt,
        status: live.status,
        contentType: live.contentType,
        bodyLength: live.body.length,
        responseHead: head,
        ...parsed.counters,
      },
    };
  }

  if (liveStrict) {
    return {
      ...parsed.result,
      debug: {
        enabled,
        strict,
        selectedSource: "live-strict-error",
        fetchedAt,
        status: live.status,
        contentType: live.contentType,
        bodyLength: live.body.length,
        responseHead: head,
        ...parsed.counters,
        errorMessage: parsed.result.errorMessage,
      },
    };
  }

  return {
    ...snapshot,
    debug: {
      enabled,
      strict,
      selectedSource: "snapshot-fallback",
      fetchedAt,
      status: live.status,
      contentType: live.contentType,
      bodyLength: live.body.length,
      responseHead: head,
      ...parsed.counters,
      errorMessage: parsed.result.errorMessage,
    },
  };
}
