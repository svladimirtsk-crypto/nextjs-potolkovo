"use client";

import { ProductImageLightbox } from "@/components/feed2/ProductImageLightbox";
import { PHOTO_PENDING_LABEL, isPhotoPending } from "@/lib/catalog-photo";
import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";
import { getDiscountedPrice } from "@/lib/feed2-products";
import { toNumber, toText } from "@/lib/feed2-snapshot-normalize";
import { LIGHTING_ONLY_DISCOUNT_PERCENT } from "@/lib/lighting-formulas";
import { isSmartProduct, kindBadgeLabel, systemBadgeLabel } from "@/lib/lighting/product-predicates";

const fmt = (value: number) => new Intl.NumberFormat("ru-RU").format(Math.round(value));

/** Page catalogue only. Prices still use the shared lighting formulas. */
export function ProductCard({ product, qty, onDec, onInc }: {
  product: FeedCatalogProduct; qty: number; onDec: () => void; onInc: () => void;
}) {
  const regular = toNumber(product.priceRub);
  const priceKnown = Number.isFinite(regular) && regular > 0;
  const lightingOnly = getDiscountedPrice(regular, LIGHTING_ONLY_DISCOUNT_PERCENT);
  const name = toText(product.name);
  const id = toText(product.productId);
  const unit = product.unit === "m" ? "м" : "шт";
  const smart = isSmartProduct(product);
  const system = systemBadgeLabel(product);
  const kind = kindBadgeLabel(product);
  const attrs = (product.keyAttributes?.length ? product.keyAttributes : product.params)
    .map((attr) => ({ label: toText(attr.label), value: toText(attr.value) }))
    .filter((attr) => attr.label && attr.value);

  return <article className="pk-product" data-product-id={id} data-price={regular} data-unit={product.unit} data-selected={qty > 0} aria-labelledby={`product-title-${id}`}>
    <div className="pk-product-image"><ProductImageLightbox src={toText(product.coverImage)} alt={name} productId={id} kind={toText(product.kind)} /></div>
    <div className="pk-product-body">
      <div className="pk-product-badges">
        {system && <span>{system}</span>}{kind && <span>{kind}</span>}
        {smart && <span className="pk-smart-badge" title="Маркировка каталога, не подтверждение совместимости">SMART</span>}
        {isPhotoPending(product) && <span data-testid="photo-pending-badge">{PHOTO_PENDING_LABEL}</span>}
      </div>
      <h3 id={`product-title-${id}`}>{name}</h3>
      <p className="pk-product-sku">Артикул {toText(product.vendorCode) || "уточняется"}</p>
      {attrs.length > 0 && <p className="pk-product-attrs">{attrs.slice(0, 2).map(a => `${a.label}: ${a.value}`).join(" · ")}</p>}
      <details className="pk-product-details"><summary>Характеристики и подбор</summary>
        <dl>{attrs.map((attr, index) => <div key={`${attr.label}-${index}`}><dt>{attr.label}</dt><dd>{attr.value}</dd></div>)}</dl>
        {smart && <p>Функции SMART и работу с вашей системой управления нужно подтвердить для этой модели.</p>}
        <p>Наличие, срок и совместимость уточним перед счётом. Добавление в корзину не означает, что комплект уже проверен.</p>
      </details>
      <div className="pk-product-purchase">
        <div className="pk-product-price">{priceKnown ? <><strong>{fmt(lightingOnly)} ₽ <small>/ {unit}</small></strong>{lightingOnly < regular && <s>{fmt(regular)} ₽</s>}</> : <strong>Цена уточняется</strong>}</div>
        <div className="pk-product-quantity" role="group" aria-label={`Количество: ${name}`}>
          <button type="button" aria-label="Уменьшить" aria-describedby={`product-title-${id}`} disabled={qty <= 0} onClick={onDec}>−</button>
          <output aria-label={`В корзине: ${name}`}>{product.unit === "m" ? qty.toFixed(1) : qty} {unit}</output>
          <button type="button" aria-label="Увеличить" aria-describedby={`product-title-${id}`} disabled={!priceKnown} onClick={onInc}>+</button>
        </div>
        <p className="pk-product-selected">{qty > 0 ? "✓ В корзине" : priceKnown ? "Добавьте нужное количество" : "Обратитесь в ПОТОЛКОВО для уточнения"}</p>
      </div>
    </div>
  </article>;
}
