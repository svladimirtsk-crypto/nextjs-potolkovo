export function sanitizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}
