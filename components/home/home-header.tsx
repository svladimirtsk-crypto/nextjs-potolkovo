import Link from "next/link";

import { contacts } from "@/content/contacts";
import { homepage } from "@/content/homepage";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export function HomeHeader() {
  return (
    <header className="sticky top-0 z-50 bg-white/96 shadow-[0_1px_0_rgba(15,23,42,0.08)] backdrop-blur supports-[backdrop-filter]:bg-white/88">
      <Container className="flex min-h-[var(--header-height)] items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex shrink-0 items-center font-mono text-sm font-bold uppercase tracking-[0.24em] text-slate-950 sm:text-[15px]"
          aria-label={contacts.brandName}
        >
          {contacts.brandShortName}
        </Link>

        <nav className="hidden items-center gap-7 lg:flex">
          {homepage.header.navItems.map((item) => (
            <a
              key={item.targetId}
              href={`#${item.targetId}`}
              className="text-sm font-medium text-slate-700 transition-colors hover:text-slate-950"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <a
            href={contacts.phoneHref}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-950 transition-colors hover:bg-slate-50 sm:hidden"
            aria-label={`${homepage.header.phoneLabelPrefix ?? "Позвонить"} ${contacts.phoneDisplay}`}
            title={contacts.phoneDisplay}
          >
            <span aria-hidden="true">📞</span>
          </a>

          <a
            href={contacts.phoneHref}
            className="hidden min-h-11 items-center rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-800 transition-colors hover:border-slate-300 hover:text-slate-950 sm:inline-flex"
            aria-label={`${homepage.header.phoneLabelPrefix ?? "Позвонить"} ${contacts.phoneDisplay}`}
          >
            {contacts.phoneDisplay}
          </a>

          <Button href="#action" className="whitespace-nowrap px-4 sm:px-5">
            <span className="sm:hidden">Замер</span>
            <span className="hidden sm:inline">{homepage.header.primaryCtaLabel}</span>
          </Button>
        </div>
      </Container>
    </header>
  );
}
