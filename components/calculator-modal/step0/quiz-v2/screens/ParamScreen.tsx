"use client";
import { useEffect, useRef, useState } from "react";
import type { ParamId } from "@/lib/step0-fsm";
import type { CeilingEngine } from "@/lib/calculator/use-calculator-engine";
import { SectionCard, OptionCard, RangeField } from "../ui";
import { showQuizStepImages } from "../step-image-feature";
import { BinaryChoiceIcon } from "../binary-choice-icons";
import { CeilingRoomOptions } from "@/components/calculator-modal/ceiling-room-options";
import { homepage } from "@/content/homepage";
import { PREFILL_HINT, defaultPerimeterMeters } from "@/lib/calculator/presets";
import { pricing } from "@/content/pricing";

const calculator = homepage.price.calculator;

function formatCurrency(v:number){ return new Intl.NumberFormat("ru-RU").format(Math.round(v)); }

/**
 * T-041: кнопки «Назад» и «Подтвердить» живут только в футере модалки,
 * поэтому экрану больше не нужен `onBack`.
 */
/**
 * PT-039…042 · Миниатюры вариантов.
 *
 * Alt намеренно пустой у схем и у кадров, чей смысл уже выражен заголовком и
 * подписью (PT-047): карточка — одна кнопка, и дублирующий alt заставлял бы
 * скринридер читать одно и то же дважды. У фото карниза alt описывает, что
 * именно видно, потому что название варианта не говорит, что ниша скрытая.
 *
 * Схемы — `public/quiz-*.svg`: они подписаны как схематичные прямо в UI и не
 * выдаются за фотографию конкретного объекта (PT-049).
 */
const CORNICE_MEDIA: Record<string, { src: string; alt: string } | undefined> = {
  "hidden-niche": { src: "/quiz-cornice-hidden-niche.jpeg", alt: "Скрытая ниша: карниз утоплен за натяжным полотном" },
  "built-in": { src: "/quiz-cornice-builtin.svg", alt: "" },
  surface: { src: "/quiz-cornice-surface.svg", alt: "" },
};

// Оба варианта — схемы в одном ракурсе: обобщённые фото трека со страницы
// услуги не показывают монтажный подтип, а смешивать фото и схему в одной
// группе нельзя (бриф, раздел 4). «Без трека» остаётся текстом.
const TRACK_MEDIA: Record<string, { src: string; alt: string } | undefined> = {
  "built-in": { src: "/quiz-track-builtin.svg", alt: "" },
  surface: { src: "/quiz-track-surface.svg", alt: "" },
};

const LIGHT_LINES_MEDIA = {
  src: "/quiz-lines.jpeg",
  alt: "Световые линии в натяжном потолке",
} as const;

