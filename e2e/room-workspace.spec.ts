import { test, expect, type Page, type Locator } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { MODAL, CALC_DRAFT_KEY, openCalculatorFromHero, completeAreaScreen, addSecondRoom, interceptLeadApi, submitLeadForm } from "./helpers";

async function start(page: Page) {
  await openCalculatorFromHero(page); const m = page.locator(MODAL);
  await expect(m.locator('.pk-wizard-caption')).toHaveText('Потолок · вопрос 1 из 5');
  await m.getByRole('button', { name: /Назвать помещение/ }).click();
  await m.getByLabel('Название помещения', { exact: true }).fill('Кухня');
  await completeAreaScreen(page);
  return m;
}
async function draft(page: Page) { return page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!), CALC_DRAFT_KEY); }
async function editArea(m: Locator, name='Кухня') {
  await m.getByRole('button', { name: `Редактировать: ${name}`, exact: true }).click();
  await m.locator('[data-edit-param="area"]').click();
}
async function capture(page: Page, name: string) {
  if (process.env.ROOM_CAPTURE_DIR) await page.locator(MODAL).screenshot({ path: `${process.env.ROOM_CAPTURE_DIR}/${name}-${test.info().project.name}.jpg`, type: 'jpeg', quality: 85, animations: 'disabled', scale: 'css' });
}

test('Room UX: actual progress, active room and functional summary footer', async ({ page }) => {
  const m=await start(page);
  await expect(m.locator('.pk-wizard-caption')).toHaveText('Параметры потолка заполнены');
  await expect(m.locator('.calculator-modal-footer').getByRole('button',{name:/К итогу/})).toBeEnabled();
  await expect(m).not.toContainText('Выберите вариант выше');
  await addSecondRoom(page,{room:'+ Спальня',area:'22 м²'});
  await expect(m.locator('[data-room-id]')).toHaveCount(2);
  await m.getByRole('button',{name:'Редактировать: Спальня',exact:true}).click();
  await expect(m.getByTestId('room-context')).toContainText('Помещение 2 из 2');
  await expect(m.getByTestId('room-context')).toContainText('Спальня');
  await expect(m.getByTestId('room-context')).toContainText('Параметры заполнены');
  await m.getByLabel('Переключить помещение').selectOption('room-1');
  await expect(m.getByRole('heading',{name:'Карточка комнаты — Кухня',exact:true})).toBeVisible();
  const result=await new AxeBuilder({page}).include(MODAL).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
  await capture(page,'room-context');
});

test('Room UX: cancel and save are transactional, do not replay all questions or alter another room', async ({ page }) => {
  const m=await start(page);await addSecondRoom(page,{room:'+ Спальня',area:'22 м²'});
  const before=await draft(page);
  await editArea(m);await m.locator('#area-v2').fill('31');
  expect((await draft(page)).rooms).toEqual(before.rooms);
  await capture(page,'edit-draft');
  await m.getByRole('button',{name:'Отмена правки',exact:true}).click();
  await expect(m.getByRole('heading',{name:'Карточка комнаты — Кухня',exact:true})).toBeVisible();
  expect((await draft(page)).rooms).toEqual(before.rooms);
  await m.locator('[data-edit-param="area"]').click();await m.locator('#area-v2').fill('21');
  await m.getByRole('button',{name:'Сохранить изменения',exact:true}).click();
  await expect(m.getByRole('heading',{name:'Карточка комнаты — Кухня',exact:true})).toBeFocused();
  await expect.poll(async()=> (await draft(page)).rooms[0].area).toBe(21);
  expect((await draft(page)).rooms[1]).toEqual(before.rooms[1]);
  await m.locator('.calculator-modal-footer').getByRole('button',{name:"К помещениям",exact:true}).click();
  await expect(m.locator('.pk-wizard-caption')).toHaveText('Параметры потолка заполнены');
  await expect(m.getByRole('button',{name:/К итогу/})).toBeEnabled();
  await capture(page,'rooms-summary');
});

test('Room UX: deletion requires confirmation and restored room ids remain unique', async ({ page }) => {
  const m=await start(page);await addSecondRoom(page,{room:'+ Спальня',area:'22 м²'});
  const before=await draft(page);
  await m.getByRole('button',{name:'Редактировать: Кухня',exact:true}).click();
  await m.getByRole('button',{name:'Удалить текущее помещение',exact:true}).click();
  let dialog=page.getByRole('alertdialog');await expect(dialog).toContainText('Кухня');
  await capture(page,'delete-behind-dialog');
  await dialog.getByRole('button',{name:'Оставить помещение',exact:true}).click();
  expect((await draft(page)).rooms).toEqual(before.rooms);
  await m.getByRole('button',{name:'Удалить текущее помещение',exact:true}).click();
  dialog=page.getByRole('alertdialog');await dialog.getByRole('button',{name:'Удалить помещение',exact:true}).click();
  await expect(m.locator('[data-room-id]')).toHaveCount(1);
  await page.reload();await page.getByRole('button',{name:/Рассчитать стоимость/}).first().click();
  await m.getByRole('button',{name:'Продолжить расчёт',exact:true}).click();
  await addSecondRoom(page,{room:'+ Кухня',area:'12 м²'});
  const after=await draft(page);expect(after.rooms.map((r:{id:string})=>r.id)).toEqual(['room-2','room-3']);
  expect(after.rooms[0]).toEqual(before.rooms[1]);
});

