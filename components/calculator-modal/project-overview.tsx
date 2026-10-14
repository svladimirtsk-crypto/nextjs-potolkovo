"use client";

import { useCalculatorModal } from "./calculator-modal-context";
import { useCalculatorStore } from "@/lib/calculator/store";
import { PriceStrip } from "./price-strip";

/** Reads the existing snapshot; does not calculate prices or imply technical approval. */
export function ProjectOverview() {
  const { currentStep, step0SessionInteracted, showCeilingInUi, lightingDraft } = useCalculatorModal();
  const { snapshot } = useCalculatorStore();
  const rooms = showCeilingInUi && step0SessionInteracted ? snapshot?.roomBreakdown ?? [] : [];
  const lights = lightingDraft?.mode === "catalog" ? lightingDraft.items ?? [] : [];
  return <aside className="pk-project-overview hidden lg:flex" aria-label="Сводка проекта">
    <div className="pk-project-brand"><span aria-hidden="true">П</span><div>ПОТОЛКОВО<small>Потолки · свет · монтаж</small></div></div>
    <div className="pk-project-heading"><p className="pk-calc-eyebrow">Ваш проект</p><h3>Всё начинается<br />с хорошего плана.</h3></div>
    {currentStep !== 2 ? <div className="pk-project-budget"><p>Предварительный бюджет</p><PriceStrip /></div> :
      <div className="pk-project-note">Итог и состав — слева. Проверьте помещения и оборудование перед отправкой заявки.</div>}
    {rooms.length > 0 && <section className="pk-project-list" aria-label="Помещения проекта">
      <h4>Помещения <span>{rooms.length}</span></h4>
      {rooms.map(room => <div key={room.id}><b>{room.label}</b><span>{room.area} м²</span><small>{room.ceilingTypeLabel}
        {room.lightLinesLength ? ` · линии ${room.lightLinesLength} м` : ""}
        {room.corniceLength && room.corniceLabel ? ` · ${room.corniceLabel}` : ""}</small></div>)}
    </section>}
    {lights.length > 0 && <section className="pk-project-list" aria-label="Свет в проекте">
      <h4>Оборудование <span>{lights.length} поз.</span></h4>
      {lights.slice(0, 3).map(item => <p key={item.sku}>{item.name}</p>)}
      {lights.length > 3 && <p>Ещё {lights.length - 3} поз. — в составе расчёта</p>}
    </section>}
    <div className="pk-project-disclaimer"><b>Сначала состав. Потом точная смета.</b><p>Расчёт помогает оценить бюджет. Геометрию и монтаж уточним на замере; цену, наличие и совместимость света — перед согласованием комплекта.</p></div>
  </aside>;
}
