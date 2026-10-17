import { expect, test } from "@playwright/test";

import snapshot from "../data/eks-feed2-snapshot.json";

/**
 * LED-каталог: комплектующие подсветки карниза и подбор питания по метражу.
 *
 * Проверяем то, чего раньше не было: разделение 72 позиций группы на ленты,
 * питание и управление, расчёт мощности с запасом 30 %, честный статус
 * «нужна проверка» вместо выдуманных позиций и вход по задаче с метражом.
 */

const products = (snapshot as { products: { name: string; vendorCode: string; productId: string }[] }).products;
const strip10 = products.find((p) => p.name.includes("10W") && p.name.includes("Светодиодная лента"))!;

async function openCornice(page: import("@playwright/test").Page, query = "") {
  await page.goto(`/uslugi/prodazha-trekovogo-osveshcheniya${query}#price`, { waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: "Подсветка карниза", exact: true }).click();
  await expect(page.getByTestId("led-kit-panel")).toBeVisible();
}

test("LED: раздел делится на ленты, питание и управление", async ({ page }) => {
  await openCornice(page);

  const panel = page.getByTestId("led-kit-panel");
  await expect(panel.getByTestId("led-group-strips")).toContainText("36");
  await expect(panel.getByTestId("led-group-power")).toContainText("19");
  await expect(panel.getByTestId("led-group-control")).toContainText("17");

  // По умолчанию открыты ленты: в сетке только ленты, без блоков питания и пультов.
  await expect(panel.getByTestId("led-group-strips")).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".pk-product")).toHaveCount(24);
  await expect(page.locator(".pk-product").first()).toContainText("Светодиодная лента");

  await panel.getByTestId("led-group-power").click();
  await expect(page.locator(".pk-product").first()).toContainText("Блок питания");
  await expect(page.locator(".pk-product")).toHaveCount(19);

  await panel.getByTestId("led-group-control").click();
  await expect(page.locator(".pk-product").first()).toContainText(/Пульт|Контроллер/);
  await expect(page.locator(".pk-product")).toHaveCount(17);
});

test("LED: 12 м при 10 Вт/м считаются с запасом 30 % и без выдуманных позиций", async ({ page }) => {
  await openCornice(page);
  const panel = page.getByTestId("led-kit-panel");

  // Лента по умолчанию — монохром 10 Вт/м: метраж 12 м даёт 120 Вт нагрузки.
  await expect(panel.getByTestId("led-strip")).toHaveValue(/./);
  await panel.getByTestId("led-meters").fill("12");

  await expect(panel.getByTestId("led-plan-load")).toHaveText("120 Вт");
  await expect(panel.getByTestId("led-plan-required")).toHaveText("156 Вт");
  await expect(panel.getByTestId("led-plan-current")).toHaveText("5 А");
  await expect(panel.getByTestId("led-plan-reels")).toHaveText("3");

  // 156 Вт с запасом → минимальный подходящий БП 200 Вт, а не 150 Вт.
  await expect(panel.getByTestId("led-psu")).toContainText("Блок питания");
  await expect(panel.getByTestId("led-psu")).toContainText("200 Вт");

  // Монохром — Wi-Fi-контроллер: подпись про Алису owner-verified, без обещания паспорта.
  await expect(panel.getByTestId("led-controller")).toContainText("WIFI TUYA монохром C01");
  await expect(panel.getByTestId("led-alice-note")).toContainText("любая лента работает через Wi-Fi 5-в-1");
  await expect(panel.getByTestId("led-alice-note")).toContainText("подтверждено владельцем на его комплекте");
  await expect(panel.getByTestId("led-remote")).toHaveCount(0);
  // 5-в-1 Wi-Fi показан как вариант на любую ленту (подтверждение владельца).
  await expect(panel.getByTestId("led-controller-alt")).toContainText("WB5");
  await expect(panel.getByTestId("led-controller-alt")).toContainText("Подходит любой ленте");
  await expect(panel.getByTestId("led-warnings")).toHaveCount(0);
  await expect(panel.getByTestId("led-plan-status")).toContainText("Расчёт сошёлся");
});

test("LED: без метража расчёта нет, а товары попадают в комплект только по нажатию", async ({ page }) => {
  await openCornice(page);
  const panel = page.getByTestId("led-kit-panel");

  await expect(panel.getByTestId("led-plan-load")).toHaveText("—");
  await expect(panel.getByTestId("led-plan-status")).toContainText("Нужна проверка");
  // Панель ничего не добавляет сама: корзина пуста, полосы корзины ещё нет.
  await expect(page.locator("[data-cart-bar]")).toHaveCount(0);

  await panel.getByTestId("led-meters").fill("12");
  await panel.getByTestId("led-psu-add").click();
  await expect(panel.getByTestId("led-psu-add")).toContainText("уже 1");
  await expect(page.locator("[data-cart-bar]")).toHaveAttribute("data-count", "1");

  // Витрина отдаёт цену за метр: в комплект идёт установленный метраж (12 м),
  // а катушка 5 м остаётся упаковкой поставщика, а не электрическим пределом.
  await panel.getByTestId("led-strip-pick-add").click();
  await expect(panel.getByTestId("led-strip-pick-add")).toContainText("12 м");
  await expect(page.locator("[data-cart-bar]")).toHaveAttribute("data-count", "2");
});

