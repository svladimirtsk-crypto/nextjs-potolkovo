import { homepage } from "@/content/homepage";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Section } from "@/components/ui/section";

import { ProofCard } from "./proof-card";
import { ProofTrackClient } from "./proof-track-client";

const proof = homepage.proof;

export function HomeProof() {
  return (
    <Section id="proof" className="bg-slate-950 text-white">
      <Container>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <Heading
            eyebrow="Работы"
            title={proof.sectionTitle}
            description={proof.sectionIntro}
            tone="dark"
          />

          <p className="text-sm text-white/60 lg:max-w-xs lg:text-right">
            На телефоне — свайпайте, на компьютере — используйте стрелки →
          </p>
        </div>

        <div className="mt-10 sm:mt-12">
          <div className="-mx-4 sm:-mx-6 lg:-mx-8">
            <div className="px-4 sm:px-6 lg:px-8">
              <ProofTrackClient>
                {proof.items.map((item) => (
                  <ProofCard
                    key={item.slug}
                    item={item}
                    defaultCtaLabel={proof.cardCtaLabel}
                  />
                ))}
              </ProofTrackClient>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
