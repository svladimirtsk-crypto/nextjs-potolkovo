// file: lib/schemas.ts

import { z } from "zod";

// ---------- Enums ----------
const roomTypeEnum = z.enum([
  "kitchen",
  "bedroom",
  "living",
  "bathroom",
  "corridor",
  "children",
  "office",
  "commercial",
]);

const priorityEnum = z.enum([
  "practical",
  "modern",
  "max-light",
  "min-height-loss",
  "design",
  "hidden-light",
]);

const lightingNeedEnum = z.enum([
  "standard",
  "tracks",
  "light-lines",
  "perimeter",
  "cornice-niche",
  "unsure",
]);

const concernEnum = z.enum([
  "low-ceiling",
  "low-light",
  "unsure-choice",
  "want-modern",
  "complex-geometry",
  "wet-room",
  "clean-minimal",
]);

const budgetEnum = z.enum(["basic", "medium", "premium", "unsure"]);

const sourceIntentEnum = z.enum([
  "lighting",
  "price",
  "low-height",
  "technical",
  "general",
]);

// ---------- Scenario 1 Input ----------
export const roomSelectionSchema = z.object({
  scenario: z.literal("room-selection"),
  roomType: roomTypeEnum,
  area: z.number().min(1).max(500),
  ceilingHeight: z.number().min(200).max(600),
  priority: priorityEnum,
  lightingNeed: lightingNeedEnum,
  concern: concernEnum,
  budget: budgetEnum,
  contact: z.string().optional(),
  sourceIntent: sourceIntentEnum,
  utmTerm: z.string().optional(),
  utmContent: z.string().optional(),
  utmCampaign: z.string().optional(),
});

// ---------- Scenario 2 Input ----------
export const techQuestionSchema = z.object({
  scenario: z.literal("tech-question"),
  question: z.string().min(5).max(1000),
  roomType: roomTypeEnum.optional(),
  ceilingHeight: z.number().min(200).max(600).optional(),
  details: z.string().max(1000).optional(),
  budget: budgetEnum.optional(),
  contact: z.string().optional(),
  sourceIntent: sourceIntentEnum,
  utmTerm: z.string().optional(),
  utmContent: z.string().optional(),
  utmCampaign: z.string().optional(),
});

// ---------- Discriminated Union ----------
export const advisorInputSchema = z.discriminatedUnion("scenario", [
  roomSelectionSchema,
  techQuestionSchema,
]);

// ---------- Output ----------
export const priceOptionSchema = z.object({
  name: z.string(),
  priceFrom: z.string(),
  description: z.string(),
});

export const roomSelectionOutputSchema = z.object({
  scenario: z.literal("room-selection"),
  intent: z.string(),
  quickSummary: z.string(),
  recommendedSolution: z.object({
    ceilingType: z.string(),
    texture: z.string(),
    profile: z.string(),
    lighting: z.string(),
    heightLoss: z.string(),
  }),
  whyItFits: z.array(z.string()),
  whatToConsider: z.array(z.string()),
  priceOptions: z.array(priceOptionSchema),
  nextStep: z.string(),
});

export const techQuestionOutputSchema = z.object({
  scenario: z.literal("tech-question"),
  intent: z.string(),
  shortAnswer: z.string(),
  recommendedOptions: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
    })
  ),
  whatToConsider: z.array(z.string()),
  estimatedImpact: z.object({
    heightLoss: z.string(),
    budgetNote: z.string(),
  }),
  nextStep: z.string(),
});

export const advisorOutputSchema = z.discriminatedUnion("scenario", [
  roomSelectionOutputSchema,
  techQuestionOutputSchema,
]);
