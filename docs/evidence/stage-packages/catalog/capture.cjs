const {chromium} = require('/home/user/repo/node_modules/playwright');
const AxeBuilder = require('/home/user/repo/node_modules/@axe-core/playwright').default;
const fs = require('fs');
(async () => {
  const browser = await chromium.launch();
  const out = '/home/user/implementation/catalog/evidence';
  const checks = [];
  for (const width of [390, 1440]) {
    const ctx = await browser.newContext({viewport:{width,height:1000}, reducedMotion:'reduce'});
    const page = await ctx.newPage();
    await page.goto('http://127.0.0.1:3100/uslugi/prodazha-trekovogo-osveshcheniya#price');
    await page.locator('.pk-product').first().waitFor();
    await page.evaluate(()=>document.fonts.ready);
    async function top(selector) {
      await page.locator(selector).first().evaluate(el=>window.scrollTo({top:el.getBoundingClientRect().top+scrollY-105,behavior:'instant'}));
    }
    async function capture(name, scope) {
      await page.screenshot({path:`${out}/${name}-${width}.jpg`,quality:88});
      const result = await new AxeBuilder({page}).include(scope).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
      checks.push({name,width,violations:result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))});
      fs.writeFileSync(`${out}/quick-axe.json`,JSON.stringify(checks,null,2));
      console.log(name,width,result.violations.length);
    }
    await top('#price'); await capture('catalog','.pk-catalog');
    await top('.pk-catalog-results');
    await page.locator('.pk-product img').first().evaluate(img=>img.decode().catch(()=>{}));
    await capture('products','.pk-catalog');
    await page.locator('.pk-product').first().getByRole('button',{name:'Увеличить',exact:true}).click();
    await page.locator('[data-cart-bar]').getByRole('button',{name:'Посмотреть'}).click();
    const drawer = page.getByRole('dialog',{name:'Корзина света',exact:true});
    await drawer.waitFor(); await capture('cart','.pk-lighting-drawer');
    await drawer.getByRole('button',{name:'Оформить',exact:true}).click();
    await page.getByRole('alertdialog',{name:'Как оформляем комплект?'}).waitFor();
    await capture('intent','[role="alertdialog"]');
    await ctx.close();
  }
  await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});
