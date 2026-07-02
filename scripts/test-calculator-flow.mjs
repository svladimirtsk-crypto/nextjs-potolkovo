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
  resolveInitialLightingTab,
  resolveInitialLightingView,
  resolveInitialWizardStep,
  resolveLightingDiscountMode,
  resolveStep0ConfirmLabel,
  resolveStep0SummaryActions,
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
        secondary: null,
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

test("Step 0 confirm labels are stable", () => {
  assert.equal(resolveStep0ConfirmLabel("area"), "Подтвердить площадь →");
  assert.equal(resolveStep0ConfirmLabel("ceiling"), "Подтвердить тип →");
  assert.equal(resolveStep0ConfirmLabel("shadowProfile"), "Подтвердить профиль →");
  assert.equal(resolveStep0ConfirmLabel("floatingProfile"), "Подтвердить профиль →");
  assert.equal(resolveStep0ConfirmLabel("lightLines"), "Подтвердить линии →");
  assert.equal(resolveStep0ConfirmLabel("cornice"), "Подтвердить карниз →");
  assert.equal(resolveStep0ConfirmLabel("track"), "Подтвердить трек →");
  assert.equal(resolveStep0ConfirmLabel("chandeliers"), "Подтвердить люстры →");
  assert.equal(resolveStep0ConfirmLabel("lights"), "Подтвердить точки →");
});

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
            assert.equal(route.secondary, null);
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
