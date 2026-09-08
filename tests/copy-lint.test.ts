import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * N-060 · Словарь запрещённых слов в клиентских текстах (F-17, F-34, F-38, F-53).
 *
 * Тексты писал человек, который знает, как устроен потолок. Клиент — нет.
 * «Узел», «точки», «закладные» ему ничего не говорят, а «мы подберём» от
 * мастера-одиночки звучит как обезличенная компания, от которой он как раз
 * уходит.
 *
 * Проверка идёт по `content/*.ts`, потому что именно там живут тексты. Строки
 * кода и комментарии из проверки исключены: слово «узел» уместно в названии
 * переменной и в пояснении для разработчика.
 */
const CONTENT_DIR = path.resolve(import.meta.dirname, "../content");

/**
 * Слово → чем заменить. Сообщение теста показывает замену.
 *
 * Границы слова заданы вручную через `(?<![а-яёa-z])`, а не через `\b`:
 * в JavaScript `\b` и `\w` определены по латинице, поэтому `/\bузл/` не
 * находит «узел» вовсе. На этом тест уже был ложно-зелёным один раз.
 */
const EDGE = "(?<![а-яёa-zA-ZА-ЯЁ])";
const TAIL = "[а-яё]*";

const BANNED: Array<{ pattern: RegExp; hint: string }> = [
  {
    pattern: new RegExp(`${EDGE}(узел|узл${TAIL})`, "gi"),
    hint: "«узел» → «профиль», «примыкание», «решение»",
  },
  {
    /**
     * Жаргон — «точки» в значении «точечные светильники». Обычное русское
     * «в нескольких точках», «точка входа» под запрет не попадает: правило
     * про подмену названия товара, а не про само слово.
     */
    pattern: new RegExp(`${EDGE}точк(и|ами|ам|ек)(?![а-яё])`, "gi"),
    hint: "«точки» в значении светильников → «светильники»",
  },
  { pattern: new RegExp(`${EDGE}закладн${TAIL}`, "gi"), hint: "«закладные» → «крепления»" },
  { pattern: /(?<![А-ЯЁA-Zа-яё])БП(?![А-ЯЁA-Zа-яё])/g, hint: "«БП» → «блок питания»" },
  { pattern: new RegExp(`${EDGE}мы(?![а-яё])`, "gi"), hint: "первое лицо ед. числа: «я»" },
  {
    pattern: new RegExp(
      `${EDGE}(подберём|подберем|покажем|посчитаем|сделаем|согласуем|зафиксируем|поможем)(?![а-яё])`,
      "gi"
    ),
    hint: "первое лицо ед. числа: «подберу», «покажу», «посчитаю»",
  },
  {
    pattern: new RegExp(
      `${EDGE}(показываем|подбираем|согласовываем|фиксируем|делаем|работаем)(?![а-яё])`,
      "gi"
    ),
    hint: "первое лицо ед. числа: «показываю», «подбираю»",
  },
];

/**
 * Строки, которые проверять нельзя.
 *
 * Отзывы — прямая речь клиентов: «мы рекомендуем Владимира» правит не
 * копирайтер, а автор отзыва. Правка чужой цитаты — подлог.
 */
const EXEMPT_FILES = new Set(["avito-reviews.ts"]);

/** Текстовые литералы файла: то, что увидит клиент. */
function textLiterals(source: string): Array<{ line: number; text: string }> {
  const out: Array<{ line: number; text: string }> = [];

  source.split("\n").forEach((line, index) => {
    const trimmed = line.trim();
    // Комментарии — пояснения для разработчика, не для клиента.
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;

    for (const match of line.matchAll(/"([^"\\]{4,})"|`([^`\\]{4,})`/g)) {
      const text = match[1] ?? match[2] ?? "";
      // Пути, идентификаторы и классы — не тексты.
      if (/^[a-z0-9\-_/.#]+$/i.test(text)) continue;
      if (!/[а-яё]/i.test(text)) continue;
      out.push({ line: index + 1, text });
    }
  });

  return out;
}

const files = readdirSync(CONTENT_DIR).filter((name) => name.endsWith(".ts"));

describe("N-060 · язык клиента в content/", () => {
  it("файлы контента вообще найдены", () => {
    // Иначе тест зелёный просто потому, что ничего не проверил.
    expect(files.length).toBeGreaterThan(5);
  });

  for (const file of files) {
    if (EXEMPT_FILES.has(file)) continue;

    it(`${file} — без жаргона и «мы»`, () => {
      const source = readFileSync(path.join(CONTENT_DIR, file), "utf8");
      const violations: string[] = [];

      for (const { line, text } of textLiterals(source)) {
        for (const { pattern, hint } of BANNED) {
          /**
           * Регексп с флагом `g` хранит `lastIndex` между вызовами, а список
           * BANNED переиспользуется на каждой строке файла. Без сброса часть
           * совпадений пропускалась — тест был ложно-зелёным на «узел».
           */
          pattern.lastIndex = 0;
          const found = text.match(pattern);
          if (found) {
            violations.push(`${file}:${line} «${found[0]}» — ${hint}\n    ${text.slice(0, 90)}`);
          }
        }
      }

      expect(violations, `\n${violations.join("\n")}`).toEqual([]);
    });
  }
});
