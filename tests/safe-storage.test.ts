/**
 * PT-012 · Единая безопасная обёртка над web-хранилищем.
 *
 * Принимается не «мы обернули в try/catch», а конкретное поведение: при
 * заблокированном хранилище ничего не летит наружу, запись честно сообщает
 * `false`, а захват атрибуции не срывает открытие калькулятора.
 *
 * Три реальных сценария отказа, которые здесь воспроизведены:
 * - обращение к `window.sessionStorage` бросает `SecurityError`
 *   (запрещённые сторонние cookie, iframe, корпоративная политика);
 * - `getItem`/`setItem` бросают (приватный режим Safari: квота 0);
 * - `window` нет вовсе (SSR).
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getWebStorage,
  readWebStorage,
  removeWebStorage,
  writeWebStorage,
  writeWebStorageIfAbsent,
} from "../lib/safe-storage";

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Рабочее хранилище в памяти — чтобы отличать «нет доступа» от «пусто». */
function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map<string, string>(Object.entries(initial));
  return {
    data,
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => Array.from(data.keys())[index] ?? null,
    removeItem: (key: string) => void data.delete(key),
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

function stubWindow(sessionStorage: unknown) {
  vi.stubGlobal("window", { sessionStorage } as unknown as Window);
}

describe("PT-012 · safe-storage без браузера", () => {
  it("SSR: хранилища нет, но и исключения нет", () => {
    vi.stubGlobal("window", undefined);

    expect(getWebStorage("session")).toBeNull();
    expect(getWebStorage("local")).toBeNull();
    expect(readWebStorage("session", "first_landing")).toBeNull();
    expect(writeWebStorage("session", "first_landing", "/")).toBe(false);
    expect(writeWebStorageIfAbsent("session", "utm_source", "vk")).toBe(false);
    expect(() => removeWebStorage("session", "first_landing")).not.toThrow();
  });
});

describe("PT-012 · safe-storage при запрете доступа", () => {
  it("геттер sessionStorage бросает SecurityError — читаем null", () => {
    const hostile = {};
    Object.defineProperty(hostile, "sessionStorage", {
      get() {
        throw new DOMException("Denied", "SecurityError");
      },
    });
    vi.stubGlobal("window", hostile);

    expect(getWebStorage("session")).toBeNull();
    expect(readWebStorage("session", "utm_source")).toBeNull();
    expect(writeWebStorage("session", "utm_source", "vk")).toBe(false);
    expect(() => removeWebStorage("session", "utm_source")).not.toThrow();
  });

  it("getItem бросает — значение считается отсутствующим", () => {
    const storage = memoryStorage();
    storage.getItem = () => {
      throw new DOMException("Denied", "SecurityError");
    };
    stubWindow(storage);

    expect(readWebStorage("session", "utm_source")).toBeNull();
  });

  it("setItem бросает QuotaExceededError (приватный режим Safari) — запись false", () => {
    const storage = memoryStorage();
    storage.setItem = () => {
      throw new DOMException("QuotaExceededError", "QuotaExceededError");
    };
    stubWindow(storage);

    expect(writeWebStorage("session", "potolkovo:calc-draft:v2", "{}")).toBe(false);
    expect(writeWebStorageIfAbsent("session", "utm_source", "vk")).toBe(false);
  });
});

describe("PT-012 · safe-storage в обычном режиме", () => {
  it("читает, пишет и удаляет", () => {
    const storage = memoryStorage({ utm_source: "yandex" });
    stubWindow(storage);

    expect(readWebStorage("session", "utm_source")).toBe("yandex");
    expect(readWebStorage("session", "нет-такого")).toBeNull();

    expect(writeWebStorage("session", "first_landing", "/uslugi")).toBe(true);
    expect(storage.data.get("first_landing")).toBe("/uslugi");

    removeWebStorage("session", "first_landing");
    expect(storage.data.has("first_landing")).toBe(false);
  });

  it("writeIfAbsent не перезаписывает первое значение (first-click attribution)", () => {
    const storage = memoryStorage({ utm_source: "yandex" });
    stubWindow(storage);

    expect(writeWebStorageIfAbsent("session", "utm_source", "vk")).toBe(false);
    expect(storage.data.get("utm_source")).toBe("yandex");

    expect(writeWebStorageIfAbsent("session", "utm_medium", "cpc")).toBe(true);
    expect(storage.data.get("utm_medium")).toBe("cpc");
  });
});

describe("PT-012 · захват атрибуции переживает заблокированное хранилище", () => {
  function stubLocationAndReferrer() {
    vi.stubGlobal("document", { referrer: "https://yandex.ru/search/?utm_source=yandex&email=x@y.z" });
  }

  it("с рабочим хранилищем пишет allowlist и чистит URL", async () => {
    const storage = memoryStorage();
    stubWindow(storage);
    vi.stubGlobal("window", {
      sessionStorage: storage,
      location: { pathname: "/uslugi/tenevye-potolki", search: "?utm_source=vk&email=x@y.z" },
    } as unknown as Window);
    stubLocationAndReferrer();

    const { captureAttributionOnce } = await import("../lib/attribution-capture");
    captureAttributionOnce();

    expect(storage.data.get("utm_source")).toBe("vk");
    // Персональный параметр не попадает даже в хранилище браузера.
    expect(storage.data.get("first_landing")).toBe("/uslugi/tenevye-potolki?utm_source=vk");
    expect(storage.data.get("first_referrer")).toBe("https://yandex.ru/search/?utm_source=yandex");
    expect(storage.data.has("email")).toBe(false);
  });

  it("с запрещённым хранилищем не бросает исключение", async () => {
    const hostile = {
      location: { pathname: "/", search: "?utm_source=vk" },
    };
    Object.defineProperty(hostile, "sessionStorage", {
      get() {
        throw new DOMException("Denied", "SecurityError");
      },
    });
    vi.stubGlobal("window", hostile as unknown as Window);
    stubLocationAndReferrer();

    const { captureAttributionOnce } = await import("../lib/attribution-capture");

    expect(() => captureAttributionOnce()).not.toThrow();
  });

  it("повторный вызов не перезаписывает первую атрибуцию", async () => {
    const storage = memoryStorage();
    vi.stubGlobal("window", {
      sessionStorage: storage,
      location: { pathname: "/", search: "?utm_source=yandex" },
    } as unknown as Window);
    stubLocationAndReferrer();

    const { captureAttributionOnce } = await import("../lib/attribution-capture");
    captureAttributionOnce();

    // Вторая точка вызова — открытие модалки: источник уже другой.
    vi.stubGlobal("window", {
      sessionStorage: storage,
      location: { pathname: "/uslugi", search: "?utm_source=google" },
    } as unknown as Window);
    captureAttributionOnce();

    expect(storage.data.get("utm_source")).toBe("yandex");
  });
});
