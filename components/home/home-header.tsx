"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { contacts } from "@/content/contacts";
import { homepage } from "@/content/homepage";
import { serviceLinks } from "@/content/service-links";
import { scrollToAnchorTarget } from "@/lib/scroll-to-anchor";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

const PRIMARY_CTA_LABEL = "Записаться на бесплатный замер";

const headerServiceLinks = serviceLinks
  .filter((item) => item.showInHeader)
  .slice(0, 6);

export function HomeHeader() {
  const [isDesktopServicesOpen, setIsDesktopServicesOpen] = useState(false);
  const [isMobileServicesOpen, setIsMobileServicesOpen] = useState(false);

  const desktopMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;

      if (
        desktopMenuRef.current &&
        !desktopMenuRef.current.contains(target)
      ) {
        setIsDesktopServicesOpen(false);
      }

      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(target)
      ) {
        setIsMobileServicesOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsDesktopServicesOpen(false);
        setIsMobileServicesOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const navItems = useMemo(() => homepage.header.navItems, []);

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
          <div ref={desktopMenuRef} className="relative">
            <button
              type="button"
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 transition-colors hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              aria-haspopup="menu"
              aria-expanded={isDesktopServicesOpen}
              aria-controls="desktop-services-menu"
              onClick={() =>
                setIsDesktopServicesOpen((prev) => !prev)
              }
              onMouseEnter={() => setIsDesktopServicesOpen(true)}
            >
              {homepage.header.servicesMenuLabel}
              <span
                aria-hidden="true"
                className={`text-xs transition-transform ${
                  isDesktopServicesOpen ? "rotate-180" : ""
                }`}
              >
                ▾
              </span>
            </button>

            {isDesktopServicesOpen ? (
              <div
                id="desktop-services-menu"
                role="menu"
                className="absolute left-0 top-[calc(100%+12px)] w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl"
                onMouseLeave={() => setIsDesktopServicesOpen(false)}
              >
                {headerServiceLinks.map((item) => (
                  <Link
                    key={item.slug}
                    href={item.href}
                    role="menuitem"
                    className="block rounded-xl px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                    onClick={() => setIsDesktopServicesOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

          {navItems.map((item) => (
            <a
              key={item.targetId}
              href={`#${item.targetId}`}
              className="text-sm font-medium text-slate-700 transition-colors hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              onClick={(event) => {
                event.preventDefault();
                scrollToAnchorTarget(`#${item.targetId}`);
              }}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <div ref={mobileMenuRef} className="relative lg:hidden">
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-4 text-sm font-medium text-slate-950 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              aria-haspopup="menu"
              aria-expanded={isMobileServicesOpen}
              aria-controls="mobile-services-menu"
              onClick={() => setIsMobileServicesOpen((prev) => !prev)}
            >
              {homepage.header.servicesMenuLabel}
            </button>

            {isMobileServicesOpen ? (
              <div
                id="mobile-services-menu"
                role="menu"
                className="fixed left-4 right-4 top-[calc(var(--header-height)+12px)] z-50 mx-auto w-auto max-w-[22rem] rounded-2xl border border-slate-200 bg-white p-2 shadow-xl max-h-[calc(100vh-var(--header-height)-24px)] overflow-auto"
              >
                {headerServiceLinks.map((item) => (
                  <Link
                    key={item.slug}
                    href={item.href}
                    role="menuitem"
                    className="block rounded-xl px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                    onClick={() => setIsMobileServicesOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

          <a
            href={contacts.phoneHref}
            className="hidden min-h-11 items-center rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-800 transition-colors hover:border-slate-300 hover:text-slate-950 md:inline-flex"
            aria-label={`${homepage.header.phoneLabelPrefix ?? "Позвонить"} ${contacts.phoneDisplay}`}
          >
            {contacts.phoneDisplay}
          </a>

          <Button href="#action" className="whitespace-nowrap px-4 sm:px-5">
            <span className="sm:hidden">Замер</span>
            <span className="hidden sm:inline">{PRIMARY_CTA_LABEL}</span>
          </Button>
        </div>
      </Container>
    </header>
  );
}
