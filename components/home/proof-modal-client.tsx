"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Picture } from "@/components/ui/picture";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import { homeAssets } from "@/content/home-assets";
import { proofView, type ProofItem } from "@/content/proof-gallery";
import { useCalculatorModal } from "@/components/calculator-modal/calculator-modal-context";
import { useCalculatorPageContext } from "@/components/calculator-modal/page-context";
import { ProofBudget } from "./proof-budget";

type Props = {
  items: readonly ProofItem[]; selectedIndex: number | null;
  onClose: () => void; onPrev: () => void; onNext: () => void;
};

/** Keyed per item: changing the solution resets the photo without a stale frame. */
function ProofPhotos({ item }: { item: ProofItem }) {
  const [index, setIndex] = useState(0);
  const asset = homeAssets.find(entry => entry.assetKey === item.imageAssetKey);
  if (!asset) return null;
  const gallery: readonly string[] = "gallery" in asset ? asset.gallery : [asset.src];
  const move = (delta: number) => setIndex(current => (current + delta + gallery.length) % gallery.length);
  return (
    <div className="pk-proof-photos" role="region" aria-label="Фотографии решения" tabIndex={0} onKeyDown={event => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); move(event.key === "ArrowLeft" ? -1 : 1); }
    }}>
      <div className="pk-proof-photo-stage">
        <Picture src={gallery[index]} alt={`${item.alt} — фото ${index + 1}`} fill sizes="(max-width: 900px) 100vw, 60vw" imgClassName="pk-proof-full-image" />
      </div>
      <div className="pk-proof-photo-tools">
        <p role="status" aria-live="polite" aria-atomic="true">Фото {index + 1} / {gallery.length}</p>
        <a href={gallery[index]} target="_blank" rel="noopener noreferrer">Оригинал фото <span className="sr-only">(откроется в новой вкладке)</span><span aria-hidden="true">↗</span></a>
        <div><button type="button" onClick={() => move(-1)} aria-label="Предыдущее фото">←</button><button type="button" onClick={() => move(1)} aria-label="Следующее фото">→</button></div>
      </div>
      <div className="pk-proof-thumbnails" role="group" aria-label="Выбрать фотографию">
        {gallery.map((src, photoIndex) => <button key={src} type="button" aria-label={`Показать фото ${photoIndex + 1}`} aria-pressed={photoIndex === index} onClick={() => setIndex(photoIndex)}>
          <Picture src={src} alt="" fill sizes="(max-width: 900px) 28vw, 160px" imgClassName="object-cover" />
          <span aria-hidden="true">{String(photoIndex + 1).padStart(2, "0")}</span>
        </button>)}
      </div>
      <p className="pk-proof-photo-hint">Рассмотрите весь кадр. Стрелки клавиатуры переключают фото, когда фокус находится в галерее.</p>
    </div>
  );
}

export function ProofModalClient({ items, selectedIndex, onClose, onPrev, onNext }: Props) {
  const { openCalculator } = useCalculatorModal();
  const page = useCalculatorPageContext();
  const dialogRef = useRef<HTMLDivElement>(null);
  const item = selectedIndex === null ? null : items[selectedIndex];
  useDialogFocus(Boolean(item), dialogRef, onClose);
  if (!item) return null;
  const view = proofView(item.slug);
  const handleWantSame = () => {
    if (!item.actionPreset) return;
    onClose();
    openCalculator(page.optionsFor("proof", {
      preset: item.actionPreset,
      presetOrigin: "explicit",
      source: `${item.slug}:proof`,
    }));
  };
  return (
    <div className="pk-proof-modal pk-proof-editorial">
      <button type="button" className="pk-proof-backdrop" onClick={onClose} aria-label="Закрыть окно" tabIndex={-1} />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="proof-dialog-title" tabIndex={-1} className="pk-proof-modal-surface">
        <header className="pk-proof-dialog-header">
          <p>ПОТОЛКОВО <span aria-hidden="true">/</span> <span>Решение {selectedIndex! + 1} из {items.length}</span></p>
          <div><button type="button" disabled={items.length < 2} onClick={onPrev} aria-label="Предыдущая работа">←</button><button type="button" disabled={items.length < 2} onClick={onNext} aria-label="Следующая работа">→</button><button type="button" onClick={onClose} aria-label="Закрыть">✕</button></div>
        </header>
        <div className="pk-proof-dialog-body" key={item.slug}>
          <ProofPhotos item={item} />
          <div className="pk-proof-story">
            <div className="pk-proof-story-intro">
              <p className="pk-eyebrow">Потолок + пространство</p>
              <h2 id="proof-dialog-title">{item.title}</h2>
              <p className="pk-proof-location">{item.addressLabel ?? item.roomType}</p>
              <dl className="pk-proof-facts">
                {item.areaLabel && <div><dt>Площадь в примере</dt><dd>{item.areaLabel}</dd></div>}
                {item.timelineLabel && <div><dt>Срок в примере</dt><dd>{item.timelineLabel}</dd></div>}
              </dl>
              <p className="pk-proof-summary">{item.summary}</p>
            </div>
            {item.challenge && <section className="pk-proof-story-section"><h3><span>01</span> Задача</h3><p>{item.challenge}</p></section>}
            {item.workDone && <section className="pk-proof-story-section"><h3><span>02</span> Решение</h3><p>{item.workDone}</p></section>}
            {item.configurationLines?.length ? <details className="pk-proof-configuration"><summary>Параметры этого примера <span aria-hidden="true">+</span></summary><ul>{item.configurationLines.map(line => <li key={line}>{line}</li>)}</ul></details> : null}
            {view.categories.includes("light") && <aside className="pk-proof-lighting-note"><p>Для нового проекта протокол управления, оборудование и совместимость проверяются отдельно.</p><Link href="/umnoe-osveshchenie" onClick={onClose}>Управление светом: что уточнить <span aria-hidden="true">↗</span></Link></aside>}
            <ProofBudget item={item} />
            <div className="pk-proof-next-step">
              <p className="pk-eyebrow">Для вашего помещения</p>
              <p>{item.actionPreset ? "Перенесём стартовые параметры в калькулятор. Проверьте площадь и метры участков, затем уточните освещение. Комплект светильников не добавляется автоматически." : "Нестандартную форму и состав освещения обсуждаем по проекту. Типовой калькулятор не заменяет такую оценку."}</p>
              {item.actionPreset ? <button type="button" className="pk-proof-primary" onClick={handleWantSame}>Хочу похожее решение <span aria-hidden="true">↗</span></button> : <Link className="pk-proof-primary" href={`${view.servicePath}#action`} onClick={onClose}>Обсудить проект <span aria-hidden="true">↗</span></Link>}
              <Link className="pk-proof-service-link" href={view.servicePath} onClick={onClose}>{view.serviceLabel} <span aria-hidden="true">↗</span></Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
