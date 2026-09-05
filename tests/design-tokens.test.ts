import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const button = readFileSync(new URL("../components/ui/button.tsx", import.meta.url), "utf8");

describe("T-064 · дизайн-токены", () => {
  it("шкала радиусов и высот объявлена", () => {
    for (const token of ["--radius-sm", "--radius-md", "--radius-lg"]) {
      expect(css, token).toContain(token);
    }
    for (const token of ["--control-sm", "--control-md", "--control-lg"]) {
      expect(css, token).toContain(token);
    }
  });

  it("акцент — #2563eb", () => {
    expect(css).toContain("--color-accent: #2563eb");
    expect(css).toContain("--color-accent-hover");
  });
});

describe("T-064 · кнопка", () => {
  it("три размера и три варианта", () => {
    expect(button).toContain('"sm" | "md" | "lg"');
    expect(button).toContain('"primary" | "secondary" | "ghost"');
  });

  it("sm не меньше 44px — минимум для касания", () => {
    expect(button).toMatch(/case "sm":\s*\n\s*return "min-h-11/);
  });

  it("primary использует акцент, а не slate-950", () => {
    const primaryBlock = button.slice(button.indexOf('case "primary"'));
    expect(primaryBlock).toContain("var(--color-accent)");
    expect(primaryBlock).not.toContain("bg-slate-950");
  });
});
