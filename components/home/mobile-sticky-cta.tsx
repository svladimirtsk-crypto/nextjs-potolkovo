import { contacts } from "@/content/contacts";
import { homepage } from "@/content/homepage";

export function MobileStickyCta() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/96 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur supports-[backdrop-filter]:bg-white/88 md:hidden">
      <div className="mx-auto grid max-w-6xl grid-cols-[auto_1fr] gap-2">
        <a
          href={contacts.phoneHref}
          className="inline-flex min-h-12 items-center justify-center rounded-full border border-slate-300 bg-white px-4 text-sm font-semibold"
          style={{ color: "#020617" }}
          aria-label={`Позвонить ${contacts.phoneDisplay}`}
        >
          Позвонить
        </a>

        <a
          href="#action"
          className="inline-flex min-h-12 items-center justify-center rounded-full border border-slate-950 bg-slate-950 px-4 text-sm font-semibold"
          style={{ color: "#ffffff" }}
        >
          {homepage.header.primaryCtaLabel}
        </a>
      </div>
    </div>
  );
}
