import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";

const scenarios = [
  {
    title: "Купить только освещение",
    badge: "−10%",
    description:
      "Подходит, если потолок уже готов или монтаж делает другой мастер. Соберите комплект и отправьте заявку на свет.",
    cta: "Выбрать свет −10%",
    href: "#price",
    tone: "emerald",
  },
  {
    title: "Освещение + потолок",
    badge: "−25%",
    description:
      "Максимальная выгода: подберём свет, заложим монтаж в потолок и пересчитаем освещение со скидкой 25%.",
    cta: "Рассчитать с потолком −25%",
    href: "#price",
    tone: "blue",
  },
] as const;

export function TrackSaleScenarioSection() {
  return (
    <Section className="bg-slate-50 py-10 sm:py-12">
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
            Два сценария покупки
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            Можно купить свет отдельно — или выгоднее вместе с потолком
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Выберите подходящий путь. Мы не навязываем потолок, но если он ещё нужен — скидка на освещение будет больше.
          </p>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {scenarios.map((item) => {
            const isBlue = item.tone === "blue";
            return (
              <article
                key={item.title}
                className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_10px_28px_rgba(15,23,42,0.04)] sm:p-8"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="text-xl font-semibold tracking-tight text-slate-950">
                      {item.title}
                    </h3>
                    <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
                      {item.description}
                    </p>
                  </div>
                  <span
                    className={[
                      "rounded-full px-4 py-2 text-sm font-bold",
                      isBlue ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700",
                    ].join(" ")}
                  >
                    {item.badge}
                  </span>
                </div>

                <div className="mt-6">
                  <Button href={item.href} variant={isBlue ? "secondary" : "primary"} className="w-full justify-center sm:w-auto">
                    {item.cta}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </Container>
    </Section>
  );
}
