#!/usr/bin/env node
/** Design-only HTML/PDF preflight. Not a site route or lead export feature. */
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const dir=path.join(root,'design/client/v8');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:1300}});
 const external=[];page.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url())});
 await page.goto('file://'+path.join(dir,'POTOLKOVO-CLIENT-MATERIALS.html'));
 await page.evaluate(()=>document.fonts.ready);
 if(await page.locator('.page').count()!==10)throw new Error('Expected 10 pages');
 for(const width of [320,390,1440]){
  await page.setViewportSize({width,height:1300});
  if(!await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))throw new Error('Overflow at '+width);
 }
 await page.emulateMedia({media:'print'});
 const layout=await page.locator('.page').evaluateAll(pages=>pages.map((p,i)=>{
  const foot=p.querySelector('footer');const last=foot.previousElementSibling;
  return {page:i+1,height:p.getBoundingClientRect().height,lastBottom:last.getBoundingClientRect().bottom,footerTop:foot.getBoundingClientRect().top};
 }));
 const bad=layout.filter(x=>x.height>1124||x.lastBottom>x.footerTop-8);
 if(bad.length)throw new Error('Print layout overflow: '+JSON.stringify(bad));
 if(external.length)throw new Error('External requests detected');
 await page.pdf({path:path.join(dir,'POTOLKOVO-CLIENT-MATERIALS.pdf'),preferCSSPageSize:true,printBackground:true});
 if(process.env.CLIENT_CAPTURE_DIR){await fs.mkdir(process.env.CLIENT_CAPTURE_DIR,{recursive:true});for(const i of [0,1,6,8])await page.locator('.page').nth(i).screenshot({path:path.join(process.env.CLIENT_CAPTURE_DIR,`page-${i+1}.png`)});}
 await fs.writeFile(path.join(dir,'layout-check.json'),JSON.stringify({pages:10,widths:[320,390,1440],externalRequests:external.length,footerOverlap:false,layout},null,2)+'\n');
 console.log('Client materials: 10 A4 pages, no overflow at 320/390/1440, offline PDF exported.');
}finally{await browser.close()}
