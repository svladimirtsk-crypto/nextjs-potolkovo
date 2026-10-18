import { expect, test } from "@playwright/test";

import { completeAreaScreen, MODAL, openCalculatorFromHero } from "./helpers";

/** PT-044/045 · Only text identifies the action; SVG must never replace it. */
test("девять комнат: line-иконки 20 px, доступное имя кнопки осталось текстовым", async ({ page }) => {
  await openCalculatorFromHero(page);
  await completeAreaScreen(page);
  const modal = page.locator(MODAL);
  await modal.getByRole("button", { name: /добавить помещение/i }).click();
  await expect(modal.getByRole("heading", { name: "Добавьте ещё помещение" })).toBeVisible();

  const labels = ["Кухня", "Гостиная", "Спальня", "Детская", "Кабинет", "Санузел", "Коридор", "Прихожая", "Другое"];
  await expect(modal.locator("svg[data-room-icon]")).toHaveCount(9);
  for (const label of labels) {
    const button = modal.getByRole("button", { name: `+ ${label}`, exact: true });
    const icon = button.locator("svg[data-room-icon]");
    await expect(icon).toHaveAttribute("aria-hidden", "true");
    await expect(icon).toHaveAttribute("stroke", "currentColor");
    await expect(icon).toHaveAttribute("width", "20");
    await expect(icon).toHaveAttribute("height", "20");
  }
  await modal.getByRole("button", { name: "+ Спальня", exact: true }).click();
  await expect(modal.getByRole("heading", { name: "Площадь потолка" })).toBeVisible();
});

test("три пары выкл/вкл: единый SVG-язык, текст и aria-pressed сохраняются", async ({ page }) => {
  await openCalculatorFromHero(page);
  const modal = page.locator(MODAL);
  await modal.getByRole("button", { name: /Одну комнату/ }).click();
  await modal.getByRole("button", { name: "18 м²", exact: true }).click();
  await modal.getByRole("button", { name: /Подтвердить площадь/ }).click();
  await modal.getByRole("button", { name: /Подтвердить тип/ }).click();
  await expect(modal.getByRole("heading", { name: "Карнизы" })).toBeVisible();

  async function checkPair(kind: string, off: RegExp, on: RegExp) {
    const no = modal.getByRole("button", { name: off });
    const yes = modal.getByRole("button", { name: on });
    const noIcon = no.locator(`svg[data-binary-kind="${kind}"]`);
    const yesIcon = yes.locator(`svg[data-binary-kind="${kind}"]`);
    await expect(noIcon).toHaveAttribute("data-binary-enabled", "false");
    await expect(yesIcon).toHaveAttribute("data-binary-enabled", "true");
    await expect(noIcon).toHaveAttribute("aria-hidden", "true");
    await expect(yesIcon).toHaveAttribute("aria-hidden", "true");
    await expect(noIcon).toHaveAttribute("stroke", "currentColor");
    await expect(yesIcon).toHaveAttribute("stroke", "currentColor");
    await expect(noIcon.locator('path[d="M3 21 21 3"]')).toHaveCount(1);
    await expect(yesIcon.locator('path[d="M3 21 21 3"]')).toHaveCount(0);
    await yes.click();
    await expect(yes).toHaveAttribute("aria-pressed", "true");
    await no.click();
    await expect(no).toHaveAttribute("aria-pressed", "true");
  }

  await modal.getByRole("button", { name: /Встроенный карниз/ }).click();
  await checkPair("cornice-light", /^Без подсветки/, /^Добавить подсветку/);
  await modal.getByRole("button", { name: /Подтвердить карниз/ }).click();
  await expect(modal.getByRole("heading", { name: /установка люстр/i })).toBeVisible();
  await checkPair("chandelier", /^Не нужно/, /^Добавить установку/);
  await modal.getByRole("button", { name: /Подтвердить люстры/ }).click();
  await expect(modal.getByRole("heading", { name: /точечные светильники/i })).toBeVisible();
  await checkPair("spotlight", /^Без светильников/, /^Добавить светильники/);
});
