import { describe, expect, it } from "vitest";

import { buildLightingPatchForTest as buildLightingPatch } from "@/lib/calculator/use-calculator-engine";

const untouched = { lights: false, trackLength: false, trackType: false };

describe("T-024 - pendingLightingPrefill", () => {
  it("nabor 10 m.p. -> trackLength 10, trackType built-in", () => {
    const patch = buildLightingPatch({ trackProfileMeters: 10, pointSpotsQty: 6 }, untouched);
    expect(patch.trackLength).toBe(10);
    expect(patch.trackType).toBe("built-in");
    expect(patch.lightsEnabled).toBe(true);
    expect(patch.lightsCount).toBe(6);
  });

  it("yavniy preferredTrackType pobezhdaet", () => {
    const patch = buildLightingPatch(
      { trackProfileMeters: 8, preferredTrackType: "surface" },
      untouched
    );
    expect(patch.trackType).toBe("surface");
    expect(patch.trackLength).toBe(8);
  });

  it("touched parametry ne perezapisyvayutsya", () => {
    const patch = buildLightingPatch(
      { trackProfileMeters: 10, pointSpotsQty: 6, preferredTrackType: "built-in" },
      { lights: true, trackLength: true, trackType: true }
    );
    expect(patch).toEqual({});
  });

  it("metry ogranicheny diapazonom 1..50", () => {
    expect(buildLightingPatch({ trackProfileMeters: 999 }, untouched).trackLength).toBe(50);
    expect(buildLightingPatch({ trackProfileMeters: 0.2 }, untouched).trackLength).toBe(1);
  });

  it("nabor bez spotov vyklyuchaet tochki", () => {
    const patch = buildLightingPatch({ trackProfileMeters: 5, pointSpotsQty: 0 }, untouched);
    expect(patch.lightsEnabled).toBe(false);
    expect(patch.lightsCount).toBeUndefined();
  });
});
