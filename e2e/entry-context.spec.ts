import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import { servicePageContent } from "@/content/services";
import { DEFAULT_CALCULATOR_AREA } from "@/lib/catalog-ui-config";
import { DISABLED_PRESET_SLUGS } from "@/lib/calculator/presets";
import { projectEntryCtaLabel } from "@/lib/entry-context";
import { LeadPayloadSchema } from "@/lib/lead/schema";

import { MODAL, clearCalcDraftStorage, interceptLeadApi, submitLeadForm } from "./helpers";

/**
 * PT-008 · EntryContext на всех точках входа в квиз (ТЗ стр. 150, раздел 3.1).
 *
 * Приёмка задачи — матрица «9 услуг × точки входа» и кейс главной
 * `shadow-track-apartment`: 18 м² / 19 м теневого профиля / 10 м трека должны
 * одинаково доезжать и до интерфейса, и до записанной заявки.
 *
 * Матрица берёт площади из `content/services.ts`, а не хардкодом: если пресет
 * услуги изменят, тест продолжит проверять именно «пресет доехал целиком».
 */

const AREA_LABEL = "Площадь потолка, м²";
const PROJECT_CTA = projectEntryCtaLabel();

/** Страница продажи треков: вход в калькулятор там ведёт сразу в каталог света. */
const LIGHTING_SERVICE_SLUG = "prodazha-trekovogo-osveshcheniya";

/**
 * Доступные имена полей Шага 0: `RangeField` задаёт `aria-label` как
 * «<подпись>, <единицы>», поэтому в `getByLabel` нужна строка с единицами.
 */
const SHADOW_LENGTH_LABEL = "Длина теневого профиля, м.п.";
const TRACK_LENGTH_LABEL = "Длина трека, м.п.";
const LIGHT_LINES_LENGTH_LABEL = "Длина световых линий, м.п.";

const SERVICES = Object.values(servicePageContent).map((service) => ({
  slug: service.slug,
  path: service.pathname,
  area: String(service.price.calculatorPreset.areaDefault),
  disabled: DISABLED_PRESET_SLUGS.has(service.slug),
}));

/** 7 услуг, у которых типовой расчёт честен. */
const CALCULATED = SERVICES.filter((service) => !service.disabled);
/** 2 услуги из `DISABLED_PRESET_SLUGS` — только «Обсудить проект». */
const PROJECT_ONLY = SERVICES.filter((service) => service.disabled);

/**
 * Открыть точку входа и вернуть модалку с видимым полем площади.
 *
 * Черновик чистим до клика: он живёт в sessionStorage вкладки и переживает
 * `goto`, а второй вход подряд попал бы на экран «продолжить / начать новый».
 */
async function openEntry(page: Page, path: string, testId: string, { scroll = false } = {}) {
  await page.goto(path);
  await clearCalcDraftStorage(page);

  if (scroll) {
    // Мобильный стики появляется только когда hero ушёл из вида (scrollY > 300).
    await page.evaluate(() => window.scrollTo(0, 1400));
  }

  const entry = page.getByTestId(testId).locator("visible=true").first();
  await expect(entry).toBeVisible();
  await entry.scrollIntoViewIfNeeded();
  await entry.click();

  const modal = page.locator(MODAL);
  await modal.waitFor();
  await expect(modal.getByLabel(AREA_LABEL, { exact: true })).toBeVisible();

  return modal;
}

/** Площадь, с которой открылся расчёт из конкретной точки входа. */
async function areaFromEntry(page: Page, path: string, testId: string, scroll = false) {
  const modal = await openEntry(page, path, testId, { scroll });
  const value = await modal.getByLabel(AREA_LABEL, { exact: true }).inputValue();
  await clearCalcDraftStorage(page);
  return value;
}

/** Подписи видимых кнопок подтверждения — по ним понимаем, сменился ли экран. */
function confirmLabels(modal: Locator) {
  return modal.locator("button:visible").filter({ hasText: /^Подтвердить/ });
}

/**
 * Нажать «Подтвердить …» и дождаться смены экрана.
 *
 * Без ожидания Playwright кликает быстрее кадра и попадает по той же кнопке
 * на следующем рендере — вопрос проматывается (ловушка описана в
 * `tests/selectors.test.ts`, оттуда же N-050).
 */
async function confirmScreen(modal: Locator) {
  const buttons = confirmLabels(modal);
  const before = (await buttons.allInnerTexts()).join("|");
  await buttons.first().click();
  await expect.poll(() => confirmLabels(modal).allInnerTexts().then((t) => t.join("|")), {
    timeout: 10_000,
  }).not.toBe(before);
}

/**
 * Шагать по экранам Шага 0, пока не появится поле с нужной подписью.
 *
 * Порядок экранов зависит от сценария (`getEnabledParams`), поэтому идём
 * видимой кнопкой «Подтвердить …», а не жёсткой цепочкой.
 */
