import {
  ATTRIBUTION_PARAM_KEYS,
  normalizeAttributionUrl,
} from "@/lib/attribution";
import { writeWebStorageIfAbsent } from "@/lib/safe-storage";

/**
 * PT-012 · Захват атрибуции первого касания (first-click).
 *
 * Одна функция вместо двух копий: `app/providers.tsx` писал UTM при загрузке
 * страницы, а `components/calculator-modal/calculator-modal-context.tsx` — тем
 * же кодом при открытии модалки. Копии уже разошлись в деталях (`first_landing`:
 * путь с query против полного `window.location.href`), а главное — обе обращались
 * к `sessionStorage` напрямую, из-за чего заблокированное хранилище роняло
 * `useEffect` и вместе с ним React-дерево страницы.
 *
 * Вызов остаётся в двух местах намеренно: провайдер срабатывает на загрузке
 * страницы, модалка — подстраховка на случай, если хранилище очистили в середине
 * сессии. Функция идемпотентна (`writeWebStorageIfAbsent`), поэтому второй вызов
 * ничего не перезаписывает.
 *
 * Значения нормализуются тем же чистым модулем, что и на сервере: персональные
 * параметры и фрагмент не попадают даже в хранилище браузера, а не только в лид.
 */
export function captureAttributionOnce(): void {
  if (typeof window === "undefined") return;

  const params = new URLSearchParams(window.location.search);
  for (const key of ATTRIBUTION_PARAM_KEYS) {
    const value = params.get(key);
    if (!value) continue;
    writeWebStorageIfAbsent("session", key, value);
  }

  // Первый визит — путь с query, без origin: origin своего сайта информации не
  // добавляет, а место в лимите и в уведомлении занимает.
  writeWebStorageIfAbsent(
    "session",
    "first_landing",
    normalizeAttributionUrl(`${window.location.pathname}${window.location.search}`),
  );

  const referrer = typeof document === "undefined" ? "" : document.referrer;
  if (referrer) {
    writeWebStorageIfAbsent("session", "first_referrer", normalizeAttributionUrl(referrer));
  }
}
