"use client";

/** T-029 · Глобальный экран ошибки: вместо белого экрана — путь связи. */
import { useEffect } from "react";
import Link from "next/link";

import { contacts } from "@/content/contacts";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] необработанная ошибка страницы", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col justify-center px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold text-slate-950">Что-то пошло не так</h1>
      <p className="mt-3 text-slate-600">
        Страница не отрисовалась. Попробуйте обновить — или напишите мне, отвечу быстро.
      </p>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="min-h-11 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Обновить страницу
        </button>
        <Link
          href="/"
          className="min-h-11 rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50"
        >
          На главную
        </Link>
      </div>

      <p className="mt-6 text-sm text-slate-600">
        <a href={contacts.phoneHref} className="font-semibold underline underline-offset-2">
          {contacts.phoneDisplay}
        </a>{" "}
        ·{" "}
        <a
          href={contacts.telegramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-blue-700 underline underline-offset-2"
        >
          Написать в Telegram
        </a>
      </p>
    </main>
  );
}
