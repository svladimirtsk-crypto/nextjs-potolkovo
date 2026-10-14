import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const example = readFileSync(path.join(root, ".env.example"), "utf8");
const script = readFileSync(path.join(root, "scripts/check-env.mjs"), "utf8");

/** Run the real guard in an isolated fixture, never rewrite the project env file. */
function runGuard(documentation: string, previewMode = "0") {
  const fixture = mkdtempSync(path.join(tmpdir(), "potolkovo-env-guard-"));
  try {
    mkdirSync(path.join(fixture, "scripts"));
    writeFileSync(path.join(fixture, "scripts/check-env.mjs"), script);
    writeFileSync(path.join(fixture, ".env.example"), documentation);
    const result = spawnSync(process.execPath, [path.join(fixture, "scripts/check-env.mjs")], {
      encoding: "utf8",
      timeout: 5000,
      env: {
        NODE_ENV: "test",
        RELEASE: "1",
        TELEGRAM_LEADS_ENABLED: "0",
        DELIVERY_ALERT_ENABLED: "0",
        WEB3FORMS_ACCESS_KEY: "ci-not-a-secret",
        CRON_SECRET: "ci-not-a-secret",
        AVAILABILITY_TOKEN: "ci-not-a-secret",
        DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:5432/potolkovo_test",
        NEXT_PUBLIC_PREVIEW_MODE: previewMode,
      },
    });
    if (result.error) throw result.error;
    return result;
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}

describe("R7 · environment guard and preview documentation", () => {
  it.each(["0", "1"])("accepts the documented preview flag (%s) in strict CI configuration", (mode) => {
    const result = runGuard(example, mode);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("[env] ok");
  });

  it("still rejects an undocumented preview flag", () => {
    const result = runGuard(example.replace(/^NEXT_PUBLIC_PREVIEW_MODE=.*$/m, ""));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("не документирована NEXT_PUBLIC_PREVIEW_MODE");
  });

  it("still rejects unknown variables instead of allowing every public flag", () => {
    const result = runGuard(`${example}\nNEXT_PUBLIC_UNKNOWN_FLAG=1\n`);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("лишняя переменная NEXT_PUBLIC_UNKNOWN_FLAG");
  });
});
