import { describe, expect, it } from "vitest";

import {
  TELEGRAM_TEXT_MAX,
  buildTelegramDeepLink,
  buildTelegramSummaryText,
} from "@/lib/lead/telegram-link";
import { buildRoomBreakdown, type V2RoomConfig } from "@/lib/calculator-v2/room-snapshot";

function room(patch: Partial<V2RoomConfig> = {}): V2RoomConfig {
  return {
    id: "r",
    label: "Комната",
    area: 24,
    ceilingType: "standard",
    shadowEnabled: false,
    shadowLength: 0,
    floatingEnabled: false,
    floatingLength: 0,
    lightLinesEnabled: false,
    lightLinesLength: 0,
    corniceType: "none",
    corniceLength: 0,
    corniceLightingEnabled: false,
    corniceLightingLength: 0,
    corniceLightingPowerSupplies: 0,
    trackType: "none",
    trackLength: 0,
    chandeliersEnabled: false,
    chandeliersCount: 0,
    lightsEnabled: false,
    lightsCount: 0,
    ...patch,
  };
}

describe("T-026 - Telegram deep-link (Prilozhenie G)", () => {
  it("polniy raschet s nomerom leada", () => {
    const text = buildTelegramSummaryText({
      leadId: "K7F3Q",
      rooms: [
        buildRoomBreakdown(room({ id: "a", shadowEnabled: true, shadowLength: 17 })),
        buildRoomBreakdown(room({ id: "b", trackType: "built-in", trackLength: 10 })),
      ],
      totalArea: 48,
      lightingTotalRub: 21008,
      grandTotalRub: 72000,
    });
    expect(text).toContain("Расчёт №K7F3Q с сайта");
    expect(text).toContain("2 комнаты");
    expect(text).toContain("48 м²");
    expect(text).toContain("теневой 17 м.п.");
    expect(text).toContain("трек 10 м");
    expect(text).toContain("свет 21 008 ₽");
    expect(text).toContain("итого ~72 000 ₽");
    expect(text.length).toBeLessThanOrEqual(TELEGRAM_TEXT_MAX);
  });

  it("bez leadId - bez nomera", () => {
    const text = buildTelegramSummaryText({
      rooms: [buildRoomBreakdown(room())],
      totalArea: 24,
      grandTotalRub: 24000,
    });
    expect(text).toContain("Расчёт с сайта");
    expect(text).not.toContain("№");
  });

  it("dlina vsegda <= 300 simvolov", () => {
    const rooms = Array.from({ length: 12 }, (_, i) =>
      buildRoomBreakdown(room({ id: `r${i}`, shadowEnabled: true, shadowLength: 999 }))
    );
    const text = buildTelegramSummaryText({
      leadId: "VERYLONGLEADCODE",
      rooms,
      totalArea: 999999,
      lightingTotalRub: 999999,
      grandTotalRub: 9999999,
    });
    expect(text.length).toBeLessThanOrEqual(TELEGRAM_TEXT_MAX);
  });

  it("pustoy raschet ne lomaetsya", () => {
    const text = buildTelegramSummaryText({ rooms: [], totalArea: 0, grandTotalRub: 0 });
    expect(text).toBe("Здравствуйте! Расчёт с сайта. Хочу уточнить.");
  });

  it("ssylka na t.me s encodeURIComponent", () => {
    const url = buildTelegramDeepLink({
      rooms: [buildRoomBreakdown(room())],
      totalArea: 24,
      grandTotalRub: 24000,
    });
    expect(url.startsWith("https://t.me/potolkovo_msk?text=")).toBe(true);
    const encoded = url.split("?text=")[1];
    expect(decodeURIComponent(encoded)).toContain("Здравствуйте!");
    expect(encoded).not.toContain(" ");
  });

  it("sklonenie komnat", () => {
    const one = buildTelegramSummaryText({
      rooms: [buildRoomBreakdown(room())],
      totalArea: 10,
      grandTotalRub: 18000,
    });
    expect(one).toContain("1 комната");

    const five = buildTelegramSummaryText({
      rooms: Array.from({ length: 5 }, (_, i) => buildRoomBreakdown(room({ id: `r${i}` }))),
      totalArea: 50,
      grandTotalRub: 50000,
    });
    expect(five).toContain("5 комнат");
  });
});
