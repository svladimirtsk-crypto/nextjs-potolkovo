"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useCalculatorModal } from "@/components/calculator-modal/calculator-modal-context";
import { useCalculatorPageContext } from "@/components/calculator-modal/page-context";
import { homepage } from "@/content/homepage";
import { filterProofItems, proofFilters, type ProofFilter, type ProofItem } from "@/content/proof-gallery";
import { ProofGalleryCard } from "./proof-gallery-card";
import { ProofModalClient } from "./proof-modal-client";

export function HomeProof() {
  const { openCalculator } = useCalculatorModal();
  const page = useCalculatorPageContext();
  const [filter, setFilter] = useState<ProofFilter>("all");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const items = filterProofItems(filter);
  const closeModal = useCallback(() => setSelectedIndex(null), []);
  const showPrev = useCallback(() => setSelectedIndex(index => index === null ? null : (index - 1 + items.length) % items.length), [items.length]);
  const showNext = useCallback(() => setSelectedIndex(index => index === null ? null : (index + 1) % items.length), [items.length]);

  const wantSame = (item: ProofItem) => {
    if (!item.actionPreset) return;
    openCalculator(page.optionsFor("proof", {
      preset: item.actionPreset,
      presetOrigin: "explicit",
      source: `${item.slug}:proof-card`,
    }));
  };

  return (
    <section id="proof" className="pk-gallery" aria-labelledby="proof-heading">
      <div className="pk-wrap">
        <div className="pk-gallery-heading">
          <div><p className="pk-eyebrow">04 / В деталях</p><h2 id="proof-heading">Потолок и свет.<br /><em>В одном пространстве.</em></h2></div>
          <div className="pk-gallery-intro"><p>{homepage.proof.sectionIntro}</p><p>Выберите решение, рассмотрите детали и примерьте параметры к своему помещению.</p></div>
        </div>
        <div className="pk-gallery-toolbar">
          <div className="pk-gallery-filters" role="group" aria-label="Фильтр решений">
            {proofFilters.map(option => <button key={option.id} type="button" aria-pressed={filter === option.id} aria-controls="proof-grid" onClick={() => { setSelectedIndex(null); setFilter(option.id); }}>{option.label}</button>)}
          </div>
          <p className="pk-gallery-count" role="status" aria-live="polite" aria-atomic="true">Показано: {items.length} из {homepage.proof.items.length}</p>
        </div>
        <div id="proof-grid" className="pk-gallery-grid">
          {items.map((item, index) => <ProofGalleryCard key={item.slug} item={item} index={homepage.proof.items.findIndex(entry => entry.slug === item.slug)} featured={filter !== "all" || index < 2} onOpen={() => setSelectedIndex(index)} onWantSame={() => wantSame(item)} />)}
        </div>
        <div className="pk-gallery-footnote"><p>Суммы — расчётные ориентиры по составу решения, не итоговая смета вашего заказа. Площадь, метры профилей и комплект света уточняются отдельно.</p><Link href="/uslugi">Все потолочные решения <span aria-hidden="true">↗</span></Link></div>
      </div>
      <ProofModalClient items={items} selectedIndex={selectedIndex} onClose={closeModal} onPrev={showPrev} onNext={showNext} />
    </section>
  );
}
