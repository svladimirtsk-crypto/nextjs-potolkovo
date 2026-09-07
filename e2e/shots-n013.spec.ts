import { test } from "@playwright/test";
import { MODAL } from "./helpers";

const PHASE = process.env.SHOT_PHASE ?? "before";

test.skip("N-013 · экран площади", async ({ page }, info) => {
  const dev = info.project.name.includes("mobile") ? "mobile" : "desktop";
  await page.goto("/");
  await page.getByRole("button", { name: /Рассчитать/ }).first().click();
  const modal = page.locator(MODAL);
  await modal.waitFor();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `shots/n013/${PHASE}-${dev}-home.png`, fullPage: false });

  // Тот же экран, но с пресетом со страницы услуги — там видна плашка предзаполнения.
  await page.goto("/uslugi/tenevoy-profil");
  await page.getByRole("button", { name: /Рассчитать с этим/ }).first().click();
  await modal.waitFor();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `shots/n013/${PHASE}-${dev}-preset.png`, fullPage: false });
});
