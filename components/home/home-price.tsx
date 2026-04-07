import { homepage } from "@/content/homepage";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Section } from "@/components/ui/section";

import { PriceCalculatorClient } from "./price-calculator-client";

const price = homepage.price;

export function HomePrice() {
  return (
    <Section id="price" className="bg-white">
      <Container>
        <Heading
          eyebrow="Цена"
          title={price.sectionTitle}
          description={price.sectionIntro}
        />

        <div className="mt-10 sm:mt-12">
          <PriceCalculatorClient />
        </div>

        <div className="mt-6 rounded-3xl bg-slate-50 p-6 sm:p-8">
          <p className="text-sm leading-6 text-slate-600">
            {price.noExtraChargeNote}
          </p>
        </div>
      </Container>
    </Section>
  );
}
