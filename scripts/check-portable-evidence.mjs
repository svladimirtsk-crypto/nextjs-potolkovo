import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Архивные TS-скрипты входят в tsconfig и проверяются Next.js на Vercel.
 * Абсолютный import может проходить локально на машине автора, но ломать чистый checkout.
 */
const root = fileURLToPath(new URL("../", import.meta.url));
const evidenceDir = resolve(process.argv[2] ?? join(root, "docs/evidence"));
const extensions = /\.(?:ts|tsx|mts|cts)$/;
const importSource = /\b(?:from\s*|import\s*\(\s*|require\s*\(\s*)["']([^"']+)["']/g;
const machineRoot = /(?:\/home\/[^/\s'"`]+\/|\/Users\/[^/\s'"`]+\/|\/vercel\/path\d+\/|[A-Za-z]:[\\/]Users[\\/])/;

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(filename);
    return entry.isFile() && extensions.test(entry.name) ? [filename] : [];
  });
}

const failures = [];
const files = sourceFiles(evidenceDir);
for (const filename of files) {
  const source = readFileSync(filename, "utf8");
  const nonportableImport = [...source.matchAll(importSource)].some((match) =>
    match[1].startsWith("/") || /^[A-Za-z]:[\\/]/.test(match[1])
  );
  if (nonportableImport || machineRoot.test(source)) {
    failures.push(relative(root, filename));
  }
}

if (failures.length > 0) {
  console.error(`[portable-evidence] абсолютный import/путь в архивном TS (${failures.length}):`);
  for (const filename of failures) console.error(`  ${filename}`);
  process.exitCode = 1;
} else {
  console.log(`[portable-evidence] ok — ${files.length} архивных TS-скриптов без путей машины автора`);
}
