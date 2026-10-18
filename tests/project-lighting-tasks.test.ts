import { describe, expect, it } from "vitest";

import { formatLeadBody } from "@/lib/lead/format-lead";
import { LeadPayloadSchema } from "@/lib/lead/schema";
import { ledCatalogHrefForTask, lightingTaskLines, projectLightingTasks, snapshotLightingTasks } from "@/lib/lighting/project-lighting-tasks";
import { buildRoomBreakdown, type V2RoomConfig } from "@/lib/calculator/room-snapshot";
import type { CalculatorLeadSnapshot } from "@/lib/calculator/snapshot-types";

function room(id: string, patch: Partial<V2RoomConfig> = {}): V2RoomConfig {
  return {
    id, label: id, area: 20, ceilingType: "standard",
    shadowEnabled: false, shadowLength: 0, floatingEnabled: false, floatingLength: 0,
    lightLinesEnabled: false, lightLinesLength: 0,
    corniceType: "none", corniceLength: 0, corniceLightingEnabled: false, corniceLightingLength: 0, corniceLightingPowerSupplies: 0,
    trackType: "none", trackLength: 0, chandeliersEnabled: false, chandeliersCount: 0, lightsEnabled: false, lightsCount: 0,
    ...patch,
  };
}

describe("UX-R2 · задачи по свету выводятся из помещений", () => {
  it("парный ключ roomId+feature и подпись метража как конструкции", () => {
    const tasks = projectLightingTasks([
      buildRoomBreakdown(room("kuhnya", { label: "Кухня", floatingEnabled: true, floatingLength: 17, ceilingType: "floating" })),
    ]);
    expect(tasks).toEqual([
      { id: "kuhnya:floating", roomId: "kuhnya", roomLabel: "Кухня", feature: "floating", title: "Парящий контур", geometryMeters: 17, status: "needs_review" },
    ]);
  });

  it("собирает все три вида задач по комнатам по порядку", () => {
    const tasks = projectLightingTasks([
      buildRoomBreakdown(room("z1", { label: "Зал", floatingEnabled: true, floatingLength: 14, lightLinesEnabled: true, lightLinesLength: 6, ceilingType: "floating" })),
      buildRoomBreakdown(room("z2", { label: "Спальня", corniceType: "hidden-niche", corniceLightingEnabled: true, corniceLightingLength: 9, corniceLength: 9 })),
    ]);
    expect(tasks.map(task => task.id)).toEqual(["z1:floating", "z1:light-lines", "z2:cornice"]);
    expect(tasks.map(task => task.title)).toEqual(["Парящий контур", "Световые линии", "Подсветка карниза"]);
    expect(tasks.every(task => task.status === "needs_review")).toBe(true);
  });

  it("явный отказ важнее оставшегося метража", () => {
    const tasks = projectLightingTasks([
      buildRoomBreakdown(room("r1", { floatingEnabled: false, floatingLength: 17, lightLinesEnabled: false, lightLinesLength: 5 })),
    ]);
    expect(tasks).toEqual([]);
  });

  it("подсветка карниза без карниза не превращается в задачу", () => {
    const tasks = projectLightingTasks([
      buildRoomBreakdown(room("r1", { corniceType: "none", corniceLightingEnabled: true, corniceLightingLength: 4 })),
    ]);
    expect(tasks).toEqual([]);
  });

  it("неизвестный метраж остаётся неизвестным, а не нулём", () => {
    const broken = { id: "r1", label: "Зал", floatingEnabled: true, floatingLength: 0 } as Parameters<typeof projectLightingTasks>[0][number];
    expect(projectLightingTasks([broken])[0].geometryMeters).toBeNull();
  });

  it("трек и споты остаются в блоке света Шага 1, а не в LED-задачах", () => {
    const tasks = projectLightingTasks([
      buildRoomBreakdown(room("r1", { trackType: "built-in", trackLength: 8, lightsEnabled: true, lightsCount: 6 })),
    ]);
    expect(tasks).toEqual([]);
  });

  it("LED-04 · ссылка сохраняет комнату/задачу и геометрию, но не раскрывает имя в URL", () => {
    const task = projectLightingTasks([
      buildRoomBreakdown(room("r1", { label: "Детская Веры", lightLinesEnabled: true, lightLinesLength: 6.123 })),
    ])[0];
    const href = ledCatalogHrefForTask(task);
    const url = new URL(href, "https://example.test");
    expect(url.pathname).toBe("/uslugi/prodazha-trekovogo-osveshcheniya");
    expect(url.searchParams.get("room")).toBe("r1");
    expect(url.searchParams.get("feature")).toBe("light-lines");
    expect(url.searchParams.get("meters")).toBe("6.13"); // не округляем нагрузку вниз
    expect(url.hash).toBe("#price");
    expect(href).not.toContain("Детская");
    expect(new URL(ledCatalogHrefForTask({ ...task, geometryMeters: null }), "https://example.test").searchParams.has("meters")).toBe(false);
    expect(new URL(ledCatalogHrefForTask({ ...task, geometryMeters: 301 }), "https://example.test").searchParams.has("meters")).toBe(false);
  });

  it("старый снапшот без разбивки по комнатам не теряет контур", () => {
    const legacy = {
      area: 18, floatingEnabled: true, floatingLength: 12,
    } as CalculatorLeadSnapshot;
    const tasks = snapshotLightingTasks(legacy);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ id: "legacy-object:floating", geometryMeters: 12, status: "needs_review" });
  });

  it("пустой снапшот не рисует задач", () => {
    expect(snapshotLightingTasks(null)).toEqual([]);
    expect(snapshotLightingTasks({ area: 0 } as CalculatorLeadSnapshot)).toEqual([]);
  });
});

