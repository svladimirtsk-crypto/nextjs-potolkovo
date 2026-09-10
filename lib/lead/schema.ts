/**
 * T-027 · zod-схема payload заявки (Приложение Б).
 *
 * Единственный источник правды о форме лида: используется в `/api/lead`
 * и в тестах. Клиент шлёт ровно эти поля.
 */
import { z } from "zod";

import { normalizePhone } from "@/lib/normalize-phone";

/** Телефон валиден, если это +7 и 10 цифр либо международный +… 11-15 цифр. */
export function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11 && (digits.startsWith("7") || digits.startsWith("8"))) return true;
  return digits.length >= 11 && digits.length <= 15;
}

export const LeadRoomSnapshotSchema = z.object({
  id: z.string().max(64),
  label: z.string().max(80),
  area: z.number().nonnegative(),
  totalRub: z.number().nonnegative(),
  ceilingTypeLabel: z.string().max(80),
  shadowLength: z.number().nullable().optional(),
  floatingLength: z.number().nullable().optional(),
  lightLinesLength: z.number().nullable().optional(),
  corniceLabel: z.string().max(80).nullable().optional(),
  corniceLength: z.number().nullable().optional(),
  corniceLightingLength: z.number().nullable().optional(),
  trackLabel: z.string().max(80).nullable().optional(),
  trackLength: z.number().nullable().optional(),
  lightsCount: z.number().nullable().optional(),
  chandeliersCount: z.number().nullable().optional(),
});

export const LightingLeadItemSchema = z.object({
  sku: z.string().max(64),
  vendorCode: z.string().max(64).optional(),
  name: z.string().max(200),
  qty: z.number().nonnegative(),
  priceRub: z.number().nonnegative(),
  totalRub: z.number().nonnegative().optional(),
  system: z.string().max(40).optional(),
  kind: z.string().max(40).optional(),
  unit: z.string().max(16).optional(),
  /** Позиция добавлена автоматикой комплектации, а не выбрана вручную. */
  auto: z.boolean().optional(),
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
  ceilingRaw: z.number().nonnegative(),
  minimumApplied: z.boolean(),
  installExtra: z.number().nonnegative(),
  lightingRegular: z.number().nonnegative(),
  lightingEffective: z.number().nonnegative(),
  discountPct: z.number().nonnegative(),
  grand: z.number().nonnegative(),
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

  source: z.string().max(64),
  placement: LeadPlacementSchema,
  pagePath: z.string().max(200).default(""),
  serviceSlug: z.string().max(64).optional(),

  leadKind: LeadKindSchema,
  orderIntent: OrderIntentSchema.default("ceiling_only"),

  attribution: z.record(z.string(), z.string().max(200)).default({}),
  snapshot: LeadSnapshotV2Schema.optional(),
  totals: TotalsSchema.optional(),
  /** Короткий rescue-лид присылает только сумму. */
  grandTotal: z.number().nonnegative().optional(),
});

export type LeadPayload = z.infer<typeof LeadPayloadSchema>;
export type LightingLeadItem = z.infer<typeof LightingLeadItemSchema>;
