import { homepage } from "@/content/homepage";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { CalculatorTeaser } from "@/components/calculator-modal/calculator-teaser";

export function HomePrice() {
  const priceContent = homepage.price;

  return (
    <section
      id="price"
      className="scroll-mt-24 bg-slate-50 py-16 sm:py-20 lg:py-24"
      aria-labelledby="price-title"
    >
      <Container>
        <Heading
          eyebrow="Стоимость"
          title={priceContent.sectionTitle}
          description={priceContent.sectionIntro}
        />

        <div className="mt-10">
          <CalculatorTeaser source="homepage" />
        </div>

        {priceContent.includedLine?.trim() ? (
          <p className="mt-6 text-center text-sm text-slate-500">
            {priceContent.includedLine}
          </p>
        ) : null}
      </Container>
    </section>
  );
}
