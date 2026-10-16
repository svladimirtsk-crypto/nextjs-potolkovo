from pathlib import Path
root=Path('/home/user/repo')
def edit(file,old,new):
 p=root/file;s=p.read_text();assert old in s,(file,old[:80]);p.write_text(s.replace(old,new,1))
p=root/'components/calculator-modal/calculator-modal.tsx';s=p.read_text();a=s.index('type StepNavProps =');b=s.index('export function CalculatorModal()',a);s=s[:a]+s[b:];s=s.replace('import { PriceStrip } from "./price-strip";','import { PriceStrip } from "./price-strip";\nimport { WizardProgress } from "./wizard-progress";\nimport { ProjectOverview } from "./project-overview";\nimport { resolveStep2Copy } from "@/lib/calculator-flow";');s=s.replace('    lightingDraft,\n','    lightingDraft,\n    lightingDiscountMode,\n',1).replace('calculator-modal-panel fixed','pk-calculator calculator-modal-panel fixed',1).replace('className="flex shrink-0 items-center justify-between border-b','className="pk-calc-header flex shrink-0 items-center justify-between border-b',1).replace('<h2 id="calc-modal-title"','<p className="pk-calc-eyebrow">ПОТОЛКОВО · Расчёт проекта</p>\n              <h2 id="calc-modal-title"',1).replace('<StepNav','<WizardProgress',1).replace('className="sticky top-0 z-10','className="pk-calc-mobile-price sticky top-0 z-10',1)
a=s.index('          <aside className=');b=s.index('</aside>',a)+len('</aside>');s=s[:a]+'          <ProjectOverview />'+s[b:]
s=s.replace(') : actionFormVisible ? (',') : leadSubmittedAt ? (\n                <button type="button" onClick={closeCalculator} className="min-h-12 rounded-xl bg-slate-950 px-6 text-sm text-white">Готово</button>\n              ) : actionFormVisible ? (',1)
s=s.replace('                  Записаться на замер →','                  {resolveStep2Copy(lightingDiscountMode === "lighting-only" ? "lighting_only" : "ceiling_only").submitLabel} →',1)
p.write_text(s)
edit('app/layout.tsx','import "./brand.css";','import "./brand.css";\nimport "./calculator-brand.css";')
edit('components/calculator-modal/price-strip.tsx','className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm','className="pk-price-strip rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm')
edit('components/calculator-modal/step0/quiz-v2/ui.tsx','<section className="rounded-[1.5rem]','<section className="pk-question rounded-[1.5rem]')
edit('components/calculator-modal/step0/quiz-v2/ui.tsx','className={`min-h-11 rounded-2xl','className={`pk-option min-h-11 rounded-2xl')
edit('components/calculator-modal/step0/quiz-v2/ui.tsx','    <div>\n      <div className="flex flex-wrap','    <div className="pk-range">\n      <div className="flex flex-wrap')
p=root/'components/calculator-modal/step0/quiz-v2/screens/ParamScreen.tsx';s=p.read_text().replace('import { homepage }','import { CeilingOption } from "@/components/calculator-modal/ceiling-option";\nimport { homepage }',1)
s=s.replace('`Подставил ${room?.area ?? 0} м² со страницы — поправьте под себя`','`Подставлено ${room?.area ?? 0} м² со страницы — поправьте под себя`').replace('Только площадь. Профили, карнизы и свет спрошу дальше — по метрам.','Начнём с площади. Примыкание, карнизы и свет выберем на следующих шагах.').replace('meta="Точный расчёт"','meta="Параметры комнаты"').replace('meta="Только узел"','meta="Только карниз"')
a=s.index('        <div className="space-y-3">',s.index('// CEILING'));b=s.index('      </SectionCard>',a)
s=s[:a]+'''        <div className="pk-ceiling-options">
          <CeilingOption active={isSimple} kind="standard" title="Простой потолок"
            description="Ровное полотно. Привычное примыкание к стене."
            price={formatFrom(pricing.ceiling.standard, "м²")}
            onClick={()=>update({ ceilingType:"standard", shadowEnabled:false, floatingEnabled:false })} />
          {engine.solutionScenario !== "standard" ? <>
            <CeilingOption active={room.shadowEnabled} kind="shadow" title="Теневой потолок"
              description="Чёткая линия по контуру, без потолочного плинтуса."
              price={`${formatCurrency(pricing.ceiling.shadowBase)} ₽ / м² + ${formatCurrency(pricing.ceiling.shadowProfilePerM)} ₽ / м.п.`}
              onClick={()=>update({ shadowEnabled: !room.shadowEnabled })} />
            <CeilingOption active={room.floatingEnabled} kind="floating" title="Парящий потолок"
              description="Подсвеченный контур — потолок визуально отделён от стен."
              price={`${formatCurrency(pricing.ceiling.floatingBase)} ₽ / м² + ${formatCurrency(pricing.ceiling.floatingProfilePerM)} ₽ / м.п.`}
              onClick={()=>update({ floatingEnabled: !room.floatingEnabled })} />
            <p className="pk-diagram-note">Можно сочетать теневой и парящий профиль на разных участках. Далее уточним метраж. Изображения — схемы, не монтажные чертежи.</p>
          </> : <div className="pk-premium-invite">
            <p>Хотите потолок без плинтуса или мягкий свет по контуру?</p>
            <button type="button" onClick={() => engine.chooseScenario("modern")}>Показать теневой и парящий профиль →</button>
            <p className="pk-diagram-note">Просмотр вариантов ничего не добавляет в смету. Световые линии, треки и скрытые карнизы можно выбрать дальше.</p>
          </div>}
        </div>
''' +s[b:];p.write_text(s)
# Presentation fragments only; all existing computed amounts stay in Step 2.
p=root/'components/calculator-modal/wizard-step2-summary.tsx';s=p.read_text().replace('import { ActionForm }','import { EstimateCard } from "./estimate-card";\nimport { ActionForm }',1);a=s.index('      {/* Grand total');b=s.index('      {hasRoomBreakdown',a)
s=s[:a]+'''      <EstimateCard total={fmt(resolvedGrandTotal)} ceiling={fmt(resolvedCeilingTotal)}
        showCeiling={resolvedShowCeilingInUi}
        lighting={resolvedLightingEffectiveTotal > 0 ? fmt(resolvedLightingEffectiveTotal) : null}
        includedInstallation={resolvedShowCeilingInUi && (includedSpotQty > 0 || includedTrackMeters > 0)
          ? `Монтаж света: ${includedSpotQty} светильников, ${includedTrackMeters} м трека — уже в потолке` : null}
        extraInstallLines={extraInstallLines}
        discount={resolvedLightingEffectiveTotal > 0 && lightingDiscountEligible && lightingAppliedBenefit > 0
          ? <>Скидка на свет −{lightingAppliedPercent}% (−{fmt(lightingAppliedBenefit)} ₽). До скидки: <del>{fmt(resolvedLightingRegularTotal)} ₽</del></> : null}
        alternative={lightingDiscountMode !== "with-ceiling" && resolvedLightingEffectiveTotal > 0 && resolvedLightingWithCeilingTotal > 0
          ? <>С потолком: {fmt(resolvedLightingWithCeilingTotal)} ₽ −25% (−{fmt(lightingPotentialBenefit)} ₽).</> : null} />

''' +s[b:];s=s.replace('<details className="rounded-2xl','<details className="pk-summary-details rounded-2xl',1);p.write_text(s)
edit('components/calculator-modal/wizard-step1-lighting.tsx','<div ref={rootRef} className="space-y-4">','''<div ref={rootRef} className="pk-lighting-stage space-y-4">
      <div className="pk-lighting-intro"><h3>Свет под ваш интерьер</h3><p>Выберите оборудование через подбор или каталог. Состав и совместимость проверим отдельно; настройка управления зависит от конкретного комплекта.</p></div>''')
