import { contacts } from '/home/user/repo/content/contacts';
import { homeAssets } from '/home/user/repo/content/home-assets';
import { homepage } from '/home/user/repo/content/homepage';
import { writeFileSync } from 'node:fs';
const data={
  contacts:{brandName:contacts.brandName,phoneDisplay:contacts.phoneDisplay,phoneHref:contacts.phoneHref,telegramUrl:contacts.telegramUrl,whatsappUrl:contacts.whatsappUrl,emailDisplay:contacts.emailDisplay},
  projects:homepage.proof.items.map(p=>{const a=homeAssets.find(a=>a.assetKey===p.imageAssetKey);if(!a||!('gallery' in a))throw new Error('Missing gallery '+p.slug);return {slug:p.slug,title:p.title,assetKey:p.imageAssetKey,existingDescription:p.summary,photos:[...a.gallery],publicationStatus:'Не подтверждено — не публиковать новый кейс'};})
};
writeFileSync('/home/user/repo/design/client/v8/source-data.json',JSON.stringify(data,null,2)+'\n');
console.log(data.projects.length+' project candidates, '+data.projects.flatMap(p=>p.photos).length+' photos; contacts sourced from code');
