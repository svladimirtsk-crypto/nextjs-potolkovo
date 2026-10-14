import type { ReactNode } from "react";

/** B8-005: presentation and announcements only; actions stay with the owning flow. */
export function StatePanel({ tone = "empty", title, description, children, announce, className = "", testId }: {
  tone?: "empty" | "loading" | "error" | "success" | "warning";
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  announce?: "polite" | "assertive";
  className?: string;
  testId?: string;
}) {
  return <div className={`pk-state pk-state--${tone} ${className}`.trim()} data-ui-state={tone}
    data-testid={testId} role={announce === "assertive" ? "alert" : announce === "polite" ? "status" : undefined}>
    <div className="pk-state-heading">
      <span className="pk-state-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          {tone === "loading" ? <path d="M20 12a8 8 0 1 1-8-8" /> : <>
            <circle cx="12" cy="12" r="8" />
            {tone === "success" ? <path d="m8 12 3 3 5-6" /> : <path d="M12 7v6m0 3v1" />}
          </>}
        </svg>
      </span>
      <p className="pk-state-title">{title}</p>
    </div>
    {description && <div className="pk-state-description">{description}</div>}
    {children && <div className="pk-state-content">{children}</div>}
  </div>;
}
