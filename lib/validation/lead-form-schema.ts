import { z } from "zod";

export const leadFormSchema = z.object({
  name: z
    .string()
    .min(1, "Укажите имя.")
    .max(80, "Слишком длинное имя."),
  phone: z
    .string()
    .regex(/^\+\d{10,15}$/, "Укажите корректный телефон."),
  address: z
    .string()
    .max(160, "Слишком длинный адрес или район.")
    .optional(),
  company: z.string().max(0).optional(),
  calculatorSnapshot: z
    .string()
    .max(4000, "Слишком большой объём данных калькулятора.")
    .optional(),
});

export const calculatorSnapshotSchema = z.object({
  area: z.number().positive(),
  ceilingTypeLabel: z.string().min(1).max(120),
  ceilingBaseRate: z.number().nonnegative(),
  ceilingBaseTotal: z.number().nonnegative(),

  ceilingExtraLabel: z.string().max(120).nullable(),
  ceilingLength: z.number().nonnegative().nullable(),
  ceilingExtraRatePerMeter: z.number().nonnegative().nullable(),
  ceilingExtraTotal: z.number().nonnegative(),

  corniceLabel: z.string().max(120).nullable(),
  corniceLength: z.number().nonnegative().nullable(),
  corniceRatePerMeter: z.number().nonnegative().nullable(),
  corniceTotal: z.number().nonnegative(),

  trackLabel: z.string().max(120).nullable(),
  trackLength: z.number().nonnegative().nullable(),
  trackRatePerMeter: z.number().nonnegative().nullable(),
  trackTotal: z.number().nonnegative(),

  lightsEnabled: z.boolean(),
  lightsCount: z.number().nonnegative().nullable(),
  lightsRatePerUnit: z.number().nonnegative(),
  lightsTotal: z.number().nonnegative(),

  total: z.number().nonnegative(),
});

export type LeadFormValues = z.infer<typeof leadFormSchema>;
export type CalculatorSnapshotValues = z.infer<typeof calculatorSnapshotSchema>;
