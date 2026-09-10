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

/**
 * N-063 · Токены и контраст (F-50, F-51).
 */
import { readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

/** Все .tsx в components/ и app/. */
function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...tsxFiles(full));
    else if (name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

const SOURCES = [path.join(ROOT, "components"), path.join(ROOT, "app")].flatMap(tsxFiles);

/** Относительная яркость по WCAG 2.1. */
function luminance(hex: string): number {
  const channels = (hex.match(/\w\w/g) ?? []).map((pair) => {
    const value = parseInt(pair, 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

describe("N-063 · контраст подписей (F-51)", () => {
  it("slate-400 на белом действительно не проходит норму", () => {
    // Основание для запрета ниже: 2.56:1 против нормы 4.5:1.
    expect(contrast("94a3b8", "ffffff")).toBeLessThan(4.5);
  });

  it("slate-600 проходит — им и заменяем", () => {
    expect(contrast("475569", "ffffff")).toBeGreaterThanOrEqual(4.5);
  });

  it("text-slate-400 не используется для читаемого текста", () => {
    /**
     * Исключения намеренные: placeholder не является контентом,
     * зачёркнутая цена приглушена по смыслу и всегда стоит рядом с
     * действующей, aria-hidden не читается вслух и не несёт информации.
     */
    const violations: string[] = [];

    for (const file of SOURCES) {
      const source = readFileSync(file, "utf8");
      source.split("\n").forEach((line, index) => {
        if (!line.includes("text-slate-400")) return;
        if (line.includes("placeholder:") || line.includes("line-through")) return;
        if (line.includes("aria-hidden")) return;
        violations.push(`${path.relative(ROOT, file)}:${index + 1}`);
      });
    }

    expect(violations, `\n${violations.join("\n")}`).toEqual([]);
  });
});

describe("N-063 · роли primary (F-50)", () => {
  it("оба primary названы токенами, а не разбросаны литералами", () => {
    for (const token of ["--color-primary", "--color-commit"]) {
      expect(css, token).toContain(token);
    }
  });

  it("у главной кнопки и кнопки подтверждения разные роли", () => {
    // Если цвета совпадут, разделение ролей потеряет смысл — либо убирать
    // одну роль, либо признать, что кнопки неразличимы.
    const primary = css.match(/--color-primary:\s*(#[0-9a-f]{6})/i)?.[1];
    const commit = css.match(/--color-commit:\s*(#[0-9a-f]{6})/i)?.[1];

    expect(primary).toBeTruthy();
    expect(commit).toBeTruthy();
    expect(primary).not.toBe(commit);
  });
});
