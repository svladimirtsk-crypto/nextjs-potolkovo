#!/usr/bin/env node
/**
 * N-061 · PT-016 · Страж актуальности запасного календаря замеров (F-21, B-F108).
 *
 * До PT-016 `content/availability.ts` был ЕДИНСТВЕННЫМ источником дат, и
 * протухший файл означал ложь на сайте: «чт, сб», которые давно заняты. Поэтому
 * страж ронял сборку — иначе календарь тихо устаревал, что и случилось
 * (2026-12-31 стояло больше ста дней).
 *
 * После PT-016 даты живут в таблице `availability_slots` и правятся через
 * `/admin/availability` без деплоя, а файл стал запасным источником: он
 * показывается, только пока БД не заполнена или недоступна. Протухший запасной
 * источник не врёт — `getAvailabilityLabel()` вернёт `null`, и блок срочности
 * скроется. Значит, ронять сборку больше не за что, а вот предупредить полезно.
 *
 * Поэтому страж предупреждает (код возврата 0), но по-прежнему ПАДАЕТ, если
 * файл структурно сломан: нет `validUntil` или это не дата. Без этого поля
 * запасной календарь нечем ограничить, и он снова начнёт обещать «чт, сб»
 * вечно — ровно тот дефект, из-за которого страж появился.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SOURCE = resolve(ROOT, "content/availability.ts");

/** Горизонт, дальше которого запасной список считается «слишком общим». */
const MAX_DAYS_AHEAD = 21;
const MS_IN_DAY = 24 * 60 * 60 * 1000;

function fail(message, hint) {
  console.error(`[availability] ${message}`);
  if (hint) console.error(`\n${hint}`);
  process.exit(1);
}

const source = readFileSync(SOURCE, "utf8");

const match = source.match(/validUntil:\s*"(\d{4}-\d{2}-\d{2})"/);
if (!match) {
  fail(
    "не нашёл validUntil в content/availability.ts",
    "Поле обязательно: без него запасной календарь нечем ограничить."
  );
}

const validUntil = new Date(`${match[1]}T23:59:59`);
if (Number.isNaN(validUntil.getTime())) {
  fail(`validUntil «${match[1]}» — не дата`);
}

const now = new Date();
const daysAhead = Math.ceil((validUntil.getTime() - now.getTime()) / MS_IN_DAY);

if (daysAhead < 0) {
  console.warn(
    `[availability] внимание: запасной календарь протух ${Math.abs(daysAhead)} дн. назад ` +
      `(validUntil ${match[1]})`
  );
  console.warn(
    "  Пока даты в БД (availability_slots) свежие, на сайт это не влияет.\n" +
      "  Если БД недоступна или календарь в ней не заполнен, блок «свободные даты»\n" +
      "  скроется — это честно, но срочность с сайта пропадёт.\n" +
      "  Освежить запасной список можно правкой content/availability.ts."
  );
} else if (daysAhead > MAX_DAYS_AHEAD) {
  console.warn(
    `[availability] внимание: validUntil ${match[1]} — это ${daysAhead} дн. вперёд ` +
      `(мягкий лимит ${MAX_DAYS_AHEAD})`
  );
  console.warn(
    "  Файл больше не основной источник, поэтому сборка не падает. Но при отказе БД\n" +
      "  сайт будет обещать одни и те же «чт, сб» до этой даты — чем она дальше,\n" +
      "  тем меньше в ней смысла."
  );
} else {
  console.log(
    `[availability] ok — запасной календарь актуален ещё ${daysAhead} дн. ` +
      `(до ${match[1]}, мягкий лимит ${MAX_DAYS_AHEAD}); основной источник — availability_slots`
  );
}
