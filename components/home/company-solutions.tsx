import Link from "next/link";
import { BrandPicture } from "@/components/brand/brand-picture";
import { company } from "@/content/company";
import { serviceLinks } from "@/content/service-links";

/** High-margin ceiling solutions remain explicit, above the price/calculator section. */
export function CompanySolutions() {
  return (
    <section id="solutions" className="pk-section pk-wrap" aria-labelledby="solutions-title">
      <div className="pk-section-head">
        <div><p className="pk-eyebrow">Решения для вашего пространства</p><h2 id="solutions-title">Потолок — часть интерьера.<br />Выберите решение.</h2></div>
        <p>Теневые и парящие потолки, световые линии, карнизы. Не просто полотно — продуманное решение для комнаты.</p>
      </div>
      <div className="pk-solutions-grid">
        {company.solutions.map(item => <article className="pk-solution" key={item.slug}>
          <BrandPicture id={item.image} sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 25vw" />
          <div className="pk-solution-copy"><h3><Link href={`/uslugi/${item.slug}`}>{item.title}</Link></h3><p>{item.description}</p>
            <Link href={`/uslugi/${item.slug}`} className="pk-text-link" aria-label={`Подробнее: ${item.title}`}>Выбрать решение <span aria-hidden="true">↗</span></Link>
          </div>
        </article>)}
      </div>
      <nav className="pk-all-services" aria-label="Все направления ПОТОЛКОВО">
        <span>Все направления</span>{serviceLinks.map(item => <Link href={item.href} key={item.slug}>{item.label}<span aria-hidden="true"> ↗</span></Link>)}
      </nav>
    </section>
  );
}

export function CompanyLighting() {
  return (
    <section className="pk-section pk-wrap" aria-labelledby="lighting-title">
      <div className="pk-lighting-panel">
        <div><p className="pk-eyebrow">Освещение и управление</p><h2 id="lighting-title">Одна комната.<br />Разные сценарии.</h2><p>{company.lighting.description}</p>
          <Link href="/uslugi/prodazha-trekovogo-osveshcheniya" className="pk-link-button">Открыть каталог света <span aria-hidden="true">↗</span></Link>
          <Link href="/uslugi/trekovoe-osveshchenie" className="pk-lighting-secondary">Свет с монтажом <span aria-hidden="true">↗</span></Link>
          <small>{company.lighting.note}</small>
        </div>
        <BrandPicture id="floating-bedroom" sizes="(max-width: 700px) 100vw, 50vw" />
      </div>
    </section>
  );
}
