import { expect, test } from "@playwright/test";

import { MODAL } from "./helpers";

/**
 * PT-038…042, PT-046, PT-047, PT-049 · Миниатюры вариантов в квизе.
 *
 * Что здесь проверяется (и чего здесь намеренно НЕТ):
 *
 * - слот картинки не меняет разметку карточек без картинки — «Без карниза»
 *   и «Без световых линий» остаются текстовыми (осознанное исключение
 *   принципа «всё или ничего», бриф раздела 4);
 * - у картинок есть однозначный статус: реальное фото — `img` в `<picture>`
 *   с содержательным alt; схема — SVG с тонкой обводкой и подписью
 *   «схематичный» рядом, чтобы её нельзя было принять за фотографию объекта;
 * - активное состояние не перекрывается картинкой: `aria-pressed` остаётся
 *   на кнопке, текст заголовка видим;
 * - вес: миниатюры квиза не тянут полноразмерные `proj-*` (проверяется по
 *   фактическим сетевым ответам, а не по предположению).
 *
 * Скриншоты намеренно не сохраняются в репозиторий (решение владельца:
 * доказательства — текстом и логами).
 */

/**
 * Включить решения комнаты на экране «Тип потолка».
 *
 * Световые линии и трек не спрашиваются сами по себе: их включает переключатель
 * в комнате, иначе шаг просто не появляется в цепочке. Это поведение UX-R2, а
 * не настройка теста — поэтому тест идёт тем же путём, что и человек.
 */
async function enableRoomFeatures(
  page: import("@playwright/test").Page,
  options: { lightLines?: boolean; track?: boolean } = {}
) {
  await page.goto("/");
  await page.getByRole("button", { name: /Рассчитать/ }).first().click();

  const modal = page.locator(MODAL);
  await modal.waitFor();

  await modal.getByRole("button", { name: /Одну комнату/ }).click();
  await modal.getByRole("button", { name: "18 м²", exact: true }).click();

  // Площадь ещё не подтверждена: переключатели решений живут на экране типа
  // потолка, поэтому сначала подтверждаем площадь.
  const confirmArea = modal.locator("button:visible").filter({ hasText: /^Подтвердить площадь/ }).first();
  if (await confirmArea.count()) await confirmArea.click();
  await expect(modal.getByRole("heading", { name: "Тип потолка", exact: true })).toBeVisible();

  if (options.lightLines) await modal.getByLabel(/Световые линии/).check();
  if (options.track) await modal.getByLabel(/Трековое освещение/).check();

  return modal;
}

async function openCorniceScreen(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Рассчитать/ }).first().click();

  const modal = page.locator(MODAL);
  await modal.waitFor();

  await modal.getByRole("button", { name: /Одну комнату/ }).click();
  await modal.getByRole("button", { name: "18 м²", exact: true }).click();

  // До «Карнизов» два экрана: тип потолка и (если появится) профили.
  for (let i = 0; i < 6; i += 1) {
    if (await modal.getByRole("heading", { name: "Карнизы", exact: true }).count()) return modal;

    const confirm = modal.locator("button:visible").filter({ hasText: /^Подтвердить/ }).first();
    if (!(await confirm.count())) break;
    await confirm.click();
  }

  await expect(modal.getByRole("heading", { name: "Карнизы", exact: true })).toBeVisible();
  return modal;
}

