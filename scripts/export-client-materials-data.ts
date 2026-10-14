/** Design-tool snapshot only; uses existing contacts and assets, no inferred case facts. */
import { contacts } from '../content/contacts';
import { homeAssets } from '../content/home-assets';
import { homepage } from '../content/homepage';
import { writeFileSync } from 'node:fs';
const data={
  contacts:{brandName:contacts.brandName,phoneDisplay:contacts.phoneDisplay,phoneHref:contacts.phoneHref,telegramUrl:contacts.telegramUrl,whatsappUrl:contacts.whatsappUrl,emailDisplay:contacts.emailDisplay},
  projects:homepage.proof.items.map(p=>{const a=homeAssets.find(a=>a.assetKey===p.imageAssetKey);if(!a||!('gallery' in a))throw new Error('Missing gallery '+p.slug);return {slug:p.slug,title:p.title,assetKey:p.imageAssetKey,existingDescription:p.summary,photos:[...a.gallery],publicationStatus:'Не подтверждено — не публиковать новый кейс'};})
};
writeFileSync(new URL('../design/client/v8/source-data.json', import.meta.url),JSON.stringify(data,null,2)+'\n');
console.log(data.projects.length+' project candidates, '+data.projects.flatMap(p=>p.photos).length+' photos; contacts sourced from code');
