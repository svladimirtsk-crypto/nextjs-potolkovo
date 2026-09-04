/**
 * T-027 · Ограничение частоты заявок: 5 запросов за 10 минут на IP.
 * In-memory (по ТЗ `@upstash/ratelimit` не нужен); дедуп по телефону — в БД.
 */
export const RATE_LIMIT_MAX = 5;
export const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

const hits = new Map<string, number[]>();

export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterSec: number };

export function checkRateLimit(
  key: string,
  now: number = Date.now(),
  max: number = RATE_LIMIT_MAX,
  windowMs: number = RATE_LIMIT_WINDOW_MS
): RateLimitResult {
  const threshold = now - windowMs;
  const recent = (hits.get(key) ?? []).filter((ts) => ts > threshold);

  if (recent.length >= max) {
    hits.set(key, recent);
    const retryAfterSec = Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000));
    return { allowed: false, remaining: 0, retryAfterSec };
  }

  recent.push(now);
  hits.set(key, recent);

  // подчищаем «протухшие» ключи, чтобы Map не рос бесконечно
  if (hits.size > 5000) {
    for (const [k, list] of hits) {
      if (list.every((ts) => ts <= threshold)) hits.delete(k);
    }
  }

  return { allowed: true, remaining: max - recent.length, retryAfterSec: 0 };
}

export function resetRateLimitForTests(): void {
  hits.clear();
}