test('Room UX: closing a pending edit asks explicitly and does not send unsaved data', async ({ page }) => {
  const leads=await interceptLeadApi(page);const m=await start(page);const before=await draft(page);
  await editArea(m);await m.locator('#area-v2').fill('31');
  await m.getByRole('button',{name:'Закрыть',exact:true}).first().click();
  let d=page.getByRole('alertdialog');await expect(d).toContainText('Закрыть без сохранения правки?');
  await d.getByRole('button',{name:'Продолжить редактирование',exact:true}).click();
  await expect(m.locator('#area-v2')).toHaveValue('31');
  await m.getByRole('button',{name:'Закрыть',exact:true}).first().click();
  d=page.getByRole('alertdialog');await d.getByRole('button',{name:'Отменить правку и закрыть',exact:true}).click();
  await expect(m).toHaveCount(0);expect(leads).toHaveLength(0);expect((await draft(page)).rooms).toEqual(before.rooms);
});

test('Room UX: only new dependent parameters are checked after changing the ceiling', async ({ page }) => {
  const m=await start(page);
  await m.getByRole('button',{name:'Редактировать: Кухня',exact:true}).click();await m.locator('[data-edit-param="ceiling"]').click();
  await m.getByRole('button',{name:/Показать теневой и парящий/}).click();await m.locator('[data-ceiling-option="shadow"]').click();
  await m.getByRole('button',{name:'Сохранить изменения',exact:true}).click();
  await m.locator('.calculator-modal-footer').getByRole('button',{name:"К помещениям",exact:true}).click();
  await m.getByRole('button',{name:/Продолжить заполнение/}).click();
  for(const title of ['Теневой профиль','Световые линии','Трековое освещение']) {
    await expect(m.getByRole('heading',{name:title,exact:true})).toBeVisible();
    await m.locator('.calculator-modal-footer button').filter({hasText:/^Подтвердить/}).click();
  }
  await expect(m.locator('.pk-wizard-caption')).toHaveText('Параметры потолка заполнены');
});

test('Room UX: a partial new draft resumes at the missing question, not at a fake completed result', async ({ page }) => {
  await openCalculatorFromHero(page);const m=page.locator(MODAL);
  await m.getByRole('button',{name:/Подтвердить площадь/}).click();await page.reload();
  await page.getByRole('button',{name:/Рассчитать стоимость/}).first().click();
  await m.getByRole('button',{name:'Продолжить расчёт',exact:true}).click();
  await expect(m.locator('.pk-wizard-caption')).toHaveText('Проверьте параметры помещений');
  await m.getByRole('button',{name:/Продолжить заполнение/}).click();
  await expect(m.getByRole('heading',{name:'Тип потолка',exact:true})).toBeVisible();
});

test('Room UX: deleting the last room keeps equipment and correctly switches to equipment-only', async ({ page }) => {
  const leads=await interceptLeadApi(page);
  await page.setViewportSize({width:390,height:844});await page.goto('/uslugi/prodazha-trekovogo-osveshcheniya#price');
  await page.locator('.pk-product').first().getByRole('button',{name:'Увеличить',exact:true}).click();
  await page.locator('[data-cart-bar]').last().getByRole('button',{name:'Оформить',exact:true}).click();
  await page.getByLabel('Как оформляем комплект?').getByRole('button',{name:/С потолком/}).click();
  const m=page.locator(MODAL);await m.locator('#area-v2').waitFor();
  for(let i=0;i<12;i++){
    if(await m.getByRole('heading',{name:'Проверка',exact:true}).count())break;
    await m.locator('.calculator-modal-footer button').filter({hasText:/^Подтвердить/}).click();
  }
  const stored=await draft(page);const first=stored.rooms[0].label;
  await m.locator('.calculator-modal-footer').getByRole('button',{name:/К итогу|Подобрать свет|Проверить освещение/}).click();
  await m.getByRole('button',{name:/Вернуться: Потолок/}).click();
  await m.getByRole('button',{name:`Редактировать: ${first}`,exact:true}).click();
  await m.getByRole('button',{name:'Удалить текущее помещение',exact:true}).click();
  const d=page.getByRole('alertdialog');await expect(d).toContainText('Без потолка применяется скидка на оборудование 10%');
  await d.getByRole('button',{name:'Удалить помещение',exact:true}).click();
  await expect(m.getByRole('heading',{name:'Добавьте первое помещение',exact:true})).toBeVisible();
  expect(await page.evaluate(key=>sessionStorage.getItem(key),CALC_DRAFT_KEY)).toBeNull();
  await m.getByRole('button',{name:'Продолжить только со светом',exact:true}).click();
  await expect(m.getByTestId('estimate-card')).not.toContainText('Потолок и работы');
  await submitLeadForm(page,{scope:m});await expect.poll(()=>leads.length).toBe(1);
  const snap=leads[0].snapshot as {rooms:unknown[];lighting:{items:Array<{qty:number}>};totals:{grand:number;lightingEffective:number;discountPct:number}};
  expect(snap.rooms).toHaveLength(0);expect(snap.lighting.items).toHaveLength(1);expect(snap.lighting.items[0].qty).toBe(1);
  expect(snap.totals.discountPct).toBe(10);expect(snap.totals.grand).toBe(snap.totals.lightingEffective);
});
