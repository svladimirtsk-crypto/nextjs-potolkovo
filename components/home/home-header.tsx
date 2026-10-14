"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { contacts } from "@/content/contacts";
import { homepage } from "@/content/homepage";
import { serviceLinks } from "@/content/service-links";
import { Button } from "@/components/ui/button";
import { useCalculatorModal } from "@/components/calculator-modal/calculator-modal-context";
import { useCalculatorPageContext } from "@/components/calculator-modal/page-context";

/** R7: disclosure navigation; all 9 URLs and PT-008 page-context entries survive. */
export function HomeHeader({ consultation = false }: { consultation?: boolean }) {
  const { openCalculator } = useCalculatorModal();
  const page = useCalculatorPageContext();
  const pathname = usePathname();
  const [desktopOpen, setDesktopOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const header = useRef<HTMLElement>(null);
  const desktopButton = useRef<HTMLButtonElement>(null);
  const mobileButton = useRef<HTMLButtonElement>(null);

  const handleOutside = useCallback((event: PointerEvent) => {
    if (!header.current?.contains(event.target as Node)) { setDesktopOpen(false); setMobileOpen(false); }
  }, []);
  const handleEscape = useCallback((event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    if (mobileOpen) { setMobileOpen(false); mobileButton.current?.focus(); }
    if (desktopOpen) { setDesktopOpen(false); desktopButton.current?.focus(); }
  }, [desktopOpen, mobileOpen]);

  useEffect(() => {
    document.addEventListener("pointerdown", handleOutside);
    document.addEventListener("keydown", handleEscape);
    return () => { document.removeEventListener("pointerdown", handleOutside); document.removeEventListener("keydown", handleEscape); };
  }, [handleOutside, handleEscape]);

  const anchorHref = (id: string) => {
    if (id === "trust") return "/o-kompanii";
    const missingLocalPrice = id === "price" && !pathname.startsWith("/uslugi/");
    return pathname !== "/" && (id === "proof" || id === "solutions" || missingLocalPrice) ? `/#${id}` : `#${id}`;
  };
  const close = () => { setDesktopOpen(false); setMobileOpen(false); };

  return (
    <header ref={header} className="pk-header">
      <div className="pk-wrap pk-header-inner">
        <BrandLogo />
        <nav className="pk-desktop-nav" aria-label="Основная навигация">
          <div className="pk-services-disclosure">
            <button ref={desktopButton} type="button" aria-expanded={desktopOpen} aria-controls="desktop-services-menu" onClick={() => setDesktopOpen(!desktopOpen)}>Решения <span aria-hidden="true">⌄</span></button>
            {desktopOpen && <div className="pk-desktop-menu" id="desktop-services-menu">
              {serviceLinks.map(item => <Link href={item.href} key={item.slug} onClick={close}>{item.label}<span aria-hidden="true">↗</span></Link>)}
              <Link href="/uslugi" onClick={close}>Все услуги <span aria-hidden="true">↗</span></Link>
            </div>}
          </div>
          <Link href="/umnoe-osveshchenie" aria-current={pathname === "/umnoe-osveshchenie" ? "page" : undefined}>Умный свет</Link>
          <Link href="/uslugi/prodazha-trekovogo-osveshcheniya">Каталог света</Link>
          {homepage.header.navItems.map(item => <Link key={item.targetId} href={anchorHref(item.targetId)} aria-current={item.targetId === "trust" && pathname === "/o-kompanii" ? "page" : undefined}>{item.label}</Link>)}
        </nav>
        <div className="pk-header-actions">
          <a className="pk-header-phone" href={contacts.phoneHref}>{contacts.phoneDisplay}<small>Москва и область</small></a>
          {page.presetDisabled || consultation ? <Button href="#action" className="pk-header-cta" data-testid="header-entry"><span className="sm:hidden">Обсудить</span><span className="hidden sm:inline">{page.projectCtaLabel}</span></Button> :
            <Button type="button" className="pk-header-cta" data-testid="header-entry" onClick={() => openCalculator(page.optionsFor("header"))}>Рассчитать</Button>}
          <button className="pk-mobile-toggle" ref={mobileButton} type="button" aria-label={mobileOpen ? "Закрыть меню" : "Открыть меню"} aria-expanded={mobileOpen} aria-controls="mobile-services-menu" onClick={() => setMobileOpen(!mobileOpen)}>
            <svg width="23" height="23" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={mobileOpen ? "M5 5l14 14M19 5L5 19" : "M3 6h18M3 12h18M3 18h18"} stroke="currentColor" strokeWidth="1.6" /></svg>
          </button>
        </div>
      </div>
      {mobileOpen && <nav className="pk-mobile-menu" id="mobile-services-menu" aria-label="Мобильная навигация">
        <p className="pk-eyebrow">Потолки и освещение</p>
        {serviceLinks.map(item => <Link key={item.slug} href={item.href} onClick={close}>{item.label}<span aria-hidden="true">↗</span></Link>)}
        <div className="pk-mobile-extra"><Link href="/uslugi" onClick={close}>Все услуги</Link><Link href="/umnoe-osveshchenie" onClick={close}>Умный свет</Link><Link href="/o-kompanii" onClick={close}>Компания</Link><a href={contacts.phoneHref} onClick={close}>{contacts.phoneDisplay}</a></div>
      </nav>}
    </header>
  );
}
