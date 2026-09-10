// components/home/mobile-sticky-cta.tsx
"use client";

import { useEffect, useRef, useState } from "react";

import { useCalculatorStore } from "@/lib/calculator/store";
import { useCalculatorModal } from "@/components/calculator-modal/calculator-modal-context";
import { useCalculatorPageContext } from "@/components/calculator-modal/page-context";
import { buildTelegramDeepLink } from "@/lib/lead/telegram-link";
import { trackMessengerClick } from "@/lib/analytics";
import { contacts } from "@/content/contacts";
import { scrollToAnchorTarget } from "@/lib/scroll-to-anchor";
import { Button } from "@/components/ui/button";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

export function MobileStickyCta() {
  const { snapshot, hasInteracted }        = useCalculatorStore();
  const {
    openCalculator,
    closeCalculator,
    ceilingEffectiveTotal,
    lightingEffectiveTotal,
  } = useCalculatorModal();

  const page = useCalculatorPageContext();

  // T-007: скрываемся, если на странице активна панель корзины
  const [hasActiveCartBar, setHasActiveCartBar] = useState(false);

  useEffect(() => {
    const read = () => {
      const bar = document.querySelector("[data-cart-bar]");
      const count = Number(bar?.getAttribute("data-count") ?? 0);
      setHasActiveCartBar(Boolean(bar) && Number.isFinite(count) && count > 0);
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-count", "data-cart-bar"],
    });
    return () => observer.disconnect();
  }, []);

  const [isVisible, setIsVisible]             = useState(false);
  const [isActionVisible, setIsActionVisible] = useState(false);
  const [isPriceVisible, setIsPriceVisible]   = useState(false);
  const [isHeroVisible, setIsHeroVisible]     = useState(true);

  const priceObserverRef  = useRef<IntersectionObserver | null>(null);
  const actionObserverRef = useRef<IntersectionObserver | null>(null);
  const heroObserverRef   = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
  const priceSection = document.getElementById("price");
  const actionSection = document.getElementById("action");
  const heroSection = document.getElementById("hero");

  const priceObserverOptions: IntersectionObserverInit = {
    root: null,
    rootMargin: "0px 0px -10% 0px",
    threshold: 0,
  };

  const actionObserverOptions: IntersectionObserverInit = {
    root: null,
    rootMargin: "0px 0px 0px 0px",
    threshold: 0,
  };

  if (heroSection) {
    heroObserverRef.current = new IntersectionObserver(([entry]) => {
      setIsHeroVisible(entry.isIntersecting);
    }, { root: null, rootMargin: "0px 0px -35% 0px", threshold: 0 });
    heroObserverRef.current.observe(heroSection);
  }

  if (priceSection) {
    priceObserverRef.current = new IntersectionObserver(([entry]) => {
      setIsPriceVisible(entry.isIntersecting);
    }, priceObserverOptions);
    priceObserverRef.current.observe(priceSection);
  }

  if (actionSection) {
    actionObserverRef.current = new IntersectionObserver(([entry]) => {
      setIsActionVisible(entry.isIntersecting);
    }, actionObserverOptions);
    actionObserverRef.current.observe(actionSection);
  }

  return () => {
    heroObserverRef.current?.disconnect();
    priceObserverRef.current?.disconnect();
    actionObserverRef.current?.disconnect();
  };
}, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (isActionVisible || isHeroVisible) {
        setIsVisible(false);
        return;
      }

      const scrolled = typeof window !== "undefined" && window.scrollY > 300;
      setIsVisible(isPriceVisible || scrolled);
    });

    return () => cancelAnimationFrame(frame);
  }, [isActionVisible, isHeroVisible, isPriceVisible]);

  const showCalculatedState = isPriceVisible || (hasInteracted && !!snapshot);

  const hasLightingInSnapshot =
    snapshot?.lighting &&
    snapshot.lighting.mode !== "none" &&
    (snapshot.lighting.items?.length ?? 0) > 0 &&
    (snapshot.lighting.discountedTotalRub ?? 0) > 0;

  // T-008: сумма только из селекторов контекста модалки
  const displayTotal = Math.max(0, (ceilingEffectiveTotal ?? 0) + (lightingEffectiveTotal ?? 0));

  const hasLightingDisplay = displayTotal > (snapshot?.total ?? 0);

  const handleCalculatorClick = () => {
    // T-021: пресет и источник страницы
    openCalculator({
      source: page.sourceFor("sticky"),
      preset: page.preset ?? undefined,
    });
  };

  // T-026: deep-link с текущим расчётом
  const telegramHref = buildTelegramDeepLink({
    rooms: snapshot?.roomBreakdown ?? [],
    totalArea: Number(snapshot?.area ?? 0),
    lightingTotalRub: lightingEffectiveTotal ?? 0,
    grandTotalRub: displayTotal,
  });

  const handleActionClick = () => {
    closeCalculator();
    scrollToAnchorTarget("#action", { focus: true, highlight: true });
  };

  if (!isVisible || hasActiveCartBar) return null;

  return (
    <div className="mobile-sticky-cta fixed bottom-0 inset-x-0 lg:hidden"
      style={{ zIndex: "var(--z-sticky, 40)" }}>
      <div
        className="border-t border-slate-200 bg-white/95 backdrop-blur px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
      >
        {showCalculatedState && snapshot ? (
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-500">
                {hasLightingDisplay ? "Ориентир с освещением" : "Ориентир"}
              </p>
              <p className="text-lg font-bold text-slate-950 truncate">
                ~{formatCurrency(displayTotal)} ₽
              </p>
            </div>
            {/* T-026: после первой сводки — [Рассчитать] [Telegram] [Позвонить] */}
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                onClick={handleCalculatorClick}
                className="justify-center px-3 text-sm"
              >
                Рассчитать
              </Button>
              <a
                href={telegramHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  trackMessengerClick({
                    messenger: "telegram",
                    placement: "page_action",
                    source: page.sourceFor("sticky"),
                    grandTotal: displayTotal,
                  })
                }
                aria-label="Написать в Telegram"
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
              </a>
              <a
                href={contacts.phoneHref}
                aria-label="Позвонить"
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6.6 10.8a15.1 15.1 0 006.6 6.6l2.2-2.2a1 1 0 011-.24 11.4 11.4 0 003.6.58 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.58 3.6a1 1 0 01-.25 1l-2.23 2.2z"/></svg>
              </a>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            onClick={handleCalculatorClick}
            className="w-full justify-center"
          >
            Рассчитать стоимость
          </Button>
        )}
      </div>
    </div>
  );
}
