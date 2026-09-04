/**
 * T-026 · Приложение Г — deep-link в Telegram с компактным расчётом.
 *
 * Текст ≤ 300 символов; если `leadId` нет — без номера расчёта.
 */
import type { CalculatorRoomBreakdown } from "@/components/home/price-calculator-context";

export const TELEGRAM_USERNAME = "potolkovo_msk";

/** Максимальная длина текста в deep-link (Приложение Г). */
export const TELEGRAM_TEXT_MAX = 300;

export type TelegramSummaryInput = {
  leadId?: string | number | null;
  rooms: CalculatorRoomBreakdown[];
  totalArea: number;
  lightingTotalRub?: number;
  grandTotalRub: number;
};

function fmt(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(Math.round(value)).replace(/\u00a0/g, " ");
}

function pluralizeRooms(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "комната";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "комнаты";
  return "комнат";
}

/** Компактное описание расчёта для мессенджера. */
export function buildTelegramSummaryText(input: TelegramSummaryInput): string {
  const parts: string[] = [];

  if (input.rooms.length > 0) {
    parts.push(`${input.rooms.length} ${pluralizeRooms(input.rooms.length)}`);
  }
  if (input.totalArea > 0) parts.push(`${fmt(input.totalArea)} м²`);

  const shadow = input.rooms.find((room) => Number(room.shadowLength) > 0);
  if (shadow) parts.push(`теневой ${fmt(Number(shadow.shadowLength))} м.п.`);

  const track = input.rooms.find((room) => Number(room.trackLength) > 0);
  if (track) parts.push(`трек ${fmt(Number(track.trackLength))} м`);

  if (Number(input.lightingTotalRub) > 0) {
    parts.push(`свет ${fmt(Number(input.lightingTotalRub))} ₽`);
  }
  if (input.grandTotalRub > 0) parts.push(`итого ~${fmt(input.grandTotalRub)} ₽`);

  const code = input.leadId ? `Расчёт №${input.leadId} с сайта` : "Расчёт с сайта";
  const body = parts.length ? `: ${parts.join(", ")}` : "";
  const text = `Здравствуйте! ${code}${body}. Хочу уточнить.`;

  if (text.length <= TELEGRAM_TEXT_MAX) return text;
  return `${text.slice(0, TELEGRAM_TEXT_MAX - 1).trimEnd()}…`;
}

/** Полная ссылка `https://t.me/potolkovo_msk?text=…`. */
export function buildTelegramDeepLink(input: TelegramSummaryInput): string {
  const text = buildTelegramSummaryText(input);
  return `https://t.me/${TELEGRAM_USERNAME}?text=${encodeURIComponent(text)}`;
}
