"use client";
import { useState, useEffect } from "react";
import type { ParamId } from "@/lib/step0-fsm";
import type { CeilingEngine } from "@/lib/calculator-v2/use-ceiling-calculator-engine";
import { SectionCard, OptionCard, RangeField } from "../ui";
import { homepage } from "@/content/homepage";

const calculator = homepage.price.calculator;

function formatCurrency(v:number){ return new Intl.NumberFormat("ru-RU").format(Math.round(v)); }

export function ParamScreen({ roomId, param, engine, onConfirm, onBack }:{
  roomId: string; param: ParamId; engine: CeilingEngine;
  onConfirm: ()=>void; onBack: ()=>void;
}) {
  const room = engine.rooms.find(r=>r.id===roomId) ?? engine.activeRoom;
  const [localLabel, setLocalLabel] = useState(room?.label ?? "");
  useEffect(()=>{ setLocalLabel(room?.label ?? ""); }, [room?.label, roomId]);

  if (!room) {
    return <div className="p-4 text-rose-600">Комната {roomId} не найдена</div>;
  }

  const update = (patch: any) => engine.updateRoom(room.id, patch);

  // AREA
  if (param === "area") {
    const isObjectMode = engine.calculationScope === "object";
    return (
      <SectionCard title="Площадь" description="Площадь считается отдельно, а профили и узлы — только по нужным участкам в метрах.">
        {!isObjectMode && (
        <div className="mb-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <p className="text-sm font-medium text-slate-700">Название помещения</p>
          <input
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={localLabel}
            onChange={e=>setLocalLabel(e.target.value)}
            onBlur={()=> update({ label: localRoomLabelTrim(localLabel) })}
            placeholder="Например: Кухня-гостиная"
          />
          <p className="mt-2 text-xs text-slate-500">Это название будет видно в общем списке помещений и в итоговом расчёте.</p>
        </div>
        )}
        <RangeField
          id="area-v2"
          label={isObjectMode ? "Укажите общую площадь объекта" : "Выберите площадь помещения"}
          value={room.area}
          min={1}
          max={isObjectMode ? 1000 : 200}
          step={1}
          unit="м²"
          onChange={v=>update({ area: v })}
          quickValues={[1,5,10,15,20,25,30,40,50,60,80]}
        />
        <div className="mt-4 flex justify-between">
          <button type="button" onClick={onBack} className="text-sm text-slate-600">← Назад</button>
          <button type="button" onClick={onConfirm} className="rounded-2xl bg-slate-950 px-5 py-2 text-sm font-semibold text-white">Подтвердить площадь →</button>
        </div>
      </SectionCard>
    );
  }

  // CEILING
  if (param === "ceiling") {
    const isSimple = !room.shadowEnabled && !room.floatingEnabled;
    return (
      <SectionCard title="Тип потолка" description="Базовая площадь считается отдельно. Теневой и парящий указывайте только на нужных участках.">
        <div className="space-y-3">
          <OptionCard
            active={isSimple}
            title="Простой потолок"
            meta={`от ${formatCurrency(1000)} ₽ / м²`}
            onClick={()=>update({ ceilingType:"standard", shadowEnabled:false, floatingEnabled:false })}
          />
          {engine.solutionScenario !== "standard" && (
            <>
              <OptionCard
                active={room.shadowEnabled}
                title="Теневой потолок"
                meta={`${formatCurrency(800)} ₽ / м² + ${formatCurrency(950)} ₽ / м.п.`}
                onClick={()=>update({ shadowEnabled: !room.shadowEnabled })}
              />
              <OptionCard
                active={room.floatingEnabled}
                title="Парящий потолок"
                meta={`${formatCurrency(800)} ₽ / м² + ${formatCurrency(2500)} ₽ / м.п.`}
                onClick={()=>update({ floatingEnabled: !room.floatingEnabled })}
              />
            </>
          )}
          {engine.solutionScenario === "standard" && (
            <button type="button" className="w-full text-left text-sm text-slate-600 underline"
              onClick={()=>{ /* в V2 modern опции открываются через сценарий, здесь заглушка */ }}>
              Показать теневой и парящий профиль →
            </button>
          )}
        </div>
        <div className="mt-4 flex justify-between">
          <button type="button" onClick={onBack} className="text-sm text-slate-600">← Назад</button>
          <button type="button" onClick={onConfirm} className="rounded-2xl bg-slate-950 px-5 py-2 text-sm font-semibold text-white">Подтвердить тип →</button>
        </div>
      </SectionCard>
    );
  }

  // CORNICE
  if (param === "cornice") {
    const corniceOpts = calculator.cornices;
    return (
      <SectionCard title="Карнизы">
        <div className="grid gap-3 sm:grid-cols-2">
          {corniceOpts.map((o:any)=>(
            <OptionCard
              key={o.slug}
              active={room.corniceType===o.slug}
              title={o.label}
              meta={o.ratePerMeter>0 ? `от ${formatCurrency(o.ratePerMeter)} ₽ / м.п.` : "Без доп. расчёта"}
              onClick={()=>update({ corniceType: o.slug })}
            />
          ))}
        </div>
        {room.corniceType!=="none" && (
          <div className="mt-4 space-y-4">
            <RangeField id="cornice-v2" label="Длина карниза" value={room.corniceLength} min={1} max={50} step={1} unit="м.п." onChange={v=>update({corniceLength:v})} />
            <div className="grid gap-3 sm:grid-cols-2">
              <OptionCard active={!room.corniceLightingEnabled} title="Без подсветки" meta="Только узел" onClick={()=>update({corniceLightingEnabled:false})} />
              <OptionCard active={!!room.corniceLightingEnabled} title="Добавить подсветку" meta={`+${formatCurrency(calculator.corniceLighting.ratePerMeter)} ₽/м.п. + блок ${formatCurrency(calculator.corniceLighting.powerSupplyRate)} ₽`} onClick={()=>update({corniceLightingEnabled:true, corniceLightingLength: room.corniceLength, corniceLightingPowerSupplies:1})} />
            </div>
            {room.corniceLightingEnabled && (
              <div className="grid gap-3 sm:grid-cols-2">
                <RangeField id="cl-len" label="Длина подсветки" value={room.corniceLightingLength ?? room.corniceLength} min={1} max={50} step={1} unit="м.п." onChange={v=>update({corniceLightingLength:v})} />
                <RangeField id="cl-psu" label="Блоки питания" value={room.corniceLightingPowerSupplies ?? 1} min={1} max={10} step={1} unit="шт." onChange={v=>update({corniceLightingPowerSupplies:v})} quickValues={[1,2,3]} />
              </div>
            )}
          </div>
        )}
        <div className="mt-4 flex justify-between">
          <button type="button" onClick={onBack} className="text-sm text-slate-600">← Назад</button>
          <button type="button" onClick={onConfirm} className="rounded-2xl bg-slate-950 px-5 py-2 text-sm font-semibold text-white">Подтвердить карниз →</button>
        </div>
      </SectionCard>
    );
  }

  // SHADOW PROFILE
  if (param === "shadowProfile") {
    const both = room.shadowEnabled && room.floatingEnabled;
    return (
      <SectionCard title={both ? "Теневой и парящий профиль" : "Теневой профиль"} description="Укажите метры профиля. По умолчанию 1:1 к площади.">
        <RangeField id="shadow-v2" label="Длина теневого профиля" value={room.shadowLength} min={1} max={150} step={1} unit="м.п." onChange={v=>update({shadowLength:v})} quickValues={[room.area]} />
        {both && (
          <div className="mt-4">
            <RangeField id="floating-v2b" label="Длина парящего профиля" value={room.floatingLength} min={1} max={150} step={1} unit="м.п." onChange={v=>update({floatingLength:v})} quickValues={[room.area]} />
          </div>
        )}
        <div className="mt-3 text-xs text-slate-500">Ориентир для площади {room.area} м² — {room.area} м.п. Если профиль нужен частично — введите фактические метры.</div>
        <div className="mt-4 flex justify-between">
          <button type="button" onClick={onBack} className="text-sm text-slate-600">← Назад</button>
          <button type="button" onClick={onConfirm} className="rounded-2xl bg-slate-950 px-5 py-2 text-sm font-semibold text-white">Подтвердить профиль →</button>
        </div>
      </SectionCard>
    );
  }

  // FLOATING PROFILE
  if (param === "floatingProfile") {
    return (
      <SectionCard title="Парящий профиль" description="Укажите метры парящего профиля.">
        <RangeField id="floating-v2" label="Длина парящего профиля" value={room.floatingLength} min={1} max={150} step={1} unit="м.п." onChange={v=>update({floatingLength:v})} quickValues={[room.area]} />
        <div className="mt-4 flex justify-between">
          <button type="button" onClick={onBack} className="text-sm text-slate-600">← Назад</button>
          <button type="button" onClick={onConfirm} className="rounded-2xl bg-slate-950 px-5 py-2 text-sm font-semibold text-white">Подтвердить профиль →</button>
        </div>
      </SectionCard>
    );
  }

  // LIGHT LINES
  if (param === "lightLines") {
    return (
      <SectionCard title="Световые линии">
        <div className="grid gap-3 sm:grid-cols-2">
          <OptionCard active={!room.lightLinesEnabled} title="Без световых линий" meta="Без доп. расчёта" onClick={()=>update({lightLinesEnabled:false})} />
          <OptionCard active={room.lightLinesEnabled} title="Добавить световые линии" meta={`от ${formatCurrency(calculator.lightLines.ratePerMeter)} ₽ / м.п.`} onClick={()=>update({lightLinesEnabled:true})} />
        </div>
        {room.lightLinesEnabled && (
          <div className="mt-4">
            <RangeField id="ll-v2" label="Длина световых линий" value={room.lightLinesLength} min={1} max={50} step={1} unit="м.п." onChange={v=>update({lightLinesLength:v})} />
          </div>
        )}
        <div className="mt-4 flex justify-between">
          <button type="button" onClick={onBack} className="text-sm text-slate-600">← Назад</button>
          <button type="button" onClick={onConfirm} className="rounded-2xl bg-slate-950 px-5 py-2 text-sm font-semibold text-white">Подтвердить линии →</button>
        </div>
      </SectionCard>
    );
  }

  // TRACK
  if (param === "track") {
    const trackOpts = calculator.tracks;
    return (
      <SectionCard title="Трековое освещение">
        <div className="grid gap-3 sm:grid-cols-2">
          {trackOpts.map((o:any)=>(
            <OptionCard key={o.slug} active={room.trackType===o.slug} title={o.label} meta={o.ratePerMeter>0?`от ${formatCurrency(o.ratePerMeter)} ₽ / м.п.`:"Без доп. расчёта"} onClick={()=>update({trackType:o.slug})} />
          ))}
        </div>
        {room.trackType!=="none" && (
          <div className="mt-4">
            <RangeField id="track-v2" label="Длина трека" value={room.trackLength} min={1} max={50} step={1} unit="м.п." onChange={v=>update({trackLength:v})} />
          </div>
        )}
        <div className="mt-4 flex justify-between">
          <button type="button" onClick={onBack} className="text-sm text-slate-600">← Назад</button>
          <button type="button" onClick={onConfirm} className="rounded-2xl bg-slate-950 px-5 py-2 text-sm font-semibold text-white">Подтвердить трек →</button>
        </div>
      </SectionCard>
    );
  }

  // CHANDELIERS
  if (param === "chandeliers") {
    return (
      <SectionCard title="Установка люстр">
        <div className="grid gap-3 sm:grid-cols-2">
          <OptionCard active={!room.chandeliersEnabled} title="Не нужно" meta="Без поштучного расчёта" onClick={()=>update({chandeliersEnabled:false})} />
          <OptionCard active={room.chandeliersEnabled} title="Добавить установку" meta={`${formatCurrency(1000)} ₽ / шт`} onClick={()=>update({chandeliersEnabled:true})} />
        </div>
        {room.chandeliersEnabled && (
          <div className="mt-4">
            <RangeField id="chand-v2" label="Количество люстр" value={room.chandeliersCount} min={1} max={10} step={1} unit="шт." onChange={v=>update({chandeliersCount:v})} quickValues={[1,2,3]} />
          </div>
        )}
        <div className="mt-4 flex justify-between">
          <button type="button" onClick={onBack} className="text-sm text-slate-600">← Назад</button>
          <button type="button" onClick={onConfirm} className="rounded-2xl bg-slate-950 px-5 py-2 text-sm font-semibold text-white">Подтвердить люстры →</button>
        </div>
      </SectionCard>
    );
  }

  // LIGHTS
  if (param === "lights") {
    return (
      <SectionCard title="Точечные светильники">
        <div className="grid gap-3 sm:grid-cols-2">
          <OptionCard active={!room.lightsEnabled} title="Без светильников" meta="Без поштучного расчёта" onClick={()=>update({lightsEnabled:false})} />
          <OptionCard active={room.lightsEnabled} title="Добавить светильники" meta={`от ${formatCurrency(calculator.lights.ratePerUnit)} ₽ / шт`} onClick={()=>update({lightsEnabled:true})} />
        </div>
        {room.lightsEnabled && (
          <div className="mt-4">
            <RangeField id="lights-v2" label="Количество светильников" value={room.lightsCount} min={1} max={40} step={1} unit="шт." onChange={v=>update({lightsCount:v})} quickValues={[4,6,8,10,12]} />
          </div>
        )}
        <div className="mt-4 flex justify-between">
          <button type="button" onClick={onBack} className="text-sm text-slate-600">← Назад</button>
          <button type="button" onClick={onConfirm} className="rounded-2xl bg-slate-950 px-5 py-2 text-sm font-semibold text-white">Подтвердить свет →</button>
        </div>
      </SectionCard>
    );
  }

  // FALLBACK generic
  return (
    <SectionCard title={param} description={`QUIZ V2 — параметр ${param} (в разработке)`}>
      <pre className="text-xs bg-slate-50 p-3 rounded-xl overflow-auto">{JSON.stringify(room, null, 2)}</pre>
      <div className="mt-4 flex justify-between">
        <button type="button" onClick={onBack} className="text-sm text-slate-600">← Назад</button>
        <button type="button" onClick={onConfirm} className="rounded-2xl bg-slate-950 px-5 py-2 text-sm font-semibold text-white">Подтвердить →</button>
      </div>
    </SectionCard>
  );
}

function localRoomLabelTrim(s:string){ const t=s.trim(); return t || "Помещение"; }
