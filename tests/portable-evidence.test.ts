import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const checker = join(process.cwd(), "scripts/check-portable-evidence.mjs");

function run(directory?: string) {
  return spawnSync(process.execPath, directory ? [checker, directory] : [checker], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

function withArchive(source: string, check: (directory: string) => void) {
  const directory = mkdtempSync(join(tmpdir(), "potolkovo-portable-evidence-"));
  try {
    writeFileSync(join(directory, "extract.ts"), source);
    check(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe("Vercel build · переносимость архивных TS-скриптов", () => {
  it("проверяет настоящие исходники проекта до next build", () => {
    const result = run();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("[portable-evidence] ok");
  });

  it("отклоняет абсолютный import, который локально совпал бы с папкой автора", () => {
    withArchive('import snapshot from "/home/user/repo/data/eks-feed2-snapshot.json";\n', (directory) => {
      const result = run(directory);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("extract.ts");
    });
  });

  it("отклоняет абсолютный путь записи результата даже без import", () => {
    withArchive('writeFileSync("/home/user/audit/evidence/result.json", "{}");\n', (directory) => {
      const result = run(directory);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("extract.ts");
    });
  });

  it("принимает относительный путь в переносимом скрипте", () => {
    withArchive('import snapshot from "../../data/snapshot.json";\n', (directory) => {
      expect(run(directory).status).toBe(0);
    });
  });
});
