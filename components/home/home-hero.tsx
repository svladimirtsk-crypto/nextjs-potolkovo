import Link from "next/link";
import { BrandPicture } from "@/components/brand/brand-picture";
import { company } from "@/content/company";
import { homepage } from "@/content/homepage";
import { HeroCta } from "./hero-cta";

/** R7-006: the existing calculator entry is preserved; the company/product leads. */
export function HomeHero() {
  return (
    <section id="hero" className="pk-hero pk-wrap" aria-labelledby="company-hero-title">
      <div className="pk-hero-grid">
        <div className="pk-hero-copy">
          <p className="pk-eyebrow">{company.eyebrow}</p>
          <h1 id="company-hero-title">Потолок и свет,<br />продуманные<br /><em>вместе.</em></h1>
          <p className="pk-lead">{homepage.hero.subtitle}</p>
          <HeroCta label={homepage.hero.primaryCtaLabel} secondaryLabel={homepage.hero.secondaryCtaLabel} />
          <p className="pk-caption">Расчёт без телефона. Точная смета — после уточнения состава.</p>
          <div className="pk-hero-foot"><span aria-hidden="true">↗</span> ПОТОЛКОВО · ОТ ИДЕИ ДО ГОТОВОГО РЕШЕНИЯ</div>
        </div>
        <div className="pk-hero-visual">
          <BrandPicture id="architectural-living" priority sizes="(max-width: 700px) 100vw, (max-width: 1400px) 52vw, 700px" />
          <Link className="pk-image-overlay" href="/uslugi/tenevoy-profil">
            <span><b>Архитектура потолка. Атмосфера света.</b><small>Теневое примыкание · трек · спокойная геометрия</small></span>
            <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </div>
      <div className="pk-principles">
        {company.principles.map((item, index) => <div key={item.title}>
          <span className="pk-number">0{index + 1} /</span><div><h2>{item.title}</h2><p>{item.text}</p></div>
        </div>)}
      </div>
    </section>
  );
}