test.describe("PT-040 · Карнизы: фото ниши и схемы встроенного/накладного", () => {
  test("у трёх вариантов есть изображение, у «без карниза» — только текст", async ({ page }) => {
    const modal = await openCorniceScreen(page);

    // Реальное фото скрытой ниши: alt описывает, что утоплено за полотном.
    const niche = modal.getByRole("button", { name: /Скрытая ниша/ });
    await expect(niche.locator("img")).toHaveAttribute(
      "alt",
      "Скрытая ниша: карниз утоплен за натяжным полотном"
    );
    await expect(niche.locator("img")).toHaveAttribute("src", /quiz-cornice-hidden-niche-480\.webp/);

    // Схемы: SVG как есть, без растра и без alt (смысл несёт заголовок).
    const builtIn = modal.getByRole("button", { name: /Встроенный карниз/ });
    const surface = modal.getByRole("button", { name: /Накладной карниз/ });
    await expect(builtIn.locator("img")).toHaveAttribute("src", "/quiz-cornice-builtin.svg");
    await expect(surface.locator("img")).toHaveAttribute("src", "/quiz-cornice-surface.svg");
    await expect(builtIn.locator("img")).toHaveAttribute("alt", "");
    await expect(surface.locator("img")).toHaveAttribute("alt", "");

    // «Без карниза» — осознанно без картинки.
    const none = modal.getByRole("button", { name: /Без карниза/ });
    await expect(none.locator("img")).toHaveCount(0);
  });

  test("подпись «схематичный разрез» видна у вариантов со схемой и не висит у фото", async ({ page }) => {
    const modal = await openCorniceScreen(page);

    // По умолчанию выбран none — подписи нет.
    await expect(modal.getByText(/Разрез схематичный/)).toHaveCount(0);

    await modal.getByRole("button", { name: /Накладной карниз/ }).click();
    await expect(modal.getByText(/Разрез схематичный/)).toBeVisible();

    await modal.getByRole("button", { name: /Скрытая ниша/ }).click();
    await expect(modal.getByText(/Разрез схематичный/)).toHaveCount(0);
  });

  test("активное состояние читается при картинке: aria-pressed и заголовок на месте", async ({ page }) => {
    const modal = await openCorniceScreen(page);

    const surface = modal.getByRole("button", { name: /Накладной карниз/ });
    await surface.click();

    await expect(surface).toHaveAttribute("aria-pressed", "true");
    await expect(surface.getByText("Накладной карниз", { exact: true })).toBeVisible();
    // Картинка не перекрывает текст: заголовок целиком внутри видимой области кнопки.
    await expect(surface.getByText("Накладной карниз", { exact: true })).toBeInViewport();
  });

  test("миниатюра не тянет полноразмерный proj-*", async ({ page }) => {
    const modal = await enableRoomFeatures(page);

    // Обнуляем журнал ровно перед переходом на «Карнизы»: фоновая галерея
    // главной грузит proj-* до открытия квиза, и её запросы к миниатюрам
    // отношения не имеют.
    const requested: string[] = [];
    page.on("request", (request) => {
      const url = request.url();
      if (/\.(jpe?g|webp|avif|svg)(\?|$)/i.test(url)) requested.push(url);
    });

    const confirmCeiling = modal.locator("button:visible").filter({ hasText: /^Подтвердить/ }).first();
    if (await confirmCeiling.count()) await confirmCeiling.click();
    await expect(modal.getByRole("heading", { name: "Карнизы", exact: true })).toBeVisible();

    // Ждём именно миниатюру, а не «сеть затихла»: на мобильной раскладке
    // фоновые запросы идут дольше, и networkidle там не наступает.
    const nicheThumb = modal.getByRole("button", { name: /Скрытая ниша/ }).locator("img");
    await expect(nicheThumb).toHaveAttribute("src", /quiz-cornice-hidden-niche-480/);
    await expect(nicheThumb).toHaveJSProperty("complete", true);

    const photos = requested.filter((url) => /\/(proj|hero)-/.test(url));
    expect(photos, `лишние полноразмерные кадры: ${photos.join(", ")}`).toHaveLength(0);

    // И в самом DOM карточек нет ссылок на полноразмерные кадры.
    const sources = await modal.locator("img").evaluateAll((imgs) =>
      imgs.map((img) => img.getAttribute("src") ?? "")
    );
    const fullSize = sources.filter((src) => /proj-|\/hero/.test(src));
    expect(fullSize, `полноразмерные src в карточках: ${fullSize.join(", ")}`).toHaveLength(0);
  });
});

test.describe("PT-042 · Световые линии: фото только у положительного варианта", () => {
  test("миниатюра у «Добавить световые линии», у «Без световых линий» — нет", async ({ page }) => {
    const modal = await enableRoomFeatures(page, { lightLines: true });

    let found = false;
    for (let i = 0; i < 8; i += 1) {
      if (await modal.getByRole("heading", { name: "Световые линии", exact: true }).count()) {
        found = true;
        break;
      }
      const confirm = modal.locator("button:visible").filter({ hasText: /^Подтвердить/ }).first();
      if (!(await confirm.count())) break;
      await confirm.click();
    }
    expect(found, "экран «Световые линии» не встретился в цепочке").toBe(true);

    const add = modal.getByRole("button", { name: /Добавить световые линии/ });
    await expect(add.locator("img")).toHaveAttribute("src", /quiz-lines-480\.webp/);
    await expect(add.locator("img")).toHaveAttribute("alt", "Световые линии в натяжном потолке");

    const none = modal.getByRole("button", { name: /Без световых линий/ });
    await expect(none.locator("img")).toHaveCount(0);
  });
});

test.describe("PT-041 · Треки: картинка только там, где она однозначна", () => {
  test("оба монтажных типа — схемы в одном ракурсе, «без трека» — текстом", async ({ page }) => {
    const modal = await enableRoomFeatures(page, { track: true });

    let found = false;
    for (let i = 0; i < 10; i += 1) {
      if (await modal.getByRole("heading", { name: "Трековое освещение", exact: true }).count()) {
        found = true;
        break;
      }
      const confirm = modal.locator("button:visible").filter({ hasText: /^Подтвердить/ }).first();
      if (!(await confirm.count())) break;
      await confirm.click();
    }
    expect(found, "экран «Трековое освещение» не встретился в цепочке").toBe(true);

    await expect(
      modal.getByRole("button", { name: /Встроенный трек/ }).locator("img")
    ).toHaveAttribute("src", "/quiz-track-builtin.svg");

    // Накладной — тоже схема в том же ракурсе: группа неполной не остаётся.
    await expect(
      modal.getByRole("button", { name: /Накладной трек/ }).locator("img")
    ).toHaveAttribute("src", "/quiz-track-surface.svg");

    // Обобщённое фото трека со страницы услуги здесь не используется.
    const pageImages = await modal.locator("img[src*='svc-track']").count();
    expect(pageImages).toBe(0);
    await expect(modal.getByRole("button", { name: /Без трека/ }).locator("img")).toHaveCount(0);
  });
});
