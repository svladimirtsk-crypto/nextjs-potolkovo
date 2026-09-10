/**
 * T-005 · Человеческие подписи вместо технических слагов.
 * Единственное место, где слаг превращается в текст для клиента.
 */
import { pricing } from "@/content/pricing";
import type { V2RoomConfig } from "./room-snapshot";

export const SCENARIO_LABELS: Record<string, string> = {
  standard: "Базовый сценарий",
  modern: "Современный сценарий",
  advanced: "Дизайнерский сценарий",
};

export const CEILING_LABELS: Record<string, string> = {
  standard: "Простой потолок",
  shadow: "Теневой потолок",
  floating: "Парящий потолок",
  "shadow-floating": "Теневой и парящий потолок",
};

export const CORNICE_LABELS: Record<string, string> = {
  none: "Без карниза",
  "built-in": "Встроенный карниз",
  "hidden-niche": "Скрытая ниша",
  surface: "Накладной карниз",
};

export const TRACK_LABELS: Record<string, string> = {
  none: "Без трека",
  "built-in": "Встроенный трек",
  surface: "Накладной трек",
};

export function scenarioLabel(slug: string | null | undefined): string {
  return SCENARIO_LABELS[String(slug ?? "standard")] ?? SCENARIO_LABELS.standard;
}

export function ceilingLabel(slug: string | null | undefined): string {
  return CEILING_LABELS[String(slug ?? "standard")] ?? CEILING_LABELS.standard;
}

export function corniceLabel(slug: string | null | undefined): string {
  return CORNICE_LABELS[String(slug ?? "none")] ?? CORNICE_LABELS.none;
}

export function trackLabel(slug: string | null | undefined): string {
  return TRACK_LABELS[String(slug ?? "none")] ?? TRACK_LABELS.none;
}

export type RoomLine = { label: string; value: string; amountRub: number };

const nf = new Intl.NumberFormat("ru-RU");
const rub = (v: number) => `${nf.format(Math.round(v))} ₽`;

/** Полный состав комнаты: все включённые узлы с метрами и суммой. */
export function describeRoom(
  room: V2RoomConfig,
  price: typeof pricing = pricing
): { lines: RoomLine[]; totalRub: number } {
  const lines: RoomLine[] = [];
  const hasSpecial = room.shadowEnabled || room.floatingEnabled;
  const baseRate = hasSpecial ? price.ceiling.shadowBase : price.ceiling.standard;

  lines.push({
    label: ceilingLabel(room.ceilingType),
    value: `${room.area} м²`,
    amountRub: room.area * baseRate,
  });

  if (room.shadowEnabled && room.shadowLength > 0) {
    lines.push({
      label: "Теневой профиль",
      value: `${room.shadowLength} м.п.`,
      amountRub: room.shadowLength * price.ceiling.shadowProfilePerM,
    });
  }

  if (room.floatingEnabled && room.floatingLength > 0) {
    lines.push({
      label: "Парящий профиль",
      value: `${room.floatingLength} м.п.`,
      amountRub: room.floatingLength * price.ceiling.floatingProfilePerM,
    });
  }

  if (room.lightLinesEnabled && room.lightLinesLength > 0) {
    lines.push({
      label: "Световые линии",
      value: `${room.lightLinesLength} м.п.`,
      amountRub: room.lightLinesLength * price.lightLinesPerM,
    });
  }

  const corniceRate =
    room.corniceType === "built-in"
      ? price.cornice.builtIn
      : room.corniceType === "hidden-niche"
        ? price.cornice.hiddenNiche
        : room.corniceType === "surface"
          ? price.cornice.surface
          : 0;

  if (corniceRate > 0 && room.corniceLength > 0) {
    lines.push({
      label: corniceLabel(room.corniceType),
      value: `${room.corniceLength} м.п.`,
      amountRub: room.corniceLength * corniceRate,
    });
  }

  if (room.corniceLightingEnabled && room.corniceType !== "none") {
    const meters = room.corniceLightingLength || room.corniceLength;
    if (meters > 0) {
      lines.push({
        label: "Подсветка карниза",
        value: `${meters} м.п.`,
        amountRub: meters * price.corniceLighting.perM,
      });
    }
    const psu = room.corniceLightingPowerSupplies ?? 1;
    if (psu > 0) {
      lines.push({
        label: "Блок питания подсветки",
        value: `${psu} шт.`,
        amountRub: psu * price.corniceLighting.psu,
      });
    }
  }

  const trackRate =
    room.trackType === "built-in"
      ? price.track.builtInPerM
      : room.trackType === "surface"
        ? price.track.surfacePerM
        : 0;

  if (trackRate > 0 && room.trackLength > 0) {
    lines.push({
      label: trackLabel(room.trackType),
      value: `${room.trackLength} м.п.`,
      amountRub: room.trackLength * trackRate,
    });
  }

  if (room.chandeliersEnabled && room.chandeliersCount > 0) {
    lines.push({
      label: "Установка люстр",
      value: `${room.chandeliersCount} шт.`,
      amountRub: room.chandeliersCount * price.chandelierInstall,
    });
  }

  if (room.lightsEnabled && room.lightsCount > 0) {
    lines.push({
      label: "Монтаж точечных светильников",
      value: `${room.lightsCount} шт.`,
      amountRub: room.lightsCount * price.spotInstall,
    });
  }

  const totalRub = lines.reduce((s, l) => s + l.amountRub, 0);
  return { lines, totalRub };
}

/** «Теневой профиль · 17 м.п. · 16 150 ₽» */
export function formatRoomLine(line: RoomLine): string {
  return `${line.label} · ${line.value} · ${rub(line.amountRub)}`;
}

export function pluralizeRooms(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "помещение";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "помещения";
  return "помещений";
}
