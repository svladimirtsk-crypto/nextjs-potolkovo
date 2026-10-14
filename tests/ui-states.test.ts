import { beforeAll, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createCatalogProductsResource } from "@/lib/lighting/catalog-products-resource";
import { getCatalogIndex, type CatalogIndex } from "@/lib/lighting/catalog-index";
import { buildCatalogProducts } from "@/lib/lighting/catalog-products";
import { StatePanel } from "@/components/brand/state-panel";
import { CatalogLoadState } from "@/components/lighting/catalog-load-state";
import { CatalogBrowse } from "@/components/lighting/CatalogBrowse";
import { SelectedList } from "@/components/lighting/SelectedList";
import { LeadFormAlert } from "@/components/home/lead-form-alert";
import { describeLeadFailure } from "@/lib/lead/failure-view";
import { DraftRestoreChoice } from "@/components/calculator-modal/step0/quiz-v2/DraftRestoreChoice";

let index: CatalogIndex;
beforeAll(async () => { index = await getCatalogIndex(); });

describe("B8-005: shared catalog loading and explicit recovery", () => {
  it("starts with loading, not a ready empty catalog, including SSR", () => {
    const r = createCatalogProductsResource(async () => index);
    expect(r.getSnapshot()).toEqual({ products: [], isLoading: true, error: null });
    expect(r.getServerSnapshot()).toBe(r.getSnapshot());
    expect(r.getSnapshot()).toBe(r.getSnapshot());
  });
  it("deduplicates simultaneous consumers without changing decoded products or prices", async () => {
    let release!: (value: CatalogIndex) => void;
    const load = vi.fn(() => new Promise<CatalogIndex>(resolve => { release = resolve; }));
    const r = createCatalogProductsResource(load);
    const first = r.ensureLoaded(); const second = r.ensureLoaded();
    expect(first).toBe(second);
    await Promise.resolve(); release(index); await first;
    expect(load).toHaveBeenCalledTimes(1);
    expect(r.getSnapshot().products).toEqual(buildCatalogProducts(index));
    expect(r.getSnapshot().isLoading).toBe(false);
    expect(r.getSnapshot().error).toBeNull();
  });
  it("keeps a failed request distinct and does not retry on consumer remount", async () => {
    const load = vi.fn().mockRejectedValue(new Error("chunk failure"));
    const r = createCatalogProductsResource(load);
    await r.ensureLoaded(); await r.ensureLoaded();
    const off = r.subscribe(() => {}); await r.ensureLoaded(); off();
    expect(load).toHaveBeenCalledTimes(1);
    expect(r.getSnapshot().error?.message).toBe("chunk failure");
    expect(r.getSnapshot().isLoading).toBe(false);
  });
  it("explicit retry recovers all subscribers, including footer and summary consumers", async () => {
    const load = vi.fn().mockRejectedValueOnce("network").mockResolvedValueOnce(index);
    const r = createCatalogProductsResource(load);
    const a = vi.fn(), b = vi.fn(); r.subscribe(a); r.subscribe(b);
    await r.ensureLoaded();
    expect(a).toHaveBeenCalledTimes(1); expect(b).toHaveBeenCalledTimes(1);
    const retry = r.retry(); expect(r.getSnapshot().isLoading).toBe(true);
    expect(r.retry()).toBe(retry);
    await retry;
    expect(load).toHaveBeenCalledTimes(2);
    expect(r.getSnapshot().products).toEqual(buildCatalogProducts(index));
    expect(a).toHaveBeenCalledTimes(3); expect(b).toHaveBeenCalledTimes(3);
  });
  it("removes unmounted listeners but keeps successful data cached", async () => {
    const load = vi.fn(async () => index); const r = createCatalogProductsResource(load);
    const listen = vi.fn(); const off = r.subscribe(listen); off();
    await r.ensureLoaded(); await r.retry(); await r.ensureLoaded();
    expect(listen).not.toHaveBeenCalled(); expect(load).toHaveBeenCalledTimes(1);
    expect(r.getServerSnapshot().isLoading).toBe(true);
  });
  it("accepts a successfully loaded empty dataset as ready, not a loading failure", async () => {
    const r = createCatalogProductsResource(async () => ({ ...index, products: [] }));
    await r.ensureLoaded(); expect(r.getSnapshot()).toEqual({ products: [], isLoading: false, error: null });
  });
  it("handles a synchronous loader failure as well as rejected promises", async () => {
    const r = createCatalogProductsResource(() => { throw new Error("local failure"); });
    await r.ensureLoaded(); expect(r.getSnapshot().error?.message).toBe("local failure");
  });
});

