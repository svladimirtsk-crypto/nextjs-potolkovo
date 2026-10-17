/**
 * PT-021 · Откуда берётся IP клиента и чему мы верим.
 *
 * Раньше `clientIp()` брал первый элемент `x-forwarded-for` как есть. Но этот
 * заголовок формируется цепочкой прокси: самый левый элемент — то, что
 * прислал сам клиент, и подделать его может кто угодно. Первый элемент
 * доверять нельзя никогда, иначе лимит заявок обходится одной строкой в
 * заголовке, а в БД остаётся чужой IP.
 *
 * Как устроена цепочка: каждый прокси дописывает в конец адрес того, кто к
 * нему пришёл. Значит последние `hops` элементов дописаны нашими прокси, а
 * адрес клиента, который видит ближайший доверенный прокси, стоит на позиции
 * `len - hops`. Хвост при этом отбрасывается: всё, что было левее, клиент мог
 * написать сам.
 *
 * `hops` — это количество прокси МЕЖДУ клиентом и приложением, которым мы
 * верим. Значение задаётся `LEAD_TRUSTED_PROXY_HOPS`; по умолчанию 1 — одна
 * платформенная точка входа. Это кодовое решение, **а не подтверждение
 * конфигурации конкретной платформы**: реальное число прыжков у Amvera/Vercel
 * нужно сверить с провайдером и зафиксировать в STATUS. Пока этого не сделано,
 * значение остаётся `platform_verified: false` (см. RELEASE-OPERATIONS).
 */
import { isIP } from "node:net";

export type ClientIpSource = "x-forwarded-for" | "x-real-ip" | "unknown";

export type ClientIpResolution = {
  /** Нормализованный адрес или `"unknown"`, если доверенного источника нет. */
  ip: string;
  source: ClientIpSource;
  /** Сколько прокси мы договорились считать своими. */
  hops: number;
  reason:
    | "trusted"
    | "no-trusted-proxy"
    | "header-missing"
    | "chain-too-short"
    | "invalid-address";
};

type HeaderReader = { get(name: string): string | null };

/**
 * Приводит значение заголовка к чистому IP.
 *
 * Прокси иногда пишут `1.2.3.4:5678` или `[2001:db8::1]:443`; `unknown` и
 * `unix:` встречаются у самодельных прокси и адресами не являются. Всё, что
 * не проходит `net.isIP`, считается невалидным — «на глаз» угадывать нельзя.
 */
export function normalizeIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = raw.trim();
  if (!value) return null;

  // [IPv6]:port и [IPv6]
  if (value.startsWith("[")) {
    const end = value.indexOf("]");
    if (end < 0) return null;
    value = value.slice(1, end);
  } else {
    // IPv4:port — только если после двоеточия цифры и до него ровно IPv4.
    const withPort = value.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d{1,5}$/);
    if (withPort) value = withPort[1];
  }

  return isIP(value) ? value.toLowerCase() : null;
}

/**
 * Определяет адрес клиента по заголовкам и числу доверенных прокси.
 *
 * `hops = 0` — доверенных прокси нет: заголовки `x-forwarded-for` и
 * `x-real-ip` полностью игнорируются, потому что их может прислать сам
 * клиент. Это честнее подделки: все запросы попадут в общую корзину
 * `unknown`, и мы увидим это по метрике, а не получим «разных клиентов».
 */
export function resolveClientIp(headers: HeaderReader, hops: number): ClientIpResolution {
  const safeHops = Number.isInteger(hops) && hops >= 0 ? hops : 0;

  if (safeHops === 0) {
    return { ip: "unknown", source: "unknown", hops: safeHops, reason: "no-trusted-proxy" };
  }

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length < safeHops) {
      // Цепочка короче, чем число доверенных прокси: это либо запрос в обход
      // прокси, либо подделка. Адрес не принимаем.
      return { ip: "unknown", source: "unknown", hops: safeHops, reason: "chain-too-short" };
    }

    const candidate = normalizeIp(parts[parts.length - safeHops]);
    if (!candidate) {
      return { ip: "unknown", source: "unknown", hops: safeHops, reason: "invalid-address" };
    }

    return { ip: candidate, source: "x-forwarded-for", hops: safeHops, reason: "trusted" };
  }

  /**
   * `x-real-ip` ставит платформенный прокси и перезаписывает клиентское
   * значение. Принимаем его только когда доверенные прокси объявлены — при
   * `hops = 0` этот заголовок тоже подделывается.
   */
  const realIp = headers.get("x-real-ip");
  if (realIp) {
    const candidate = normalizeIp(realIp);
    if (!candidate) {
      return { ip: "unknown", source: "unknown", hops: safeHops, reason: "invalid-address" };
    }
    return { ip: candidate, source: "x-real-ip", hops: safeHops, reason: "trusted" };
  }

  return { ip: "unknown", source: "unknown", hops: safeHops, reason: "header-missing" };
}
