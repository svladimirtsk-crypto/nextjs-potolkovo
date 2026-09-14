/**
 * T-027 · zod-схема payload заявки (Приложение Б).
 *
 * Единственный источник правды о форме лида: используется в `/api/lead`
 * и в тестах. Клиент шлёт ровно эти поля.
 */
import { z } from "zod";

import { normalizeAttribution } from "@/lib/attribution";
import { isValidPhone, normalizePhone } from "@/lib/normalize-phone";

/**
 * Телефон валиден, если это +7 и 10 цифр либо международный +… 11-15 цифр.
 *
 * PT-004: правило переехало в `lib/normalize-phone.ts`, чтобы клиент
 * (основная форма и rescue-диалог) и сервер проверяли номер одной и той же
 * функцией. Реэкспорт оставлен — на него ссылается документация схемы.
 */
export { isValidPhone };

/**
 * PT-010 · Верхние границы чисел снапшота.
 *
 * Они заведомо выше любого значения, которое способен ввести человек в UI
 * (площадь — сотни м², метраж — десятки м, счётчики — десятки штук), поэтому
 * живую заявку не отсекают. Смысл другой: `area: 1e9` или `lightsCount: -1e15`
 * не должны доезжать до пересчёта и до БД, а до этой задачи доезжали — схема
 * проверяла только знак.
 */
const MAX_AREA_SQM = 10_000;
const MAX_LENGTH_METERS = 10_000;
const MAX_COUNT = 10_000;
const MAX_MONEY_RUB = 100_000_000;

const meters = z.number().nonnegative().max(MAX_LENGTH_METERS).nullable().optional();
const counters = z.number().int().nonnegative().max(MAX_COUNT).nullable().optional();

export const LeadRoomSnapshotSchema = z.object({
  id: z.string().max(64),
  label: z.string().max(80),
  area: z.number().nonnegative().max(MAX_AREA_SQM),
  totalRub: z.number().nonnegative().max(MAX_MONEY_RUB),
  ceilingTypeLabel: z.string().max(80),
  shadowLength: meters,
  floatingLength: meters,
  lightLinesLength: meters,
  corniceLabel: z.string().max(80).nullable().optional(),
  corniceLength: meters,
  corniceLightingLength: meters,
  trackLabel: z.string().max(80).nullable().optional(),
  trackLength: meters,
  lightsCount: counters,
  chandeliersCount: counters,

  /**
   * PT-010 · нормализованные параметры комнаты.
   *
   * Необязательные: снапшоты, собранные клиентом до этой задачи, их не
   * содержат. Серверный пересчёт (`lib/lead/server-recalc.ts`) при их
   * отсутствии восстанавливает конфиг по лейблам и помечает результат как
   * приблизительный.
   */
  ceilingType: z.enum(["standard", "shadow", "floating", "shadow-floating"]).optional(),
  shadowEnabled: z.boolean().optional(),
  floatingEnabled: z.boolean().optional(),
  lightLinesEnabled: z.boolean().optional(),
  corniceType: z.enum(["none", "built-in", "hidden-niche", "surface"]).optional(),
  corniceLightingEnabled: z.boolean().optional(),
  corniceLightingPowerSupplies: z.number().int().nonnegative().max(MAX_COUNT).nullable().optional(),
  trackType: z.enum(["none", "built-in", "surface"]).optional(),
  chandeliersEnabled: z.boolean().optional(),
  lightsEnabled: z.boolean().optional(),
});

/**
 * Единица измерения метражного товара в каталоге (`data/catalog-index.json`,
 * словарь `unit`): всё остальное продаётся штуками.
 */
export const METER_UNIT = "m";

export const LightingLeadItemSchema = z
  .object({
    sku: z.string().max(64),
    vendorCode: z.string().max(64).optional(),
    name: z.string().max(200),
    qty: z.number().nonnegative().max(MAX_COUNT),
    priceRub: z.number().nonnegative().max(MAX_MONEY_RUB),
    totalRub: z.number().nonnegative().max(MAX_MONEY_RUB).optional(),
    system: z.string().max(40).optional(),
    kind: z.string().max(40).optional(),
    unit: z.string().max(16).optional(),
    /** Позиция добавлена автоматикой комплектации, а не выбрана вручную. */
    auto: z.boolean().optional(),
  })
  /**
   * PT-010 · дробное количество штучного товара отклоняется.
   *
   * Клиент так сделать не может — `normalizeQty` в `use-lighting-cart.ts`
   * округляет штуки до целого, а метры до десятых. Значит дробные «2.5
   * светильника» приходят только из изменённого запроса, и принимать их как
   * цену нельзя. Единицу берём заявленную клиентом: это первичный фильтр,
   * авторитетную проверку по единице из каталога делает серверный пересчёт.
   */
  .superRefine((item, ctx) => {
    if (item.unit === METER_UNIT) return;
    if (Number.isInteger(item.qty)) return;

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["qty"],
      message: "Количество штучного товара должно быть целым",
    });
  });

