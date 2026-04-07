"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { contacts } from "@/content/contacts";
import { homepage } from "@/content/homepage";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export function HomeHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 24);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={[
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled
          ? "border-b border-slate-200/70 bg-white/90 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/75"
          : "bg-transparent",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Container className="flex min-h-[var(--header-height)] items-center justify-between gap-3">
        <Link
          href="/"
          className={[
            "font-mono text-sm font-bold uppercase tracking-[0.28em] transition-colors sm:text-base",
            scrolled ? "text-slate-950" : "text-white",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {contacts.brandShortName}
        </Link>

        <nav className="hidden items-center gap-6 lg:flex">
          {homepage.header.navItems.map((item) => (
            <a
              key={item.targetId}
              href={`#${item.targetId}`}
              className={[
                "text-sm font-medium transition-colors",
                scrolled ? "text-slate-600 hover:text-slate-950" : "text-white/80 hover:text-white",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <a
            href={contacts.phoneHref}
            className={[
              "inline-flex h-11 w-11 items-center justify-center rounded-full border transition-colors sm:hidden",
              scrolled
                ? "border-slate-200 bg-white text-slate-950 hover:bg-slate-50"
                : "border-white/20 bg-white/10 text-white hover:bg-white/15",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-label={`${homepage.header.phoneLabelPrefix ?? "Позвонить"} ${contacts.phoneDisplay}`}
            title={contacts.phoneDisplay}
          >
            <span aria-hidden="true">📞</span>
          </a>

          <a
            href={contacts.phoneHref}
            className={[
              "hidden text-sm font-medium transition-colors sm:inline-flex",
              scrolled ? "text-slate-700 hover:text-slate-950" : "text-white/85 hover:text-white",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-label={`${homepage.header.phoneLabelPrefix ?? "Позвонить"} ${contacts.phoneDisplay}`}
          >
            {contacts.phoneDisplay}
          </a>

          <Button
            href="#action"
            variant={scrolled ? "primary" : "secondary"}
            className="whitespace-nowrap px-4 sm:px-5"
          >
            <span className="sm:hidden">Замер</span>
            <span className="hidden sm:inline">{homepage.header.primaryCtaLabel}</span>
          </Button>
        </div>
      </Container>
    </header>
  );
}
