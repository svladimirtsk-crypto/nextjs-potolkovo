/**
 * PT-020 (A-13, F-14 · T-326) · Фейковый сервер доставки заявок.
 *
 * Зачем он нужен. Каналы доставки (`lib/lead/deliver-telegram.ts`,
 * `lib/lead/deliver-web3forms.ts`) во всех существующих тестах заглушены на
 * уровне модуля — `vi.mock("@/lib/lead/deliver-telegram", …)`. Это правильно с
 * точки зрения правила 7 раздела 2 ТЗ (реальные вызовы в Telegram/Web3Forms в
 * тестах запрещены), но из-за этого сам HTTP-слой каналов не проверен ничем:
 * ни обработка 429/500, ни контракт Web3Forms «HTTP 200, но `success: false` —
 * это провал», ни обрыв соединения, ни поведение при выключенном канале.
 *
 * Здесь — настоящий `node:http`-сервер на 127.0.0.1 и перехват `globalThis.fetch`:
 * запросы к `api.telegram.org` и `api.web3forms.com` переписываются на него, а
 * любой другой внешний вызов бросает исключение. Тест получает реальные сокеты,
 * реальные статусы и реальные тайминги, но наружу не уходит ничего.
 *
 * Перехват намеренно строгий: «молча пропустить неизвестный URL» означало бы,
 * что новый внешний вызов в коде доставки уйдёт в боевой сервис прямо из теста.
 *
 * Канал определяется по пути запроса, а не по заголовку `Host`: после
 * переписывания URL хост становится `127.0.0.1:<port>`, а `host` входит в список
 * запрещённых заголовков fetch и до сервера не доехал бы.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

/** Каналы, которые распознаёт сервер. */
export type FakeChannel = "telegram" | "web3forms" | "alert";

export type FakeRequest = {
  channel: FakeChannel;
  method: string;
  /** Путь и query исходного внешнего URL (`/bot<token>/sendMessage`). */
  path: string;
  headers: Record<string, string | string[] | undefined>;
  body: string;
  /** Тело, разобранное как JSON; `null`, если это не JSON. */
  json: unknown;
  at: number;
};

export type FakeResponseSpec = {
  /** Код ответа. По умолчанию 200. */
  status?: number;
  /** Тело как JSON. По умолчанию — «успех» своего канала. */
  json?: unknown;
  /** Тело как есть, вместо `json` — для проверки разбора мусора. */
  text?: string;
  /** Задержка перед ответом, мс. */
  delayMs?: number;
  /**
   * Оборвать соединение без ответа. Так выглядит сетевой сбой: `fetch` бросает
   * исключение, а не возвращает статус.
   */
  dropConnection?: boolean;
  /**
   * Не отвечать вовсе. Для проверок, что вызывающий код не висит вечно: тест
   * обязан сам передать `AbortSignal`.
   */
  hang?: boolean;
};

export type FakeDeliveryServer = {
  /** Адрес фейкового сервера (`http://127.0.0.1:<port>`). */
  url: string;
  /** Все принятые запросы по порядку. */
  requests: FakeRequest[];
  /** Сколько запросов принято по каналу. */
  count(channel: FakeChannel): number;
  /** Последний запрос по каналу. */
  last(channel: FakeChannel): FakeRequest | undefined;
  /**
   * Что отвечать каналу. Массив — последовательность: первый запрос получает
   * первый ответ и т. д., после конца списка повторяется последний элемент
   * (удобно для «упасть дважды, потом восстановиться»).
   */
  respond(channel: FakeChannel | "*", spec: FakeResponseSpec | FakeResponseSpec[]): void;
  /** Забыть запросы и настроенные ответы. */
  reset(): void;
  /** Поставить перехват `globalThis.fetch`. */
  install(): void;
  /** Снять перехват. */
  uninstall(): void;
  /** Остановить сервер (в том числе зависшие соединения). */
  close(): Promise<void>;
};

/** Токены различаются — по ним разделяем бота заявок и бота алертов. */
export const FAKE_TELEGRAM_TOKEN = "fake-telegram-token";
export const FAKE_ALERT_TELEGRAM_TOKEN = "fake-alert-telegram-token";
export const FAKE_WEB3FORMS_KEY = "fake-web3forms-key";

