import { homepage } from "@/content/homepage";
import { Container } from "@/components/ui/container";
import { CalculatorTeaser } from "@/components/calculator-modal/calculator-teaser";

const priceContent = homepage.price;

export function HomePrice() {
  return (
    <section
      id="price"
      aria-labelledby="price-title"
      className="scroll-mt-24 bg-white py-16 sm:py-20"
    >
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
            Цена
          </p>

          <h2
            id="price-title"
            className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl"
          >
            {priceContent.sectionTitle}
          </h2>

          <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">
            {priceContent.sectionIntro}
          </p>
        </div>

        <div className="mt-10 sm:mt-12">
          <CalculatorTeaser source="homepage" />
        </div>
      </Container>
    </section>
  );
}
