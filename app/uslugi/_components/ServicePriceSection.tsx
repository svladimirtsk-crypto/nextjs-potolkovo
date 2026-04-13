import type { ServicePageContent } from "@/content/services";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { CalculatorTeaser } from "@/components/calculator-modal/calculator-teaser";

type ServicePriceSectionProps = {
  service: ServicePageContent;
};

export function ServicePriceSection({ service }: ServicePriceSectionProps) {
  const priceContent = service.price;

  return (
    <section id="price" className="scroll-mt-24 bg-white py-16 sm:py-20">
      <Container>
        <Heading
          eyebrow="Стоимость"
          title={priceContent.sectionTitle}
          description={priceContent.sectionIntro}
        />

        {priceContent.calculatorPreset?.introNote?.trim() ? (
          <p className="mt-4 text-sm text-slate-500">
            {priceContent.calculatorPreset.introNote}
          </p>
        ) : null}

        <div className="mt-10">
          <CalculatorTeaser
            preset={priceContent.calculatorPreset}
            source={service.slug}
          />
        </div>

        {priceContent.note?.trim() ? (
          <p className="mt-6 text-sm text-slate-500">{priceContent.note}</p>
        ) : null}
      </Container>
    </section>
  );
}