/** Хосты, которые перехватываются. */
const INTERCEPTED_HOSTS = ["api.telegram.org", "api.web3forms.com"] as const;

function defaultResponse(channel: FakeChannel): FakeResponseSpec {
  // Web3Forms считает успехом только `{ success: true }` — это часть контракта.
  if (channel === "web3forms") return { status: 200, json: { success: true } };
  return { status: 200, json: { ok: true, result: { message_id: 1 } } };
}

function channelOf(path: string): FakeChannel {
  if (path.startsWith("/submit")) return "web3forms";
  if (path.includes(FAKE_ALERT_TELEGRAM_TOKEN)) return "alert";
  return "telegram";
}

function rawUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return (input as Request).url;
}

export async function startFakeDelivery(): Promise<FakeDeliveryServer> {
  const responses = new Map<FakeChannel | "*", FakeResponseSpec[]>();
  const requests: FakeRequest[] = [];
  let installed = false;
  let originalFetch: typeof globalThis.fetch | null = null;

  const server: Server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = [];

    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      const path = String(req.url ?? "/");
      const channel = channelOf(path);

      let json: unknown = null;
      try {
        json = body ? JSON.parse(body) : null;
      } catch {
        json = null; // тело не JSON — тест вправе прислать и мусор
      }

      requests.push({
        channel,
        method: String(req.method),
        path,
        headers: req.headers,
        body,
        json,
        at: Date.now(),
      });

      const spec = nextSpec(channel);

      if (spec.hang) return; // соединение остаётся открытым — прерывать обязан клиент
      if (spec.dropConnection) {
        req.socket.destroy();
        return;
      }

      const send = () => {
        const payload =
          spec.text ?? JSON.stringify(spec.json ?? defaultResponse(channel).json ?? { ok: true });
        res.writeHead(spec.status ?? 200, { "Content-Type": "application/json" });
        res.end(payload);
      };

      if (spec.delayMs && spec.delayMs > 0) setTimeout(send, spec.delayMs);
      else send();
    });
  });

  function nextSpec(channel: FakeChannel): FakeResponseSpec {
    const queue = responses.get(channel) ?? responses.get("*");
    if (!queue || queue.length === 0) return defaultResponse(channel);

    // Запрос уже добавлен в список, поэтому индекс последнего — count - 1.
    const index = requests.filter((request) => request.channel === channel).length - 1;
    return queue[Math.min(Math.max(index, 0), queue.length - 1)];
  }

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  const url = `http://127.0.0.1:${address.port}`;

  function rewrite(input: RequestInfo | URL): string | null {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl(input));
    } catch {
      return null; // относительный URL — не внешний вызов
    }

    if (!INTERCEPTED_HOSTS.includes(parsed.host as (typeof INTERCEPTED_HOSTS)[number])) return null;
    return `${url}${parsed.pathname}${parsed.search}`;
  }

  const api: FakeDeliveryServer = {
    url,
    requests,
    count: (channel) => requests.filter((request) => request.channel === channel).length,
    last: (channel) => [...requests].reverse().find((request) => request.channel === channel),
    respond(channel, spec) {
      responses.set(channel, Array.isArray(spec) ? spec : [spec]);
    },
    reset() {
      responses.clear();
      requests.length = 0;
    },
    install() {
      if (installed) return;
      originalFetch = globalThis.fetch;
      const passthrough = originalFetch;

      globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
        const rewritten = rewrite(input);
        if (rewritten) return passthrough.call(globalThis, rewritten, init);

        const raw = rawUrl(input);
        // Относительные URL и локальные адреса не трогаем: тест может звать свой же API.
        if (!/^https?:\/\//i.test(raw) || /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])/i.test(raw)) {
          return passthrough.call(globalThis, input as never, init);
        }

        throw new Error(
          `PT-020: внешний вызов в тесте запрещён (правило 7 раздела 2 ТЗ): ${raw}. ` +
            `Хост нужно добавить в INTERCEPTED_HOSTS фейкового сервера доставки.`
        );
      }) as typeof globalThis.fetch;

      installed = true;
    },
    uninstall() {
      if (!installed || !originalFetch) return;
      globalThis.fetch = originalFetch;
      installed = false;
      originalFetch = null;
    },
    async close() {
      api.uninstall();
      // Зависшие соединения (spec.hang) не дали бы серверу закрыться самому.
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };

  return api;
}