test("LED: метраж приходит из задачи света — вход по ссылке", async ({ page }) => {
  await openCornice(page, "?led=1&meters=7.5");
  const panel = page.getByTestId("led-kit-panel");

  await expect(panel.getByTestId("led-meters")).toHaveValue("7.5");
  await expect(panel).toContainText("Метраж подставлен из задачи света: 7,5 м");
  await expect(panel.getByTestId("led-plan-load")).toHaveText("75 Вт");
  await expect(panel.getByTestId("led-plan-required")).toHaveText("97,5 Вт");
  // 97,5 Вт требует БП на 100 Вт — минимальный подходящий по мощности.
  await expect(panel.getByTestId("led-psu")).toContainText("100 Вт");

  // Мусор в параметре не превращается в расчёт.
  await page.goto("/uslugi/prodazha-trekovogo-osveshcheniya?led=1&meters=abc#price", { waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: "Подсветка карниза", exact: true }).click();
  await expect(page.getByTestId("led-meters")).toHaveValue("");
});

test("LED: для RGBW основным становится 5-в-1 Wi-Fi, без дубля альтернативы", async ({ page }) => {
  await openCornice(page);
  const panel = page.getByTestId("led-kit-panel");
  const rgbw = products.find((p) => p.name.includes("RGBW") && p.name.includes("Светодиодная лента"))!;

  await panel.getByTestId("led-strip").selectOption(rgbw.productId);
  await panel.getByTestId("led-meters").fill("10");

  await expect(panel.getByTestId("led-controller")).toContainText("WB5");
  await expect(panel.getByTestId("led-controller")).toContainText("работает со всеми лентами, подтверждено владельцем");
  // 5-в-1 уже основной: второй строкой он не повторяется.
  await expect(panel.getByTestId("led-controller-alt")).toHaveCount(0);
  // Белый канал 5-в-1 по названию не доказывается — статус остаётся «нужна проверка».
  await expect(panel.getByTestId("led-plan-status")).toContainText("Нужна проверка");
  await expect(panel.getByTestId("led-warnings")).toContainText("Каналы W");
});

test("LED: поиск и остальные разделы каталога не ломаются панелью", async ({ page }) => {
  await openCornice(page);
  await page.getByLabel("Поиск по каталогу").fill(strip10.vendorCode);
  await expect(page.locator(".pk-product")).toHaveCount(1);
  await expect(page.locator(".pk-product")).toContainText("10W");

  await page.getByRole("button", { name: "Очистить поиск", exact: true }).click();
  await page.getByRole("tab", { name: "Трековые системы", exact: true }).click();
  await expect(page.getByTestId("led-kit-panel")).toHaveCount(0);
  await expect(page.locator(".pk-product").first()).toContainText("COLIBRI");
});

/**
 * Часть C · Ряды и зоны.
 *
 * Главный риск, который закрывает тест: 6 м световой линии в два ряда — это
 * 12 м ленты. Пока ряды не умножали длину, нагрузка занижалась ровно вдвое, а
 * вместе с ней и блок питания.
 */
test("LED: два ряда удваивают длину ленты и нагрузку", async ({ page }) => {
  await openCornice(page);
  const panel = page.getByTestId("led-kit-panel");

  await panel.getByTestId("led-meters").fill("6");
  await expect(panel.getByTestId("led-plan-installed")).toHaveText("6 м");
  await expect(panel.getByTestId("led-plan-load")).toHaveText("60 Вт");

  await panel.getByTestId("led-rows").fill("2");
  await expect(panel.getByTestId("led-plan-installed")).toHaveText("12 м");
  await expect(panel.getByTestId("led-plan-load")).toHaveText("120 Вт");
  await expect(panel.getByTestId("led-plan-required")).toHaveText("156 Вт");
  // Закупка считается от установленной длины: 12 м → 3 катушки по 5 м.
  await expect(panel.getByTestId("led-plan-reels")).toHaveText("3");
});

test("LED: несколько зон — свой контроллер на зону и пометка о схеме питания", async ({ page }) => {
  await openCornice(page);
  const panel = page.getByTestId("led-kit-panel");

  await panel.getByTestId("led-meters").fill("12");
  await expect(panel.getByTestId("led-plan-controllers")).toHaveText("1");

  await panel.getByTestId("led-zones").fill("2");
  await expect(panel.getByTestId("led-plan-controllers")).toHaveText("2");
  // Общая мощность зон та же: зона — это управление, а не отдельная нагрузка.
  await expect(panel.getByTestId("led-plan-load")).toHaveText("120 Вт");
  // Один БП на две зоны требует подтверждённой схемы — статус не зелёный.
  await expect(panel.getByTestId("led-plan-status")).toContainText("Нужна проверка");
  await expect(panel.getByTestId("led-warnings")).toContainText("2 зоны");
  await expect(panel.getByTestId("led-controller")).toContainText("2 шт");
});
