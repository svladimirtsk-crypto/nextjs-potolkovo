import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import {
  getCatalogIndex,
  getCatalogPrefill,
  resetCatalogIndexForTests,
} from "@/lib/lighting/catalog-index";
import snapshotData from "@/data/eks-feed2-snapshot.json";

const ROOT = resolve(__dirname, "..");

function fileKb(relativePath: string): number {
  return readFileSync(resolve(ROOT, relativePath)).byteLength / 1024;
}

beforeEach(() => {
  resetCatalogIndexForTests();
});

describe("T-029 - byudzhety sgenerirovannyh faylov", () => {
  it("catalog-index.json <= 120 KB", () => {
    expect(fileKb("data/catalog-index.json")).toBeLessThanOrEqual(120);
  });

  it("catalog-prefill.json <= 20 KB", () => {
    expect(fileKb("data/catalog-prefill.json")).toBeLessThanOrEqual(20);
  });

  it("indeks kratno menshe polnogo fida", () => {
    const full = fileKb("data/eks-feed2-snapshot.json");
    expect(fileKb("data/catalog-index.json")).toBeLessThan(full / 5);
  });
});

describe("T-029 - dekodirovanie indeksa", () => {
  it("tovarov stolko zhe, skolko v fide", async () => {
    const index = await getCatalogIndex();
    const source = (snapshotData as { products?: unknown[] }).products ?? [];
    expect(index.products).toHaveLength(source.length);
  });

  it("slovari raspakovany v chitaemye znacheniya", async () => {
    const index = await getCatalogIndex();
    const track = index.products.find((p) => p.kind === "TRACK_PROFILE");

    expect(track).toBeDefined();
    expect(track?.system).toMatch(/COLIBRI|CLARUS|TRACK/);
    expect(track?.unit).toBeTruthy();
  });

  it("ceny i nalichie sohraneny bez izmeneniy", async () => {
    const index = await getCatalogIndex();
    // 0У-00001341 · КОЛИБРИ 2000 мм · 5082 ₽ (эталон из фида)
    const colibri = index.products.find((p) => p.vendorCode === "0У-00001341");
    expect(colibri?.priceRub).toBe(5082);
    expect(colibri?.available).toBe(true);
  });

  it("coverImage razvernut v absolyutnyy URL", async () => {
    const index = await getCatalogIndex();
    const withCover = index.products.filter((p) => p.coverImage);

    expect(withCover.length).toBeGreaterThan(0);
    for (const product of withCover) {
      expect(product.coverImage.startsWith("http")).toBe(true);
    }
  });

  it("cokol razmechen dlya lamp", async () => {
    const index = await getCatalogIndex();
    const sockets = new Set(
      index.products.map((p) => p.socket).filter((socket): socket is NonNullable<typeof socket> => Boolean(socket))
    );
    expect(sockets.size).toBeGreaterThan(0);
    for (const socket of sockets) expect(["GX53", "MR16", "GU10"]).toContain(socket);
  });

  it("memoizaciya: povtornyy vyzov otdaet tot zhe obyekt", async () => {
    const [first, second] = await Promise.all([getCatalogIndex(), getCatalogIndex()]);
    expect(first).toBe(second);
  });
});

describe("T-029 - prefill", () => {
  it("otdaet system i kind po artikulu", async () => {
    const prefill = await getCatalogPrefill();
    // Префилл отражает фид как есть; доводкой kind/длины занимается
    // applyVendorOverrides уже на стороне потребителя.
    const colibri = prefill["0У-00001341"];

    expect(colibri).toBeDefined();
    expect(colibri.system).toBe("COLIBRI_220");
  });

  it("dliny profiley zapisany v millimetrah", async () => {
    const prefill = await getCatalogPrefill();
    const withLength = Object.values(prefill).filter((entry) => entry.lengthMm !== null);

    expect(withLength.length).toBeGreaterThan(0);
    for (const entry of withLength) {
      expect(Number.isInteger(entry.lengthMm)).toBe(true);
      expect(entry.lengthMm).toBeGreaterThan(0);
    }
  });

  it("pokryvaet ves fid po artikulam", async () => {
    const prefill = await getCatalogPrefill();
    const source = (snapshotData as { products?: { vendorCode?: string }[] }).products ?? [];
    const codes = new Set(source.map((p) => String(p.vendorCode ?? "")).filter(Boolean));

    expect(Object.keys(prefill).length).toBe(codes.size);
  });
});
