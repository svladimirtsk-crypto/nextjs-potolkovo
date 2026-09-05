import { describe, expect, it } from "vitest";
import { availability, getAvailabilityLabel } from "../content/availability";
import { isLegalFieldFilled } from "../content/contacts";

describe("T-047 · календарь свободных дат", () => {
  it("отдаёт строку, пока список актуален", () => {
    const label = getAvailabilityLabel(new Date(`${availability.validUntil}T00:00:00`));
    expect(label).toContain(availability.labelPrefix);
    for (const day of availability.freeSlotDays) expect(label).toContain(day);
  });

  it("молчит, если список протух — лучше ничего, чем ложное окно", () => {
    expect(getAvailabilityLabel(new Date("2099-01-01T00:00:00"))).toBeNull();
  });
});

describe("T-047 · реквизиты", () => {
  it("считает TODO_OWNER незаполненным", () => {
    expect(isLegalFieldFilled("TODO_OWNER")).toBe(false);
    expect(isLegalFieldFilled("   ")).toBe(false);
    expect(isLegalFieldFilled("ИП Иванов И. И.")).toBe(true);
  });
});
