import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { homepage } from "@/content/homepage";
import { homeAssets } from "@/content/home-assets";
import { phase2ServiceSlugs } from "@/content/services";
import { filterProofItems, proofFilters, proofPresentation, proofView } from "@/content/proof-gallery";
import { ProofBudget } from "@/components/home/proof-budget";
import { ProofGalleryCard } from "@/components/home/proof-gallery-card";

const items = homepage.proof.items;

describe("R7 solution gallery", () => {
  it("covers exactly the existing six items, preserving their order and identity", () => {
    expect(Object.keys(proofPresentation)).toEqual(items.map(item => item.slug));
    const filtered = filterProofItems("all");
    expect(filtered).toHaveLength(6);
    filtered.forEach((item, index) => expect(item).toBe(items[index]));
    expect(() => proofView("missing")).toThrow("Unknown proof item");
  });
  it.each(proofFilters)("$label never returns an empty or duplicate selection", filter => {
    const selected = filterProofItems(filter.id);
    expect(selected.length).toBeGreaterThan(0);
    expect(new Set(selected.map(item => item.slug)).size).toBe(selected.length);
    selected.forEach(item => expect(items.some(original => original === item)).toBe(true));
  });
  it("keeps high-margin solutions and combined lighting discoverable", () => {
    expect(filterProofItems("shadow").map(item => item.slug)).toEqual(["shadow-track-apartment"]);
    expect(filterProofItems("floating").map(item => item.slug)).toEqual(["floating-led-living-room"]);
    expect(filterProofItems("light").map(item => item.slug)).toEqual(["shadow-track-apartment", "floating-led-living-room", "light-lines-office"]);
    expect(filterProofItems("cornice").map(item => item.slug)).toEqual(["floating-led-living-room", "hidden-cornice-flat"]);
  });
  it.each(items)("$slug reuses existing photos and links to an existing service", item => {
    const asset = homeAssets.find(entry => entry.assetKey === item.imageAssetKey);
    expect(asset).toBeDefined();
    expect(asset && "gallery" in asset && asset.gallery.length).toBe(3);
    expect(phase2ServiceSlugs).toContain(proofView(item.slug).servicePath.replace("/uslugi/", ""));
  });
  it.each(items)("$slug retains budget labels, without representing them as a final quote", item => {
    const html = renderToStaticMarkup(createElement(ProofBudget, { item }));
    expect(html).toContain(item.priceLabel);
    expect(html).toContain("не итоговая смета вашего заказа");
    if ("budgetBreakdown" in item) {
      expect(html).toContain("Состав расчётного ориентира");
      expect(html).toContain(new Intl.NumberFormat("ru-RU").format(item.budgetBreakdown.totalRub));
    }
  });
  it("routes bespoke geometry to a discussion instead of inventing a standard preset", () => {
    const item = items.find(entry => entry.slug === "custom-dome")!;
    const html = renderToStaticMarkup(createElement(ProofGalleryCard, { item, index: 5, onOpen() {}, onWantSame() {} }));
    expect(html).toContain('href="/uslugi/individualnye-proekty#action"');
    expect(html).toContain("Обсудить проект");
    expect(html).not.toContain("Хочу похожее");
  });
});
