"use client";
import type { RoomConfig } from "@/lib/calculator/use-calculator-engine";
import { setCeilingFeature, setTrackFeature } from "@/lib/calculator/room-features";
import { CeilingOption } from "./ceiling-option";
import { formatFrom, pricing } from "@/content/pricing";
const rub = (n: number) => new Intl.NumberFormat("ru-RU").format(n);

export function CeilingRoomOptions({ room, onChange }: { room: RoomConfig; onChange: (patch: Partial<RoomConfig>) => void }) {
  return <>
    <div className="pk-ceiling-options">
      <CeilingOption active={!room.shadowEnabled && !room.floatingEnabled} kind="standard" title="Простой потолок"
        description="Ровное полотно. Привычное примыкание к стене." price={formatFrom(pricing.ceiling.standard, "м²")}
        onClick={() => onChange({ ceilingType: "standard", shadowEnabled: false, floatingEnabled: false })} />
      <CeilingOption active={room.shadowEnabled} kind="shadow" title="Теневой потолок"
        description="Чёткая линия по контуру, без потолочного плинтуса."
        price={`${rub(pricing.ceiling.shadowBase)} ₽ / м² + ${rub(pricing.ceiling.shadowProfilePerM)} ₽ / м.п.`}
        onClick={() => onChange(setCeilingFeature(room, "shadow", !room.shadowEnabled))} />
      <CeilingOption active={room.floatingEnabled} kind="floating" title="Парящий потолок"
        description="Подсвеченный контур. Ленту, питание и управление нужно подобрать отдельно."
        price={`${rub(pricing.ceiling.floatingBase)} ₽ / м² + ${rub(pricing.ceiling.floatingProfilePerM)} ₽ / м.п.`}
        onClick={() => onChange(setCeilingFeature(room, "floating", !room.floatingEnabled))} />
    </div>
    <p className="pk-diagram-note">Теневой и парящий профиль можно сочетать на разных участках. Это выбор для текущего помещения; другие комнаты не изменятся. Изображения — схемы.</p>
    <fieldset className="pk-room-features">
      <legend>Дополнительные решения в этой комнате</legend>
      <label>
        <input type="checkbox" checked={room.lightLinesEnabled} onChange={e => onChange({ lightLinesEnabled: e.target.checked })} />
        <span><b>Световые линии</b><small>Длину уточним отдельным вопросом. Действующая ставка — {formatFrom(pricing.lightLinesPerM, "м.п.")}.</small></span>
      </label>
      <label>
        <input type="checkbox" checked={room.trackType !== "none"} onChange={e => onChange(setTrackFeature(room, e.target.checked))} />
        <span><b>Трековое освещение</b><small>Выберем способ монтажа и метраж. Оборудование — на шаге «Свет».</small></span>
      </label>
      <p>Линии и трек доступны с любым потолком. Переключатели включают выбранное решение в предварительный расчёт по текущим параметрам; длину нужно подтвердить. Карниз и подсветку выберем дальше.</p>
    </fieldset>
  </>;
}
