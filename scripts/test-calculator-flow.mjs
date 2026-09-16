import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);

const source = fs.readFileSync(new URL("../lib/calculator-flow.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
    strict: true,
  },
});

const compiledModule = { exports: {} };
vm.runInNewContext(
  outputText,
  { module: compiledModule, exports: compiledModule.exports, require },
  { filename: "calculator-flow.cjs" }
);

const {
  fillCallbackWindow,
  resolveInitialLightingTab,
  resolveInitialLightingView,
  resolveInitialWizardStep,
  resolveLightingDiscountMode,
  resolveStep0SummaryActions,
  resolveStep2Copy,
} = compiledModule.exports;

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("Step 0 summary routing decision table", () => {
  const cases = [
    [
      { scenario: "standard", hasLighting: false },
      {
        primary: { label: "К итогу →", destination: 2 },
        secondary: { label: "Подобрать свет −25% →", destination: 1 },
      },
    ],
    [
      { scenario: "standard", hasLighting: true },
      {
        primary: { label: "К итогу →", destination: 2 },
        secondary: { label: "Проверить свет →", destination: 1 },
      },
    ],
    [
      { scenario: "modern", hasLighting: false },
      {
        primary: { label: "Подобрать свет −25% →", destination: 1 },
        secondary: { label: "К итогу →", destination: 2 },
      },
    ],
    [
      { scenario: "modern", hasLighting: true },
      {
        primary: { label: "Проверить освещение →", destination: 1 },
        secondary: { label: "К итогу →", destination: 2 },
      },
    ],
    [
      { scenario: "advanced", hasLighting: false },
      {
        primary: { label: "Связаться и обсудить →", destination: 2 },
        secondary: { label: "Подобрать свет −25% →", destination: 1 },
      },
    ],
    [
      { scenario: "advanced", hasLighting: true },
      {
        primary: { label: "Связаться и обсудить →", destination: 2 },
        secondary: { label: "Проверить свет →", destination: 1 },
      },
    ],
  ];

  for (const [input, expected] of cases) {
    assert.deepEqual(plain(resolveStep0SummaryActions(input)), expected, JSON.stringify(input));
  }
});

test("lighting discount mode decision table", () => {
  const cases = [
    [{ hasLighting: false, regularTotal: 0, discountEligibleWithCeiling: false, entryMode: "default" }, "none"],
    [{ hasLighting: true, regularTotal: 0, discountEligibleWithCeiling: false, entryMode: "default" }, "none"],
    [{ hasLighting: true, regularTotal: 10000, discountEligibleWithCeiling: false, entryMode: "default" }, "none"],
    [{ hasLighting: true, regularTotal: 10000, discountEligibleWithCeiling: true, entryMode: "default" }, "with-ceiling"],
    [{ hasLighting: true, regularTotal: 10000, discountEligibleWithCeiling: false, entryMode: "lighting-first" }, "lighting-only"],
    [{ hasLighting: true, regularTotal: 10000, discountEligibleWithCeiling: true, entryMode: "lighting-first" }, "with-ceiling"],
  ];

  for (const [input, expected] of cases) {
    assert.equal(resolveLightingDiscountMode(input), expected, JSON.stringify(input));
  }
});

test("initial modal options for default and lighting-first flows", () => {
  assert.equal(resolveInitialWizardStep({ entryMode: "default", initialStep: undefined }), 0);
  assert.equal(resolveInitialWizardStep({ entryMode: "lighting-first", initialStep: undefined }), 1);
  assert.equal(resolveInitialWizardStep({ entryMode: "lighting-first", initialStep: 0 }), 0);

  assert.equal(resolveInitialLightingTab({ entryMode: "default", initialLightingTab: undefined }), undefined);
  assert.equal(resolveInitialLightingTab({ entryMode: "lighting-first", initialLightingTab: undefined }), "catalog");
  assert.equal(resolveInitialLightingTab({ entryMode: "lighting-first", initialLightingTab: "recommendations" }), "recommendations");

  assert.equal(resolveInitialLightingView({ entryMode: "default", initialLightingView: undefined }), undefined);
  assert.equal(resolveInitialLightingView({ entryMode: "lighting-first", initialLightingView: undefined }), "browse");
  assert.equal(resolveInitialLightingView({ entryMode: "lighting-first", initialLightingView: "selected" }), "selected");
});

