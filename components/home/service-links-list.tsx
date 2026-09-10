import Link from "next/link";

import { serviceLinks } from "@/content/service-links";

type ServiceLinksListProps = {
  variant?: "footer" | "header";
  className?: string;
};

export function ServiceLinksList({
  variant = "footer",
  className = "",
}: ServiceLinksListProps) {
  const items =
    variant === "header"
      ? serviceLinks.filter((item) => item.showInHeader)
      : serviceLinks.filter((item) => item.showInFooter);

  return (
    <ul
      className={[
        variant === "header"
          ? "flex flex-wrap items-center gap-x-4 gap-y-2"
          : "space-y-3",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {items.map((item) => (
        <li key={item.slug}>
          <Link
            href={item.href}
            className={
              variant === "header"
                ? "text-sm text-slate-600 transition-colors hover:text-slate-950"
                : "text-sm text-slate-600 transition-colors hover:text-slate-950"
            }
          >
            {variant === "header" && item.shortLabel ? item.shortLabel : item.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
