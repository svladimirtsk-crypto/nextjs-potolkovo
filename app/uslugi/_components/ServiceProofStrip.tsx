import Image from "next/image";
import type { ServicePageContent } from "@/content/services";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

type ServiceProofStripProps = {
  service: ServicePageContent;
};

export function ServiceProofStrip({ service }: ServiceProofStripProps) {
  return (
    <section
      id="proof"
      aria-labelledby={`${service.slug}-proof-title`}
      className="bg-slate-50 py-16 sm:py-20"
    >
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
            Примеры работ
          </p>

          <h2
            id={`${service.slug}-proof-title`}
            className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl"
          >
            {service.proof.sectionTitle}
          </h2>

          <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">
            {service.proof.sectionIntro}
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {service.proof.items.map((item) => (
            <article
              key={`${service.slug}-${item.title}`}
              className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm"
            >
              <div className="relative aspect-[4/3] bg-slate-100">
                <Image
                  src={item.src}
                  alt={item.alt}
                  fill
                  sizes="(min-width: 1024px) 30vw, 100vw"
                  className="object-cover"
                />
              </div>

              <div className="p-5 sm:p-6">
                <h3 className="text-xl font-semibold tracking-tight text-slate-950">
                  {item.title}
                </h3>

                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {item.summary}
                </p>

                <div className="mt-5 grid grid-cols-3 gap-3 border-t border-slate-200 pt-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Площадь
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {item.areaLabel}
                    </p>
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Срок
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {item.timelineLabel}
                    </p>
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Ориентир
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {item.priceLabel}
                    </p>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button href="#price">{service.hero.primaryCtaLabel}</Button>
          <Button href="#action" variant="secondary">
            Обсудить мой объект
          </Button>
        </div>
      </Container>
    </section>
  );
}
