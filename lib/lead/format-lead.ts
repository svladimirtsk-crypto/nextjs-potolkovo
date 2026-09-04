/**
 * T-027 · Единый формат письма/сообщения по заявке.
 *
 * Один текст используется и для Telegram, и для письма — чтобы мастер видел
 * одинаковую структуру независимо от канала.
 */
import type { LeadPayload } from "./schema";

function fmt(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(Math.round(value)).replace(/\u00a0/g, " ");
}

const INTENT_LABELS: Record<string, string> = {
  ceiling_only: "Потолок",
  lighting_with_ceiling: "Потолок + свет",
  lighting_only: "Только свет",
  advanced: "Дизайнерский проект",
};

const PREFERRED_TIME_LABELS: Record<string, string> = {
  today: "сегодня",
  tomorrow_morning: "завтра утром",
  telegram: "написать в Telegram",
};

const KIND_LABELS: Record<string, string> = {
  direct: "прямая заявка",
  calculator: "из калькулятора",
  "lighting-only": "только освещение",
  rescue: "спасение расчёта",
};

/** Тема письма: `Заявка · {intent} · ~{grand} ₽ · {name} · {phone}`. */
export function formatLeadSubject(payload: LeadPayload): string {
  const intent = INTENT_LABELS[payload.orderIntent] ?? payload.orderIntent;
  const grand = payload.snapshot?.totals.grand ?? payload.totals?.grand ?? payload.grandTotal ?? 0;
  const name = payload.name?.trim() || "без имени";
  return `Заявка · ${intent} · ~${fmt(grand)} ₽ · ${name} · ${payload.phone}`;
}

/** Тело заявки: контакт, атрибуция, потолок по комнатам, свет, итог. */
export function formatLeadBody(payload: LeadPayload, leadCode?: string): string {
  const lines: string[] = [];

  if (leadCode) lines.push(`Заявка №${leadCode}`, "");

  lines.push("КОНТАКТ");
  lines.push(`Имя: ${payload.name?.trim() || "—"}`);
  lines.push(`Телефон: ${payload.phone}`);
  if (payload.address?.trim()) lines.push(`Адрес: ${payload.address.trim()}`);
  if (payload.preferredTime) {
    lines.push(`Когда удобно: ${PREFERRED_TIME_LABELS[payload.preferredTime] ?? payload.preferredTime}`);
  }

  lines.push("", "ИСТОЧНИК И АТРИБУЦИЯ");
  lines.push(`Источник: ${payload.source}`);
  lines.push(`Место: ${payload.placement}`);
  lines.push(`Тип заявки: ${KIND_LABELS[payload.leadKind] ?? payload.leadKind}`);
  lines.push(`Интент: ${INTENT_LABELS[payload.orderIntent] ?? payload.orderIntent}`);
  if (payload.pagePath) lines.push(`Страница: ${payload.pagePath}`);
  if (payload.serviceSlug) lines.push(`Услуга: ${payload.serviceSlug}`);
  const attribution = Object.entries(payload.attribution ?? {});
  if (attribution.length > 0) {
    for (const [key, value] of attribution) lines.push(`${key}: ${value}`);
  }

  const snapshot = payload.snapshot;

  if (snapshot && snapshot.rooms.length > 0) {
    lines.push("", "ПОТОЛОК ПО КОМНАТАМ");
    for (const room of snapshot.rooms) {
      lines.push(`${room.label} · ${room.area} м² · ${room.ceilingTypeLabel} · ${fmt(room.totalRub)} ₽`);
      const nodes: string[] = [];
      if (room.shadowLength) nodes.push(`теневой · ${room.shadowLength} м.п.`);
      if (room.floatingLength) nodes.push(`парящий · ${room.floatingLength} м.п.`);
      if (room.lightLinesLength) nodes.push(`световые линии · ${room.lightLinesLength} м.п.`);
      if (room.corniceLength && room.corniceLabel) {
        nodes.push(`${room.corniceLabel.toLowerCase()} · ${room.corniceLength} м.п.`);
      }
      if (room.corniceLightingLength) nodes.push(`подсветка карниза · ${room.corniceLightingLength} м.п.`);
      if (room.trackLength && room.trackLabel) {
        nodes.push(`${room.trackLabel.toLowerCase()} · ${room.trackLength} м.п.`);
      }
      if (room.lightsCount) nodes.push(`точки · ${room.lightsCount} шт.`);
      if (room.chandeliersCount) nodes.push(`люстры · ${room.chandeliersCount} шт.`);
      for (const node of nodes) lines.push(`  – ${node}`);
    }
    if (snapshot.totals.minimumApplied) {
      lines.push("  ! применён минимальный заказ");
    }
  }

  if (snapshot && snapshot.totals.installExtra > 0) {
    lines.push("", "МОНТАЖ СВЕТА");
    lines.push(`Досчёт монтажа: ${fmt(snapshot.totals.installExtra)} ₽`);
  }

  const lighting = snapshot?.lighting;
  if (lighting && lighting.items.length > 0) {
    const manual = lighting.items.filter((item) => !item.auto);
    const auto = lighting.items.filter((item) => item.auto);

    lines.push("", "СВЕТ");
    lines.push("Артикул · Название · Кол-во · Цена · Сумма");
    for (const item of manual) {
      const total = item.totalRub ?? item.qty * item.priceRub;
      lines.push(
        `${item.vendorCode ?? item.sku} · ${item.name} · ${item.qty} ${item.unit ?? "шт."} · ${fmt(item.priceRub)} ₽ · ${fmt(total)} ₽`
      );
    }
    if (auto.length > 0) {
      lines.push("", "Добавлено автоматически:");
      for (const item of auto) {
        const total = item.totalRub ?? item.qty * item.priceRub;
        lines.push(
          `${item.vendorCode ?? item.sku} · ${item.name} · ${item.qty} ${item.unit ?? "шт."} · ${fmt(item.priceRub)} ₽ · ${fmt(total)} ₽`
        );
      }
    }
    lines.push(`Свет без скидки: ${fmt(lighting.regularTotalRub)} ₽`);
    if (lighting.discountAmountRub > 0) {
      lines.push(
        `Скидка ${lighting.discountPercentApplied}%: −${fmt(lighting.discountAmountRub)} ₽ → ${fmt(lighting.effectiveTotalRub)} ₽`
      );
    }
  }

  const totals = snapshot?.totals ?? payload.totals;
  lines.push("", "ИТОГО");
  if (totals) {
    lines.push(`Потолок: ${fmt(totals.ceilingRaw)} ₽`);
    if (totals.installExtra > 0) lines.push(`Монтаж света: ${fmt(totals.installExtra)} ₽`);
    if (totals.lightingEffective > 0) lines.push(`Свет: ${fmt(totals.lightingEffective)} ₽`);
    lines.push(`Общий ориентир: ~${fmt(totals.grand)} ₽`);
  } else if (payload.grandTotal) {
    lines.push(`Общий ориентир: ~${fmt(payload.grandTotal)} ₽`);
  } else {
    lines.push("Расчёт не приложен — уточнить по телефону.");
  }

  return lines.join("\n");
}

/** HTML-версия для Telegram (`parse_mode: HTML`) — экранируем только спецсимволы. */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function formatLeadForTelegram(payload: LeadPayload, leadCode?: string): string {
  const subject = formatLeadSubject(payload);
  const body = formatLeadBody(payload, leadCode);
  return `<b>${escapeHtml(subject)}</b>\n<pre>${escapeHtml(body)}</pre>`;
}
