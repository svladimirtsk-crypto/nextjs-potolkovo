"use client";

import { useMemo, useState } from "react";

import { homepage } from "@/content/homepage";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Section } from "@/components/ui/section";

import { ProofCard } from "./proof-card";
import { ProofModalClient } from "./proof-modal-client";
import { ProofTrackClient } from "./proof-track-client";

const proof = homepage.proof;

export function HomeProof() {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const desktopPreviewItems = useMemo(() => proof.items.slice(0, 3), []);

  const openByIndex = (index: number) => {
    setSelectedIndex(index);
  };

  const openBySlug = (slug: string) => {
    const index = proof.items.findIndex((item) => item.slug === slug);
    if (index >= 0) {
      setSelectedIndex(index);
    }
  };

  const closeModal = () => {
    setSelectedIndex(null);
  };

  const showPrev = () => {
    setSelectedIndex((current) => {
      if (current === null) return current;
      return current === 0 ? proof.items.length - 1 : current - 1;
    });
  };

  const showNext = () => {
    setSelectedIndex((current) => {
      if (current === null) return current;
      return current === proof.items.length - 1 ? 0 : current + 1;
    });
  };

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

          <div className="hidden max-w-sm space-y-2 text-right lg:block">
            <p className="text-sm font-medium text-white/80">
              Короткий preview на странице
            </p>
            <p className="text-sm leading-6 text-white/60">
              Детали решения, сроки и ориентир по бюджету — в карточке кейса.
            </p>
          </div>
        </div>

        {/* Mobile: swipe */}
        <div className="mt-10 lg:hidden">
          <div className="-mx-4 sm:-mx-6">
            <div className="px-4 sm:px-6">
              <ProofTrackClient>
                {proof.items.map((item, index) => (
                  <ProofCard
                    key={item.slug}
                    item={item}
                    mode="mobile"
                    onOpen={() => openByIndex(index)}
                  />
                ))}
              </ProofTrackClient>
            </div>
          </div>

          <p className="mt-4 text-sm text-white/60">
            Свайпайте, чтобы посмотреть больше работ. Нажмите на карточку для деталей.
          </p>
        </div>

        {/* Desktop: compact grid */}
        <div className="mt-10 hidden lg:block">
          <div className="grid gap-5 xl:grid-cols-3">
            {desktopPreviewItems.map((item) => (
              <ProofCard
                key={item.slug}
                item={item}
                mode="desktop"
                onOpen={() => openBySlug(item.slug)}
              />
            ))}
          </div>

          <div className="mt-6 flex items-center justify-between rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
            <div>
              <p className="text-sm font-medium text-white/84">
                Показаны 3 работы из {proof.items.length}
              </p>
              <p className="mt-1 text-sm text-white/60">
                Остальные кейсы и подробности открою в отдельном окне без перегруза страницы.
              </p>
            </div>

            <Button variant="secondary" onClick={() => openByIndex(0)}>
              Посмотреть все работы
            </Button>
          </div>
        </div>
      </Container>

      <ProofModalClient
        items={proof.items}
        selectedIndex={selectedIndex}
        onClose={closeModal}
        onPrev={showPrev}
        onNext={showNext}
      />
    </Section>
  );
}
