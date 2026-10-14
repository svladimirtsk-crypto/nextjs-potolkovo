import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { interceptLeadApi, submitLeadForm } from "./helpers";

test("B8 company follow-up: request context, optional photos and accessible responsive card", async ({ page }) => {
  const leads = await interceptLeadApi(page);
  await page.goto("/");
  await submitLeadForm(page, { name: "Тест бренда", phone: "9161234567" });
  const card = page.locator("#action .pk-photo-cta");
  await expect(card).toBeVisible();
  await expect(card).toContainText("Фото к вашей заявке");
  await expect(card).toContainText("помогут обсудить детали до замера");
  await expect(card).not.toContainText(/уточню|ещё до выезда|Хотите быстрее/);
  expect(leads).toHaveLength(1);
  expect(leads[0].source).toBe("home");
  expect(leads[0].consent).toBe(true);
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    for (const link of await card.locator("a").all()) {
      const box = await link.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
      await expect(link).toHaveAttribute("target", "_blank");
    }
  }
  await card.getByTestId("success-telegram").focus();
  await expect(card.getByTestId("success-telegram")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(card.getByTestId("success-whatsapp")).toBeFocused();
  const axe = await new AxeBuilder({ page }).include("#action .pk-photo-cta").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(axe.violations.map(v => v.id)).toEqual([]);
  if (process.env.BRAND_CAPTURE_DIR) {
    await page.setViewportSize({ width: 390, height: 1000 });
    await card.screenshot({ path: `${process.env.BRAND_CAPTURE_DIR}/photo-follow-up-${test.info().project.name}.png` });
  }
});
