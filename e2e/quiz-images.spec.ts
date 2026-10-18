import { expect, test } from "@playwright/test";

import { MODAL } from "./helpers";

// Test process must use the same build-time value as the Next build. A mismatch
// fails these checks instead of silently accepting the wrong deployed bundle.
const IMAGES_ON = process.env.NEXT_PUBLIC_QUIZ_STEP_IMAGES === "on";

/**
 * PT-038…042, PT-046…049 · Off by default; on is a three-screen pilot.
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

test("PT-048 · флаг управляет тремя схемами потолка, но не выбором/ценой", async ({ page }) => {
  const modal = await enableRoomFeatures(page);
  const options = modal.locator("[data-ceiling-option]");
  await expect(options).toHaveCount(3);
  await expect(modal.locator(".pk-ceiling-diagram svg")).toHaveCount(IMAGES_ON ? 3 : 0);
  const shadow = modal.getByRole("button", { name: /Теневой потолок/ });
  await shadow.click();
  await expect(shadow).toHaveAttribute("aria-pressed", "true");
  await expect(shadow).toContainText("₽");
  await expect(shadow).toContainText("Теневой потолок");
  if (!IMAGES_ON) await expect(modal.getByText(/Изображения — схемы/)).toHaveCount(0);
});

test.describe("PT-040 · Карнизы: off текстом, on фото ниши и схемы", () => {
  test("off оставляет все варианты текстовыми; on иллюстрирует три положительных", async ({ page }) => {
    const modal = await openCorniceScreen(page);
    const niche = modal.getByRole("button", { name: /Скрытая ниша/ });
    const builtIn = modal.getByRole("button", { name: /Встроенный карниз/ });
    const surface = modal.getByRole("button", { name: /Накладной карниз/ });

    if (IMAGES_ON) {
      await expect(niche.locator("img")).toHaveAttribute("alt", "Скрытая ниша: карниз утоплен за натяжным полотном");
      await expect(niche.locator("img")).toHaveAttribute("src", /quiz-cornice-hidden-niche-480\.webp/);
      await expect(builtIn.locator("img")).toHaveAttribute("src", "/quiz-cornice-builtin.svg");
      await expect(surface.locator("img")).toHaveAttribute("src", "/quiz-cornice-surface.svg");
      await expect(builtIn.locator("img")).toHaveAttribute("alt", "");
      await expect(surface.locator("img")).toHaveAttribute("alt", "");
    } else {
      for (const option of [niche, builtIn, surface]) {
        await expect(option.locator("img")).toHaveCount(0);
        await expect(option).toContainText("₽");
      }
    }
    await expect(modal.getByRole("button", { name: /Без карниза/ }).locator("img")).toHaveCount(0);
  });

  test("подпись «схематичный разрез» видна у вариантов со схемой и не висит у фото", async ({ page }) => {
    const modal = await openCorniceScreen(page);

    // По умолчанию выбран none — подписи нет.
    await expect(modal.getByText(/Разрез схематичный/)).toHaveCount(0);

    await modal.getByRole("button", { name: /Накладной карниз/ }).click();
    if (IMAGES_ON) await expect(modal.getByText(/Разрез схематичный/)).toBeVisible();
    else await expect(modal.getByText(/Разрез схематичный/)).toHaveCount(0);

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

    const nicheThumb = modal.getByRole("button", { name: /Скрытая ниша/ }).locator("img");
    if (IMAGES_ON) {
      // Ждём миниатюру, не networkidle: галерея главной грузится независимо.
      await expect(nicheThumb).toHaveAttribute("src", /quiz-cornice-hidden-niche-480/);
      await expect(nicheThumb).toHaveJSProperty("complete", true);
    } else {
      await expect(nicheThumb).toHaveCount(0);
      expect(requested.filter((url) => /quiz-cornice/.test(url))).toHaveLength(0);
    }

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

test.describe("PT-042/048 · Световые линии вне первой волны", () => {
  test("даже on-пилот сохраняет текст и цену без фото на этом экране", async ({ page }) => {
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
    await expect(add.locator("img")).toHaveCount(0);
    await expect(add).toContainText("₽");
    await add.click();
    await expect(add).toHaveAttribute("aria-pressed", "true");

    const none = modal.getByRole("button", { name: /Без световых линий/ });
    await expect(none.locator("img")).toHaveCount(0);
  });
});

async function openTrackScreen(page: import("@playwright/test").Page) {
  const modal = await enableRoomFeatures(page, { track: true });
  for (let i = 0; i < 10; i += 1) {
    if (await modal.getByRole("heading", { name: "Трековое освещение", exact: true }).count()) return modal;
    const confirm = modal.locator("button:visible").filter({ hasText: /^Подтвердить/ }).first();
    if (!(await confirm.count())) break;
    await confirm.click();
  }
  await expect(modal.getByRole("heading", { name: "Трековое освещение", exact: true })).toBeVisible();
  return modal;
}

test.describe("PT-041 · Треки: пилотные схемы только там, где они однозначны", () => {
  test("off текстом; on — оба монтажных типа в одном ракурсе", async ({ page }) => {
    const modal = await openTrackScreen(page);
    const builtIn = modal.getByRole("button", { name: /Встроенный трек/ });
    const surface = modal.getByRole("button", { name: /Накладной трек/ });
    if (IMAGES_ON) {
      await expect(builtIn.locator("img")).toHaveAttribute("src", "/quiz-track-builtin.svg");
      await expect(surface.locator("img")).toHaveAttribute("src", "/quiz-track-surface.svg");
    } else {
      await expect(builtIn.locator("img")).toHaveCount(0);
      await expect(surface.locator("img")).toHaveCount(0);
    }
    // Обобщённые фотографии не подменяют монтажный подтип.
    await expect(modal.locator("img[src*='svc-track']")).toHaveCount(0);
    await expect(modal.getByRole("button", { name: /Без трека/ }).locator("img")).toHaveCount(0);
  });

  test("недоступный SVG не лишает кнопку текста, цены и активного состояния", async ({ page }) => {
    await page.route("**/quiz-track-surface.svg", (route) =>
      route.fulfill({ status: 404, contentType: "text/plain", body: "not found" })
    );
    const modal = await openTrackScreen(page);
    const surface = modal.getByRole("button", { name: /Накладной трек/ });
    await surface.scrollIntoViewIfNeeded();
    await expect(surface.locator("img")).toHaveCount(0);
    await surface.click();
    await expect(surface).toHaveAttribute("aria-pressed", "true");
    await expect(surface).toContainText("₽");
    await expect(surface).toContainText("Накладной трек");
  });
});
