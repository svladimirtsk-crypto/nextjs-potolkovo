"use client";
import { useEffect, useRef, useState } from "react";
import type { ParamId } from "@/lib/step0-fsm";
import type { CeilingEngine } from "@/lib/calculator-v2/use-ceiling-calculator-engine";
import { SectionCard, OptionCard, RangeField } from "../ui";
import { homepage } from "@/content/homepage";
import { PREFILL_HINT, defaultPerimeterMeters } from "@/lib/calculator/presets";
import { formatFrom, pricing } from "@/content/pricing";

const calculator = homepage.price.calculator;

function formatCurrency(v:number){ return new Intl.NumberFormat("ru-RU").format(Math.round(v)); }

/**
 * T-041: кнопки «Назад» и «Подтвердить» живут только в футере модалки,
 * поэтому экрану больше не нужен `onBack`.
 */
export function ParamScreen({ roomId, param, engine, onConfirm }:{
  roomId: string; param: ParamId; engine: CeilingEngine;
  onConfirm: ()=>void;
}) {
  /**
   * T-041 · Доступность: при смене вопроса фокус уходит на заголовок карточки,
   * иначе скринридер и клавиатура остаются на кнопке предыдущего экрана.
   * Это работа с DOM-узлом, а не синхронизация состояния, — эффект уместен.
   */
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, [param, roomId]);

  const room = engine.rooms.find(r=>r.id===roomId) ?? engine.activeRoom;
  // Локальное значение поля синхронизируется через key, а не через эффект.
  const [localLabel, setLocalLabel] = useState(room?.label ?? "");

  if (!room) {
    return <div className="p-4 text-rose-600">Комната {roomId} не найдена</div>;
  }

  const update = (patch: Parameters<CeilingEngine["updateRoom"]>[1]) => engine.updateRoom(room.id, patch);

  // T-021: подпись под предзаполненным пресетом параметром
  const prefillHint = engine.prefilled?.[param] ? (
    <p className="mb-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
      {engine.presetNote ?? PREFILL_HINT}
    </p>
  ) : null;

  // T-024: что уже учтено из набора, собранного в каталоге освещения
  const kitHintText = ((): string | null => {
    const kit = engine.pendingLightingPrefill;
    if (!kit) return null;
    const meters = Number(kit.trackProfileMeters ?? 0);
    const spots = Number(kit.pointSpotsQty ?? 0);
    const parts: string[] = [];
    if ((param === "track" || param === "lights") && meters > 0) {
      parts.push(`${Math.round(meters * 10) / 10} м.п. трека`);
    }
    if ((param === "lights" || param === "track") && spots > 0) {
      parts.push(`${spots} спотов`);
    }
    if (!parts.length) return null;
    return `Из вашего набора: ${parts.join(", ")} — учтено`;
  })();

  const kitHint = kitHintText ? (
    <p className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-900">
      {kitHintText}
    </p>
  ) : null;

  // AREA
  if (param === "area") {
    const isObjectMode = engine.calculationScope === "object";
    return (
      <SectionCard headingRef={headingRef} title="Площадь" description="Площадь считается отдельно, а профили и узлы — только по нужным участкам в метрах.">
        {prefillHint}
        {kitHint}
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
          <p className="mt-2 text-xs text-slate-600">Это название будет видно в общем списке помещений и в итоговом расчёте.</p>
        </div>
        )}
        {/* T-041: режим расчёта переехал сюда с отдельного экрана. */}
        <div className="mb-4">
          <p className="text-sm font-medium text-slate-700">Считаю:</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <OptionCard
              active={!isObjectMode}
              title="Комнату"
              meta="Кухня, спальня, гостиная — точный расчёт"
              onClick={() => engine.chooseCalcMode("room")}
            />
            <OptionCard
              active={isObjectMode}
              title="Весь объект"
              meta="Прикинуть бюджет по квартире или дому"
              onClick={() => engine.chooseCalcMode("object")}
            />
          </div>
        </div>

        <RangeField
          id="area-v2"
          label={isObjectMode ? "Укажите общую площадь объекта" : "Выберите площадь помещения"}
          value={room.area}
          min={1}
          max={isObjectMode ? 1000 : 200}
          step={1}
          unit="м²"
          onChange={v=>update({ area: v })}
          quickValues={isObjectMode ? [40, 60, 80, 100, 120] : [10, 12, 15, 18, 20, 25, 30, 40]}
        />
      </SectionCard>
    );
  }

  // CEILING
  if (param === "ceiling") {
    const isSimple = !room.shadowEnabled && !room.floatingEnabled;
    return (
      <SectionCard headingRef={headingRef} title="Тип потолка" description="Базовая площадь считается отдельно. Теневой и парящий указывайте только на нужных участках.">
        {prefillHint}
        {kitHint}
        <div className="space-y-3">
          <OptionCard
            active={isSimple}
            title="Простой потолок"
            meta={formatFrom(pricing.ceiling.standard, "м²")}
            onClick={()=>update({ ceilingType:"standard", shadowEnabled:false, floatingEnabled:false })}
          />
          {engine.solutionScenario !== "standard" && (
            <>
              <OptionCard
                active={room.shadowEnabled}
                title="Теневой потолок"
                meta={`${formatCurrency(pricing.ceiling.shadowBase)} ₽ / м² + ${formatCurrency(pricing.ceiling.shadowProfilePerM)} ₽ / м.п.`}
                onClick={()=>update({ shadowEnabled: !room.shadowEnabled })}
              />
              <OptionCard
                active={room.floatingEnabled}
                title="Парящий потолок"
                meta={`${formatCurrency(pricing.ceiling.floatingBase)} ₽ / м² + ${formatCurrency(pricing.ceiling.floatingProfilePerM)} ₽ / м.п.`}
                onClick={()=>update({ floatingEnabled: !room.floatingEnabled })}
              />
            </>
          )}
          {engine.solutionScenario === "standard" && (
            <button
              type="button"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-left text-sm font-medium text-slate-700 hover:border-slate-400"
              onClick={() => {
                // T-005: включаем современный сценарий, площадь не теряется
                engine.chooseScenario("modern");
                update({ ceilingType: "shadow", shadowEnabled: true, shadowLength: room.shadowLength || Math.max(4, Math.round(Math.sqrt(room.area) * 4)) });
              }}
            >
              Показать теневой и парящий профиль →
            </button>
          )}
        </div>
      </SectionCard>
    );
  }

  // CORNICE
  if (param === "cornice") {
    const corniceOpts = calculator.cornices;
    return (
      <SectionCard headingRef={headingRef} title="Карнизы">
        {prefillHint}
        {kitHint}
        <div className="grid gap-3 sm:grid-cols-2">
          {corniceOpts.map((o)=>(
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
      </SectionCard>
    );
  }

  // SHADOW PROFILE
  if (param === "shadowProfile") {
    const both = room.shadowEnabled && room.floatingEnabled;
    return (
      <SectionCard headingRef={headingRef} title={both ? "Теневой и парящий профиль" : "Теневой профиль"} description="По умолчанию — весь периметр помещения. Если профиль нужен не везде, переключитесь на «частично».">
        <PerimeterField
          id="shadow-v2"
          label="Длина теневого профиля"
          area={room.area}
          value={room.shadowLength}
          onChange={v=>update({shadowLength:v})}
        />
        {both && (
          <div className="mt-4">
            <PerimeterField
              id="floating-v2b"
              label="Длина парящего профиля"
              area={room.area}
              value={room.floatingLength}
              onChange={v=>update({floatingLength:v})}
            />
          </div>
        )}
      </SectionCard>
    );
  }

  // FLOATING PROFILE
  if (param === "floatingProfile") {
    return (
      <SectionCard headingRef={headingRef} title="Парящий профиль" description="По умолчанию — весь периметр помещения. Если профиль нужен не везде, переключитесь на «частично».">
        <PerimeterField
          id="floating-v2"
          label="Длина парящего профиля"
          area={room.area}
          value={room.floatingLength}
          onChange={v=>update({floatingLength:v})}
        />
      </SectionCard>
    );
  }

  // LIGHT LINES
  if (param === "lightLines") {
    return (
      <SectionCard headingRef={headingRef} title="Световые линии">
        <div className="grid gap-3 sm:grid-cols-2">
          <OptionCard active={!room.lightLinesEnabled} title="Без световых линий" meta="Без доп. расчёта" onClick={()=>update({lightLinesEnabled:false})} />
          <OptionCard active={room.lightLinesEnabled} title="Добавить световые линии" meta={`от ${formatCurrency(calculator.lightLines.ratePerMeter)} ₽ / м.п.`} onClick={()=>update({lightLinesEnabled:true})} />
        </div>
        {room.lightLinesEnabled && (
          <div className="mt-4">
            <RangeField id="ll-v2" label="Длина световых линий" value={room.lightLinesLength} min={1} max={50} step={1} unit="м.п." onChange={v=>update({lightLinesLength:v})} />
          </div>
        )}
      </SectionCard>
    );
  }

  // TRACK
  if (param === "track") {
    const trackOpts = calculator.tracks;
    return (
      <SectionCard headingRef={headingRef} title="Трековое освещение">
        {prefillHint}
        {kitHint}
        <div className="grid gap-3 sm:grid-cols-2">
          {trackOpts.map((o)=>(
            <OptionCard key={o.slug} active={room.trackType===o.slug} title={o.label} meta={o.ratePerMeter>0?`от ${formatCurrency(o.ratePerMeter)} ₽ / м.п.`:"Без доп. расчёта"} onClick={()=>update({trackType:o.slug})} />
          ))}
        </div>
        {room.trackType!=="none" && (
          <div className="mt-4">
            <RangeField id="track-v2" label="Длина трека" value={room.trackLength} min={1} max={50} step={1} unit="м.п." onChange={v=>update({trackLength:v})} />
          </div>
        )}
      </SectionCard>
    );
  }

  // CHANDELIERS
  if (param === "chandeliers") {
    return (
      <SectionCard headingRef={headingRef} title="Монтаж: установка люстр" description="Сами светильники подберём на следующем шаге со скидкой.">
        {prefillHint}
        {kitHint}
        <div className="grid gap-3 sm:grid-cols-2">
          <OptionCard active={!room.chandeliersEnabled} title="Не нужно" meta="Без поштучного расчёта" onClick={()=>update({chandeliersEnabled:false})} />
          <OptionCard active={room.chandeliersEnabled} title="Добавить установку" meta={`${formatCurrency(pricing.chandelierInstall)} ₽ / шт.`} onClick={()=>update({chandeliersEnabled:true})} />
        </div>
        {room.chandeliersEnabled && (
          <div className="mt-4">
            <RangeField id="chand-v2" label="Количество люстр" value={room.chandeliersCount} min={1} max={10} step={1} unit="шт." onChange={v=>update({chandeliersCount:v})} quickValues={[1,2,3]} />
          </div>
        )}
      </SectionCard>
    );
  }

  // LIGHTS
  if (param === "lights") {
    return (
      <SectionCard headingRef={headingRef} title="Монтаж: точечные светильники" description="Сами светильники подберём на следующем шаге со скидкой.">
        {prefillHint}
        {kitHint}
        <div className="grid gap-3 sm:grid-cols-2">
          <OptionCard active={!room.lightsEnabled} title="Без светильников" meta="Без поштучного расчёта" onClick={()=>update({lightsEnabled:false})} />
          <OptionCard active={room.lightsEnabled} title="Добавить светильники" meta={`от ${formatCurrency(calculator.lights.ratePerUnit)} ₽ / шт`} onClick={()=>update({lightsEnabled:true})} />
        </div>
        {room.lightsEnabled && (
          <div className="mt-4">
            <RangeField id="lights-v2" label="Количество светильников" value={room.lightsCount} min={1} max={40} step={1} unit="шт." onChange={v=>update({lightsCount:v})} quickValues={[4,6,8,10,12]} />
          </div>
        )}
      </SectionCard>
    );
  }

  // FALLBACK generic: экран недоступного параметра — автопереход дальше.
  return <UnavailableParamScreen onConfirm={onConfirm} />;
}


/**
 * T-041 · Длина профиля по периметру.
 *
 * По умолчанию берём `round(4·√area)` — геометрический ориентир периметра,
 * а не длину «1:1 к площади», которая завышала метраж на больших комнатах.
 * Переключатель «частично» открывает ручной ввод: профиль часто ставят
 * только вдоль одной-двух стен.
 */
function PerimeterField({
  id,
  label,
  area,
  value,
  onChange,
}: {
  id: string;
  label: string;
  area: number;
  value: number;
  onChange: (v: number) => void;
}) {
  const full = defaultPerimeterMeters(area);
  const isFull = Math.abs(value - full) < 0.001;

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        <OptionCard
          active={isFull}
          title="По всему периметру"
          meta={`${full} м.п. — ориентир для ${area} м²`}
          onClick={() => onChange(full)}
        />
        <OptionCard
          active={!isFull}
          title="Частично"
          meta="Укажу метры вручную"
          onClick={() => onChange(Math.max(1, Math.round(full / 2)))}
        />
      </div>

      {!isFull ? (
        <div className="mt-4">
          <RangeField
            id={id}
            label={label}
            value={value}
            min={1}
            max={150}
            step={1}
            unit="м.п."
            onChange={onChange}
          />
        </div>
      ) : null}
    </div>
  );
}

/** T-003: вместо отладочного дампа — карточка + автоматический переход. */
function UnavailableParamScreen({ onConfirm }: { onConfirm: () => void }) {
  const navigatedRef = useRef(false);

  useEffect(() => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    // единственный допустимый эффект — навигация
    const id = window.setTimeout(onConfirm, 0);
    return () => window.clearTimeout(id);
  }, [onConfirm]);

  return (
    <SectionCard title="Этот параметр пока недоступен" description="Переходим к следующему шагу.">
      <p className="text-sm text-slate-600">Секунду…</p>
    </SectionCard>
  );
}

function localRoomLabelTrim(s:string){ const t=s.trim(); return t || "Помещение"; }
