import type { ReactNode } from "react";

/** All amounts and conditions are computed by the existing Step 2, not this card. */
export function EstimateCard({ total, ceiling, lighting, showCeiling, includedInstallation, extraInstallLines, discount, alternative }: {
  total: string; ceiling: string; lighting: string | null; showCeiling: boolean;
  includedInstallation: string | null; extraInstallLines: string[];
  discount: ReactNode; alternative: ReactNode;
}) {
  return <section className="pk-estimate" aria-label="Ориентировочный итог" data-testid="estimate-card">
    <div className="pk-estimate-top"><p>Ориентировочный итог</p><span>Предварительно</span></div>
    <p className="pk-estimate-total" aria-live="polite" aria-atomic="true">~{total} ₽</p>
    <p className="pk-estimate-note">{showCeiling ? "Точная смета — после замера и согласования состава." : "Цена и наличие оборудования — после проверки комплекта."}</p>
    <dl className="pk-estimate-lines">
      {showCeiling && <div><dt>Потолок и работы</dt><dd>{ceiling} ₽</dd></div>}
      {lighting && <div><dt>Свет</dt><dd>{lighting} ₽</dd></div>}
    </dl>
    {includedInstallation && <p className="pk-estimate-footnote">{includedInstallation}</p>}
    {extraInstallLines.map(line => <p className="pk-estimate-footnote" key={line}>+ {line}</p>)}
    {discount && <p className="pk-estimate-discount">{discount}</p>}
    {alternative && <p className="pk-estimate-footnote">{alternative}</p>}
  </section>;
}
