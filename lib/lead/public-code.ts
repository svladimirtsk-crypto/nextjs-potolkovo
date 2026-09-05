/**
 * N-001 · Короткий код заявки.
 *
 * Вынесен в отдельный модуль, чтобы `store-pg.ts` не тянул за собой
 * in-memory реализацию (а вместе с ней — лишний код в серверный бандл).
 *
 * Алфавит без `I`, `O`, `0`, `1`: код диктуют по телефону, похожие символы
 * приводят к «не могу найти вашу заявку».
 */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Короткий человекочитаемый код заявки, напр. `K7F3Q`. */
export function generatePublicCode(): string {
  let code = "";
  for (let i = 0; i < 5; i += 1) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}
