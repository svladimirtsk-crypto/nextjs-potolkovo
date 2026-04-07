import { homepage } from "@/content/homepage";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Section } from "@/components/ui/section";

import { PriceCalculatorClient } from "./price-calculator-client";

const price = homepage.price;

export function HomePrice() {
  return (
    <Section id="price" className="scroll-mt-24 className="bg-white">
      <Container>
        <Heading
          eyebrow="Цена"
          title={price.sectionTitle}
          description={price.sectionIntro}
        />

        <div className="mt-10 sm:mt-12">
          <PriceCalculatorClient />
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 sm:p-6">
            <p className="text-sm font-semibold text-slate-950">После замера — фиксированная смета</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {price.fixedPriceNote}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 sm:p-6">
            <p className="text-sm font-semibold text-slate-950">Без пересборки цены по ходу работ</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {price.noExtraChargeNote}
            </p>
          </div>
        </div>
      </Container>
    </Section>
  );
}
