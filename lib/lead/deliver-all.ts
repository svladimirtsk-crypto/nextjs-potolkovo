/**
 * PT-003 · Доставка заявки по всем каналам.
 *
 * Вынесено из `app/api/lead/route.ts`, чтобы обработчик запроса и крон
 * повторной доставки использовали один и тот же код. Раньше логика жила
 * прямо в маршруте, и ретрай повторял её своей копией.
 *
 * Модуль ничего не решает про то, ждать доставку или нет — это выбор
 * вызывающего. `/api/lead` не ждёт (клиенту важно «сохранено»), крон ждёт.
 */
import { deliverToTelegram } from "@/lib/lead/deliver-telegram";
import { deliverToWeb3Forms } from "@/lib/lead/deliver-web3forms";
import type { LeadPayload } from "@/lib/lead/schema";
import type { DeliveryChannel, LeadStore } from "@/lib/lead/store-types";

/**
 * Каналы, по которым уходит каждая заявка.
 *
 * Задания на них создаются в одной транзакции с лидом, поэтому список должен
 * быть постоянным: канал, добавленный только в момент отправки, не получит
 * задания и не будет повторён при сбое.
 */
export const DELIVERY_CHANNELS: readonly DeliveryChannel[] = ["telegram", "web3forms"];

/** Отправка по одному каналу; результат приводится к общему виду. */
async function deliverOne(
  channel: DeliveryChannel,
  payload: LeadPayload,
  publicCode: string
): Promise<{ ok: boolean; error?: string }> {
  if (channel === "telegram") return deliverToTelegram(payload, publicCode);
  if (channel === "web3forms") return deliverToWeb3Forms(payload, publicCode);

  // Неизвестный канал — не молчаливый успех: иначе задание закроется как
  // отправленное, а сообщение никуда не уйдёт.
  return { ok: false, error: `неизвестный канал доставки: ${channel}` };
}

export type DeliverAllResult = {
  sent: DeliveryChannel[];
  failed: DeliveryChannel[];
};

/**
 * Отправляет заявку во все каналы и записывает исход каждого.
 *
 * Каналы идут параллельно: они независимы, и падение Telegram не должно
 * задерживать дубль на почту. Статус пишется по факту каждой попытки —
 * `sent` закрывает задание, `failed` оставляет его крону.
 */
export async function deliverAll(
  store: LeadStore,
  leadId: number,
  payload: LeadPayload,
  publicCode: string,
  channels: readonly DeliveryChannel[] = DELIVERY_CHANNELS
): Promise<DeliverAllResult> {
  const results = await Promise.all(
    channels.map(async (channel) => {
      const result = await deliverOne(channel, payload, publicCode);

      await store.recordDelivery(
        leadId,
        channel,
        result.ok ? "sent" : "failed",
        result.ok ? undefined : result.error
      );

      return { channel, ok: result.ok };
    })
  );

  return {
    sent: results.filter((r) => r.ok).map((r) => r.channel),
    failed: results.filter((r) => !r.ok).map((r) => r.channel),
  };
}
