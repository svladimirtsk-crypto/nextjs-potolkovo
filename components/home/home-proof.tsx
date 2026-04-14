"use client";

import { useState, useCallback } from "react";

import { homepage } from "@/content/homepage";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Section } from "@/components/ui/section";
import { ProofCard } from "./proof-card";
import { ProofTrackClient } from "./proof-track-client";
import { ProofModalClient } from "./proof-modal-client";
import { ProofSliderDesktop } from "./proof-slider-desktop";

export function HomeProof() {
  const proof = homepage.proof;
  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  const openBySlug = useCallback((slug: string) => {
    setActiveSlug(slug);
  }, []);

  const closeModal = useCallback(() => {
    setActiveSlug(null);
  }, []);

  return (
    <Section id="proof" className="scroll-mt-24 bg-white py-16 sm:py-20 lg:py-24">
      <Container>
        <Heading
          eyebrow="Портфолио"
          title={proof.sectionTitle}
          description={proof.sectionIntro}
        />

        {/* Mobile: horizontal scroll track */}
        <div className="mt-10 lg:hidden">
          <ProofTrackClient>
            {proof.items.map((item) => (
              <ProofCard
                key={item.slug}
                item={item}
                mode="mobile"
                onOpen={() => openBySlug(item.slug)}
              />
            ))}
          </ProofTrackClient>
        </div>

        {/* Desktop: slider with arrows */}
        <div className="mt-10 hidden lg:block">
          <ProofSliderDesktop
            items={proof.items}
            onOpen={openBySlug}
            renderCard={(item, onOpen) => (
              <ProofCard
                item={item}
                mode="desktop"
                onOpen={() => onOpen(item.slug)}
              />
            )}
          />
        </div>
      </Container>

      <ProofModalClient
        items={proof.items}
        activeSlug={activeSlug}
        onClose={closeModal}
      />
    </Section>
  );
}
