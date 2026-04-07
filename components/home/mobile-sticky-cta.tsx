import { contacts } from "@/content/contacts";

export function MobileStickyCta() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur md:hidden">
      <div className="grid grid-cols-2 gap-2">
        <a
          href={contacts.phoneHref}
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-950"
        >
          Позвонить
        </a>

        <a
          href="#action"
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-slate-950 px-3 text-sm font-semibold text-white"
        >
          Записаться
        </a>
      </div>
    </div>
  );
}
