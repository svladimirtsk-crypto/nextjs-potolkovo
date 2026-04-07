import { homepage } from "@/content/homepage";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Section } from "@/components/ui/section";

import { PriceScenarios } from "./price-scenarios";

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
          <PriceScenarios />
        </div>

        <div className="mt-8 rounded-3xl bg-slate-50 p-6 sm:p-8 lg:p-10">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-8">
            <div className="space-y-3">
              <p className="text-base leading-7 text-slate-700">
                {price.includedLine}
              </p>
              <p className="text-base font-medium leading-7 text-slate-950">
                {price.fixedPriceNote}
              </p>
              <p className="text-sm leading-6 text-slate-600">
                {price.noExtraChargeNote}
              </p>
            </div>

            <Button href="#action" className="w-full justify-center lg:w-auto">
              {price.primaryCtaLabel}
            </Button>
          </div>
        </div>
      </Container>
    </Section>
  );
}
