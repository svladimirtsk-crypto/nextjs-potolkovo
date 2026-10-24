import { expect, test } from "@playwright/test";
import { interceptLeadApi, MODAL, submitLeadForm } from "./helpers";

/** LED-22–24: plan revisions without an invented BOM, and explicit cart reconciliation. */
test("LED: meters, rows and zones revise the quote without silently replacing saved equipment", async ({ page }) => {
  await page.goto("/uslugi/prodazha-trekovogo-osveshcheniya#price", { waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: "Подсветка карниза", exact: true }).click();
  const panel = page.getByTestId("led-kit-panel");
  await panel.getByTestId("led-meters").fill("6");
  const revision = panel.getByTestId("led-quote-revision");
  await expect(revision).toBeVisible();
  const initial = await revision.getAttribute("data-quote-version");
  expect(initial).toMatch(/^ledq1-/);
  await expect(page.locator("[data-cart-bar]")).toHaveCount(0);

  await panel.getByTestId("led-zones").fill("2");
  await expect(revision).not.toHaveAttribute("data-quote-version", initial!);
  const zonesRevision = await revision.getAttribute("data-quote-version");
  await panel.getByTestId("led-rows").fill("2");
  await expect(revision).not.toHaveAttribute("data-quote-version", zonesRevision!);

  await panel.getByTestId("led-psu-add").click();
  await expect(page.locator("[data-cart-bar]")).toHaveAttribute("data-count", "1");
  // Increase load so the previous PSU is not the suggested one; do not erase the item.
  await panel.getByTestId("led-meters").fill("24");
  await expect(panel.getByTestId("led-cart-recheck")).toBeVisible();
  await expect(page.locator("[data-cart-bar]")).toHaveAttribute("data-count", "1");
});

test("LED-24: cancel keeps draft; failed submit/retry keeps the same needs_review BOM and requestId", async ({ page }) => {
  const stub = { status: 500, body: { ok: false, error: "internal" } };
  const leads = await interceptLeadApi(page, stub);
  await page.goto("/uslugi/prodazha-trekovogo-osveshcheniya#price", { waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: "Подсветка карниза", exact: true }).click();
  const panel = page.getByTestId("led-kit-panel");
  await panel.getByTestId("led-meters").fill("12");
  await panel.getByTestId("led-zones").fill("2");
  await panel.getByTestId("led-rows").fill("2");
  await panel.getByTestId("led-psu-add").click();
  const version = await panel.getByTestId("led-quote-revision").getAttribute("data-quote-version");
  expect(version).toMatch(/^ledq1-/);
  const checkout = page.locator("[data-cart-bar]:visible").last().getByRole("button", { name: "Оформить" });
  await checkout.click();
  await expect(page.getByLabel("Как оформляем комплект?")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(MODAL)).toHaveCount(0);
  await expect(panel.getByTestId("led-quote-revision")).toHaveAttribute("data-quote-version", version!);
  await expect(page.locator("[data-cart-bar]")).toHaveAttribute("data-count", "1");
  expect(leads).toHaveLength(0);

  await checkout.click();
  await page.getByLabel("Как оформляем комплект?").getByRole("button", { name: /Только оборудование/ }).click();
  const modal = page.locator(MODAL);
  await submitLeadForm(page, { scope: modal });
  await expect(modal.getByTestId("lead-error-alert")).toBeVisible();
  expect(leads).toHaveLength(1);
  const payload = leads[0] as {
    requestId?: string;
    snapshot?: { lighting?: { ledPlanning?: Array<{ meters: number; zones: number; rows: number }> };
      ledReview?: { status: string; bom: Array<{ priceRub: number; qty: number }>; questions: string[]; quoteVersion: string };
      totals?: { ledIncludedRub: number; ledEquipmentExtraRub: number; ledCeilingDeltaRub: number } };
  };
  expect(payload.requestId).toBeTruthy();
  expect(payload.snapshot?.lighting?.ledPlanning?.[0]).toMatchObject({ meters: 12, zones: 2, rows: 2 });
  expect(payload.snapshot?.ledReview).toMatchObject({ status: "needs_review", quoteVersion: version });
  expect(payload.snapshot?.ledReview?.bom).toHaveLength(1);
  expect(payload.snapshot?.totals).toMatchObject({ ledIncludedRub: 0, ledCeilingDeltaRub: 0,
    ledEquipmentExtraRub: payload.snapshot!.ledReview!.bom[0].priceRub * payload.snapshot!.ledReview!.bom[0].qty });
  expect(payload.snapshot?.ledReview?.questions?.length).toBeGreaterThan(0);

  stub.status = 201;
  stub.body = { ok: true, leadId: "E2E01", status: "queued" };
  await modal.getByTestId("lead-retry-button").click();
  await expect(page.getByText(/Заявка №E2E01 сохранена/)).toBeVisible();
  expect(leads).toHaveLength(2);
  expect(leads[1].requestId).toBe(payload.requestId);
  expect(leads[1].snapshot).toEqual(payload.snapshot);
});
