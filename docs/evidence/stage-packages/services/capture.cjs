const {chromium}=require('/home/user/repo/node_modules/playwright');
const Axe=require('/home/user/repo/node_modules/@axe-core/playwright').default;
const fs=require('fs');
(async()=>{
 const browser=await chromium.launch();
 const results=[];
 const slugs=['','tenevoy-profil','paryashchie-potolki','svetovye-linii','skrytye-karnizy','prostye-potolki','svetoprozrachnye-potolki'];
 for(const width of [1440,390]){
  const ctx=await browser.newContext({viewport:{width,height:width===390?1200:1000},reducedMotion:'reduce'});
  const page=await ctx.newPage();
  for(const slug of slugs){
   await page.goto('http://127.0.0.1:3100/uslugi/'+slug);
   await page.evaluate(()=>document.fonts.ready);
   await page.locator('main img').first().evaluate(image=>image.decode().catch(()=>{}));
   await page.screenshot({path:`/home/user/implementation/services/evidence/${slug||'hub'}-${width}.jpg`,quality:86});
   const result=await new Axe({page}).include('main').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
   results.push({slug:slug||'hub',width,violations:result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))});
   fs.writeFileSync('/home/user/implementation/services/evidence/quick-axe.json',JSON.stringify(results,null,2));
   console.log(slug||'hub',width,result.violations.length);
  }
  await ctx.close();
 }
 await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});
