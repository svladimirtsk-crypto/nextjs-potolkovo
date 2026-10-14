"use client";

export function CatalogCartBar({ count, total, onView, onCheckout }: {
  count: number; total: number; onView: () => void; onCheckout: () => void;
}) {
  if (!count) return null;
  return <div data-cart-bar data-count={count} className="pk-catalog-cart-bar">
    <div aria-live="polite" aria-atomic="true"><p>Корзина <span>· {count} поз.</span></p><strong>{new Intl.NumberFormat("ru-RU").format(Math.round(total))} ₽</strong><small>только свет · предварительно</small></div>
    <div className="pk-cart-bar-actions"><button type="button" onClick={onView}>Посмотреть</button><button type="button" onClick={onCheckout}>Оформить <span aria-hidden="true">↗</span></button></div>
  </div>;
}
