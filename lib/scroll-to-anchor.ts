export function isHashHref(href: string) {
  return href.startsWith("#");
}

function getScrollBehavior(): ScrollBehavior {
  if (typeof window === "undefined") return "auto";

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
}

function getHeaderOffset() {
  if (typeof window === "undefined") return 88;

  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--header-height")
    .trim();

  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? 88 : parsed;
}

function clearHashFromUrl() {
  if (typeof window === "undefined") return;
  if (!window.location.hash) return;

  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${window.location.search}`
  );
}

export function scrollToAnchorTarget(
  href: string,
  options?: {
    focus?: boolean;
    highlight?: boolean;
  }
) {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const hash = href.startsWith("#") ? href.slice(1) : href.split("#")[1];
  if (!hash) return;

  const target = document.getElementById(hash);
  if (!target) return;

  // ключевое: не оставляем #action/#price в URL
  clearHashFromUrl();

  const headerOffset = getHeaderOffset();
  const targetTop =
    target.getBoundingClientRect().top + window.scrollY - headerOffset - 12;

  window.scrollTo({
    top: Math.max(targetTop, 0),
    behavior: getScrollBehavior(),
  });

  if (options?.highlight !== false) {
    const highlightClasses = [
      "ring-2",
      "ring-slate-950",
      "ring-offset-4",
      "ring-offset-white",
      "transition-shadow",
    ];

    target.classList.add(...highlightClasses);

    const previousTimeout = target.getAttribute("data-anchor-highlight-timeout");
    if (previousTimeout) {
      window.clearTimeout(Number(previousTimeout));
    }

    const timeout = window.setTimeout(() => {
      target.classList.remove(...highlightClasses);
      target.removeAttribute("data-anchor-highlight-timeout");
    }, 1600);

    target.setAttribute("data-anchor-highlight-timeout", String(timeout));
  }

  if (options?.focus !== false) {
    const hadTabIndex = target.hasAttribute("tabindex");
    if (!hadTabIndex) target.setAttribute("tabindex", "-1");

    target.focus({ preventScroll: true });

    if (!hadTabIndex) {
      window.setTimeout(() => {
        target.removeAttribute("tabindex");
      }, 1800);
    }
  }
}
