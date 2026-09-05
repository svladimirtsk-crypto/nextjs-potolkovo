import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  ART_GX53_REQUIRED_VENDOR_CODES,
  ART_MR16_REQUIRED_VENDOR_CODES,
  ART_NO_LAMP_VENDOR_CODES,
  CATALOG_SECTIONS,
  CLARUS_PSU_VENDOR_CODES,
  POINT_TO_MOUNT_VENDOR_CODE,
  TRACK_PROFILE_WHITELIST,
} from "../lib/catalog-ui-config";
import { normalizeFeedCatalogProducts } from "../lib/feed2-snapshot-normalize";

const snapshot = JSON.parse(
  readFileSync(new URL("../data/eks-feed2-snapshot.json", import.meta.url), "utf8")
) as { products?: unknown[] };

const products = normalizeFeedCatalogProducts(snapshot.products ?? []);
const vendorCodes = new Set(products.map((p) => String(p.vendorCode ?? "").trim()).filter(Boolean));

/** Та же классификация, что использует UI каталога для группировки. */
function sectionOf(product: (typeof products)[number]): string | null {
  const text = `${product.name ?? ""} ${product.vendorCode ?? ""} ${product.categoryPath ?? ""}`.toLowerCase();

  if (
    product.kind === "TRACK_PROFILE" ||
    product.kind === "TRACK_FIXTURE" ||
    product.kind === "TRACK_ACCESSORY"
  ) {
    return "track-systems";
  }
  if (product.kind === "SPOT_FIXTURE") return "point-fixtures";
  if (product.kind === "CHANDELIER") return "chandeliers";
  if (product.kind === "LED_STRIP" || product.kind === "PSU" || product.kind === "CONTROL") {
    return "cornice-lighting";
  }
  if (product.kind === "LAMP") return "lamps";
  if (
    product.kind === "CEILING_COMPONENT" ||
    text.includes("заклад") ||
    text.includes("решетк") ||
    text.includes("решётк")
  ) {
    return "mounts-grilles";
  }
  return null;
}

describe("T-091 · validate-catalog: whitelist ⊂ фид", () => {
  it("все профили из TRACK_PROFILE_WHITELIST есть в фиде", () => {
    for (const [system, codes] of Object.entries(TRACK_PROFILE_WHITELIST)) {
      for (const code of codes) {
        expect(vendorCodes.has(code), `${system}: ${code}`).toBe(true);
      }
    }
  });

  it("блоки питания CLARUS есть в фиде", () => {
    for (const code of CLARUS_PSU_VENDOR_CODES) {
      expect(vendorCodes.has(code), code).toBe(true);
    }
  });

  it("обязательные ART-коды и закладные есть в фиде", () => {
    const codes = [
      ...ART_GX53_REQUIRED_VENDOR_CODES,
      ...ART_MR16_REQUIRED_VENDOR_CODES,
      ...ART_NO_LAMP_VENDOR_CODES,
      ...Object.keys(POINT_TO_MOUNT_VENDOR_CODE),
      ...Object.values(POINT_TO_MOUNT_VENDOR_CODE),
    ];

    for (const code of codes) {
      expect(vendorCodes.has(code), code).toBe(true);
    }
  });
});

describe("T-091 · покрытие каталога", () => {
  it("каждая секция каталога непустая — вкладок без товаров быть не должно", () => {
    const counts = new Map<string, number>();
    for (const product of products) {
      const section = sectionOf(product);
      if (section) counts.set(section, (counts.get(section) ?? 0) + 1);
    }

    for (const section of CATALOG_SECTIONS) {
      expect(counts.get(section.id) ?? 0, section.id).toBeGreaterThan(0);
    }
  });

  it("подавляющее большинство товаров достижимо хотя бы из одной секции", () => {
    const reachable = products.filter((p) => sectionOf(p) !== null);
    const ratio = reachable.length / products.length;

    // Базовая линия на сегодня — 454/547 ≈ 83 %. Порог 0.80 ловит реальную
    // регрессию (секция отвалилась / поменялся kind), но не падает на
    // нормальном хвосте «прочего» из фида. Если покрытие вырастет —
    // поднимите порог осознанно, а не подгоняйте его под факт.
    expect(ratio, `достижимо ${reachable.length} из ${products.length}`).toBeGreaterThan(0.8);
  });

  it("у товаров есть название и цена — иначе карточка бессмысленна", () => {
    const broken = products.filter(
      (p) => !String(p.name ?? "").trim() || !Number.isFinite(Number(p.priceRub))
    );

    expect(broken.map((p) => p.vendorCode)).toEqual([]);
  });
});
