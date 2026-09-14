import { showChoiceDialog } from "@/components/ui/confirm-dialog";
import {
  resolveCheckoutIntentAction,
  type CheckoutIntentAction,
  type CheckoutIntentChoice,
} from "@/lib/lighting/catalog-checkout";

/**
 * T-045 · Экран интента перед оформлением комплекта.
 *
 * Режим скидки определяет весь дальнейший путь: «только оборудование» ведёт
 * сразу к заявке (Шаг 2), «с потолком» — в расчёт потолка (Шаг 0). Спрашиваем
 * это один раз явным вопросом, а не двумя кнопками в липком баре.
 *
 * PT-011 · Это диалог выбора, а не «да/нет». Раньше он возвращал `boolean`, и
 * закрытие (Escape, клик по подложке, крестик) давало тот же `false`, что и
 * кнопка «Только оборудование −10 %» — человек уходил из диалога, а попадал в
 * форму заявки. Теперь исходов три: `dismissed` не меняет корзину и не открывает
 * калькулятор, а фокус возвращается на кнопку «Оформить».
 *
 * Вынесено из `CatalogSectionClient.tsx` ещё и поэтому: компонент и так на
 * грани лимита в 600 строк (PT-018), а логика выбора пути — самостоятельная.
 */
export async function askCheckoutIntent(): Promise<CheckoutIntentAction> {
  const outcome = await showChoiceDialog<CheckoutIntentChoice>({
    title: "Как оформляем комплект?",
    message:
      "Только оборудование — скидка 10 %, пришлю счёт после проверки наличия. " +
      "С натяжным потолком — скидка на свет 25 %, сначала посчитаем потолок.",
    primary: { id: "with-ceiling", label: "С потолком −25 %" },
    secondary: { id: "lighting-only", label: "Только оборудование −10 %" },
    variant: "info",
  });

  return resolveCheckoutIntentAction(outcome);
}
