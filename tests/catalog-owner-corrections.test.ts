import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RetiredCatalogNotice } from "@/components/lighting/retired-catalog-notice";
import { describe, expect, it } from "vitest";
import snapshot from "@/data/eks-feed2-snapshot.json";
import pricingInputs from "@/data/proof-pricing-inputs.json";
import { normalizeFeedCatalogProducts } from "@/lib/feed2-snapshot-normalize";
import { applyVendorOverrides } from "@/lib/vendor-code-overrides";
import { isRetiredCatalogProduct } from "@/lib/catalog-retirement";
import { nonLuminaireRole } from "@/lib/lighting/product-role";
import { isPanelProduct, isPointFixture, matchesPointSubtype } from "@/lib/lighting/product-predicates";
import { sectionOfProduct, productsOfSection } from "@/lib/lighting/catalog-filters";
import { getRequiredLampSocket } from "@/lib/feed2-products";
import { getCatalogIndex, getCatalogPrefill } from "@/lib/lighting/catalog-index";
import { buildCatalogProducts, getCatalogLookupProducts } from "@/lib/lighting/catalog-products";
import { calcSelectedPointQty } from "@/lib/lighting/cart-derived";
import { pointsOfKind } from "@/lib/lighting/popular-points";
import { scopeCatalogProducts } from "@/lib/lighting/step1-selectors";
import { TRACK_PROFILE_WHITELIST } from "@/lib/catalog-ui-config";

const products = normalizeFeedCatalogProducts(snapshot.products).map(applyVendorOverrides);
const raw = normalizeFeedCatalogProducts(snapshot.products);
const byCode = (code: string) => { const p = products.find(p => p.vendorCode === code); expect(p, code).toBeDefined(); return p!; };
const controls = ["0У-00002005", "0У-00002099", "0У-00002100", "0У-00002331", "0У-00002332"];
const accessories = ["ЦБ-00010285", "ЦБ-00010286", "ЦБ-00010287", "ЦБ-00010705", "ЦБ-00010706", "0У-00004814", "0У-00004815"];
const filter = { section: "track-systems" as const, trackSystem: "COLIBRI_220" as const, trackGroup: "TRACK_CONTROL" as const, pointSubtype: "PANELS" as const, lampSocket: "GX53" as const };

