// Архивный скрипт запускается из корня проекта; импорты не привязаны к машине автора аудита.
import snapshot from '../../../../data/eks-feed2-snapshot.json';
import { normalizeFeedCatalogProducts } from '../../../../lib/feed2-snapshot-normalize';
import { applyVendorOverrides } from '../../../../lib/vendor-code-overrides';
import { isRetiredCatalogProduct } from '../../../../lib/catalog-retirement';
import { isPanelProduct, isPointFixture } from '../../../../lib/lighting/product-predicates';
import { nonLuminaireRole } from '../../../../lib/lighting/product-role';
import { sectionOfProduct } from '../../../../lib/lighting/catalog-filters';
import { getRequiredLampSocket } from '../../../../lib/feed2-products';
import { writeFileSync } from 'node:fs';
const rows=normalizeFeedCatalogProducts(snapshot.products).map(p=>{
 const after=applyVendorOverrides(p);const text=(p.name+' '+p.categoryPath).toLowerCase();
 return {offerId:p.offerId,vendorCode:p.vendorCode,name:p.name,beforeKind:p.kind,afterKind:after.kind,role:nonLuminaireRole(after),system:after.system,active:!isRetiredCatalogProduct(p),beforePoint:p.kind==='SPOT_FIXTURE'||/панел|panel|600x600|595x595/.test(text),afterPoint:isPointFixture(after),afterPanel:isPanelProduct(after),category:sectionOfProduct(after),requiredLamp:getRequiredLampSocket(after),priceRub:p.priceRub,unit:after.unit,review:nonLuminaireRole(after)?'role confirmed by owner; pairing/installation not certified':'supplier classification; physical form/optics/compatibility need data'};
});
writeFileSync('docs/evidence/calculator-audit-2026-10-15/raw/evidence/fixture-audit.json',JSON.stringify(rows,null,2));
const roles=rows.filter(p=>p.role);console.log({raw:rows.length,active:rows.filter(p=>p.active).length,controlledRoles:roles.length,correctedFalsePoints:roles.filter(p=>p.beforePoint&&!p.afterPoint).length,activePanels:rows.filter(p=>p.active&&p.afterPanel).length});
