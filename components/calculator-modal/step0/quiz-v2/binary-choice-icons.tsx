"use client";

/** PT-045: один SVG-язык для пар «выкл/вкл». Иконка декоративна; текст обязателен. */
export type BinaryChoiceKind = "cornice-light" | "chandelier" | "spotlight";

export function BinaryChoiceIcon({ kind, enabled }: { kind: BinaryChoiceKind; enabled: boolean }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" data-binary-kind={kind} data-binary-enabled={enabled}>
    {kind === "cornice-light" ? (
      <path d="M12 3v2M4 11H3m18 0h-1M7 5 6 4m11 1 1-1M8 13a4 4 0 1 1 8 0c0 2-2 2.5-2 5h-4c0-2.5-2-3-2-5ZM10 21h4M10 18h4" />
    ) : kind === "chandelier" ? (
      <path d="M12 2v9M5 14c3-1 5-2 7-5 2 3 4 4 7 5M5 14v4m14-4v4m-7-7v7M3 18h4m10 0h4m-11 0h4M8 20h8" />
    ) : (
      <path d="M3 5h18M8 5l2 8h4l2-8M9 13h6M12 16v5m-4-4-2 3m10-3 2 3" />
    )}
    {!enabled ? <path d="M3 21 21 3" strokeWidth="2" /> : null}
  </svg>;
}