describe("B8-005: explicit states and honest actions", () => {
  for (const tone of ["empty", "loading", "error", "success", "warning"] as const) {
    it(`${tone}: has textual meaning and a decorative, non-announcing icon`, () => {
      const html = renderToStaticMarkup(createElement(StatePanel, { tone, title: "Понятный заголовок", description: "Следующий шаг" }));
      expect(html).toContain(`data-ui-state="${tone}"`); expect(html).toContain('aria-hidden="true"');
      expect(html).toContain("Понятный заголовок"); expect(html).not.toContain('role="alert"');
    });
  }
  it("loading does not show empty-state or retry actions; error has recovery without page reload", () => {
    const retry = vi.fn(), back = vi.fn();
    const loading = renderToStaticMarkup(createElement(CatalogLoadState, { loading: true, onRetry: retry, onBack: back }));
    expect(loading).toContain('role="status"'); expect(loading).not.toContain("Повторить загрузку");
    const failure = renderToStaticMarkup(createElement(CatalogLoadState, { loading: false, onRetry: retry, onBack: back }));
    expect(failure).toContain('role="alert"'); expect(failure).toContain("не отсутствие товаров");
    expect(failure).toContain("Повторить загрузку"); expect(retry).not.toHaveBeenCalled(); expect(back).not.toHaveBeenCalled();
  });
  it("empty search has an accessible input and reset action without selecting products", () => {
    const change = vi.fn(), qty = vi.fn();
    const html = renderToStaticMarkup(createElement(CatalogBrowse, {
      query: "не найдено", onQueryChange: change, hasCeilingContext: false, withCeilingPercent: 25,
      lightingOnlyPercent: 10, products: [], cartItems: {}, onQtyChange: qty, onZoom: vi.fn(), cardDiscountPercent: 10,
    }));
    expect(html).toContain('aria-label="Поиск в текущем разделе"'); expect(html).toContain("Сбросить поиск");
    expect(html).toContain("Выбранные товары останутся"); expect(qty).not.toHaveBeenCalled(); expect(change).not.toHaveBeenCalled();
  });
  it("empty selection offers browsing without a manufactured total", () => {
    const browse = vi.fn(); const html = renderToStaticMarkup(createElement(SelectedList, {
      items: [], totals: { regular: 0, effective: 0, effectivePercent: 0, effectiveBenefit: 0, withCeiling: 0, withCeilingBenefit: 0 },
      showWithCeilingHint: false, onQtyChange: vi.fn(), onRemove: vi.fn(), onGoToSummary: vi.fn(), goToSummaryDisabled: true, onBrowse: browse,
    }));
    expect(html).toContain("Перейти в каталог"); expect(html).not.toContain("0 ₽"); expect(browse).not.toHaveBeenCalled();
  });
  it("network errors keep the unknown outcome, request retry and fields explanation", () => {
    const view = describeLeadFailure({ ok: false, kind: "network", status: null, issues: [], retryAfterSec: null, serverMessage: null });
    const html = renderToStaticMarkup(createElement(LeadFormAlert, { view, onRetry: vi.fn() }));
    expect(html).toContain("Не получили подтверждение"); expect(html).toContain("Повторить отправку");
    expect(html).toContain("Введённые данные на месте"); expect(html).toContain('role="alert"');
  });
  it("a blocked rate limit remains non-retriable until the existing form policy permits it", () => {
    const view = describeLeadFailure({ ok: false, kind: "ratelimit", status: 429, issues: [], retryAfterSec: 60, serverMessage: null });
    const html = renderToStaticMarkup(createElement(LeadFormAlert, { view, onRetry: vi.fn() }));
    expect(html).toContain("Нужно немного подождать"); expect(html).not.toContain('data-testid="lead-retry-button"');
  });
  it("unreadable draft remains a deliberate destructive choice, not automatic clearing", () => {
    const start = vi.fn(); const html = renderToStaticMarkup(createElement(DraftRestoreChoice, { variant: "unreadable", origin: "default", onStartNew: start }));
    expect(html).toContain("только после вашего выбора"); expect(html).not.toContain("Ничего не сломалось");
    expect(start).not.toHaveBeenCalled();
  });
});
