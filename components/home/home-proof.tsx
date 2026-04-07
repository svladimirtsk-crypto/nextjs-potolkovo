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
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <Heading
            eyebrow="Работы"
            title={proof.sectionTitle}
            description={proof.sectionIntro}
            tone="dark"
          />

          <div className="hidden space-y-2 lg:block lg:max-w-sm lg:text-right">
            <p className="text-sm font-medium text-white/80">6 реальных объектов</p>
            <p className="text-sm leading-6 text-white/60">
              Смотрите решения, сроки и ориентир по бюджету без тяжёлых галерей и
              модалок.
            </p>
          </div>
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

          <p className="mt-4 text-sm text-white/60 lg:hidden">
            Свайпайте, чтобы посмотреть больше работ.
          </p>
        </div>
      </Container>
    </Section>
  );
}