describe("UX-R2 · формулировка для мастера", () => {
  it("называет метраж геометрией и запрещает выдуманный комплект", () => {
    const lines = lightingTaskLines([
      buildRoomBreakdown(room("r1", { label: "Кухня", floatingEnabled: true, floatingLength: 17, ceilingType: "floating" })),
    ]);
    const text = lines.join("\n");
    expect(lines[0]).toBe("LED-ЗАДАЧИ ПО ПОМЕЩЕНИЯМ — НУЖЕН ПОДБОР");
    expect(text).toContain("Кухня · Парящий контур · 17 м конструкции");
    expect(text).toContain("Геометрический метраж не равен закупке ленты");
    expect(text).toContain("блоки питания и управление не подобраны и не проверены");
    expect(text).not.toMatch(/\d+\s*Вт|\d+\s*W|блок питания \d|SKU|\d+ шт\./);
  });

  it("без задач блок не появляется", () => {
    expect(lightingTaskLines([buildRoomBreakdown(room("r1", { lightsEnabled: true, lightsCount: 6 }))])).toEqual([]);
  });

  it("в теле заявки задачи стоят после комнат и не выдают себя за готовый комплект", () => {
    const payload = LeadPayloadSchema.parse({
      name: "Иван", phone: "+79055219909", consent: true,
      source: "kalkulyator", placement: "modal", leadKind: "calculator", orderIntent: "lighting_with_ceiling",
      snapshot: {
        version: 2, scenario: "standard", scope: "room", entry: "ceiling-first", source: "calculator",
        rooms: [{
          id: "r1", label: "Кухня", area: 18, totalRub: 30000, ceilingTypeLabel: "Парящий",
          floatingLength: 14, lightLinesLength: 5, corniceLightingLength: null, corniceLength: 0, trackLength: 0,
          lightsCount: null, chandeliersCount: null, floatingEnabled: true, lightLinesEnabled: true,
        }],
        lighting: null,
        totals: { ceilingRaw: 30000, minimumApplied: false, installExtra: 0, lightingRegular: 0, lightingEffective: 0, discountPct: 0, grand: 30000 },
      },
    });
    const body = formatLeadBody(payload);
    expect(body).toContain("LED-ЗАДАЧИ ПО ПОМЕЩЕНИЯМ — НУЖЕН ПОДБОР");
    expect(body).toContain("Кухня · Парящий контур · 14 м конструкции");
    expect(body).toContain("Кухня · Световые линии · 5 м конструкции");
    expect(body.indexOf("LED-ЗАДАЧИ")).toBeGreaterThan(body.indexOf("ПОТОЛОК ПО КОМНАТАМ"));
    expect(body).not.toContain("свет не задан");
  });
});
