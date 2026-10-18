import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { showQuizStepImages } from "@/components/calculator-modal/step0/quiz-v2/step-image-feature";
import { OptionCard } from "@/components/calculator-modal/step0/quiz-v2/ui";
import { hasOptimizedPicture } from "@/components/ui/picture";

const screens = ["ceiling", "cornice", "track", "lightLines", "scenario", "area"];

describe("PT-048 · build-time gate and safe media fallback", () => {
  it("defaults to off, accepts only explicit on and pilots only three screens", () => {
    const prior = process.env.NEXT_PUBLIC_QUIZ_STEP_IMAGES;
    try {
      delete process.env.NEXT_PUBLIC_QUIZ_STEP_IMAGES;
      expect(showQuizStepImages("ceiling")).toBe(false);
    } finally {
      if (prior === undefined) delete process.env.NEXT_PUBLIC_QUIZ_STEP_IMAGES;
      else process.env.NEXT_PUBLIC_QUIZ_STEP_IMAGES = prior;
    }
    for (const flag of ["off", "1", "true", "ON", ""]) {
      for (const screen of screens) {
        expect(showQuizStepImages(screen, flag)).toBe(false);
      }
    }
    for (const screen of ["ceiling", "cornice", "track"]) {
      expect(showQuizStepImages(screen, "on")).toBe(true);
    }
    for (const screen of ["lightLines", "scenario", "area"]) {
      expect(showQuizStepImages(screen, "on")).toBe(false);
    }
  });

  it("missing raster manifest entry gives a text-only selectable card", () => {
    expect(hasOptimizedPicture("/quiz-cornice-hidden-niche.jpeg")).toBe(true);
    expect(hasOptimizedPicture("/quiz-not-generated.jpeg")).toBe(false);
    const html = renderToStaticMarkup(React.createElement(OptionCard, {
      active: true,
      title: "Текстовый вариант",
      meta: "Цена и подпись на месте",
      onClick: () => {},
      imageSrc: "/quiz-not-generated.jpeg",
      imageAlt: "",
    }));
    expect(html).toContain("Текстовый вариант");
    expect(html).toContain("Цена и подпись на месте");
    expect(html).toContain('aria-pressed="true"');
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<picture");
  });
});
