import { expect, test } from "@playwright/test";
import { MODAL, completeAreaScreen } from "./helpers";

/**
 * N-021 · Экран «Светильники» Шага 1 (F-15, F-16, F-45).
 */
async function openPointsScreen(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Рассчитать/ }).first().click();
  const modal = page.locator(MODAL);
  await modal.waitFor();
  await completeAreaScreen(page, { area: "18 м²", points: "6 шт." });
  await modal.getByRole("button", { name: /Подобрать свет/ }).first().click();
  return modal;
}

test.describe("Шаг 1 · светильники", () => {
  test("сценарий 15: «Добавить 6 популярных» закрывает потребность одним нажатием", async ({
    page,
  }) => {
    const modal = await openPointsScreen(page);

    // F-16: до N-021 кнопки не было вовсе — только заблокированное
    // «Подтвердить точки» и требование собрать шесть штук вручную.
    const confirm = modal.getByRole("button", { name: /Подтвердить светильники/ });
    await expect(confirm).toBeDisabled();

    const addPopular = modal.getByTestId("add-popular-points");
    await expect(addPopular).toBeVisible();
    await expect(addPopular).toContainText(/Добавить 6/);

    await addPopular.click();

    /**
     * Потребность закрыта, и мастер сам уходит на следующий шаг — «Лампы».
     * Именно это и есть смысл кнопки: одно нажатие вместо шести добавлений
     * и ручного подтверждения.
     */
    await expect(modal.getByText("Лампы к светильникам")).toBeVisible();
    await expect(modal.getByText(/Выбранное \(1\)/)).toBeVisible();
  });

  test("F-15: первый вопрос — вид светильника, а не цоколь", async ({ page }) => {
    const modal = await openPointsScreen(page);

    await expect(modal.getByText("Какие светильники?")).toBeVisible();

    // Три типа на языке клиента, у каждого фото и цена «от».
    for (const kind of ["recessed", "swivel", "panel"]) {
      await expect(modal.getByTestId(`point-kind-${kind}`)).toBeVisible();
      await expect(modal.getByTestId(`point-kind-${kind}`)).toContainText(/от \d/);
    }

    // Маркировки цоколей на входе не показываются — они за ссылкой.
    await expect(modal.getByRole("button", { name: "GX53", exact: true })).toHaveCount(0);

    await modal.getByTestId("open-manual-points").click();
    await expect(modal.getByRole("button", { name: "GX53", exact: true })).toBeVisible();
  });

  test("смена типа меняет предложение и сетку", async ({ page }) => {
    const modal = await openPointsScreen(page);

    const addPopular = modal.getByTestId("add-popular-points");
    const recessedLabel = await addPopular.innerText();

    await modal.getByTestId("point-kind-panel").click();
    await expect(modal.getByTestId("point-kind-panel")).toHaveAttribute("aria-pressed", "true");

    // Предложение пересчитано под другой тип — иначе выбор ни на что не влияет.
    await expect(addPopular).not.toHaveText(recessedLabel);
    await expect(addPopular).toContainText(/панелей/);
  });

  test("копирайт: «светильники» вместо «точек»", async ({ page }) => {
    const modal = await openPointsScreen(page);

    const body = await modal.innerText();
    expect(body).not.toMatch(/\bточк/i);
    expect(body).toContain("Светильники");
  });
});
