import Link from "next/link";

import { contacts } from "@/content/contacts";
import { homepage } from "@/content/homepage";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export function HomeHeader() {
  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <Container className="flex min-h-[var(--header-height)] items-center justify-between gap-4">
        <Link
          href="/"
          className="font-mono text-sm font-bold uppercase tracking-[0.28em] text-slate-950 sm:text-base"
        >
          {contacts.brandShortName}
        </Link>

        <nav className="hidden items-center gap-6 lg:flex">
          {homepage.header.navItems.map((item) => (
            <a
              key={item.targetId}
              href={`#${item.targetId}`}
              className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-950"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3 sm:gap-4">
          {/* Телефон всегда видим на мобильных */}
          <a
            href={contacts.phoneHref}
            className="hidden text-sm font-medium text-slate-700 hover:text-slate-950 sm:inline-flex"
          >
            {contacts.phoneDisplay}
          </a>

          <Button href="#action" className="px-5 text-sm font-semibold">
            {homepage.header.primaryCtaLabel}
          </Button>
        </div>
      </Container>
    </header>
  );
}
