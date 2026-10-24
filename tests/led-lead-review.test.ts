import { describe, expect, it } from "vitest";
import { formatLeadBody } from "@/lib/lead/format-lead";
import { LeadPayloadSchema } from "@/lib/lead/schema";
import { recalculateLeadPriceWithCatalog } from "@/lib/lead/server-recalc";
import { ledRoleOf } from "@/lib/lighting/led-hardware";
import { BASE_ROOM, buildClientPayload, catalogPromise } from "./helpers/lead-payload-factory";

const assignment = (sku: string) => [{ taskId: "r1:cornice", sku, qty: 1 }];

describe("LED-21–24 · authoritative preliminary lead, linked cornice PSU and quote revision", () => {
  it("one explicitly linked LED PSU replaces exactly one included amount; price arithmetic and all questions survive", async () => {
    const products = await catalogPromise;
    const psu = products.find((product) => ledRoleOf(product) === "psu" && product.unit === "pcs");
    expect(psu).toBeDefined();
    const cart = [{ product: psu!, qty: 1 }];
    const linked = buildClientPayload({ rooms: [BASE_ROOM], cart, discountMode: "with-ceiling",
      ledPsuAssignments: assignment(psu!.productId) });
    const unlinked = buildClientPayload({ rooms: [BASE_ROOM], cart, discountMode: "with-ceiling" });
    expect(unlinked.snapshot!.totals.grand - linked.snapshot!.totals.grand).toBe(1500);
    expect(linked.snapshot?.totals).toMatchObject({
      ledIncludedRub: 1500, ledEquipmentExtraRub: psu!.priceRub,
      ledCeilingDeltaRub: -1500,
    });
    expect(linked.snapshot?.totals.ledPsuReplacementRub).toBe(1500);
    expect(linked.snapshot?.ledReview).toMatchObject({
      status: "needs_review", commercialStatus: "needs_review", installation: "unknown",
      replacedCeilingRub: 1500, unlinkedCornicePsuQty: 0,
      assignments: assignment(psu!.productId),
      bom: [{ sku: psu!.productId, role: "psu", qty: 1, taskId: "r1:cornice" }],
    });

    const server = recalculateLeadPriceWithCatalog(linked, products);
    expect(server.ok).toBe(true);
    if (!server.ok) return;
    expect(server.priceCheck.status).toBe("verified"); // ONLY arithmetic, not an accepted commercial quote
    expect(server.grandTotal).toBe(linked.snapshot?.totals.grand);
    expect(server.snapshot?.totals).toMatchObject({
      ledIncludedRub: 1500, ledEquipmentExtraRub: psu!.priceRub,
      ledCeilingDeltaRub: -1500,
    });
    expect(server.snapshot?.ledReview?.quoteVersion).toBe(linked.snapshot?.ledReview?.quoteVersion);
    expect(server.snapshot?.ledReview?.questions.join(" ")).toContain("паспортам");
    const letter = formatLeadBody(server.payload, "TEST-LINK");
    expect(letter).toContain("LED · ПРЕДВАРИТЕЛЬНЫЙ ПОДБОР, НЕ СЧЁТ");
    expect(letter).toContain(`BOM (на проверку): ${psu!.productId} · psu · 1 pcs · задача r1:cornice`);
    expect(letter).toContain(`БП для r1:cornice: ${psu!.productId}`);
    const allQuestions = Array.from({ length: 16 }, (_, index) => `Вопрос инженеру №${index + 1}`);
    const completeLetter = formatLeadBody({ ...server.payload, snapshot: { ...server.snapshot!,
      ledReview: { ...server.snapshot!.ledReview!, questions: allQuestions } } });
    expect(completeLetter).toContain(`? ${allQuestions[0]}`);
    expect(completeLetter).toContain(`? ${allQuestions[15]}`);
    expect(completeLetter).not.toContain("Ещё 4 вопросов");
    expect(letter).toContain("Из ставки карниза вычтены включённые БП");
    expect(letter).toContain("LED · включено в ставку: 1 500 ₽");
    expect(letter).toContain("фактическая дельта потолка после минимума: -1 500 ₽");
  });

  it("unbound PSU does not earn a credit and raises a visible double-charge question", async () => {
    const products = await catalogPromise;
    const psu = products.find((product) => ledRoleOf(product) === "psu" && product.unit === "pcs")!;
    const payload = buildClientPayload({ rooms: [BASE_ROOM], cart: [{ product: psu, qty: 1 }], discountMode: "with-ceiling" });
    const result = recalculateLeadPriceWithCatalog(payload, products);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot?.ledReview?.unlinkedCornicePsuQty).toBe(1);
    expect(result.snapshot?.ledReview?.replacedCeilingRub).toBe(0);
    expect(result.priceCheck.issues.map((issue) => issue.code)).toContain("led-assignment-review");
    expect(formatLeadBody(result.payload).includes("проверить двойное начисление")).toBe(true);
  });

  it("forged/dangling assignment or claimed credit is ignored by the server, not silently accepted", async () => {
    const products = await catalogPromise;
    const psu = products.find((product) => ledRoleOf(product) === "psu" && product.unit === "pcs")!;
    const linked = buildClientPayload({ rooms: [BASE_ROOM], cart: [{ product: psu, qty: 1 }],
      discountMode: "with-ceiling", ledPsuAssignments: assignment(psu.productId) });
    const tampered = LeadPayloadSchema.parse({
      ...linked,
      snapshot: {
        ...linked.snapshot!,
        lighting: { ...linked.snapshot!.lighting!, ledPsuAssignments: [
          { taskId: "r2:cornice", sku: psu.productId, qty: 5 },
        ] },
        ledReview: { ...linked.snapshot!.ledReview!, replacedCeilingRub: 100_000 },
        totals: { ...linked.snapshot!.totals, ledIncludedRub: 100_000,
          ledEquipmentExtraRub: 100_000, ledCeilingDeltaRub: -100_000 },
      },
    });
    const result = recalculateLeadPriceWithCatalog(tampered, products);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot?.ledReview?.replacedCeilingRub).toBe(0);
    expect(result.snapshot?.ledReview?.assignments).toEqual([]);
    expect(result.snapshot?.totals.ledPsuReplacementRub).toBeUndefined();
    expect(result.snapshot?.totals.ledIncludedRub).toBe(0);
    expect(result.snapshot?.totals.ledEquipmentExtraRub).toBe(psu.priceRub);
    expect(result.snapshot?.totals.ledCeilingDeltaRub).toBe(0);
    expect(result.grandTotal).toBe((linked.snapshot?.totals.grand ?? 0) + 1500);
    expect(result.priceCheck.status).toBe("mismatch");
    expect(result.priceCheck.issues.map((issue) => issue.code)).toContain("led-assignment-review");
    expect(result.priceCheck.issues.map((issue) => issue.code)).toContain("led-quote-drift");
  });

  it("empty BOM remains an accepted review request and persists its room geometry and questions", async () => {
    const products = await catalogPromise;
    const payload = buildClientPayload({ rooms: [BASE_ROOM], cart: [], discountMode: "none" });
    expect(payload.snapshot?.ledReview?.bom).toEqual([]);
    const result = recalculateLeadPriceWithCatalog(payload, products);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.priceCheck.status).toBe("verified");
    expect(result.snapshot?.ledReview?.quoteVersion).toBe(payload.snapshot?.ledReview?.quoteVersion);
    expect(result.snapshot?.ledReview?.tasks).toMatchObject([{ id: "r1:cornice", geometryMeters: 12 }]);
    expect(result.snapshot?.ledReview?.questions.length).toBeGreaterThan(0);
    expect(formatLeadBody(result.payload)).toContain("Задач: 1; LED-позиций в корзине: 0");
  });

  it("server refuses replacement when the selected PSU has a known Moscow zero", async () => {
    const products = await catalogPromise;
    const psu = products.find((product) => ledRoleOf(product) === "psu" && product.unit === "pcs")!;
    const payload = buildClientPayload({ rooms: [BASE_ROOM], cart: [{ product: psu, qty: 1 }],
      discountMode: "with-ceiling", ledPsuAssignments: assignment(psu.productId) });
    const server = recalculateLeadPriceWithCatalog(payload, products.map((product) =>
      product.productId === psu.productId ? { ...product, stockByWarehouse: { moscow: 0 } } : product));
    expect(server.ok).toBe(true);
    if (!server.ok) return;
    expect(server.snapshot?.ledReview?.replacedCeilingRub).toBe(0);
    expect(server.priceCheck.issues.map((issue) => issue.code)).toContain("moscow-zero-reported");
    expect(server.priceCheck.issues.map((issue) => issue.code)).toContain("led-assignment-review");
    expect(server.grandTotal).toBe((payload.snapshot?.totals.grand ?? 0) + 1500);
  });

  it("lighting-only never subtracts a ceiling rate even if an old draft carries a binding", async () => {
    const products = await catalogPromise;
    const psu = products.find((product) => ledRoleOf(product) === "psu" && product.unit === "pcs")!;
    const payload = buildClientPayload({ rooms: [BASE_ROOM], cart: [{ product: psu, qty: 1 }],
      discountMode: "lighting-only", ledPsuAssignments: assignment(psu.productId) });
    const result = recalculateLeadPriceWithCatalog(payload, products);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot?.ledReview?.replacedCeilingRub).toBe(0);
    expect(result.snapshot?.totals.ledPsuReplacementRub).toBeUndefined();
    expect(result.grandTotal).toBe(payload.snapshot?.totals.lightingEffective);
  });
});
