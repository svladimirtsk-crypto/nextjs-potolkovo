import { contacts } from "@/content/contacts";
import type { ServicePageContent } from "@/content/services";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

type ServiceTrustSectionProps = {
  service: ServicePageContent;
};

export function ServiceTrustSection({ service }: ServiceTrustSectionProps) {
  return (
    <section
      id="trust"
      aria-labelledby={`${service.slug}-trust-title`}
      className="bg-slate-50 py-16 sm:py-20"
    >
      <Container>
        <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr] lg:gap-10">
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Доверие
            </p>

            <h2
              id={`${service.slug}-trust-title`}
              className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl"
            >
              {service.trust.sectionTitle}
            </h2>

            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
              {service.trust.sectionIntro}
            </p>

            <div className="mt-8 grid gap-4">
              {service.trust.bullets.map((item) => (
                <article
                  key={`${service.slug}-${item.title}`}
                  className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <h3 className="text-lg font-semibold text-slate-950">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {item.description}
                  </p>
                </article>
              ))}
            </div>
          </div>

          <aside className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Почему со мной спокойно
            </p>

            <div className="mt-6 grid gap-4">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-500">Регион работы</p>
                <p className="mt-1 text-base font-semibold text-slate-950">
                  {contacts.regionLabel}
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-500">Телефон</p>
                <p className="mt-1 text-base font-semibold text-slate-950">
                  {contacts.phoneDisplay}
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-500">График</p>
                <p className="mt-1 text-base font-semibold text-slate-950">
                  {contacts.workingHoursLabel}
                </p>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3">
              <Button href="#action" className="justify-center">
                {service.hero.primaryCtaLabel}
              </Button>

              <Button
                href={contacts.telegramUrl}
                variant="secondary"
                className="justify-center"
              >
                {service.hero.secondaryTelegramCtaLabel}
              </Button>
            </div>
          </aside>
        </div>
      </Container>
    </section>
  );
}