for f in ['ScenarioScreen','RoomPickerScreen','RoomEditScreen','SummaryScreen']:
 p=root/f'components/calculator-modal/step0/quiz-v2/screens/{f}.tsx';s=p.read_text().replace('<section className="rounded-[1.5rem]','<section className="pk-question rounded-[1.5rem]',1);s=s.replace('дальше покажу только нужные шаги','дальше покажем только нужные шаги').replace('SMART-свет и сценарии управления — обсудим лично.','Сценарии управления — обсудим состав и совместимость.').replace('Готовый расчёт','Предварительный расчёт');p.write_text(s)
p=root/'components/calculator-modal/step0/quiz-v2/screens/RoomEditScreen.tsx';s=p.read_text();needle='    { id: "cornice",';i=s.index(needle);s=s[:i]+'''    ...(room.shadowEnabled ? [{ id: "shadowProfile" as const, label: room.floatingEnabled ? "Теневой / парящий профиль" : "Теневой профиль", value: room.floatingEnabled ? `${room.shadowLength} / ${room.floatingLength} м.п.` : `${room.shadowLength} м.п.` }] : []),
    ...(!room.shadowEnabled && room.floatingEnabled ? [{ id: "floatingProfile" as const, label: "Парящий профиль", value: `${room.floatingLength} м.п.` }] : []),
    ...(engine.solutionScenario !== "standard" ? [{ id: "lightLines" as const, label: "Световые линии", value: room.lightLinesEnabled ? `${room.lightLinesLength} м.п.` : "Не нужны" }] : []),
'''+s[i:];p.write_text(s)
