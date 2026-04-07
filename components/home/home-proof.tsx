import { homepage } from "@/content/homepage";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Section } from "@/components/ui/section";

import { ProofCard } from "./proof-card";

const proof = homepage.proof;

export function HomeProof() {
  return (
    <Section id="proof" className="bg-slate-950 text-white">
      <Container>
        <Heading
          eyebrow="Работы"
          title={proof.sectionTitle}
          description={proof.sectionIntro}
          className="text-white"
        />

        <div className="mt-10 sm:mt-12">
          <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2 sm:gap-5 lg:gap-6">
            {proof.items.map((item) => (
              <ProofCard
                key={item.slug}
                item={item}
                defaultCtaLabel={proof.cardCtaLabel}
              />
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
}
