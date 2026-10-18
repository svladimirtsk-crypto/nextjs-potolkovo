import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const current = JSON.parse(readFileSync(resolve(ROOT, "data/eks-feed2-snapshot.json"), "utf8")) as {
  products: Record<string, unknown>[];
  updatedAt: string;
  source: string;
  discountPercentForCeilingOrder: number;
  categories: unknown[];
};
const protectedPaths = [
  "data/eks-feed2-snapshot.json", "data/catalog-index.json", "data/catalog-prefill.json",
  "data/catalog-retired.json", "data/proof-pricing-inputs.json", "data/catalog-images.json",
  "data/catalog-images-missing.json", "feed-diff.md",
];

function fingerprint(): string {
  const hash = createHash("sha256");
  for (const rel of protectedPaths) {
    const file = resolve(ROOT, rel);
    hash.update(rel);
    hash.update(existsSync(file) ? readFileSync(file) : "<absent>");
  }
  // LED-26: отрицательные пробы обязаны сохранить не только JSON, но и
  // рабочие превью; staging-копия изображений не должна утечь в public/.
  for (const file of readdirSync(resolve(ROOT, "public/catalog")).filter((name) => name.endsWith(".webp")).sort()) {
    hash.update(file);
    hash.update(readFileSync(resolve(ROOT, "public/catalog", file)));
  }
  return hash.digest("hex");
}

/** Локальный HTTP fixture: никаких запросов к EKS и никаких реальных PR. */
async function refreshWithFixture(
  products: Record<string, unknown>[], args: string[] = [], fixtureRoot = ROOT,
): Promise<{ code: number | null; output: string }> {
  const server = createServer((_, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ updatedAt: current.updatedAt, source: "test-fixture", products }));
  });
  await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("fixture server did not bind a local port");
    return await new Promise((resolveResult, reject) => {
      const child = spawn(process.execPath, [resolve(fixtureRoot, "scripts/refresh-feed.mjs"), ...args], {
        cwd: fixtureRoot,
        env: { ...process.env, FEED_URL: `http://127.0.0.1:${address.port}/fixture` },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let output = "";
      child.stdout.on("data", (data: Buffer) => { output += data.toString(); });
      child.stderr.on("data", (data: Buffer) => { output += data.toString(); });
      child.on("error", reject);
      child.on("close", (code) => resolveResult({ code, output }));
    });
  } finally {
    await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
  }
}

function isolatedFeedRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "potolkovo-refresh-test-"));
  const inputs = [
    "scripts/refresh-feed.mjs", "scripts/validate-catalog.mjs",
    "scripts/build-catalog-index.mjs", "scripts/build-catalog-images.mjs",
    "data/eks-feed2-snapshot.json", "data/catalog-retired.json",
    "data/catalog-index.json", "data/catalog-prefill.json", "data/proof-pricing-inputs.json",
    "data/catalog-images.json", "data/catalog-images-missing.json",
    "content/catalog-retired.json", "lib/catalog-ui-config.ts", "lib/vendor-code-overrides.ts",
    "app/uslugi/prodazha-trekovogo-osveshcheniya/_components/LightKitShowcase.tsx",
  ];
  try {
    for (const rel of inputs) {
      const dest = resolve(root, rel);
      mkdirSync(dirname(dest), { recursive: true });
      cpSync(resolve(ROOT, rel), dest);
    }
    cpSync(resolve(ROOT, "public/catalog"), resolve(root, "public/catalog"), { recursive: true });
    symlinkSync(resolve(ROOT, "node_modules"), resolve(root, "node_modules"), "dir");
    return root;
  } catch (error) {
    rmSync(root, { recursive: true, force: true });
    throw error;
  }
}

