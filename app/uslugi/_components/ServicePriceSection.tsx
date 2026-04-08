import type { ServicePageContent } from "@/content/services";
import { PriceCalculatorClient } from "@/components/home/price-calculator-client";
import { Container } from "@/components/ui/container";

type ServicePriceSectionProps = {
  service: ServicePageContent;
};

export function ServicePriceSection({ service }: ServicePriceSectionProps) {
  return (
    <section
      id="price"
      aria-labelledby={`${service.slug}-price-title`}
      className="scroll-mt-24 bg-white py-16 sm:py-20"
    >
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
            Цена
          </p>

          <h2
            id={`${service.slug}-price-title`}
            className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl"
          >
            {service.price.sectionTitle}
          </h2>

          <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">
            {service.price.sectionIntro}
          </p>

          {service.price.calculatorPreset.introNote ? (
            <p className="mt-4 text-sm leading-6 text-slate-500">
              {service.price.calculatorPreset.introNote}
            </p>
          ) : null}

          <p className="mt-3 text-sm leading-6 text-slate-500">
            {service.price.note}
          </p>
        </div>

        <div className="mt-10">
          <PriceCalculatorClient
            key={service.slug}
            preset={service.price.calculatorPreset}
            compactSections
          />
        </div>
      </Container>
    </section>
  );
}
