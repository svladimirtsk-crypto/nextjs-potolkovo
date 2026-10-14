import Link from "next/link";
import { Picture } from "@/components/ui/picture";
import { homeAssets } from "@/content/home-assets";
import { proofView, type ProofItem } from "@/content/proof-gallery";

type Props = { item: ProofItem; index: number; featured?: boolean; onOpen: () => void; onWantSame: () => void };

export function ProofGalleryCard({ item, index, featured, onOpen, onWantSame }: Props) {
  const asset = homeAssets.find(entry => entry.assetKey === item.imageAssetKey);
  const view = proofView(item.slug);
  if (!asset) return null;
  return (
    <article className={`pk-gallery-card${featured ? " pk-gallery-card-featured" : ""}`} data-proof-slug={item.slug}>
      <button type="button" className="pk-gallery-image" onClick={onOpen} aria-label={`Открыть кейс: ${item.title}`}>
        <Picture src={asset.src} alt={item.alt} fill sizes={featured ? "(max-width: 760px) 100vw, 50vw" : "(max-width: 760px) 100vw, (max-width: 1100px) 50vw, 25vw"} imgClassName="object-cover" />
        <span className="pk-gallery-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
        <span className="pk-gallery-expand" aria-hidden="true">Смотреть <span>↗</span></span>
      </button>
      <div className="pk-gallery-card-body">
        <p className="pk-gallery-category">{item.serviceType}</p>
        <h3><button type="button" onClick={onOpen}>{view.shortTitle}</button></h3>
        <p className="pk-gallery-meta">{item.roomType}{item.areaLabel && <><span aria-hidden="true"> · </span>{item.areaLabel}</>}</p>
        <div className="pk-gallery-price"><span>Расчётный ориентир</span><strong>{item.priceLabel ?? "По составу проекта"}</strong></div>
        <div className="pk-gallery-card-actions">
          {item.actionPreset ? <button type="button" aria-label="Хочу похожее решение" onClick={onWantSame}>Хочу похожее <span aria-hidden="true">↗</span></button> : <Link href={`${view.servicePath}#action`}>Обсудить проект <span aria-hidden="true">↗</span></Link>}
          <button type="button" onClick={onOpen} aria-label={`Детали решения: ${item.title}`}>Детали</button>
        </div>
      </div>
    </article>
  );
}