export function ParamScreen({ roomId, param, engine, onConfirm, editing = false }:{
  roomId: string; param: ParamId; engine: CeilingEngine;
  onConfirm: ()=>void; editing?: boolean;
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
  /** N-013 (F-08): поле названия свёрнуто — на входе от человека не требуют печатать. */
  const [nameOpen, setNameOpen] = useState(false);

  if (!room) {
    return <div className="p-4 text-rose-600">Комната {roomId} не найдена</div>;
  }

  const update = (patch: Parameters<CeilingEngine["updateRoom"]>[1]) => engine.updateRoom(room.id, patch);

  /**
   * N-013 (F-10): плашка предзаполнения раньше висела и на главной, где
   * пресета нет: контекст модалки подставляет заглушку {standard, 10 м²},
   * и `prefilled.area` выставлялся всегда. Признак настоящего пресета —
   * пришедшее со страницы название источника (`presetNote`).
   */
  const areaPrefillNote =
    param === "area" && engine.prefilled?.area && engine.presetNote
      ? `Подставлено ${room?.area ?? 0} м² со страницы — поправьте под себя`
      : null;

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
    const isSecondRoom = engine.rooms.length > 1;

    return (
      <SectionCard
        headingRef={headingRef}
        title="Площадь потолка"
        /* N-013 (F-09): «узлы» и «участки в метрах» — язык монтажника. */
        description={editing ? "Измените площадь и сохраните правку. Остальные параметры помещения сохранятся." : "Начнём с площади. Примыкание, карнизы и свет выберем на следующих шагах."}
      >
        {kitHint}

        {/*
          N-013 (F-11): порядок блоков идёт от общего к частному —
          (a) что считаем, (b) сколько это в метрах, (c) как назвать.
          Раньше первым стоял ввод названия: человек ещё ничего не посчитал,
          а его уже просили печатать (F-08).
        */}
        {!editing && !isSecondRoom && <div className="mb-4">
          <p className="text-sm font-medium text-slate-700">Что считаем?</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <OptionCard
              active={!isObjectMode}
              title="Одну комнату"
              meta="Параметры комнаты"
              onClick={() => engine.chooseCalcMode("room")}
            />
            <OptionCard
              active={isObjectMode}
              title="Всю квартиру или дом"
              meta="Прикинуть бюджет"
              onClick={() => engine.chooseCalcMode("object")}
            />
          </div>
        </div>}

        {/* N-013 (F-10): плашка — только когда значение действительно пришло
            со страницы, и с указанием, что именно подставлено. */}
        {areaPrefillNote ? (
          <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200">
            {areaPrefillNote}
          </p>
        ) : null}

        <RangeField
          id="area-v2"
          label={isObjectMode ? "Общая площадь объекта" : "Площадь потолка"}
          value={room.area}
          min={1}
          max={isObjectMode ? 1000 : 200}
          step={1}
          unit="м²"
          valueText={`${room.area} квадратных метров`}
          onChange={v=>update({ area: v })}
          /* N-013 (F-13): пять значений вместо восьми — на mobile один ряд. */
          quickValues={isObjectMode ? [40, 60, 80, 100, 120] : [12, 15, 18, 22, 30]}
        />

        {/* (c) Название — свёрнуто. Нужно только когда комнат больше одной. */}
        <div className="mt-4">
          {nameOpen || isSecondRoom ? (
            <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <label htmlFor="room-label-v2" className="text-sm font-medium text-slate-700">
                Название помещения
              </label>
              <input
                id="room-label-v2"
                autoFocus={nameOpen}
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={localLabel}
                onChange={e=> { setLocalLabel(e.target.value); update({ label: localRoomLabelTrim(e.target.value) }); }}
                maxLength={60}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
                onBlur={()=> update({ label: localRoomLabelTrim(localLabel) })}
                placeholder="Например: Кухня-гостиная"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setNameOpen(true)}
              className="min-h-11 text-sm font-medium text-slate-700 underline underline-offset-4 hover:text-slate-950"
            >
              Назвать помещение (например, Кухня)
            </button>
          )}
        </div>
      </SectionCard>
    );
  }

  // The choices belong to this room, not to a global scenario tier.
  if (param === "ceiling") {
    return <SectionCard headingRef={headingRef} title="Тип потолка" description={editing
      ? "Измените решение этой комнаты. Метраж новых функций проверим после сохранения."
      : "Выберите примыкание и дополнительные решения. Их метраж уточним дальше."}>
      {prefillHint}{kitHint}<CeilingRoomOptions room={room} onChange={update} />
    </SectionCard>;
  }

  // CORNICE
  if (param === "cornice") {
    const corniceOpts = calculator.cornices;
    return (
      <SectionCard headingRef={headingRef} title="Карнизы">
        {prefillHint}
        {kitHint}
        {/*
          PT-040 · у «Скрытая ниша» есть настоящее фото (proof-04), у встроенного
          и накладного разделяющих кадров нет — вместо выдачи общего фото за
          конкретный подтип рисуем схемы сечения в одном ракурсе. «Без карниза» —
          осознанно текстом: иллюстрировать отсутствие нечем.
        */}
        <div className="grid gap-3 sm:grid-cols-2">
          {corniceOpts.map((o)=>{
            const image = showQuizStepImages("cornice") ? CORNICE_MEDIA[o.slug] : undefined;
            return (
              <OptionCard
                key={o.slug}
                active={room.corniceType===o.slug}
                title={o.label}
                meta={o.ratePerMeter>0 ? `от ${formatCurrency(o.ratePerMeter)} ₽ / м.п.` : "Без доп. расчёта"}
                onClick={()=>update({ corniceType: o.slug })}
                imageSrc={image?.src}
                imageAlt={image?.alt}
              />
            );
          })}
        </div>
        {showQuizStepImages("cornice") && room.corniceType!=="none" && room.corniceType!=="hidden-niche" ? (
          <p className="pk-caption">Разрез схематичный: показывает, встроен карниз в полотно или наложен на него; конкретную систему подберём после замера.</p>
        ) : null}
        {room.corniceType!=="none" && (
          <div className="mt-4 space-y-4">
            <RangeField id="cornice-v2" label="Длина карниза" value={room.corniceLength} min={1} max={50} step={1} unit="м.п." onChange={v=>update({corniceLength:v})} />
            <div className="grid gap-3 sm:grid-cols-2">
              <OptionCard active={!room.corniceLightingEnabled} title="Без подсветки" meta="Только карниз" icon={<BinaryChoiceIcon kind="cornice-light" enabled={false} />} onClick={()=>update({corniceLightingEnabled:false})} />
              <OptionCard active={!!room.corniceLightingEnabled} title="Добавить подсветку" meta={`+${formatCurrency(calculator.corniceLighting.ratePerMeter)} ₽/м.п. + блок ${formatCurrency(calculator.corniceLighting.powerSupplyRate)} ₽`} icon={<BinaryChoiceIcon kind="cornice-light" enabled />} onClick={()=>update({corniceLightingEnabled:true, corniceLightingLength: room.corniceLength, corniceLightingPowerSupplies:1})} />
            </div>
            {room.corniceLightingEnabled && <p className="pk-diagram-note">Количество блоков здесь влияет на предварительную стоимость, но не является подбором по мощности. Модель, нагрузку и управление нужно проверить на шаге «Свет».</p>}
            {room.corniceLightingEnabled && (
              <div className="grid gap-3 sm:grid-cols-2">
                <RangeField id="cl-len" label="Длина подсветки" value={room.corniceLightingLength ?? room.corniceLength} min={1} max={50} step={1} unit="м.п." onChange={v=>update({corniceLightingLength:v})} />
                <RangeField id="cl-psu" label="Блоки в предварительном расчёте" value={room.corniceLightingPowerSupplies ?? 1} min={1} max={10} step={1} unit="шт." onChange={v=>update({corniceLightingPowerSupplies:v})} quickValues={[1,2,3]} />
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
          {/*
            PT-042 · фото proof-03 показывает световые линии, поэтому стоит
            только у положительного варианта: у «без линий» иллюстрировать нечего.
          */}
          <OptionCard
            active={room.lightLinesEnabled}
            title="Добавить световые линии"
            meta={`от ${formatCurrency(calculator.lightLines.ratePerMeter)} ₽ / м.п.`}
            onClick={()=>update({lightLinesEnabled:true})}
            imageSrc={showQuizStepImages("lightLines") ? LIGHT_LINES_MEDIA.src : undefined}
            imageAlt={showQuizStepImages("lightLines") ? LIGHT_LINES_MEDIA.alt : undefined}
          />
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
          {trackOpts.map((o)=>{
            const image = showQuizStepImages("track") ? TRACK_MEDIA[o.slug] : undefined;
            return (
              <OptionCard
                key={o.slug}
                active={room.trackType===o.slug}
                title={o.label}
                meta={o.ratePerMeter>0?`от ${formatCurrency(o.ratePerMeter)} ₽ / м.п.`:"Без доп. расчёта"}
                onClick={()=>update({trackType:o.slug})}
                imageSrc={image?.src}
                imageAlt={image?.alt}
              />
            );
          })}
        </div>
        {showQuizStepImages("track") && room.trackType!=="none" ? (
          <p className="pk-caption">Обобщённые фото трека со страницы услуги здесь не используются: они не доказывают конкретный способ монтажа.</p>
        ) : null}
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
          <OptionCard active={!room.chandeliersEnabled} title="Не нужно" meta="Без поштучного расчёта" icon={<BinaryChoiceIcon kind="chandelier" enabled={false} />} onClick={()=>update({chandeliersEnabled:false})} />
          <OptionCard active={room.chandeliersEnabled} title="Добавить установку" meta={`${formatCurrency(pricing.chandelierInstall)} ₽ / шт.`} icon={<BinaryChoiceIcon kind="chandelier" enabled />} onClick={()=>update({chandeliersEnabled:true})} />
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
          <OptionCard active={!room.lightsEnabled} title="Без светильников" meta="Без поштучного расчёта" icon={<BinaryChoiceIcon kind="spotlight" enabled={false} />} onClick={()=>update({lightsEnabled:false})} />
          <OptionCard active={room.lightsEnabled} title="Добавить светильники" meta={`от ${formatCurrency(calculator.lights.ratePerUnit)} ₽ / шт`} icon={<BinaryChoiceIcon kind="spotlight" enabled />} onClick={()=>update({lightsEnabled:true})} />
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

function localRoomLabelTrim(s:string){ const t=s.trim().slice(0,60); return t || "Помещение"; }