describe("LED-26 · feed refresh сохраняет last-known-good до успешной staging-сборки", () => {
  it("валидный фид проходит валидатор, индекс и обложки в --check без записи в рабочее дерево", async () => {
    const before = fingerprint();
    const result = await refreshWithFixture(current.products, ["--check"]);
    expect(result.code, result.output).toBe(0);
    expect(result.output).toContain("check-only: staging прошёл");
    expect(fingerprint()).toBe(before);
  }, 40_000);

  it("публикует успешный staging только в изолированную фикстуру, сохраняя скидку и категории", async () => {
    const liveBefore = fingerprint();
    const fixture = isolatedFeedRoot();
    try {
      const originalPrice = Number(current.products[0]?.priceRub);
      const candidatePrice = originalPrice + 100;
      const candidate = current.products.map((product, i) => i === 0
        ? { ...product, priceRub: candidatePrice }
        : product);
      const result = await refreshWithFixture(candidate, [], fixture);
      expect(result.code, result.output).toBe(0);
      expect(result.output).toContain("готово к PR и ручному ревью");
      const saved = JSON.parse(readFileSync(resolve(fixture, "data/eks-feed2-snapshot.json"), "utf8"));
      expect(saved.products[0].priceRub).toBe(candidatePrice);
      expect(saved.discountPercentForCeilingOrder).toBe(current.discountPercentForCeilingOrder);
      expect(saved.categories).toEqual(current.categories);
      const index = JSON.parse(readFileSync(resolve(fixture, "data/catalog-index.json"), "utf8"));
      const row = index.rows.find((r: unknown[]) => r[0] === current.products[0]?.productId);
      expect(row[index.columns.indexOf("priceRub")]).toBe(candidatePrice);
      expect(readFileSync(resolve(fixture, "feed-diff.md"), "utf8")).toContain(`${originalPrice} → ${candidatePrice} ₽`);
      expect(fingerprint()).toBe(liveBefore);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  }, 40_000);

  it("обрывает неполный и дублирующийся фид до любых записей", async () => {
    const before = fingerprint();
    const small = await refreshWithFixture(current.products.slice(0, 10));
    expect(small.code).not.toBe(0);
    expect(small.output).toContain("похоже на сбой выгрузки");
    const duplicate = current.products.map((product, i) => i === 1
      ? { ...product, vendorCode: current.products[0]?.vendorCode }
      : product);
    const invalid = await refreshWithFixture(duplicate);
    expect(invalid.code).not.toBe(0);
    expect(invalid.output).toContain("дублирующаяся позиция");
    expect(fingerprint()).toBe(before);
  }, 20_000);

  it("отклоняет неподтверждённый хост фото до запуска обновления", async () => {
    const before = fingerprint();
    const invalid = current.products.map((product, i) => i === 0
      ? { ...product, coverImage: "http://127.0.0.1/internal" }
      : product);
    const result = await refreshWithFixture(invalid);
    expect(result.code).not.toBe(0);
    expect(result.output).toContain("не с HTTPS-хоста EKS");
    expect(fingerprint()).toBe(before);
  }, 20_000);

  it("пропавший обязательный SKU проваливает валидатор в /tmp, не меняя снимок/индекс", async () => {
    const before = fingerprint();
    const missing = current.products.filter((p) => p.vendorCode !== "0У-00006089");
    expect(missing.length).toBe(current.products.length - 1);
    const result = await refreshWithFixture(missing);
    expect(result.code).not.toBe(0);
    expect(result.output).toContain("SKU 0У-00006089 отсутствует");
    expect(fingerprint()).toBe(before);
  }, 20_000);

  it("ошибка бюджета производного индекса в staging не публикует новый snapshot", async () => {
    const before = fingerprint();
    const inflated = [
      ...current.products,
      ...Array.from({ length: 80 }, (_, i) => ({
        productId: `test-large-${i}`, vendorCode: `TEST-LARGE-${i}`, offerId: `TEST-LARGE-${i}`,
        name: `Проверка бюджета индекса ${i} ${"Д".repeat(500)}`,
        priceRub: 100, available: true, kind: "OTHER", system: "UNKNOWN",
        categoryPath: "Тестовая группа", coverImage: "", unit: "pcs",
      })),
    ];
    const result = await refreshWithFixture(inflated);
    expect(result.code).not.toBe(0);
    expect(result.output).toContain("index превышает бюджет");
    expect(fingerprint()).toBe(before);
  }, 25_000);
});
