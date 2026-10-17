#!/usr/bin/env node
/**
 * T8-010/011/012 · Генератор запроса поставщику из фактических данных.
 *
 * Список вопросов нельзя писать «по памяти»: он должен следовать из того, что
 * реально известно в профиле и снимке каталога. Скрипт читает
 * `docs/evidence/catalog-led/led-strip-profiles.json` и `data/eks-feed2-snapshot.json`
 * и собирает `docs/evidence/catalog-led/supplier-request.md`:
 *   - что уже есть и откуда (название / этикетка), со статусом;
 *   - чего не хватает по каждой серии;
 *   - минимальный пакет вопросов из §12 ТЗ;
 *   - расхождение цен «катушка против метра» как отдельный пункт.
 *
 * Запуск: node scripts/generate-led-supplier-request.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const profilePath = join(root, "docs/evidence/catalog-led/led-strip-profiles.json");
const snapshotPath = join(root, "data/eks-feed2-snapshot.json");
const outPath = join(root, "docs/evidence/catalog-led/supplier-request.md");

const profile = JSON.parse(readFileSync(profilePath, "utf8"));
const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));

/** Поля, которых нет ни в названии, ни в витрине, — их и просим. */
const STRIP_MISSING = [
  "кратность реза (мм)",
  "ширина платы (мм)",
  "IP",
  "CRI и световой поток по режимам",
  "максимальная длина одного питания (м)",
  "тепловые требования (профиль, рассеиватель, закрытая полость)",
  "база цены: за метр или за катушку",
  "кратность упаковки и MOQ",
  "паспорт Вт/м по режимам (сейчас Вт/м выведены из названия)",
];

const PSU_MISSING = [
  "CV/CC и точный выходной ток",
  "правило derating и его основание",
  "габариты, крепление, IP, температура",
  "охлаждение/шум, минимальная нагрузка",
  "входной диапазон, inrush и защита",
];

const CONTROLLER_MISSING = [
  "предел тока по каждому каналу и суммарно (сейчас частично с этикетки)",
  "ограничение используемого входного разъёма",
  "тип выходного каскада (общий плюс/минус), распиновка",
  "RF-семейство и совместимые пульты (по id)",
  "экосистема, Алиса, зависимость от интернета, поведение после отключения питания",
  "версия прошивки/регион",
];

const REMOTE_MISSING = [
  "совместимые контроллеры (по id)",
  "число зон и число силовых каналов — раздельно",
  "питание пульта, сопряжение, максимум устройств",
  "работа без сети/офлайн",
];

const money = (value) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value ?? 0);

/** Сравнение «цена катушки против витринной цены за метр» по совпадающим характеристикам. */
function priceBasisCheck() {
  const stripSnapshot = snapshot.products.filter(
    (product) => product.kind === "LED_STRIP" && /Светодиодная лента/i.test(product.name)
  );
  const current = profile.strips ?? [];

  const norm = (name) =>
    String(name)
      .toLowerCase()
      .replace(/катушка\s*\d+([.,]\d+)?\s*м/gi, "")
      .replace(/\d+\s*шт/gi, "")
      .replace(/чз|н\b/gi, "")
      .replace(/\s+/g, " ")
      .replace(/\d+([.,]\d+)?\s*м\s*$/i, "")
      .trim();

  const rows = [];
  for (const strip of current) {
    const key = norm(strip.title);
    const match = stripSnapshot.find((product) => norm(product.name) === key);
    if (!match) continue;
    const reel = strip.reelMeters ?? null;
    const perMeterFromReel = reel ? strip.priceRub / reel : null;
    rows.push({
      name: strip.title.replace(/\s+/g, " ").trim(),
      reelPrice: strip.priceRub,
      reel,
      perMeterFromReel,
      showcasePrice: match.priceRub,
    });
  }
  return { rows, compared: rows.length, showcaseStrips: stripSnapshot.length, currentStrips: current.length };
}

const basis = priceBasisCheck();

const lines = [];
lines.push("# Запрос поставщику EKS — минимальный пакет (T8-010/011/012)");
lines.push("");
lines.push(
  "Документ собран из фактических данных: профиля `led-strip-profiles.json` (срез 2026-10-16) и витрины `eks-feed2-snapshot.json`. Это не отчёт о выполнении, а перечень того, чего **нет** в данных. Ни одно отсутствующее поле не заполняется догадкой."
);
lines.push("");
lines.push("## 1. Что уже есть и с каким статусом");
lines.push("");
lines.push("| Что | Сколько | Источник | Статус |");
lines.push("|---|---:|---|---|");
lines.push(
  `| Ленты | ${(profile.strips ?? []).length} | названия позиций фида | title_only |`
);
lines.push(
  `| Блоки питания | ${(profile.powerSupplies ?? []).length} | названия позиций фида | title_only |`
);
lines.push(
  `| Контроллеры | ${(profile.controllers ?? []).length} | названия + фото этикеток WB5/C01RF | title_only / label_observed |`
);
lines.push(`| Пульты | ${(profile.remotes ?? []).length} | названия позиций фида | title_only |`);
lines.push(`| Наборы «пульт + контроллер» | ${(profile.controllerRemoteKits ?? []).length} | названия позиций фида | title_only |`);
lines.push("");
lines.push(
  "Статусы по ТЗ §4: `title_only` (название) и `label_observed` (фото маркировки) **не дают verified BOM**. `datasheet_verified` — только по паспорту/инструкции от поставщика."
);
lines.push("");

