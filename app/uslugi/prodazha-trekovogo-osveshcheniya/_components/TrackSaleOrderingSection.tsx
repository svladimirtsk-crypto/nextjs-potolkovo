import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Section } from "@/components/ui/section";

const steps = [
  {
    step: "01",
    title: "Заявка",
    description: "Оставьте заявку на замер или позвоните.",
  },
  {
    step: "02",
    title: "Замер и подбор",
    description: "Мастер приедет, поможет выбрать трековую систему и сделает расчёт.",
  },
  {
    step: "03",
    title: "Закупка и монтаж",
    description: "Закупаем оборудование со скидкой, устанавливаем потолок и треки за 1 день.",
  },
  {
    step: "04",
    title: "Приёмка",
    description: "Проверяете работу, оплачиваете и наслаждаетесь светом.",
  },
];

export function TrackSaleOrderingSection() {
  return (
    <Section id="promise" className="scroll-mt-24 bg-white">
      <Container>
        <Heading
          eyebrow="Процесс"
          title="Как заказать"
          description="Простой путь от заявки до готового результата."
        />

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {steps.map((item) => (
            <div key={item.step} className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-slate-100 text-slate-950 flex items-center justify-center text-lg font-bold">
                {item.step}
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-950 mb-1">
                  {item.title}
                </h3>
                <p className="text-sm leading-6 text-slate-600">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Button href="#action" className="justify-center py-6 text-base">
            Записаться на замер
          </Button>
        </div>
      </Container>
    </Section>
  );
}
