import { expect, test } from "@playwright/test";
import { MODAL } from "./helpers";

/**
 * N-013 · Экран «Площадь потолка» (F-08–F-11, F-13).
 */
test.describe("Шаг 0 · экран площади", () => {
  test("сценарий 12: выбор масштаба и площадь помещаются без скролла", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Рассчитать/ }).first().click();

    const modal = page.locator(MODAL);
    await modal.waitFor();

    await expect(modal.getByRole("button", { name: /Одну комнату/ })).toBeInViewport();
    await expect(modal.getByRole("button", { name: /Всю квартиру или дом/ })).toBeInViewport();
    // Степпер площади — тот самый блок, который раньше уходил под сгиб.
    await expect(modal.getByLabel("Площадь потолка, м²", { exact: true })).toBeInViewport();
  });

  test("на входе не просят печатать название комнаты", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Рассчитать/ }).first().click();

    const modal = page.locator(MODAL);
    await modal.waitFor();

    // F-08: поле свёрнуто в ссылку — печатать до первого расчёта не нужно.
    await expect(modal.getByLabel("Название помещения")).toHaveCount(0);

    const disclosure = modal.getByRole("button", { name: /Назвать помещение/ });
    await expect(disclosure).toBeVisible();
    await disclosure.click();
    await expect(modal.getByLabel("Название помещения")).toBeVisible();
  });

  test("язык клиента: без «узлов» и «участков», пять быстрых площадей", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Рассчитать/ }).first().click();

    const modal = page.locator(MODAL);
    await modal.waitFor();

    const body = await modal.innerText();
    // F-09: слова монтажника не должны попадаться клиенту на первом экране.
    expect(body).not.toMatch(/узл|участк/i);
    expect(body).toContain("Только площадь");

    // F-13: пять чипов вместо восьми.
    for (const value of ["12 м²", "15 м²", "18 м²", "22 м²", "30 м²"]) {
      await expect(modal.getByRole("button", { name: value, exact: true })).toBeVisible();
    }
    await expect(modal.getByRole("button", { name: "40 м²", exact: true })).toHaveCount(0);

    // Дефолт совпадает с чипом — иначе экран выглядит как «ничего не выбрано».
    await expect(modal.getByRole("button", { name: "18 м²", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  test("F-10: плашка предзаполнения — только когда значение пришло со страницы", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Рассчитать/ }).first().click();
    const modal = page.locator(MODAL);
    await modal.waitFor();

    // На главной пресета нет: контекст подставляет заглушку, и сообщать не о чем.
    await expect(modal.getByText(/со страницы/)).toHaveCount(0);

    await page.reload();
    await page.goto("/uslugi/tenevoy-profil");
    await page.getByRole("button", { name: "Рассчитать теневой потолок" }).first().click();
    await modal.waitFor();

    // А здесь площадь действительно подставлена — и плашка называет её.
    await expect(modal.getByText(/Подставил \d+ м² со страницы/)).toBeVisible();
  });
});
