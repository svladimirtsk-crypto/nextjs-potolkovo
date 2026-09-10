import Link from "next/link";

type TextLinkProps = {
  href: string;
  children: React.ReactNode;
  className?: string;
};

function isExternalHref(href: string) {
  return href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("tel:");
}

export function TextLink({
  href,
  children,
  className = "",
}: TextLinkProps) {
  const classes = [
    "text-sm text-slate-600 underline decoration-slate-300 underline-offset-4 transition-colors hover:text-slate-950 hover:decoration-slate-950",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (isExternalHref(href)) {
    return (
      <a
        href={href}
        className={classes}
        target={href.startsWith("http") ? "_blank" : undefined}
        rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
      >
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}
