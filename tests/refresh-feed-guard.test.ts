import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { copyFileSync, cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CATALOG_DATA_FILES, publishCatalogRelease, rollbackCatalogRelease, verifyCatalogRelease } from "../scripts/catalog-release.mjs";

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
  "data/catalog-images-missing.json", "data/catalog-review.json", "feed-diff.md",
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
  sourceDate = current.updatedAt, failpoint = "",
): Promise<{ code: number | null; output: string }> {
  const server = createServer((_, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ updatedAt: sourceDate, source: "test-fixture", products }));
  });
  await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("fixture server did not bind a local port");
    return await new Promise((resolveResult, reject) => {
      const child = spawn(process.execPath, [resolve(fixtureRoot, "scripts/refresh-feed.mjs"), ...args], {
        cwd: fixtureRoot,
        env: { ...process.env, FEED_URL: `http://127.0.0.1:${address.port}/fixture`,
          CATALOG_RELEASE_FAILPOINT: failpoint },
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
    "scripts/refresh-feed.mjs", "scripts/catalog-release.mjs", "scripts/validate-catalog.mjs", "scripts/feed-review.mjs",
    "scripts/build-catalog-index.mjs", "scripts/build-catalog-images.mjs", "scripts/check-catalog-images.mjs",
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
      const pointer = resolve(fixture, "data/catalog-current");
      const selected = readlinkSync(pointer);
      expect(selected).toMatch(/^catalog-releases\/r-[0-9a-f-]+$/);
      for (const file of ["eks-feed2-snapshot.json", "catalog-index.json", "catalog-images.json"]) {
        expect(lstatSync(resolve(fixture, "data", file)).isSymbolicLink()).toBe(true);
        expect(readlinkSync(resolve(fixture, "data", file))).toBe(`catalog-current/data/${file}`);
      }
      const release = JSON.parse(readFileSync(resolve(fixture, "data", selected, "manifest.json"), "utf8"));
      expect(release.catalogVersion).toBe(saved.catalogVersion);
      expect(release.previousReleaseId).toMatch(/^r-[0-9a-f-]+$/);
      const checkedBuild = spawnSync(process.execPath, [resolve(fixture, "scripts/build-catalog-index.mjs")],
        { cwd: fixture, encoding: "utf8" });
      expect(checkedBuild.status, checkedBuild.stderr).toBe(0);
      expect(readlinkSync(pointer)).toBe(selected);
      expect(fingerprint()).toBe(liveBefore);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  }, 40_000);

  it("LED-26 · rejects a failed switch, then atomically rolls back a reviewed release", async () => {
    const liveBefore = fingerprint();
    const fixture = isolatedFeedRoot();
    const source = resolve(fixture, "data/eks-feed2-snapshot.json");
    const pointer = resolve(fixture, "data/catalog-current");
    const oldPrice = Number(current.products[0]?.priceRub);
    const candidate = (delta: number) => current.products.map((product, i) => i === 0
      ? { ...product, priceRub: oldPrice + delta } : product);
    const price = () => Number(JSON.parse(readFileSync(source, "utf8")).products[0].priceRub);
    try {
      const rejected = await refreshWithFixture(candidate(50), [], fixture, current.updatedAt, "before-switch");
      expect(rejected.code).not.toBe(0);
      expect(rejected.output).toContain("сбой до переключения");
      // First refresh adopts the old flat snapshot before attempting a switch.
      expect(price()).toBe(oldPrice);
      const baseline = readlinkSync(pointer);
      expect(lstatSync(source).isSymbolicLink()).toBe(true);

      const good = await refreshWithFixture(candidate(100), [], fixture);
      expect(good.code, good.output).toBe(0);
      const goodPointer = readlinkSync(pointer);
      expect(goodPointer).not.toBe(baseline);
      expect(price()).toBe(oldPrice + 100);
      const goodIndex = readFileSync(resolve(fixture, "data/catalog-index.json"));

      const failedAfter = await refreshWithFixture(candidate(200), [], fixture, current.updatedAt, "after-switch");
      expect(failedAfter.code).not.toBe(0);
      expect(failedAfter.output).toContain("сбой после переключения");
      expect(readlinkSync(pointer)).toBe(goodPointer);
      expect(price()).toBe(oldPrice + 100);
      expect(readFileSync(resolve(fixture, "data/catalog-index.json")).equals(goodIndex)).toBe(true);

      const rollback = await refreshWithFixture(current.products, ["--rollback"], fixture);
      expect(rollback.code, rollback.output).toBe(0);
      expect(rollback.output).toContain("атомарный откат");
      expect(readlinkSync(pointer)).toBe(baseline);
      expect(price()).toBe(oldPrice);
      expect(fingerprint()).toBe(liveBefore); // The actual working tree was untouched.
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  }, 60_000);

  it("LED-26 · changed photo gets an immutable release URL, and a corrupt release cannot be reactivated", async () => {
    const fixture = isolatedFeedRoot();
    const stage = mkdtempSync(join(tmpdir(), "potolkovo-photo-stage-"));
    try {
      const candidate = current.products.map((product, i) => i === 0
        ? { ...product, priceRub: Number(product.priceRub) + 100 } : product);
      const first = await refreshWithFixture(candidate, [], fixture);
      expect(first.code, first.output).toBe(0);
      const pointer = resolve(fixture, "data/catalog-current");
      const previous = readlinkSync(pointer).split("/").pop()!;
      const version = JSON.parse(readFileSync(resolve(fixture, "data/eks-feed2-snapshot.json"), "utf8")).catalogVersion;
      for (const file of CATALOG_DATA_FILES) {
        mkdirSync(resolve(stage, "data"), { recursive: true });
        copyFileSync(resolve(fixture, "data", file), resolve(stage, "data", file));
      }
      const liveImages = resolve(fixture, "public/catalog");
      mkdirSync(resolve(stage, "public/catalog"), { recursive: true });
      for (const name of readdirSync(liveImages).filter((value) => value.endsWith(".webp"))) {
        copyFileSync(resolve(liveImages, name), resolve(stage, "public/catalog", name));
      }
      const id = String(current.products[0]?.productId);
      const oldPhoto = readFileSync(resolve(liveImages, `${id}-512.webp`));
      const distinctName = readdirSync(liveImages).find((name) => name.endsWith("-512.webp") &&
        !readFileSync(resolve(liveImages, name)).equals(oldPhoto));
      expect(distinctName).toBeDefined();
      const replacement = readFileSync(resolve(liveImages, distinctName!));
      writeFileSync(resolve(stage, "public/catalog", `${id}-512.webp`), replacement);
      const issued = publishCatalogRelease({ root: fixture, stage, report: "photo-only test",
        review: { toVersion: version }, expectedVersion: version, expectedPointer: previous });
      expect(issued.previousReleaseId).toBe(previous);
      const mapped = JSON.parse(readFileSync(resolve(fixture, "data/catalog-images.json"), "utf8"));
      const url = mapped[id].href512 as string;
      expect(url).toBe(`/catalog/releases/${issued.releaseId}/${id}-512.webp`);
      expect(readFileSync(resolve(fixture, "public", url.slice(1))).equals(replacement)).toBe(true);
      expect(readFileSync(resolve(liveImages, `${id}-512.webp`)).equals(oldPhoto)).toBe(true);
      expect(verifyCatalogRelease(fixture, issued.releaseId).catalogVersion).toBe(version);

      const rolledBack = rollbackCatalogRelease({ root: fixture });
      expect(rolledBack.toReleaseId).toBe(previous);
      expect(readlinkSync(pointer)).toBe(`catalog-releases/${previous}`);
      expect(JSON.parse(readFileSync(resolve(fixture, "data/catalog-images.json"), "utf8"))[id].href512).toBeUndefined();
      writeFileSync(resolve(fixture, "public", url.slice(1)), Buffer.from("corrupt"));
      expect(() => rollbackCatalogRelease({ root: fixture, targetId: issued.releaseId })).toThrow(/фото/);
      expect(readlinkSync(pointer)).toBe(`catalog-releases/${previous}`);
    } finally {
      rmSync(stage, { recursive: true, force: true });
      rmSync(fixture, { recursive: true, force: true });
    }
  }, 50_000);

  it("LED-19/20 · готовит полный версионированный diff и сохраняет только московский склад", async () => {
    const liveBefore = fingerprint();
    const fixture = isolatedFeedRoot();
    try {
      const candidate = current.products.map((product, i) => i === 0 ? {
        ...product,
        vendorCode: "SKU-MOSCOW-TEST",
        priceRub: Number(product.priceRub) + 100,
        packQty: 5,
        stockByWarehouse: { moscow: 0, barnaul: 20 },
        params: [...(Array.isArray(product.params) ? product.params : []),
          { label: "Остатки Брн", value: "20" }, { label: "Остатки Мск", value: "0" }],
      } : product);
      const result = await refreshWithFixture(candidate, [], fixture);
      expect(result.code, result.output).toBe(0);
      const saved = JSON.parse(readFileSync(resolve(fixture, "data/eks-feed2-snapshot.json"), "utf8"));
      expect(saved.catalogVersion).toMatch(/^cat-sha256-[a-f0-9]{64}$/);
      expect(saved.products[0].stockByWarehouse).toEqual({ moscow: 0 });
      // Supplier's explicit ISO timestamp may date the Moscow observation;
      // build time is never substituted.
      expect(saved.products[0].stockObservedAt).toBe(current.updatedAt);
      expect(JSON.stringify(saved.products[0])).not.toContain("Остатки Брн");
      expect(saved.products[0].packQty).toBe(5);
      const index = JSON.parse(readFileSync(resolve(fixture, "data/catalog-index.json"), "utf8"));
      expect(index.catalogVersion).toBe(saved.catalogVersion);
      const row = index.rows.find((r: unknown[]) => r[0] === current.products[0]?.productId);
      expect(row[index.columns.indexOf("moscowStock")]).toBe(0);
      const review = JSON.parse(readFileSync(resolve(fixture, "data/catalog-review.json"), "utf8"));
      expect(review.toVersion).toBe(saved.catalogVersion);
      expect(review.changes.filter((c: { productId: string }) => c.productId === current.products[0]?.productId)
        .map((c: { field: string }) => c.field)).toEqual(["priceRub", "vendorCode", "packQty", "moscowStock"]);
      expect(review.requiresReview).toBe(true);
      expect(readFileSync(resolve(fixture, "feed-diff.md"), "utf8")).toContain("Москва: 1");
      expect(fingerprint()).toBe(liveBefore);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  }, 40_000);

  it("LED-19 · дата фида без часового пояса не выдаётся за время наблюдения", async () => {
    const before = fingerprint();
    const fixture = isolatedFeedRoot();
    try {
      const candidate = current.products.map((product, i) => i === 0
        ? { ...product, stockByWarehouse: { moscow: 7 } } : product);
      const result = await refreshWithFixture(candidate, [], fixture, "2026-10-22 18:00");
      expect(result.code, result.output).toBe(0);
      const saved = JSON.parse(readFileSync(resolve(fixture, "data/eks-feed2-snapshot.json"), "utf8"));
      expect(saved.products[0].stockByWarehouse).toEqual({ moscow: 7 });
      expect(saved.products[0].stockObservedAt).toBeNull();
      const index = JSON.parse(readFileSync(resolve(fixture, "data/catalog-index.json"), "utf8"));
      const row = index.rows.find((r: unknown[]) => r[0] === current.products[0]?.productId);
      expect(row[index.columns.indexOf("stockObservedAt")]).toBe(-1);
      expect(fingerprint()).toBe(before);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  }, 40_000);

  it("LED-19 · противоречивый московский остаток отклоняет до публикации", async () => {
    const before = fingerprint();
    const candidate = current.products.map((product, i) => i === 0 ? {
      ...product,
      stockByWarehouse: { moscow: 0 },
      params: [{ label: "Остатки Мск", value: "8" }],
    } : product);
    const result = await refreshWithFixture(candidate);
    expect(result.code).not.toBe(0);
    expect(result.output).toContain("неоднозначный остаток Москвы");
    expect(fingerprint()).toBe(before);
  }, 20_000);

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

  it("LED-26 · vanished supplier image cannot silently downgrade the published catalog", async () => {
    const before = fingerprint();
    const candidate = current.products.map((product, i) => i === 0
      ? { ...product, coverImage: "" } : product);
    const result = await refreshWithFixture(candidate);
    expect(result.code).not.toBe(0);
    expect(result.output).toContain("неполный набор обложек в staging");
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
