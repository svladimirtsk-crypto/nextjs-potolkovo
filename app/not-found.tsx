/** T-029 · Страница 404 со ссылками на основные разделы. */
import Link from "next/link";

import { contacts } from "@/content/contacts";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col justify-center px-4 py-16 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">404</p>
      <h1 className="mt-2 text-2xl font-semibold text-slate-950">Такой страницы нет</h1>
      <p className="mt-3 text-slate-600">
        Возможно, адрес изменился. Загляните на главную или в раздел услуг.
      </p>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="min-h-11 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          На главную
        </Link>
        <Link
          href="/uslugi/tenevoy-profil"
          className="min-h-11 rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50"
        >
          Услуги и цены
        </Link>
      </div>

      <p className="mt-6 text-sm text-slate-600">
        <a href={contacts.phoneHref} className="font-semibold underline underline-offset-2">
          {contacts.phoneDisplay}
        </a>{" "}
        · {contacts.workingHoursLabel}
      </p>
    </main>
  );
}