async function walkToField(modal: Locator, label: string, maxScreens = 12): Promise<Locator> {
  for (let screen = 0; screen < maxScreens; screen += 1) {
    const field = modal.getByLabel(label, { exact: true }).locator("visible=true").first();
    if (await field.count()) return field;

    if (!(await confirmLabels(modal).count())) break;
    await confirmScreen(modal);
  }

  throw new Error(`Поле «${label}» не появилось за ${maxScreens} экранов`);
}

/** Дойти до экрана «Проверка» (конец Шага 0). */
async function walkToReview(modal: Locator, maxScreens = 14) {
  for (let screen = 0; screen < maxScreens; screen += 1) {
    if (await modal.getByRole("heading", { name: "Проверка" }).count()) return;
    if (!(await confirmLabels(modal).count())) break;
    await confirmScreen(modal);
  }
  await expect(modal.getByRole("heading", { name: "Проверка" })).toBeVisible();
}

test.describe("PT-008 · матрица точек входа", () => {
  test.setTimeout(180_000);

  test("хедер на странице услуги открывает расчёт с пресетом этой услуги", async ({ page }) => {
    for (const service of CALCULATED) {
      const area = await areaFromEntry(page, service.path, "header-entry");
      expect(area, `${service.slug} · хедер`).toBe(service.area);
    }
  });

  test("hero-CTA страницы услуги открывает расчёт с пресетом этой услуги", async ({ page }) => {
    for (const service of CALCULATED) {
      /**
       * У страницы продажи треков hero другой: primary — якорь на каталог
       * комплектов, а вход в калькулятор открывает сразу Шаг 1 (подбор света),
       * поэтому площади там нет — проверяем, что открылся каталог.
       */
      if (service.slug === LIGHTING_SERVICE_SLUG) {
        await page.goto(service.path);
        await clearCalcDraftStorage(page);
        await page.getByTestId("hero-entry").locator("visible=true").first().click();

        const modal = page.locator(MODAL);
        await modal.waitFor();
        await expect(modal.getByRole("button", { name: "Каталог", exact: true })).toBeVisible();
        await clearCalcDraftStorage(page);
        continue;
      }

      const area = await areaFromEntry(page, service.path, "hero-entry");
      expect(area, `${service.slug} · hero`).toBe(service.area);
    }
  });

  test("mid-CTA страницы услуги открывает расчёт с пресетом этой услуги", async ({ page }) => {
    for (const service of CALCULATED) {
      const area = await areaFromEntry(page, service.path, "mid-cta");
      expect(area, `${service.slug} · mid`).toBe(service.area);
    }
  });

  test("мобильный стики открывает расчёт с пресетом этой услуги", async ({ page, viewport }) => {
    test.skip((viewport?.width ?? 0) >= 1024, "стики — только мобильная раскладка (lg:hidden)");

    for (const service of CALCULATED) {
      const area = await areaFromEntry(page, service.path, "sticky-entry", true);
      expect(area, `${service.slug} · стики`).toBe(service.area);
    }
  });

  test("на главной хедер и hero дают прайсовый старт, а не чужой пресет", async ({ page }) => {
    const expected = String(DEFAULT_CALCULATOR_AREA);

    expect(await areaFromEntry(page, "/", "header-entry")).toBe(expected);
    expect(await areaFromEntry(page, "/", "hero-entry")).toBe(expected);
  });

  test("пресет страницы доносит не только площадь: световые линии 4 м.п.", async ({ page }) => {
    const service = SERVICES.find((item) => item.slug === "svetovye-linii")!;
    const modal = await openEntry(page, service.path, "hero-entry");

    await expect(modal.getByLabel(AREA_LABEL, { exact: true })).toHaveValue(service.area);

    // До PT-008 `lightLinesEnabled` и `lightLinesLengthDefault` терялись:
    // расчёт открывался без линий, которые страница обещает показать.
    const lines = await walkToField(modal, LIGHT_LINES_LENGTH_LABEL);
    await expect(lines).toHaveValue("4");
  });
});