// Подписей кнопок Шага 0 здесь намеренно нет.
//
// Этот харнесс транспилирует `lib/calculator-flow.ts` в изолированный модуль
// через `vm` и не разрешает импорты, поэтому проверить можно только то, что
// определено в самом этом файле. Подписи живут в `getParamConfirmLabel`
// (`lib/step0-fsm.ts`) — их проверяет `tests/step0-fsm.test.ts` в vitest, где
// импорты работают штатно.
//
// Раньше здесь был блок «Step 0 confirm labels are stable», который звал
// `resolveStep0ConfirmLabel` — функцию, которой в `calculator-flow.ts` никогда
// не было. Тест падал с `TypeError: resolveStep0ConfirmLabel is not a function`
// и ожидал для `lights` текст «Подтвердить точки →», не совпадавший ни с одним
// из существовавших значений.

test("90-case combined flow matrix keeps routing and discount invariants", () => {
  const scenarios = ["standard", "modern", "advanced"];
  const lightingStates = [false, true];
  const entryModes = [undefined, "default", "lighting-first"];
  const ceilingStates = ["unstarted", "editing", "summary", "confirmed", "changed-after-confirm"];

  let checked = 0;

  for (const scenario of scenarios) {
    for (const hasLighting of lightingStates) {
      for (const entryMode of entryModes) {
        for (const ceilingState of ceilingStates) {
          checked += 1;

          const route = resolveStep0SummaryActions({ scenario, hasLighting });
          assert.ok([1, 2].includes(route.primary.destination));
          assert.ok(route.primary.label.length > 0);

          if (route.secondary) {
            assert.ok([1, 2].includes(route.secondary.destination));
            assert.notEqual(route.primary.label, route.secondary.label);
          }

          if (scenario === "modern" && !hasLighting) {
            assert.equal(route.primary.destination, 1);
            assert.equal(route.secondary?.destination, 2);
          }

          if (scenario === "standard") {
            assert.equal(route.primary.destination, 2);
          }

          if (scenario === "advanced") {
            assert.equal(route.primary.destination, 2);
          }

          const ceilingConfirmed = ceilingState === "confirmed";
          const discountMode = resolveLightingDiscountMode({
            hasLighting,
            regularTotal: hasLighting ? 10000 : 0,
            discountEligibleWithCeiling: ceilingConfirmed,
            entryMode,
          });

          if (!hasLighting) {
            assert.equal(discountMode, "none");
          } else if (ceilingConfirmed) {
            assert.equal(discountMode, "with-ceiling");
          } else if (entryMode === "lighting-first") {
            assert.equal(discountMode, "lighting-only");
          } else {
            assert.equal(discountMode, "none");
          }
        }
      }
    }
  }

  assert.equal(checked, 90);
});

test("unknown scenario falls back to standard summary routing", () => {
  assert.deepEqual(
    plain(resolveStep0SummaryActions({ scenario: undefined, hasLighting: false })),
    {
      primary: { label: "К итогу →", destination: 2 },
      secondary: { label: "Подобрать свет −25% →", destination: 1 },
    }
  );
});

/* ─── PT-019 · Копирайт Шага 2 и окно перезвона ───
 * До этого харнесс проверял 5 из 7 экспортов `calculator-flow.ts`:
 * `resolveStep2Copy` и `fillCallbackWindow` не проверялись ничем, кроме E2E.
 * Оба отвечают за текст, который видит клиент в шаге заявки, а подстановка
 * окна перезвона приходит с сервера (`/api/lead`) — если placeholder разъедется
 * с фактом, клиент увидит «Перезвоню {callbackWindow}». */

