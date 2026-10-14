"use client";

/** Diagram, not a mounting drawing. Deliberately no dimensions or compatibility claims. */
function CeilingDiagram({ kind }: { kind: "standard" | "shadow" | "floating" }) {
  return <svg viewBox="0 0 220 112" fill="none" aria-hidden="true" focusable="false">
    <path d="M28 96V20H203" stroke="#adb9aa" strokeWidth="14" />
    <path d="M36 38V95" stroke="#53675e" strokeWidth="2" />
    <path d="M36 62H205" stroke="#173c36" strokeWidth="2" strokeDasharray="3 5" opacity=".3" />
    {kind === "standard" ? <><path d="M37 52H205" stroke="#173c36" strokeWidth="4" /><path d="M37 52v11h14" stroke="#173c36" strokeWidth="4" /></> :
      kind === "shadow" ? <><path d="M53 52H205" stroke="#173c36" strokeWidth="4" /><path d="M37 48h13v10H37" fill="#173c36" /></> :
        <><path d="M53 52H205" stroke="#173c36" strokeWidth="4" /><path d="M38 53v32" stroke="#d7ed89" strokeWidth="12" /><path d="M39 53v32" stroke="#7b913e" strokeWidth="2" /><path d="M46 47h10v8" stroke="#173c36" strokeWidth="3" /></>}
    <path d="M156 81h47" stroke="#adb9aa" /><circle cx="151" cy="81" r="2" fill="#53675e" />
  </svg>;
}

export function CeilingOption({ active, title, description, price, kind, onClick }: {
  active: boolean; title: string; description: string; price: string;
  kind: "standard" | "shadow" | "floating"; onClick: () => void;
}) {
  return <button type="button" className="pk-ceiling-option" aria-pressed={active} onClick={onClick} data-ceiling-option={kind}>
    <span className="pk-ceiling-diagram"><CeilingDiagram kind={kind} /></span>
    <span className="pk-ceiling-copy"><span className="pk-ceiling-title">{title}<span className="pk-option-check" aria-hidden="true">{active ? "✓" : "+"}</span></span>
      <span className="pk-ceiling-description">{description}</span><span className="pk-ceiling-price">{price}</span></span>
  </button>;
}
