"use client";

import { useEffect, type RefObject } from "react";

/** DOM-only modal lifecycle: focus, scroll lock, keyboard containment and return.
 * Callers keep onClose stable so quantity changes cannot reset focus.
 */
export function useDialogFocus(open: boolean, ref: RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusables = () => [...dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), summary, [tabindex="0"]'
    )].filter(el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden" && !el.closest('[inert]'));
    (focusables()[0] ?? dialog).focus({ preventScroll: true });
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); onClose(); return; }
      if (event.key !== "Tab") return;
      const nodes = focusables(), first = nodes[0], last = nodes.at(-1);
      if (!first) { event.preventDefault(); dialog.focus(); return; }
      if (!dialog.contains(document.activeElement) || (event.shiftKey && document.activeElement === first)) {
        event.preventDefault(); (event.shiftKey ? last : first)?.focus();
      } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown, true);
    return () => {
      document.removeEventListener("keydown", keydown, true);
      document.body.style.overflow = overflow;
      if (previous?.isConnected && (document.activeElement === document.body || dialog.contains(document.activeElement))) previous.focus({ preventScroll: true });
    };
  }, [open, ref, onClose]);
}
