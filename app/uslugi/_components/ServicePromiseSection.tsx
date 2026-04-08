import { contacts } from "@/content/contacts";
import type { ServicePageContent } from "@/content/services";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

type ServicePromiseSectionProps = {
  service: ServicePageContent;
};

export function ServicePromiseSection({ service }: ServicePromiseSectionProps) {
  return (
    <section
      id="promise"
      aria-labelledby={`${service.slug}-promise-title`}
      className="bg-white py-16 sm:py-20"
    >
      <Container>
        <div className="grid gap-8 lg:grid-cols-[1fr_0.88fr] lg:gap-10">
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Процесс
            </p>

            <h2
              id={`${service.slug}-promise-title`}
              className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl"
            >
              {service.promise.sectionTitle}
            </h2>

            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
              {service.promise.sectionIntro}
            </p>

            <div className="mt-8 grid gap-4">
              {service.promise.steps.map((step) => (
                <article
                  key={`${service.slug}-${step.stepLabel}`}
                  className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white">
                      {step.stepLabel}
                    </div>

                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold text-slate-950">
                        {step.title}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <aside className="rounded-[2rem] bg-slate-950 p-6 text-white sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/60">
              Что фиксируем заранее
            </p>

            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-semibold text-white">
                  Точная смета после замера
                </p>
                <p className="mt-2 text-sm leading-6 text-white/70">
                  Сразу понимаете объём работ, конфигурацию решения и итоговую стоимость.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-semibold text-white">
                  Понятный контакт без посредников
                </p>
                <p className="mt-2 text-sm leading-6 text-white/70">
                  Вы общаетесь напрямую со мной, а не с цепочкой менеджеров и подрядчиков.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-semibold text-white">
                  Удобная связь и выезд по Москве и МО
                </p>
                <p className="mt-2 text-sm leading-6 text-white/70">
                  {contacts.phoneDisplay} · {contacts.workingHoursLabel}
                </p>
              </div>
            </div>

            <p className="mt-6 text-sm leading-6 text-white/70">
              {service.promise.closingNote}
            </p>

            <div className="mt-8 flex flex-col gap-3">
              <Button href="#action" variant="secondary" className="justify-center">
                {service.hero.primaryCtaLabel}
              </Button>

              <Button href={contacts.phoneHref} className="justify-center">
                {service.hero.secondaryPhoneCtaLabel}
              </Button>
            </div>
          </aside>
        </div>
      </Container>
    </section>
  );
}
