import { chromium, expect } from '/home/user/repo/node_modules/@playwright/test/index.mjs';
import fs from 'node:fs/promises';
const O='/home/user/audit/catalog-led-2026-10-14';const base='http://127.0.0.1:3100';const route='/uslugi/prodazha-trekovogo-osveshcheniya';
const b=await chromium.launch({headless:true,args:['--no-sandbox','--disable-gpu']});const results={baseSha:'4239468b4aa574eb00b4d3b837cdd09620e1a4c7',route,viewports:[],journeys:[],noProductionLead:true};
const settle=p=>p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
try{
 for(const width of [390,1440]){
  const ctx=await b.newContext({viewport:{width,height:width===390?844:1000}});const p=await ctx.newPage();await p.route('**/api/lead',r=>r.abort());
  await p.goto(base+route);await p.locator('.pk-product').first().waitFor();await p.evaluate(()=>document.fonts.ready);
  const audit=await p.evaluate(()=>({h1:document.querySelector('h1')?.textContent,headings:[...document.querySelectorAll('h2')].map(e=>e.textContent),catalogTop:document.querySelector('.pk-catalog')?.getBoundingClientRect().top,searchTop:document.querySelector('.pk-search')?.getBoundingClientRect().top,bodyHeight:document.body.scrollHeight,headerLinks:[...document.querySelectorAll('header a')].map(a=>({text:a.textContent,href:a.getAttribute('href')})),duplicateIds:[...new Set([...document.querySelectorAll('[id]')].map(e=>e.id))].filter(id=>document.querySelectorAll('[id="'+CSS.escape(id)+'"]').length>1),categoryTabs:[...document.querySelectorAll('.pk-catalog-tabs button')].map(e=>e.textContent),selectedTab:document.querySelector('.pk-catalog-tabs [aria-selected="true"]')?.textContent,firstCard:document.querySelector('.pk-product')?.textContent,overflow:document.documentElement.scrollWidth>innerWidth}));
  results.viewports.push({width,...audit});await p.screenshot({type:'jpeg',quality:85,animations:'disabled',scale:'css',path:`${O}/screenshots/01-page-${width}.jpg`,fullPage:false});
  await p.locator('.pk-catalog').scrollIntoViewIfNeeded();await p.locator('.pk-catalog-nav').screenshot({type:'jpeg',quality:85,animations:'disabled',scale:'css',path:`${O}/screenshots/02-navigation-${width}.jpg`});
  const search=p.getByLabel('Поиск по каталогу');await search.fill('WB5');await settle(p);
  results.journeys.push({width,step:'WB5 from default track tab',cards:await p.locator('.pk-product').count(),matches:await p.locator('.pk-search-matches').innerText()});
  await p.locator('.pk-search-matches button').filter({hasText:'Подсветка карниза'}).click();const card=p.locator('.pk-product');await expect(card).toHaveCount(1);await card.getByRole('button',{name:'Увеличить',exact:true}).click();await settle(p);
  results.journeys.push({width,step:'WB5 added once',card:await card.innerText(),cart:await p.locator('[data-cart-bar]').last().innerText()});
  await card.screenshot({type:'jpeg',quality:85,animations:'disabled',scale:'css',path:`${O}/screenshots/03-wb5-half-meter-${width}.jpg`});
  await p.locator('.pk-smart-note button').click();await settle(p);
  results.journeys.push({width,step:'WB5 with SMART enabled',cards:await p.locator('.pk-product').count(),empty:await p.locator('.pk-catalog-empty').innerText()});
  await p.locator('.pk-catalog-toolbar').screenshot({type:'jpeg',quality:85,animations:'disabled',scale:'css',path:`${O}/screenshots/04-smart-empty-${width}.jpg`});
  await p.locator('.pk-smart-note button').click();await search.fill('');await settle(p);
  results.journeys.push({width,step:'Cornice category',visible:await p.locator('.pk-product').count(),results:await p.locator('.pk-catalog-results').innerText(),filters:await p.locator('.pk-catalog-toolbar').innerText()});
  const searches=[];
  for(const q of ['лента 24В','лента 24V','24V','CCT','УУ-00007668','0У-00006564','Wi-Fi','WIFI','TUYA']){
   await search.fill(q);await settle(p);searches.push({query:q,cards:await p.locator('.pk-product').count(),results:await p.locator('.pk-catalog-results').innerText()});
  }
  results.journeys.push({width,step:'Search diagnostics',searches});
  await ctx.close();
 }
 const ctx=await b.newContext({viewport:{width:390,height:844}});const p=await ctx.newPage();await p.route('**/api/lead',r=>r.abort());
 await p.goto(base+'/');await p.getByRole('button',{name:/Рассчитать стоимость/}).first().click();const modal=p.locator('[data-testid="calculator-modal"][data-open="true"]');
 for(const name of [/Одну комнату/,/^18 м²$/,/Подтвердить площадь/,/Подтвердить тип/,/Подтвердить карниз/,/Подтвердить люстры/,/Подтвердить свет/])await modal.getByRole('button',{name}).click();
 await modal.getByRole('button',{name:/К итогу/}).first().click();await modal.getByRole('button',{name:'Изменить свет',exact:true}).click();await modal.getByRole('button',{name:'Каталог',exact:true}).click();
 results.journeys.push({width:390,step:'Modal default catalog, no cornice answer',buttons:await modal.locator('.pk-lighting-stage button').allTextContents()});
 await modal.locator('.pk-lighting-stage').screenshot({type:'jpeg',quality:85,animations:'disabled',scale:'css',path:`${O}/screenshots/05-modal-hidden-led.jpg`});
 await modal.getByLabel('Поиск в текущем разделе').fill('WB5');await settle(p);
 results.journeys.push({width:390,step:'Modal WB5 query with LED category absent',text:await modal.locator('.pk-lighting-stage').innerText()});
 await modal.locator('.pk-lighting-stage').screenshot({type:'jpeg',quality:85,animations:'disabled',scale:'css',path:`${O}/screenshots/06-modal-wb5-missing.jpg`});
 await ctx.close();
 await fs.writeFile(`${O}/evidence/browser-audit.json`,JSON.stringify(results,null,2));
 console.log(JSON.stringify(results.viewports.map(({width,h1,catalogTop,searchTop,bodyHeight,duplicateIds,overflow})=>({width,h1,catalogTop,searchTop,bodyHeight,duplicateIds,overflow})),null,2));
 console.log(JSON.stringify(results.journeys.filter(j=>j.step==='WB5 added once'||j.step==='Search diagnostics'),null,2));
}finally{await b.close()}
