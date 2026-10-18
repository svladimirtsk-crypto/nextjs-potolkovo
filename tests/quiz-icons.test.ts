import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ROOM_TYPES, RoomTypeIcon } from "@/components/calculator-modal/step0/quiz-v2/room-type-icons";
import { BinaryChoiceIcon } from "@/components/calculator-modal/step0/quiz-v2/binary-choice-icons";

describe("PT-044/045 · unified inline pictograms", () => {
  it("renders all nine 20px room icons under the 5 KB HTML/SVG budget", () => {
    expect(ROOM_TYPES).toHaveLength(9);
    const icons = ROOM_TYPES.map((type) =>
      renderToStaticMarkup(React.createElement(RoomTypeIcon, { type }))
    );
    expect(Buffer.byteLength(icons.join(""), "utf8")).toBeLessThanOrEqual(5 * 1024);
    for (const icon of icons) {
      expect(icon).toContain('width="20"');
      expect(icon).toContain('height="20"');
      expect(icon).toContain('stroke="currentColor"');
      expect(icon).toContain('aria-hidden="true"');
      expect(icon).toContain('focusable="false"');
      expect(icon).not.toContain("<image");
    }
  });

  it("renders three distinct, decorative on/off pairs without changing button text", () => {
    for (const kind of ["cornice-light", "chandelier", "spotlight"] as const) {
      const on = renderToStaticMarkup(React.createElement(BinaryChoiceIcon, { kind, enabled: true }));
      const off = renderToStaticMarkup(React.createElement(BinaryChoiceIcon, { kind, enabled: false }));
      expect(on).toContain('stroke="currentColor"');
      expect(on).toContain('aria-hidden="true"');
      expect(off).toContain('aria-hidden="true"');
      expect(off).toContain('d="M3 21 21 3"');
      expect(on).not.toContain('d="M3 21 21 3"');
      expect(on).not.toBe(off);
    }
  });
});
