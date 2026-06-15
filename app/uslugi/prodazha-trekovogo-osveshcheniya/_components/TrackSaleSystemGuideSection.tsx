import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Section } from "@/components/ui/section";

const systems = [
  {
    title: "COLIBRI 220V",
    badge: "Рекомендуется",
    description:
      "Встроенный трек 220V. Хороший вариант для большинства натяжных потолков: проще по питанию, много светильников и аксессуаров.",
  },
  {
    title: "CLARUS 48V",
    badge: "Нужен БП",
    description:
      "Низковольтная система 48V. Выглядит технологично, но требует блока питания и внимательного расчёта места под него.",
  },
  {
    title: "ART 220V",
    badge: "Накладной",
    description:
      "Накладной трек 220V. Подходит, если потолок уже готов или не нужно встраивать профиль в конструкцию потолка.",
  },
] as const;

export function TrackSaleSystemGuideSection() {
  return (
    <Section className="bg-white py-12 sm:py-16">
      <Container>
        <Heading
          eyebrow="Как выбрать систему"
          title="COLIBRI, CLARUS или ART — подскажу, что подойдёт"
          description="Если потолок ещё не установлен, систему лучше выбирать вместе с конструкцией потолка. Так проще заложить профиль, питание, блоки и монтаж без переделок."
          align="center"
        />

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {systems.map((system) => (
            <article
              key={system.title}
              className="rounded-[1.75rem] border border-slate-200 bg-slate-50/80 p-5 sm:p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-semibold tracking-tight text-slate-950">{system.title}</h3>
                <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
                  {system.badge}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{system.description}</p>
            </article>
          ))}
        </div>

        <div className="mt-6 rounded-[1.5rem] border border-blue-200 bg-blue-50 p-5 text-sm leading-6 text-blue-950">
          <p className="font-semibold">Главное правило</p>
          <p className="mt-1 text-blue-900/80">
            Если потолок ещё предстоит делать — выгоднее собрать свет и потолок вместе: освещение будет со скидкой 25%, а монтажные узлы сразу заложим правильно.
          </p>
        </div>
      </Container>
    </Section>
  );
}
