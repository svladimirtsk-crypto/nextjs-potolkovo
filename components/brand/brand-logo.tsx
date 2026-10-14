import Link from "next/link";

/** Company wordmark: deliberately no portrait or individual name. */
export function BrandLogo() {
  return (
    <Link href="/" className="pk-logo" aria-label="ПОТОЛКОВО — главная">
      <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <path d="M4 33V8h30v25" stroke="currentColor" strokeWidth="3" />
        <path d="M12 16h14" stroke="#a9844b" strokeWidth="3" />
        <path d="M19 16v11" stroke="currentColor" strokeWidth="3" />
      </svg>
      <span><b>ПОТОЛКОВО</b><small>ПОТОЛКИ · СВЕТ · МОНТАЖ</small></span>
    </Link>
  );
}