describe("Owner clarification 15.10: hardware is not a light source", () => {
  for (const code of controls) it(`${code}: track control, not a panel/spot or installation point`, () => {
    const p = byCode(code);
    expect(p.kind).toBe("TRACK_CONTROL"); expect(p.unit).toBe("pcs");
    expect(nonLuminaireRole(p)).toBe("track-control"); expect(isPanelProduct(p)).toBe(false); expect(isPointFixture(p)).toBe(false);
    expect(sectionOfProduct(p)).toBe("track-systems"); expect(getRequiredLampSocket(p)).toBeNull();
    expect(calcSelectedPointQty([{ product: p, productId: p.productId, qty: 4 }])).toBe(0);
    expect(productsOfSection(products, filter)).toContainEqual(p);
  });
  for (const code of accessories) it(`${code}: supplementary component, no lamp or fixture requirement`, () => {
    const p = byCode(code);
    expect(p.kind).toBe("FIXTURE_ACCESSORY"); expect(p.unit).toBe("pcs"); expect(sectionOfProduct(p)).toBe("fixture-accessories");
    expect(isPointFixture(p)).toBe(false); expect(getRequiredLampSocket(p)).toBeNull();
    for (const subtype of ["GX53", "MR16", "GU10", "PANELS", "OTHER"] as const) expect(matchesPointSubtype(p, subtype)).toBe(false);
    expect(calcSelectedPointQty([{ product: p, productId: p.productId, qty: 3 }])).toBe(0);
  });
  it("protects raw misclassified items too, not only already-normalized UI cards", () => {
    for (const code of [...controls, ...accessories]) {
      const p = raw.find(p => p.vendorCode === code)!;
      expect(isPanelProduct(p), code).toBe(false); expect(isPointFixture(p), code).toBe(false); expect(getRequiredLampSocket(p), code).toBeNull();
    }
  });
  it("does not remove real LED panels or true fixture models", () => {
    const real = products.filter(p => p.kind === "PANEL"); expect(real.length).toBeGreaterThan(0);
    expect(real.every(isPanelProduct)).toBe(true);
    const spots = products.filter(p => p.kind === "SPOT_FIXTURE"); expect(spots.length).toBeGreaterThan(50);
    expect(spots.every(isPointFixture)).toBe(true);
    for (const kind of ["recessed", "swivel", "panel"] as const) {
      expect(pointsOfKind(products, kind).every(p => nonLuminaireRole(p) === null)).toBe(true);
    }
  });
  it("routes accessories and controls equally in full page and modal", () => {
    const modalControls = scopeCatalogProducts({ ...filter, products, selectedMode: false, selectedProducts: [], query: "" });
    expect(modalControls.map(p => p.productId)).toEqual(productsOfSection(products, filter).map(p => p.productId));
    const f = { ...filter, section: "fixture-accessories" as const };
    const modalAccessories = scopeCatalogProducts({ ...f, products, selectedMode: false, selectedProducts: [], query: "" });
    expect(modalAccessories.map(p => p.productId)).toEqual(productsOfSection(products, f).map(p => p.productId));
    expect(modalAccessories).toHaveLength(7);
  });
  it("recognizes current aliases and Clarus-named controls without asserting cross-family pairing", () => {
    const mount = { ...byCode("ЦБ-00010705"), vendorCode: "УУ-00007943", offerId: "1246", kind: "SPOT_FIXTURE" as const };
    expect(applyVendorOverrides(mount).kind).toBe("FIXTURE_ACCESSORY");
    const control = { ...byCode("0У-00002005"), vendorCode: "test-clarus-control", offerId: "", name: "КЛАРУС СМАРТ Конвертер для трековой системы", system: "CLARUS_48" as const, kind: "PANEL" as const };
    expect(applyVendorOverrides(control)).toMatchObject({ kind: "TRACK_CONTROL", system: "CLARUS_48" });
    expect(isPanelProduct(control)).toBe(false);
  });
});

describe("Owner withdrawal: 0У-00001341 / offer 2021", () => {
  it("is absent from active index, prefill, price inputs and profile whitelist", async () => {
    const i = await getCatalogIndex();
    expect(i.products.some(p => p.vendorCode === "0У-00001341")).toBe(false);
    expect(buildCatalogProducts(i).some(p => p.vendorCode === "0У-00001341")).toBe(false);
    expect((await getCatalogPrefill())["0У-00001341"]).toBeUndefined();
    expect(pricingInputs.prices).not.toHaveProperty("0У-00001341");
    expect(TRACK_PROFILE_WHITELIST.COLIBRI_220).not.toContain("0У-00001341");
  });
  it("retains unavailable historical lookup instead of silently replacing an old request", async () => {
    const p = (await getCatalogLookupProducts()).find(p => p.vendorCode === "0У-00001341");
    expect(p).toMatchObject({ available: false, priceRub: 5082 }); expect(isRetiredCatalogProduct(p!)).toBe(true);
  });
  it("matches the withdrawn offer if its supplier code changes", () => {
    expect(isRetiredCatalogProduct({ vendorCode: "future-alias", offerId: "2021" })).toBe(true);
    expect(isRetiredCatalogProduct({ vendorCode: "0У-00006090", offerId: "12402" })).toBe(false);
  });
});


describe("Withdrawal notice", () => {
  it("does not pretend the old sum is current or silently replace the product", () => {
    const html = renderToStaticMarkup(createElement(RetiredCatalogNotice, {
      items: [{ sku: "eks-0-00001341", vendorCode: "0У-00001341", name: "Историческая позиция", priceRub: 5082, qty: 1 }], onReview: () => {},
    }));
    expect(html).toContain("Сохранённая сумма может включать");
    expect(html).toContain("Автоматически ничего не заменяем");
    expect(html).toContain("Проверить снятые позиции");
  });
});
