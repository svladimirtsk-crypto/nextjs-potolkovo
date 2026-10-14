#!/usr/bin/env node
/** Design-only exports. Run after python scripts/build-brand-kit.py. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { chromium } from '@playwright/test';
const root=path.resolve(import.meta.dirname,'..');
const dir=path.join(root,'design/brand/v8');
const manifest=JSON.parse(await fs.readFile(path.join(dir,'manifest.json'),'utf8'));
for(const item of [...manifest.files]){
 const file=path.join(dir,item.file);const png=item.file.replace('.svg','.png');
 await sharp(file,{density:300}).resize({width:item.layout==='symbol'?512:1600}).png().toFile(path.join(dir,png));
 const data=await fs.readFile(path.join(dir,png));const meta=await sharp(data).metadata();
 manifest.files.push({file:png,layout:item.layout,tone:item.tone,width:meta.width,height:meta.height,sha256:crypto.createHash('sha256').update(data).digest('hex')});
}
await fs.writeFile(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage();const external=[];
 page.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url())});
 await page.goto('file://'+path.join(dir,'POTOLKOVO-BRANDBOOK.html'));
 await page.evaluate(()=>document.fonts.ready);
 for(const width of [320,390,1440]){
  await page.setViewportSize({width,height:1000});
  const good=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
  if(!good)throw new Error('Brandbook overflow at '+width);
 }
 await page.emulateMedia({media:'print'});
 const collisions=await page.locator('.page').evaluateAll(pages=>pages.flatMap((p,i)=>{
  const footer=p.querySelector('footer');const last=footer.previousElementSibling;
  return last.getBoundingClientRect().bottom>footer.getBoundingClientRect().top-8?[i+1]:[];
 }));
 if(collisions.length)throw new Error('Brandbook content overlaps footer on pages '+collisions);
 if(external.length)throw new Error('Offline brandbook made external requests');
 await page.pdf({path:path.join(dir,'POTOLKOVO-BRANDBOOK.pdf'),preferCSSPageSize:true,printBackground:true});
 const capture=process.env.BRAND_CAPTURE_DIR;
 if(capture){await fs.mkdir(capture,{recursive:true});for(const i of [0,2,7])await page.locator('.page').nth(i).screenshot({path:path.join(capture,`brandbook-${i+1}.png`)});}
 console.log('24 logo exports; offline brandbook: 10 pages, no footer collisions, no overflow at 320/390/1440. PDF exported.');
}finally{await browser.close()}
