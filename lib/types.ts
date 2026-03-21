// file: lib/types.ts

export type SourceIntent =
  | "lighting"
  | "price"
  | "low-height"
  | "technical"
  | "general";

export type RoomType =
  | "kitchen"
  | "bedroom"
  | "living"
  | "bathroom"
  | "corridor"
  | "children"
  | "office"
  | "commercial";

export type Priority =
  | "practical"
  | "modern"
  | "max-light"
  | "min-height-loss"
  | "design"
  | "hidden-light";

export type LightingNeed =
  | "standard"
  | "tracks"
  | "light-lines"
  | "perimeter"
  | "cornice-niche"
  | "unsure";

export type Concern =
  | "low-ceiling"
  | "low-light"
  | "unsure-choice"
  | "want-modern"
  | "complex-geometry"
  | "wet-room"
  | "clean-minimal";

export type BudgetLevel = "basic" | "medium" | "premium" | "unsure";

// ---------- Scenario 1 Input ----------
export interface RoomSelectionInput {
  scenario: "room-selection";
  roomType: RoomType;
  area: number;
  ceilingHeight: number;
  priority: Priority;
  lightingNeed: LightingNeed;
  concern: Concern;
  budget: BudgetLevel;
  contact?: string;
  sourceIntent: SourceIntent;
  utmTerm?: string;
  utmContent?: string;
  utmCampaign?: string;
}

// ---------- Scenario 2 Input ----------
export interface TechQuestionInput {
  scenario: "tech-question";
  question: string;
  roomType?: RoomType;
  ceilingHeight?: number;
  details?: string;
  budget?: BudgetLevel;
  contact?: string;
  sourceIntent: SourceIntent;
  utmTerm?: string;
  utmContent?: string;
  utmCampaign?: string;
}

export type AdvisorInput = RoomSelectionInput | TechQuestionInput;

// ---------- Scenario 1 Output ----------
export interface PriceOption {
  name: string;
  priceFrom: string;
  description: string;
}

export interface RoomSelectionOutput {
  scenario: "room-selection";
  intent: string;
  quickSummary: string;
  recommendedSolution: {
    ceilingType: string;
    texture: string;
    profile: string;
    lighting: string;
    heightLoss: string;
  };
  whyItFits: string[];
  whatToConsider: string[];
  priceOptions: PriceOption[];
  nextStep: string;
}

// ---------- Scenario 2 Output ----------
export interface RecommendedOption {
  name: string;
  description: string;
}

export interface TechQuestionOutput {
  scenario: "tech-question";
  intent: string;
  shortAnswer: string;
  recommendedOptions: RecommendedOption[];
  whatToConsider: string[];
  estimatedImpact: {
    heightLoss: string;
    budgetNote: string;
  };
  nextStep: string;
}

export type AdvisorOutput = RoomSelectionOutput | TechQuestionOutput;

// ---------- Rule-based computed context ----------
export interface ComputedContext {
  roomLabel: string;
  recommendedTexture: string;
  recommendedProfile: string;
  recommendedLighting: string;
  heightLossRange: string;
  isWetRoom: boolean;
  budgetRanges: {
    basic: { label: string; pricePerSqm: string; description: string };
    optimal: { label: string; pricePerSqm: string; description: string };
    premium: { label: string; pricePerSqm: string; description: string };
  };
  compatibilityNotes: string[];
  warnings: string[];
  estimatedTotalBasic: string;
  estimatedTotalOptimal: string;
  estimatedTotalPremium: string;
}

// ---------- Scenario 2 computed context ----------
export interface TechContext {
  roomLabel?: string;
  heightNote?: string;
  isWetRoom: boolean;
  generalNotes: string[];
}