test.describe("PT-008 · услуги без честного типового расчёта", () => {
  test.setTimeout(180_000);

  test("в списке обе услуги из ТЗ", async () => {
    expect(PROJECT_ONLY.map((service) => service.slug)).toEqual([
      "individualnye-proekty",
      "svetoprozrachnye-potolki",
    ]);
  });

  test("хедер, hero, mid и «Хочу так же» ведут в форму, а не в калькулятор", async ({ page }) => {
    for (const service of PROJECT_ONLY) {
      await page.goto(service.path);
      await clearCalcDraftStorage(page);

      for (const testId of ["header-entry", "hero-entry", "mid-cta", "want-same"]) {
        const entry = page.getByTestId(testId).locator("visible=true").first();
        await expect(entry, `${service.slug} · ${testId}`).toBeVisible();
        expect(await entry.getAttribute("href"), `${service.slug} · ${testId}`).toBe("#action");
        await expect(entry, `${service.slug} · ${testId}`).toContainText(/Обсудить/);
      }

      // Калькулятор не открывается ни из одной точки: модалки нет в DOM.
      await page.getByTestId("header-entry").locator("visible=true").first().click();
      await expect(page.locator(MODAL)).toHaveCount(0);
      await expect(page.locator("#action")).toBeInViewport();
    }
  });

  test("мобильный стики ведёт в форму", async ({ page, viewport }) => {
    test.skip((viewport?.width ?? 0) >= 1024, "стики — только мобильная раскладка (lg:hidden)");

    for (const service of PROJECT_ONLY) {
      await page.goto(service.path);
      await clearCalcDraftStorage(page);
      await page.evaluate(() => window.scrollTo(0, 1400));

      const sticky = page.getByTestId("sticky-entry").locator("visible=true").first();
      await expect(sticky).toBeVisible();
      expect(await sticky.getAttribute("href")).toBe("#action");
      await expect(sticky).toContainText(/Обсудить/);
    }
  });

  test("блок цены зовёт обсудить проект и не обещает калькулятор", async ({ page }) => {
    for (const service of PROJECT_ONLY) {
      await page.goto(service.path);

      const block = page.getByTestId("project-entry-block");
      await expect(block, service.slug).toBeVisible();

      const cta = page.getByTestId("project-entry-cta");
      await expect(cta, service.slug).toHaveText(PROJECT_CTA);
      expect(await cta.getAttribute("href"), service.slug).toBe("#action");

      // T-021/PT-008: висящий копирайт «Калькулятор ниже…» и тизер расчёта.
      await expect(page.getByText(/Калькулятор ниже/), service.slug).toHaveCount(0);
      await expect(page.getByText("Итоговая стоимость за 2 минуты"), service.slug).toHaveCount(0);
    }
  });
});

test.describe("PT-008 · приёмка: кейс «18 м² / 19 м теневого / 10 м трека»", () => {
  test.setTimeout(180_000);

  test("пресет кейса доезжает до интерфейса и до заявки одинаково", async ({ page }) => {
    const leads = await interceptLeadApi(page);

    await page.goto("/");
    await clearCalcDraftStorage(page);

    const card = page
      .locator("article")
      .filter({ hasText: "Теневой профиль + трековое освещение COLIBRI" })
      .locator("visible=true")
      .first();
    await card.scrollIntoViewIfNeeded();
    await card.getByRole("button", { name: "Хочу похожее решение" }).click();

    const modal = page.locator(MODAL);
    await modal.waitFor();

    // (1) Площадь кейса — 18 м², а не дефолт прайса и не периметр.
    await expect(modal.getByLabel(AREA_LABEL, { exact: true })).toHaveValue("18");

    // (2) Метка помещения из `roomLabelDefault` — поле раньше терялось.
    await modal.getByRole("button", { name: /Назвать помещение/ }).click();
    await expect(modal.locator("#room-label-v2")).toHaveValue("Кухня-гостиная");

    // (3) Длина теневого профиля из кейса — 19 м, а не round(4·√18) = 17 м.
    await expect(await walkToField(modal, SHADOW_LENGTH_LABEL)).toHaveValue("19");

    // (4) Длина трека из кейса — 10 м, а не 17/4 = 4 м.
    await expect(await walkToField(modal, TRACK_LENGTH_LABEL)).toHaveValue("10");

    await walkToReview(modal);
    await modal.locator("button:visible").filter({ hasText: /К итогу/ }).first().click();
    await submitLeadForm(page, { scope: modal });

    expect(leads).toHaveLength(1);
    const rooms = (leads[0].snapshot as { rooms?: Array<Record<string, unknown>> } | undefined)
      ?.rooms;
    expect(rooms).toHaveLength(1);

    // (5) Заявка несёт те же числа, что видел человек.
    expect(rooms?.[0]).toMatchObject({
      label: "Кухня-гостиная",
      area: 18,
      shadowLength: 19,
      trackLength: 10,
      /**
       * PT-010 · серверный пересчёт читает нормализованные параметры, а не
       * лейблы: без `ceilingType`/`trackType` он не отличил бы теневой профиль
       * от накладного и пересчитал бы заявку приблизительно.
       */
      ceilingType: "shadow",
      shadowEnabled: true,
      trackType: "built-in",
    });

    /**
     * (6) PT-010 · живой payload проходит новую, более строгую схему заявки.
     *
     * Сам серверный пересчёт этого тела запроса проверяется в
     * `tests/lead-server-recalc.test.ts` по фикстуре
     * `tests/fixtures/lead-payload-browser-case.json` — это тот же payload,
     * перехваченный этим сценарием. Внутри процесса Playwright его не
     * пересчитать: `getCatalogIndex()` делает `import()` JSON, а ESM-загрузчик
     * Playwright требует для этого import-атрибут, которого у Next.js-кода нет.
     */
    const parsed = LeadPayloadSchema.safeParse(leads[0]);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.snapshot?.rooms[0].ceilingType).toBe("shadow");
  });
});
