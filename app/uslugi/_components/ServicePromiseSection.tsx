import type { ServicePageContent } from "@/content/services";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

const PRIMARY_CTA_LABEL = "Записаться на бесплатный замер";

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
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
            Процесс
          </p>

          <h2
            id={`${service.slug}-promise-title`}
            className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl"
          >
            {service.promise.sectionTitle}
          </h2>

          <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">
            {service.promise.sectionIntro}
          </p>
        </div>

        <div className="mt-10 grid gap-4">
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

        <div className="mt-8 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 sm:p-6">
          <p className="text-sm leading-7 text-slate-600">
            {service.promise.closingNote}
          </p>

          <div className="mt-5">
            <Button href="#action">{PRIMARY_CTA_LABEL}</Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