export const LightingLeadBlockSchema = z.object({
  mode: z.string().max(32),
  items: z.array(LightingLeadItemSchema).max(200),
  regularTotalRub: z.number().nonnegative(),
  effectiveTotalRub: z.number().nonnegative(),
  discountMode: z.string().max(32),
  discountPercentApplied: z.number().nonnegative(),
  discountAmountRub: z.number().nonnegative(),
});

export const TotalsSchema = z.object({
  ceilingRaw: z.number().nonnegative().max(MAX_MONEY_RUB),
  minimumApplied: z.boolean(),
  installExtra: z.number().nonnegative().max(MAX_MONEY_RUB),
  lightingRegular: z.number().nonnegative().max(MAX_MONEY_RUB),
  lightingEffective: z.number().nonnegative().max(MAX_MONEY_RUB),
  discountPct: z.number().nonnegative().max(100),
  grand: z.number().nonnegative().max(MAX_MONEY_RUB),
});

export const LeadSnapshotV2Schema = z.object({
  version: z.literal(2),
  scenario: z.enum(["standard", "modern", "advanced"]),
  scope: z.enum(["room", "object"]),
  rooms: z.array(LeadRoomSnapshotSchema).max(30),
  lighting: LightingLeadBlockSchema.nullable(),
  totals: TotalsSchema,
  source: z.string().max(64),
  entry: z.enum(["ceiling-first", "lighting-first", "direct"]),
});

export const LeadPlacementSchema = z.enum([
  "home",
  "service-page",
  "modal",
  "rescue",
  "sticky",
]);

export const LeadKindSchema = z.enum(["direct", "calculator", "lighting-only", "rescue"]);

export const OrderIntentSchema = z.enum([
  "ceiling_only",
  "lighting_with_ceiling",
  "lighting_only",
  "advanced",
]);

export const LeadPayloadSchema = z.object({
  name: z.string().trim().max(80).optional(),
  phone: z
    .string()
    .transform((value) => normalizePhone(value))
    .refine(isValidPhone, { message: "Проверьте номер телефона" }),
  address: z.string().trim().max(160).optional(),
  preferredTime: z.enum(["today", "tomorrow_morning", "telegram"]).optional(),
  consent: z.literal(true),
  /** Honeypot: заполнено только ботом. */
  botcheck: z.literal("").optional(),

  /**
   * PT-009 · Ключ идемпотентности — один на попытку отправки.
   *
   * Необязательное намеренно: раздел 3.8 требует совместимости API на время
   * миграции (`expand → migrate → switch → contract`), а собранный до деплоя
   * клиентский JS в браузере посетителя ещё какое-то время шлёт запросы без
   * этого поля. Делать его обязательным сразу — значит получить волну `422` от
   * живых людей на уже открытых страницах. Без `requestId` работает прежняя
   * защита: дедуп по телефону и отпечатку payload.
   */
  requestId: z.string().trim().min(8).max(64).optional(),

  source: z.string().max(64),
  placement: LeadPlacementSchema,
  pagePath: z.string().max(200).default(""),
  serviceSlug: z.string().max(64).optional(),

  leadKind: LeadKindSchema,
  orderIntent: OrderIntentSchema.default("ceiling_only"),

  /**
   * PT-012 · Атрибуция нормализуется мягко, а не отклоняется.
   *
   * Прежняя схема `z.record(z.string(), z.string().max(200))` требовала, чтобы
   * каждое значение уложилось в 200 символов, и длинная рекламная ссылка в
   * `first_landing`/`first_referrer` валила весь запрос в `422`: заявка терялась
   * из-за поля, без которого она полноценна. Теперь значение проходит через
   * `normalizeAttribution` — allowlist ключей, лимит 2048 на URL целиком, снятый
   * фрагмент и выброшенные не-UTM параметры (включая персональные). Битый клиент
   * (строка или массив вместо объекта) даёт пустой словарь, а не отказ.
   */
  attribution: z
    .unknown()
    .default({})
    .transform((value) => normalizeAttribution(value)),
  snapshot: LeadSnapshotV2Schema.optional(),
  totals: TotalsSchema.optional(),
  /** Короткий rescue-лид присылает только сумму. */
  grandTotal: z.number().nonnegative().optional(),
});

export type LeadPayload = z.infer<typeof LeadPayloadSchema>;
export type LeadRoomSnapshot = z.infer<typeof LeadRoomSnapshotSchema>;
export type LightingLeadItem = z.infer<typeof LightingLeadItemSchema>;
export type LightingLeadBlock = z.infer<typeof LightingLeadBlockSchema>;
export type LeadTotals = z.infer<typeof TotalsSchema>;
export type LeadSnapshotV2 = z.infer<typeof LeadSnapshotV2Schema>;
