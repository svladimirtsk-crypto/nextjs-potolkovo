import type { ProofItem } from "@/content/proof-gallery";

const money = (value: number) => new Intl.NumberFormat("ru-RU").format(Math.round(value));

export function ProofBudget({ item }: { item: ProofItem }) {
  if (!item.priceLabel) return null;
  const budget = item.budgetBreakdown;
  return (
    <section className="pk-proof-budget" aria-label="Расчётный ориентир">
      <p className="pk-eyebrow">Ориентир по бюджету</p>
      <p className="pk-proof-budget-total">{item.priceLabel}</p>
      <p className="pk-proof-budget-note">Расчётный пример, не итоговая смета вашего заказа. Состав и стоимость уточняются для вашего помещения.</p>
      {item.budgetNote && <p className="pk-proof-budget-note">{item.budgetNote}</p>}
      {budget && <details className="pk-proof-budget-details">
        <summary>Состав расчётного ориентира <span aria-hidden="true">+</span></summary>
        <dl>
          <div><dt>Потолок и монтаж</dt><dd>{money(budget.ceilingWorksRub)} ₽</dd></div>
          <div><dt>Освещение без скидки</dt><dd><s>{money(budget.lightingRawRub)} ₽</s></dd></div>
          <div><dt>Освещение со скидкой −{budget.lightingDiscountPercent}%</dt><dd>{money(budget.lightingDiscountedRub)} ₽</dd></div>
          {budget.customCharges.map(charge => <div key={charge.label}><dt>{charge.label}</dt><dd>{money(charge.amountRub)} ₽</dd></div>)}
          <div className="pk-proof-budget-sum"><dt>Итого по расчёту</dt><dd>{money(budget.totalRub)} ₽</dd></div>
        </dl>
      </details>}
    </section>
  );
}
