import { expect, test } from "@playwright/test";

/**
 * Маршруты к Алисе, подтверждённые владельцем 16.10.2026:
 * любая лента — через Wi-Fi 5-в-1, SMART-трековые светильники — через
 * панель-конвертер. Проверяем, что витрина говорит именно это, а не
 * «совместимость нужно подтвердить для этой модели».
 */

const CATALOG = "/uslugi/prodazha-trekovogo-osveshcheniya#price";

async function openTrackControls(page: import("@playwright/test").Page) {
  await page.goto(CATALOG, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Управление", exact: true }).click();
}

test("Алиса: SMART-трековый светильник показывает маршрут через панель-конвертер", async ({ page }) => {
  await page.goto(CATALOG, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Поиск по каталогу").fill("КОЛИБРИ СМАРТ трековый светильник РИО");
  const card = page.locator(".pk-product").first();
  await expect(card).toContainText("СМАРТ");

  await expect(card.getByTestId("alice-route-badge")).toHaveText("Алиса: через панель-конвертер");
  await card.locator("summary").click();
  await expect(card.getByTestId("alice-route-detail")).toContainText("панель-конвертер КОЛИБРИ СМАРТ");
  await expect(card.getByTestId("alice-route-detail")).toContainText("подтверждено владельцем на его комплекте");
});

test("Алиса: обычный трековый светильник не обещает голосовое управление", async ({ page }) => {
  await page.goto(CATALOG, { waitUntil: "domcontentloaded" });
  // Первый трековый светильник COLIBRI без маркировки СМАРТ.
  await page.getByRole("tab", { name: "Трековые системы", exact: true }).click();
  const cards = page.locator(".pk-product");
  const count = await cards.count();
  for (let i = 0; i < count; i += 1) {
    const text = await cards.nth(i).innerText();
    if (!/СМАРТ|SMART/i.test(text)) {
      await expect(cards.nth(i).getByTestId("alice-route-badge")).toHaveCount(0);
      return;
    }
  }
  throw new Error("Не нашлось трекового светильника без маркировки СМАРТ");
});

test("Алиса: конвертер и панель управления помечены как шлюз трека", async ({ page }) => {
  await openTrackControls(page);
  await expect(page.locator(".pk-product")).toHaveCount(5);

  await page.getByLabel("Поиск по каталогу").fill("Конвертер WI-FI");
  const converter = page.locator(".pk-product").first();
  await expect(converter).toContainText("Управление треком");
  await expect(converter.getByTestId("alice-route-badge")).toHaveText("Шлюз для Алисы");
  await converter.locator("summary").click();
  await expect(converter.getByTestId("alice-route-detail")).toContainText("Это управление треком, а не светильник");

  await page.getByLabel("Поиск по каталогу").fill("Панель управления для трековой системы, белая");
  const panel = page.locator(".pk-product").first();
  await expect(panel.getByTestId("alice-route-badge")).toHaveText("Шлюз для Алисы");
});

test("Алиса: пульт SMART-системы — это не шлюз, маршрут не обещается", async ({ page }) => {
  await openTrackControls(page);
  await page.getByLabel("Поиск по каталогу").fill("Пульт для управления смарт системы");
  const remote = page.locator(".pk-product").first();
  await expect(remote).toContainText("Пульт");
  await expect(remote.getByTestId("alice-route-badge")).toHaveCount(0);
});

test("Алиса: блок «Умный свет» объясняет два подтверждённых маршрута", async ({ page }) => {
  await page.goto(CATALOG, { waitUntil: "domcontentloaded" });
  const note = page.locator(".pk-smart-note");
  await expect(note).toContainText("любая лента — через Wi-Fi 5-в-1");
  await expect(note).toContainText("SMART-трековые светильники — через панель-конвертер");
  await expect(note).toContainText("проверим перед заказом");
});

test("Алиса: лента в каталоге помечена маршрутом через 5-в-1", async ({ page }) => {
  await page.goto(CATALOG, { waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: "Подсветка карниза", exact: true }).click();
  await page.getByLabel("Поиск по каталогу").fill("Светодиодная лента СТАНДАРТ 140 24V 112 диодов 10W 4200К");
  const strip = page.locator(".pk-product").first();
  await expect(strip.getByTestId("alice-route-badge")).toHaveText("Алиса: через Wi-Fi 5-в-1");
  await strip.locator("summary").click();
  await expect(strip.getByTestId("alice-route-detail")).toContainText("монохром, CCT, RGB, RGBW и RGB+CCT");
});

test("Алиса: панель подсветки говорит про 5-в-1 и оставляет проверку мощности", async ({ page }) => {
  await page.goto(`${CATALOG.split("#")[0]}?led=1&meters=12#price`, { waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: "Подсветка карниза", exact: true }).click();
  const panel = page.getByTestId("led-kit-panel");
  await expect(panel.getByTestId("led-alice-note")).toContainText("С Алисой любая лента работает через Wi-Fi 5-в-1");
  await expect(panel.getByTestId("led-alice-note")).toContainText("ток и каналы проверяем по паспорту");
  // Owner-verified маршрут ≠ выбранный контроллер: в live-заголовке нет режима ленты.
  await expect(panel.getByTestId("led-alice-note")).toContainText("контроллер пока не назначен");
  await expect(panel.getByTestId("led-controller-add")).toHaveCount(0);
});
