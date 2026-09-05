"use client";

import { useState } from "react";

import { useCalculatorModal } from "@/components/calculator-modal/calculator-modal-context";
import type { ServiceCalculatorPreset } from "@/content/services";

import { homepage } from "@/content/homepage";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Section } from "@/components/ui/section";

import { ProofCard } from "./proof-card";
import { ProofModalClient } from "./proof-modal-client";
import { ProofTrackClient } from "./proof-track-client";
import { ProofSliderDesktop } from "./proof-slider-desktop";

const proof = homepage.proof;

export function HomeProof() {
  const { openCalculator } = useCalculatorModal();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  /** T-040: «Хочу так же» открывает калькулятор с пресетом кейса. */
  const wantSame = (item: (typeof proof.items)[number]) => {
    // У части кейсов пресета нет — открываем калькулятор со стандартным потолком.
    const itemPreset = (item as { actionPreset?: ServiceCalculatorPreset }).actionPreset;
    const preset = (itemPreset ?? { ceilingType: "standard" }) as ServiceCalculatorPreset;
    openCalculator({ preset, forcePreset: true, source: `${item.slug}:proof-card` });
  };

  const openByIndex = (index: number) => setSelectedIndex(index);

  const openBySlug = (slug: string) => {
    const index = proof.items.findIndex((item) => item.slug === slug);
    if (index >= 0) setSelectedIndex(index);
  };

  const closeModal = () => setSelectedIndex(null);

  const showPrev = () =>
    setSelectedIndex((cur) => {
      if (cur === null) return cur;
      return cur === 0 ? proof.items.length - 1 : cur - 1;
    });

  const showNext = () =>
    setSelectedIndex((cur) => {
      if (cur === null) return cur;
      return cur === proof.items.length - 1 ? 0 : cur + 1;
    });

  return (
    <Section id="proof" className="bg-slate-950 text-white">
      <Container>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Heading
              eyebrow="Работы"
              title={proof.sectionTitle}
              description={proof.sectionIntro}
              tone="dark"
            />
            <p className="mt-4 text-sm text-white/60">
              Цены в карточках считаются по той же логике, что и в калькуляторе: потолок, узлы и освещение показываются прозрачно.
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
                    onWantSame={() => wantSame(item)}
                  />
                ))}
              </ProofTrackClient>
            </div>
          </div>
          <p className="mt-4 text-sm text-white/60">
            Свайпайте, чтобы посмотреть больше работ. Нажмите на карточку для деталей.
          </p>
        </div>

        {/* Desktop: scroll-snap slider, 3 cards visible */}
        <div className="mt-10 hidden lg:block">
          <ProofSliderDesktop items={proof.items} onOpen={openBySlug} onWantSame={wantSame} />
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
