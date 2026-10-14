"use client";
import type { RoomConfig } from "@/lib/calculator/use-calculator-engine";

export function RoomContext({ rooms, roomId, status, editing, onSelect, onOverview }: {
  rooms: readonly RoomConfig[]; roomId?: string; status?: string; editing: boolean;
  onSelect: (id: string) => void; onOverview?: () => void;
}) {
  if (!rooms.length) return null;
  const index = rooms.findIndex(room => room.id === roomId);
  const room = rooms[index];
  return <div className="pk-room-context" data-testid="room-context">
    <div className="pk-room-context-copy">
      <small>{room ? `Помещение ${index + 1} из ${rooms.length}` : "Помещения в расчёте"}</small>
      <strong>{room?.label ?? `${rooms.length} в расчёте`}</strong>
      {status && <span>{status}</span>}
    </div>
    {rooms.length > 1 && !editing && <label className="sr-only" htmlFor="calc-room-switch">Переключить помещение</label>}
    {rooms.length > 1 && !editing && <select id="calc-room-switch" value={roomId ?? ""} disabled={editing}
      onChange={e => { if (e.target.value) onSelect(e.target.value); }}>
      <option value="" disabled>Выбрать помещение</option>
      {rooms.map((r, i) => <option key={r.id} value={r.id}>{i + 1}. {r.label}</option>)}
    </select>}
    {!editing && onOverview && <button type="button" onClick={onOverview}>К помещениям</button>}
    {editing && <span className="pk-room-context-edit">Правка до сохранения</span>}
  </div>;
}
