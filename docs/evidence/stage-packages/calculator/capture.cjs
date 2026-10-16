const { chromium } = require('/home/user/repo/node_modules/playwright');
const AxeBuilder = require('/home/user/repo/node_modules/@axe-core/playwright').default;
const fs = require('fs');
(async () => {
 const b = await chromium.launch();
 const out = '/home/user/implementation/calculator/evidence';
 const results = [];
 for (const width of [390, 1440]) {
  const ctx = await b.newContext({viewport:{width,height:900}});
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:3100');
  await p.getByTestId('hero-entry').click();
  const m = p.locator('[data-testid="calculator-modal"][data-open="true"]');
  await m.locator('#area-v2').waitFor();
  async function capture(state) {
   await p.screenshot({path:`${out}/${state}-${width}.png`});
   const a = await new AxeBuilder({page:p}).include('[data-testid="calculator-modal"][data-open="true"]').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
   results.push({state,width,violations:a.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,failure:n.failureSummary}))})),height:await m.locator('.calculator-modal-content').evaluate(e=>e.clientHeight),overflow:await m.evaluate(e=>e.scrollWidth-e.clientWidth)});
   fs.writeFileSync(`${out}/quick-axe.json`,JSON.stringify(results,null,2));
   console.log(state,width,a.violations.map(v=>v.id));
  }
  await capture('area');
  await m.getByRole('button',{name:/Одну комнату/}).click();
  await m.getByRole('button',{name:'18 м²',exact:true}).click();
  await m.getByRole('button',{name:/Подтвердить площадь/}).click();
  await m.getByRole('button',{name:/Показать теневой/}).click();
  await m.getByRole('button',{name:/Теневой потолок/}).click();
  await capture('ceiling');
  for(let i=0;i<12;i++) {
   if(await m.getByRole('heading',{name:'Проверка',exact:true}).count()) break;
   const c = m.locator('button:visible').filter({hasText:/^Подтвердить/}).first();
   if(!await c.count())break;
   await c.click();
  }
  await capture('review');
  await m.getByRole('button',{name:/К итогу/}).first().click();
  await m.getByTestId('estimate-card').waitFor();
  await capture('estimate');
  await m.getByRole('button',{name:'Изменить свет',exact:true}).click();
  await m.getByRole('button',{name:'Каталог',exact:true}).waitFor();
  await capture('lighting');
  await ctx.close();
 }
 await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
