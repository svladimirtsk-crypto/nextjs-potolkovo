// lib/use-utm.ts
// P1.10: UTM persistence — сохраняем UTM-метки в sessionStorage при заходе

"use client";

import { useEffect } from "react";

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "yclid",
  "_openstat",
  "gclid",
  "fbclid",
] as const;

const EXTRA_KEYS = ["first_landing", "first_referrer"] as const;

export function useUtmCapture() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // сохраняем UTM-метки
    for (const key of UTM_KEYS) {
      const v = params.get(key);
      if (v) sessionStorage.setItem(key, v);
    }

    // сохраняем первый landing (если ещё не сохранён)
    if (!sessionStorage.getItem("first_landing")) {
      sessionStorage.setItem("first_landing", window.location.href);
    }

    // сохраняем первый referrer (если ещё не сохранён)
    if (!sessionStorage.getItem("first_referrer")) {
      sessionStorage.setItem(
        "first_referrer",
        document.referrer || window.location.href
      );
    }
  }, []);
}

export function getUtmParams(): Record<string, string> {
  const result: Record<string, string> = {};
  if (typeof window === "undefined") return result;

  for (const key of [...UTM_KEYS, ...EXTRA_KEYS]) {
    const v = sessionStorage.getItem(key);
    if (v) result[key] = v;
  }

  return result;
}
