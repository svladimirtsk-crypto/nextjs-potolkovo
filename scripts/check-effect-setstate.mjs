#!/usr/bin/env node
/**
 * N-050 · Страж: никакой синхронизации состояния через `useEffect`.
 *
 * Правило ТЗ v2 п. 0.7 запрещает `setState` внутри `useEffect` для
 * синхронизации. Такой код выглядит безобидно, но ломается тонко: между
 * рендером и доставкой значения есть кадр, в котором интерфейс показывает
 * рассогласованное состояние. Именно так футер Шага 0 отставал на шаг —
 * заголовок «Карнизы», кнопка «Подтвердить тип», и быстрый клик подтверждал
 * предыдущий экран.
 *
 * Проверка — грубая, по тексту: ищем вызовы `setXxx(` внутри тела
 * `useEffect(`. Точный разбор AST здесь избыточен, а регресс ловится и так.
 *
 * Исключения перечислены поимённо с обоснованием: правило запрещает
 * синхронизацию состояния, а не любые эффекты вообще.
 */

import { readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";

const ROOTS = ["components", "app"];

/**
 * Разрешённые вызовы. Ключ — имя сеттера, значение — почему это не
 * синхронизация состояния.
 */
const ALLOWED_SETTERS = {
  setMounted: "флаг гидрации: значение зависит от факта запуска в браузере",
  setDraft: "чтение localStorage — внешний источник, недоступный при рендере",
  setDraftDecided: "то же чтение черновика: решение принимается после ответа стораджа",
  setHistory: "применение пресета страницы — одноразовый переход, не синхронизация",
  setZoomImage: "закрытие лайтбокса по Escape — обработчик события, а не состояние",
  setStep0: "публикация в стор идёт из useLayoutEffect, до отрисовки (N-050)",
  setStep1FooterAction: "то же для футера Шага 1: useLayoutEffect + сброс при размонтировании",
  setIsActionFormVisible: "IntersectionObserver: видимость формы — факт из браузера",
  setAnimKey: "перезапуск CSS-анимации при смене суммы, а не хранение данных",
  setPrefillTrigger: "разовый сигнал о приезде набора из каталога",
  setOpen: "закрытие лайтбокса по Escape — обработчик события",
  setIsDesktopServicesOpen: "закрытие меню по клику вне и Escape — обработчик события",
  setIsMobileServicesOpen: "то же для мобильного меню",
  setHasActiveCartBar: "MutationObserver: наличие бара корзины в DOM",
  setIsHeroVisible: "IntersectionObserver: видимость секции",
  setIsPriceVisible: "IntersectionObserver: видимость секции",
  setIsActionVisible: "IntersectionObserver: видимость секции",
};

/**
 * Файлы, где мост к внешнему стору пока остаётся эффектом.
 * Логика слияния при этом вынесена в чистые функции и покрыта тестами —
 * эффект только доставляет результат.
 */
const ALLOWED_BRIDGES = {
  "components/calculator-modal/calculator-modal-context.tsx":
    "mergeLightingIntoSnapshot — мост к стору снапшота, слияние чистое",
  "components/calculator-modal/wizard-step2-summary.tsx":
    "mergeInstallExtraIntoSnapshot — то же для досчёта монтажа",
  "app/uslugi/prodazha-trekovogo-osveshcheniya/_components/CatalogSectionClient.tsx":
    "корзина каталога страницы → снапшот: сборка вынесена в catalog-checkout.ts",
};

async function collectFiles(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      out.push(...(await collectFiles(full)));
    } else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
      out.push(full);
    }
  }
  return out;
}

/** Тела всех `useEffect(` в файле — по балансу скобок. */
function effectBodies(source) {
  const bodies = [];
  const marker = "useEffect(";

  let from = 0;
  for (;;) {
    const start = source.indexOf(marker, from);
    if (start === -1) break;

    let depth = 0;
    let end = start + marker.length - 1;
    for (let i = start + marker.length - 1; i < source.length; i += 1) {
      const ch = source[i];
      if (ch === "(") depth += 1;
      else if (ch === ")") {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }

    bodies.push({ text: source.slice(start, end), offset: start });
    from = end;
  }

  return bodies;
}

function lineOf(source, offset) {
  return source.slice(0, offset).split("\n").length;
}

const violations = [];

for (const root of ROOTS) {
  for (const file of await collectFiles(root)) {
    const source = readFileSync(file, "utf8");
    if (!source.includes("useEffect(")) continue;

    const rel = file.replace(/\\/g, "/");
    if (ALLOWED_BRIDGES[rel]) continue;

    for (const body of effectBodies(source)) {
      for (const match of body.text.matchAll(/\b(set[A-Z]\w*)\s*\(/g)) {
        const setter = match[1];
        if (ALLOWED_SETTERS[setter]) continue;
        if (setter === "setTimeout" || setter === "setInterval") continue;
        // Storage API — не состояние React.
        if (setter === "setItem") continue;

        /**
         * Внутри requestAnimationFrame состояние ставится по кадру браузера,
         * а не «догоняет» рендер: такие вызовы читают геометрию или запускают
         * анимацию, и запретом п. 0.7 не покрываются.
         */
        const before = body.text.slice(0, match.index ?? 0);
        const rafAt = before.lastIndexOf("requestAnimationFrame(");
        if (rafAt !== -1 && !before.slice(rafAt).includes("});")) continue;

        violations.push({
          file: rel,
          line: lineOf(source, body.offset + (match.index ?? 0)),
          setter,
        });
      }
    }
  }
}

if (violations.length > 0) {
  console.error("[effect-setstate] синхронизация состояния через useEffect:");
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line} — ${v.setter}()`);
  }
  console.error(
    "\nПеренесите вычисление в селектор или в обработчик события." +
      "\nЕсли это не синхронизация — добавьте сеттер в ALLOWED_SETTERS с обоснованием."
  );
  process.exit(1);
}

const bridges = Object.keys(ALLOWED_BRIDGES).length;
console.log(
  `[effect-setstate] ok — ${Object.keys(ALLOWED_SETTERS).length} разрешённых сеттеров, ${bridges} моста к стору`
);
