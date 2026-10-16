import snapshot from '/home/user/repo/data/eks-feed2-snapshot.json';
import { normalizeFeedCatalogProducts } from '/home/user/repo/lib/feed2-snapshot-normalize';
import { applyVendorOverrides } from '/home/user/repo/lib/vendor-code-overrides';
import { isRetiredCatalogProduct } from '/home/user/repo/lib/catalog-retirement';
import { isPanelProduct, isPointFixture } from '/home/user/repo/lib/lighting/product-predicates';
import { nonLuminaireRole } from '/home/user/repo/lib/lighting/product-role';
import { sectionOfProduct } from '/home/user/repo/lib/lighting/catalog-filters';
import { getRequiredLampSocket } from '/home/user/repo/lib/feed2-products';
import { writeFileSync } from 'node:fs';
const rows=normalizeFeedCatalogProducts(snapshot.products).map(p=>{
 const after=applyVendorOverrides(p);const text=(p.name+' '+p.categoryPath).toLowerCase();
 return {offerId:p.offerId,vendorCode:p.vendorCode,name:p.name,beforeKind:p.kind,afterKind:after.kind,role:nonLuminaireRole(after),system:after.system,active:!isRetiredCatalogProduct(p),beforePoint:p.kind==='SPOT_FIXTURE'||/панел|panel|600x600|595x595/.test(text),afterPoint:isPointFixture(after),afterPanel:isPanelProduct(after),category:sectionOfProduct(after),requiredLamp:getRequiredLampSocket(after),priceRub:p.priceRub,unit:after.unit,review:nonLuminaireRole(after)?'role confirmed by owner; pairing/installation not certified':'supplier classification; physical form/optics/compatibility need data'};
});
writeFileSync('/home/user/audit/calculator-2026-10-15/evidence/fixture-audit.json',JSON.stringify(rows,null,2));
const roles=rows.filter(p=>p.role);console.log({raw:rows.length,active:rows.filter(p=>p.active).length,controlledRoles:roles.length,correctedFalsePoints:roles.filter(p=>p.beforePoint&&!p.afterPoint).length,activePanels:rows.filter(p=>p.active&&p.afterPanel).length});