const STEP2_INTENTS = [
  "ceiling_only",
  "lighting_with_ceiling",
  "lighting_only",
  "advanced",
  "direct",
];

test("step 2 copy is defined for every intent and keeps the callback placeholder", () => {
  for (const intent of STEP2_INTENTS) {
    const copy = resolveStep2Copy(intent);

    assert.ok(copy, `нет копирайта для ${intent}`);
    assert.equal(typeof copy.submitLabel, "string", `submitLabel для ${intent}`);
    assert.ok(copy.submitLabel.length > 0, `пустая подпись кнопки для ${intent}`);
    assert.ok(Array.isArray(copy.chips) && copy.chips.length > 0, `нет чипов для ${intent}`);
    assert.equal(typeof copy.showFulfilment, "boolean", `showFulfilment для ${intent}`);

    // Окно перезвона подставляется сервером — место под него обязано быть.
    const withPlaceholder = copy.nextSteps.filter((step) => step.includes("{callbackWindow}"));
    assert.equal(withPlaceholder.length, 1, `ровно один placeholder в «Что дальше» для ${intent}`);
  }
});

test("step 2 copy: «только свет» спрашивает получение, «напрямую» не дублирует заголовок", () => {
  // Свет без потолка — это счёт и доставка: спрашиваем способ получения и время.
  assert.equal(resolveStep2Copy("lighting_only").showFulfilment, true);
  for (const intent of ["ceiling_only", "lighting_with_ceiling", "advanced", "direct"]) {
    assert.equal(resolveStep2Copy(intent).showFulfilment, false, `showFulfilment для ${intent}`);
  }

  // Потолок и «потолок + свет» — одна и та же форма.
  assert.deepEqual(plain(resolveStep2Copy("ceiling_only")), plain(resolveStep2Copy("lighting_with_ceiling")));

  // `direct`: заголовок и подзаголовок задаёт секция страницы, форма их не дублирует.
  const direct = resolveStep2Copy("direct");
  assert.equal(direct.formTitle, "");
  assert.equal(direct.formSubtitle, "");
  assert.equal(direct.submitLabel, resolveStep2Copy("ceiling_only").submitLabel);

  // Незнаковый интент (пришёл из старого черновика) — откат к форме потолка, а не undefined.
  assert.deepEqual(plain(resolveStep2Copy("unknown_intent")), plain(resolveStep2Copy("ceiling_only")));
});

test("fillCallbackWindow подставляет окно, а при пустом — честное «в ближайшее время»", () => {
  const steps = ["Перезвоню {callbackWindow}", "Бесплатный замер, фиксирую смету"];

  assert.deepEqual(fillCallbackWindow(steps, "сегодня с 18:00 до 20:00"), [
    "Перезвоню сегодня с 18:00 до 20:00",
    "Бесплатный замер, фиксирую смету",
  ]);

  // Пустое или пробельное окно — не дыра в тексте и не «Перезвоню ».
  for (const empty of ["", "   ", "\t"]) {
    assert.deepEqual(fillCallbackWindow(steps, empty), [
      "Перезвоню в ближайшее время",
      "Бесплатный замер, фиксирую смету",
    ], `пустое окно: ${JSON.stringify(empty)}`);
  }

  // Исходный массив не мутируется: шаги переиспользуются между рендерами.
  assert.deepEqual(steps, ["Перезвоню {callbackWindow}", "Бесплатный замер, фиксирую смету"]);

  // Placeholder не остался — иначе клиент увидит фигурные скобки.
  for (const intent of STEP2_INTENTS) {
    const filled = fillCallbackWindow(resolveStep2Copy(intent).nextSteps, "завтра утром");
    assert.ok(
      filled.every((step) => !step.includes("{callbackWindow}")),
      `остался placeholder для ${intent}`
    );
  }
});
