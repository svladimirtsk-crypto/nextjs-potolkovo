import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Section } from "@/components/ui/section";
import { contacts } from "@/content/contacts";

/**
 * T-045 · Условия продажи.
 *
 * Для дистанционной продажи оборудования это обязательная информация:
 * кто продавец, как платить, как получить, какая гарантия и как вернуть.
 */
const terms = [
  {
    title: "Продавец",
    body: `Оборудование поставляется со склада партнёра EKS Market. Заказ, счёт и сопровождение — через меня: ${contacts.phoneDisplay}, ${contacts.workingHoursLabel}.`,
  },
  {
    title: "Оплата",
    body: "Счёт выставляю после подтверждения наличия позиций. Оплата по счёту — картой или переводом. Монтаж оплачивается отдельно после приёмки работ.",
  },
  {
    title: "Доставка и самовывоз",
    body: "Самовывоз со склада в Москве или доставка по Москве и Московской области. Сроки зависят от наличия: позиции со склада — обычно 1–3 рабочих дня.",
  },
  {
    title: "Гарантия",
    body: "На оборудование действует гарантия производителя — по большинству позиций от 1 до 2 лет. Гарантийные случаи ведём через поставщика.",
  },
  {
    title: "Возврат",
    body: "Возврат по Закону о защите прав потребителей для дистанционной торговли: товар надлежащего качества — в течение 7 дней при сохранении товарного вида и упаковки. Брак меняем по гарантии.",
  },
] as const;

export function TrackSaleTermsSection() {
  return (
    <Section className="bg-slate-50 py-12 sm:py-16">
      <Container>
        <Heading
          eyebrow="Условия"
          title="Как оформляется покупка"
          description="Коротко о продавце, оплате, доставке, гарантии и возврате."
          align="center"
        />

        <dl className="mx-auto mt-8 grid max-w-4xl gap-4 sm:grid-cols-2">
          {terms.map((term) => (
            <div key={term.title} className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
              <dt className="text-sm font-semibold text-slate-950">{term.title}</dt>
              <dd className="mt-1.5 text-sm leading-6 text-slate-600">{term.body}</dd>
            </div>
          ))}
        </dl>
      </Container>
    </Section>
  );
}
