import type { ServicePageContent } from "@/content/services";
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
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
            Доверие
          </p>

          <h2
            id={`${service.slug}-trust-title`}
            className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl"
          >
            {service.trust.sectionTitle}
          </h2>

          <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">
            {service.trust.sectionIntro}
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
      </Container>
    </section>
  );
}
