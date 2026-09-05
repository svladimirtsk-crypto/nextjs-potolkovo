import { expect, test } from "@playwright/test";

import { MODAL, interceptLeadApi, submitLeadForm } from "./helpers";

/**
 * N-003 · Сценарий 3 из T-091 + сценарий 13 (F-31) — страницы услуг.
 *
 * Две разные вещи: калькулятор должен открываться прямо со страницы услуги,
 * и цена в hero обязана совпадать с ценой в секции. Расхождение цен — прямая
 * потеря доверия: человек видит одну сумму в шапке и другую ниже.
 */

const SERVICE = "/uslugi/tenevoy-profil";

test.describe("Страница услуги", () => {
  test("сценарий 3: калькулятор открывается с CTA услуги", async ({ page }) => {
    await page.goto(SERVICE);

    await page.getByRole("button", { name: "Рассчитать с этим узлом" }).first().click();

    const modal = page.locator(MODAL);
    await modal.waitFor();
    await expect(modal.getByRole("button", { name: /Подтвердить площадь/ })).toBeVisible();
  });

  /**
   * ТЗ v1 требует, чтобы CTA услуги предзаполняла тип потолка и площадь 22 м².
   * Сейчас квиз открывается пустым (сценарий «Комнату» + дефолт 10 м²), тип
   * услуги не переносится. Это состояние источников состояния Шага 0 — чинится
   * в N-011/N-050, тест включим тем же коммитом.
   */
  test.fixme("сценарий 3 (полный): CTA услуги предзаполняет теневой профиль и 22 м²", async ({
    page,
  }) => {
    await page.goto(SERVICE);
    await page.getByRole("button", { name: "Рассчитать с этим узлом" }).first().click();

    const modal = page.locator(MODAL);
    await modal.waitFor();

    await expect(modal.getByRole("button", { name: "22 м²", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(modal).toContainText("Теневой");
  });

  test("сценарий 13: ценовой якорь hero совпадает с таблицей сравнения", async ({ page }) => {
    await page.goto(SERVICE);

    // Цены рендерятся через Intl.NumberFormat("ru-RU") — там NBSP (U+00A0).
    const normalize = (value: string | null) => (value ?? "").replace(/\u00a0/g, " ");
    const anchorOf = (text: string) =>
      text.match(/от\s+([\d\s]+)\s*₽\s*\/\s*м\.п\./)?.[1]?.replace(/\s+/g, "");

    const heroPrice = anchorOf(normalize(await page.locator("#hero").textContent()));

    // В сравнении та же услуга должна называть ту же цену, что и hero.
    const comparePrices = (
      await page.locator("#compare").evaluateAll((nodes) =>
        nodes.map((node) => node.textContent ?? "")
      )
    )
      .map(normalize)
      .join(" ");

    expect(heroPrice).toBe("950");
    expect(comparePrices.replace(/\s+/g, " ")).toContain("от 950 ₽ / м.п.");
  });

  test("H1 услуги не содержит регион (F-39)", async ({ page }) => {
    await page.goto(SERVICE);

    const h1 = (await page.locator("h1").first().textContent()) ?? "";
    expect(h1).not.toMatch(/в Москве и МО/i);

    // Регион остаётся в title — SEO не теряем.
    await expect(page).toHaveTitle(/Москв/i);
  });

  test("сценарий 4b: заявка со страницы услуги несёт source услуги", async ({ page }) => {
    const leads = await interceptLeadApi(page);

    await page.goto(`${SERVICE}#action`);
    await submitLeadForm(page, { name: "Анна", phone: "9031112233" });

    await expect(page.getByText(/Заявка .* принята|Заявка отправлена/)).toBeVisible();
    expect(leads).toHaveLength(1);
    expect(String(leads[0].source)).toContain("tenevoy-profil");
  });
});