lines.push("## 2. Расхождение цены катушки и витринной цены за метр");
lines.push("");
lines.push(
  `Сопоставлено по характеристикам: **${basis.compared}** позиций из ${basis.currentStrips} актуальных и ${basis.showcaseStrips} в витрине.`
);
lines.push("");
if (basis.rows.length > 0) {
  lines.push("| Позиция | Цена катушки, ₽ | Катушка, м | Из неё ₽/м | Витрина, ₽/м |");
  lines.push("|---|---:|---:|---:|---:|");
  for (const row of basis.rows.slice(0, 12)) {
    lines.push(
      `| ${row.name} | ${money(row.reelPrice)} | ${row.reel ?? "?"} | ${row.perMeterFromReel ? row.perMeterFromReel.toFixed(0) : "?"} | ${money(row.showcasePrice)} |`
    );
  }
  lines.push("");
  const avg = basis.rows.reduce((sum, row) => sum + (row.perMeterFromReel ?? 0), 0) / basis.rows.length;
  const avgShow = basis.rows.reduce((sum, row) => sum + row.showcasePrice, 0) / basis.rows.length;
  lines.push(
    `Средняя по всем позициям цена метра из катушки — **${avg.toFixed(0)} ₽/м**, витринная — **${avgShow.toFixed(0)} ₽/м** (разброс из-за разной мощности): это согласуется с трактовкой «цена в фиде за катушку 5 м, в витрине за метр», но остаётся выводом, а не подтверждением поставщика.`
  );
  lines.push("");
}
lines.push("**Вопрос 1 (блокирующий):** подтвердить единицу цены в выгрузке — за метр или за катушку — и прислать `priceUnit`, `packQty`, `MOQ` по каждой позиции. Пока ответа нет, код считает целые катушки и не умножает цену катушки на метраж.");
lines.push("");

lines.push("## 3. Ленты: чего нет в данных");
lines.push("");
lines.push("Серии, по которым нужен паспорт (всего " + (profile.strips ?? []).length + "):");
lines.push("");
const series = [
  ...new Set(
    (profile.strips ?? []).map(
      (strip) => strip.series ?? `${String(strip.kind ?? "ЛЕНТА").toUpperCase()} ${strip.voltage ?? "?"}V`
    )
  ),
];
lines.push(series.map((item) => `- ${item}`).join("\n"));
lines.push("");
lines.push("По каждой серии просим:");
lines.push("");
lines.push(STRIP_MISSING.map((item) => `- ${item}`).join("\n"));
lines.push("");

lines.push("## 4. Блоки питания: чего нет");
lines.push("");
lines.push(`Позиций в профиле: ${(profile.powerSupplies ?? []).length}.`);
lines.push("");
lines.push(PSU_MISSING.map((item) => `- ${item}`).join("\n"));
lines.push("");
lines.push("Отдельно: паспорт подтверждает снижение допустимой мощности при монтаже в закрытой полости — без него коэффициент derating в расчёт не вводится.");
lines.push("");

lines.push("## 5. Контроллеры и пульты: чего нет");
lines.push("");
lines.push(
  `Контроллеров: ${(profile.controllers ?? []).length}, пультов: ${(profile.remotes ?? []).length}, наборов: ${(profile.controllerRemoteKits ?? []).length}.`
);
lines.push("");
lines.push("По контроллерам:");
lines.push("");
lines.push(CONTROLLER_MISSING.map((item) => `- ${item}`).join("\n"));
lines.push("");
lines.push("По пультам:");
lines.push("");
lines.push(REMOTE_MISSING.map((item) => `- ${item}`).join("\n"));
lines.push("");

lines.push("## 6. Минимальный пакет (ТЗ §12)");
lines.push("");
lines.push("1. Паспорт/инструкция на каждую модель из списка выше.");
lines.push("2. `priceUnit` / `MOQ` / `packQty` по каждой позиции.");
lines.push("3. Максимальная мощность Вт/м по режимам, а не «в среднем».");
lines.push("4. Кратность реза, ширина платы, максимальная питаемая длина, тепловые требования.");
lines.push("5. Паспорт БП: выходной ток, derating и его основание.");
lines.push("6. Ограничения контроллера: по каждому каналу и суммарно, ограничения входного разъёма.");
lines.push("7. RF-семейства и подтверждённые пары «контроллер — пульт».");
lines.push("8. Режимы WB5 / LM051 / C01 / C02 / C03 и поведение после отключения питания.");
lines.push("9. Экосистема, работа с Алисой, зависимость от интернета.");
lines.push("10. Полная номенклатура соединителей, профилей и рассеивателей.");
lines.push("");
lines.push("Файлы или другая выгрузка приветствуются. Отсутствующие данные не заполняются догадками: до подтверждения в таблице совместимости остаётся `unknown`.");
lines.push("");

writeFileSync(outPath, lines.join("\n"), "utf8");
console.log(`[supplier-request] записано: ${outPath}`);
console.log(`[supplier-request] сопоставлено цен: ${basis.compared} из ${basis.currentStrips}`);
