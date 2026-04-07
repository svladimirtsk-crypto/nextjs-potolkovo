import { z } from "zod";

export const leadFormSchema = z.object({
  name: z
    .string()
    .min(1, "Укажите имя.")
    .max(80, "Слишком длинное имя."),
  phone: z
    .string()
    .regex(/^\+\d{10,15}$/, "Укажите корректный телефон."),
  company: z.string().max(0).optional(),
});

export type LeadFormValues = z.infer<typeof leadFormSchema>;
