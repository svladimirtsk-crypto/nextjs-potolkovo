import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Section } from "@/components/ui/section";

const faqItems = [
  {
    q: "Как действует скидка 15%?",
    a: "Скидка предоставляется при одновременном заказе натяжных потолков и трекового освещения. Мы закупаем оборудование у поставщика и делаем вам скидку от цены каталога.",
  },
  {
    q: "Товары в наличии?",
    a: "Наличие зависит от складских остатков поставщика. Уточним актуальный статус и цену перед оформлением заявки.",
  },
  {
    q: "Как происходит оплата?",
    a: "Оплата после утверждения сметы и объёма работ. Предоплата за оборудование согласовывается индивидуально.",
  },
  {
    q: "Вы устанавливаете трековое освещение?",
    a: "Да, монтирую трековые системы при установке натяжного потолка. Интеграция профилей, в том числе под гарпун — моя специализация.",
  },
];

export function TrackSaleFaqSection() {
  return (
    <Section id="trust" className="scroll-mt-24 bg-slate-50">
      <Container>
        <Heading
          eyebrow="Вопросы"
          title="Частые вопросы"
          description="Кратко об условиях, оплате и том, как работает скидка."
        />

        <div className="mt-10 space-y-4 max-w-3xl mx-auto">
          {faqItems.map((item, idx) => (
            <div
              key={idx}
              className="rounded-[1.5rem] border border-slate-200 bg-white p-6"
            >
              <h3 className="text-base font-semibold text-slate-950 mb-2">
                {item.q}
              </h3>
              <p className="text-sm leading-6 text-slate-600">{item.a}</p>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}
