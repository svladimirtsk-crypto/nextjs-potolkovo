/**
 * PT-009 · Клиентский ключ идемпотентности.
 *
 * Правило из раздела 3.5 ТЗ: «requestId генерируется один раз на попытку
 * отправки и живёт до успеха». Ключевое слово — «до успеха», и именно оно
 * определяет, когда ключ меняют:
 *
 *  - двойной клик и повтор после сетевого сбоя — payload тот же, ключ тот же.
 *    Сервер вернёт прежний результат и не создаст вторую заявку;
 *  - человек после неудачи поправил имя, номер или «когда удобно» — payload
 *    другой, значит это уже другая попытка, и ключ новый. Иначе сервер
 *    ответил бы `409` (тот же requestId с другим хешем), и форма встала бы
 *    намертво: отправить исправленную заявку было бы невозможно;
 *  - успех — ключ сбрасывается. Следующая отправка того же состава (человек
 *    реально хочет отправить вторую заявку) должна создать новую запись.
 *
 * Состояние живёт в модуле, а не в React: форма может размонтироваться между
 * попытками (закрыли модалку, открыли снова), а незавершённая попытка от этого
 * не перестаёт быть незавершённой.
 */
import { fnv1a32, leadPayloadFingerprint } from "./canonical";

let pending: { fingerprint: string; requestId: string } | null = null;

/**
 * UUID на одну попытку отправки.
 *
 * `crypto.randomUUID` есть во всех целевых браузерах, но только в secure
 * context — на `http://` локальной разработки его нет. Фолбэк даёт строку той
 * же формы, иначе разработка без HTTPS теряла бы идемпотентность целиком.
 */
export function createRequestId(): string {
  const cryptoRef = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;

  if (typeof cryptoRef?.randomUUID === "function") {
    return cryptoRef.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof cryptoRef?.getRandomValues === "function") {
    cryptoRef.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }

  // version 4 / variant 10 — форма UUID, а не его криптографическая суть.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Ключ для текущей попытки: прежний, если payload не изменился, иначе новый.
 */
export function acquireRequestId(payload: Record<string, unknown>): string {
  const fingerprint = fnv1a32(leadPayloadFingerprint(payload));

  if (pending && pending.fingerprint === fingerprint) {
    return pending.requestId;
  }

  const requestId = createRequestId();
  pending = { fingerprint, requestId };
  return requestId;
}

/** Сбросить ключ — после успеха или после `409`, когда ключ скомпрометирован. */
export function releaseRequestId(): void {
  pending = null;
}

/** Текущий незавершённый ключ (`null`, если попытки не было). Для тестов. */
export function peekRequestId(): string | null {
  return pending?.requestId ?? null;
}
