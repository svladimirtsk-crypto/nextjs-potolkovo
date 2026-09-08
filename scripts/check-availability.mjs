#!/usr/bin/env node
/**
 * N-061 · Страж актуальности календаря замеров (F-21).
 *
 * `availability.ts` правится руками, и в этом его смысл: мастер один,
 * синхронизации с настоящим календарём нет. Но ручной список без срока
 * годности превращается в ложь — `validUntil: 2026-12-31` означал, что
 * сайт целый год обещает «чт, сб», даже когда все четверги заняты.
 *
 * Поэтому окно жёстко ограничено: не дальше 21 дня вперёд. Владелец
 * обновляет список раз в две-три недели, иначе сборка падает и напоминает.
 * Дата в прошлом — тоже ошибка сборки, хотя на сайте такой календарь просто
 * скрывается: молча показывать пустоту вместо блока «почему сейчас» плохо,
 * но врать — хуже.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SOURCE = resolve(ROOT, "content/availability.ts");

/** Максимальный горизонт ручного календаря. */
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
    "Поле обязательно: без него календарь нечем ограничить."
  );
}

const validUntil = new Date(`${match[1]}T23:59:59`);
if (Number.isNaN(validUntil.getTime())) {
  fail(`validUntil «${match[1]}» — не дата`);
}

const now = new Date();
const daysAhead = Math.ceil((validUntil.getTime() - now.getTime()) / MS_IN_DAY);

if (daysAhead < 0) {
  fail(
    `календарь замеров протух ${Math.abs(daysAhead)} дн. назад (validUntil ${match[1]})`,
    "Обновите freeSlotDays и validUntil в content/availability.ts.\n" +
      "Пока дата в прошлом, блок «свободные даты» на сайте скрыт — клиент не видит,\n" +
      "когда вы свободны."
  );
}

if (daysAhead > MAX_DAYS_AHEAD) {
  fail(
    `validUntil ${match[1]} — это ${daysAhead} дн. вперёд, максимум ${MAX_DAYS_AHEAD}`,
    "Список свободных дней правится руками и так далеко вперёд быть верным не может.\n" +
      "Поставьте дату ближе и обновляйте раз в две-три недели."
  );
}

console.log(
  `[availability] ok — календарь актуален ещё ${daysAhead} дн. (до ${match[1]}, лимит ${MAX_DAYS_AHEAD})`
);
