import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Section } from "@/components/ui/section";

/**
 * T-045 · Два разных процесса вместо одного усреднённого.
 *
 * Покупка оборудования и заказ с монтажом идут по-разному: в первом случае
 * замер не нужен и всё упирается в наличие и счёт, во втором — начинается
 * с замера. Раньше единая лестница «заявка → замер → монтаж» вводила в
 * заблуждение тех, кто хочет просто купить свет.
 */
const tracks = [
  {
    id: "buy",
    title: "Купить оборудование",
    note: "−10 % на свет",
    steps: [
      { title: "Заявка", description: "Соберите комплект в каталоге и оставьте контакты." },
      { title: "Проверка наличия и счёт", description: "Сверяю остатки у поставщика и выставляю счёт с актуальными ценами." },
      { title: "Оплата", description: "Оплачиваете счёт картой или переводом." },
      { title: "Самовывоз или доставка", description: "Забираете со склада в Москве или привожу по Москве и МО." },
    ],
  },
  {
    id: "install",
    title: "С установкой",
    note: "−25 % на свет",
    steps: [
      { title: "Замер", description: "Приезжаю, снимаю размеры и проверяю узлы под свет." },
      { title: "Смета", description: "Фиксирую состав работ и оборудования — цена не меняется задним числом." },
      { title: "Закупка и монтаж", description: "Заказываю комплект и ставлю потолок со светом за 1 день." },
      { title: "Приёмка", description: "Проверяете работу, оплачиваете по факту." },
    ],
  },
] as const;

export function TrackSaleOrderingSection() {
  return (
    <Section id="promise" className="scroll-mt-24 bg-white">
      <Container>
        <Heading
          eyebrow="Процесс"
          title="Как заказать"
          description="Два пути: купить только оборудование или сделать свет вместе с потолком."
        />

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {tracks.map((track) => (
            <article
              key={track.id}
              className="rounded-[1.75rem] border border-slate-200 bg-slate-50/80 p-5 sm:p-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-semibold tracking-tight text-slate-950">{track.title}</h3>
                <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
                  {track.note}
                </span>
              </div>

              <ol className="mt-4 space-y-4">
                {track.steps.map((step, index) => (
                  <li key={step.title} className="flex gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-slate-950 ring-1 ring-slate-200">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-950">{step.title}</p>
                      <p className="mt-0.5 text-sm leading-6 text-slate-600">{step.description}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Button href="#action" className="justify-center py-6 text-base">
            Записаться на замер
          </Button>
        </div>
      </Container>
    </Section>
  );
}
