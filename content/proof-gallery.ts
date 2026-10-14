import { homepage } from "./homepage";
import type { ServiceCalculatorPreset } from "./services";

/** Presentation only: no new object facts, rates, presets or photo provenance. */
export type ProofItem = {
  slug: string; title: string; serviceType: string; roomType: string; summary: string;
  imageAssetKey: string; alt: string; ctaLabel: string; actionTargetId: string;
  areaLabel?: string; timelineLabel?: string; priceLabel?: string; addressLabel?: string;
  challenge?: string; workDone?: string; configurationLines?: readonly string[];
  scopeLabel?: string; budgetNote?: string; actionPreset?: ServiceCalculatorPreset;
  budgetBreakdown?: {
    ceilingWorksRub: number; lightingRawRub: number; lightingDiscountPercent: number;
    lightingDiscountedRub: number; totalRub: number;
    customCharges: readonly { label: string; amountRub: number }[];
  };
};
export const proofFilters = [
  { id: "all", label: "Все решения" },
  { id: "shadow", label: "Теневые" },
  { id: "floating", label: "Парящие" },
  { id: "light", label: "Освещение" },
  { id: "cornice", label: "Карнизы" },
] as const;
export type ProofFilter = (typeof proofFilters)[number]["id"];
type ProofSlug = (typeof homepage.proof.items)[number]["slug"];
type Presentation = {
  shortTitle: string;
  categories: readonly Exclude<ProofFilter, "all">[];
  servicePath: `/uslugi/${string}`;
  serviceLabel: string;
};
export const proofPresentation = {
  "shadow-track-apartment": { shortTitle: "Теневая линия. Направленный свет.", categories: ["shadow", "light"], servicePath: "/uslugi/tenevoy-profil", serviceLabel: "О теневом профиле" },
  "floating-led-living-room": { shortTitle: "Свет по контуру пространства.", categories: ["floating", "light", "cornice"], servicePath: "/uslugi/paryashchie-potolki", serviceLabel: "О парящих потолках" },
  "light-lines-office": { shortTitle: "Геометрия света.", categories: ["light"], servicePath: "/uslugi/svetovye-linii", serviceLabel: "О световых линиях" },
  "hidden-cornice-flat": { shortTitle: "Шторы — от самого потолка.", categories: ["cornice"], servicePath: "/uslugi/skrytye-karnizy", serviceLabel: "О скрытых карнизах" },
  "matte-apartment": { shortTitle: "Чистая плоскость.", categories: [], servicePath: "/uslugi/prostye-potolki", serviceLabel: "О матовых потолках" },
  "custom-dome": { shortTitle: "За пределами плоскости.", categories: [], servicePath: "/uslugi/individualnye-proekty", serviceLabel: "Об индивидуальных проектах" },
} satisfies Record<ProofSlug, Presentation>;

export function proofView(slug: string): Presentation {
  if (!Object.hasOwn(proofPresentation, slug)) throw new Error(`Unknown proof item: ${slug}`);
  return proofPresentation[slug as ProofSlug];
}
export function filterProofItems(filter: ProofFilter): readonly ProofItem[] {
  return homepage.proof.items.filter(item => filter === "all" || proofView(item.slug).categories.includes(filter));
}
