"use client";

/**
 * N-061 · Микро-CTA после успешной заявки (F-20).
 *
 * После «перезвоню завтра» человеку нечего делать, кроме как ждать. Самое
 * полезное, что он может сделать прямо сейчас, — прислать фотографии
 * помещения: по ним видно геометрию, ниши и высоту, и часть выездов
 * «просто посмотреть» отпадает.
 *
 * Один компонент на оба экрана успеха — в модалке калькулятора и в форме на
 * странице. Дублировать разметку смысла нет: текст и поведение одинаковы, а
 * разошедшиеся копии мы уже разбирали всю N-051.
 */
import { contacts } from "@/content/contacts";
import { telegramLeadLink } from "@/lib/service-page-actions";

export function TelegramPhotoCta({
  leadCode,
  className = "",
}: {
  /** Номер заявки уходит в текст сообщения — связывать фото вручную не придётся. */
  leadCode: string | null;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl bg-white/70 p-3 text-left ring-1 ring-emerald-200 ${className}`.trim()}
    >
      <p className="text-sm font-semibold text-emerald-950">Хотите быстрее?</p>
      <p className="mt-1 text-sm text-emerald-900">
        Пришлите 2–3 фото помещения — уточню смету ещё до выезда.
      </p>
      {/*
        Два мессенджера рядом: человек пришлёт фото туда, где у него уже
        открыт чат, а не туда, где удобнее нам. Оба ведут в один и тот же
        разговор с мастером и несут номер заявки в тексте.
      */}
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={telegramLeadLink(contacts.telegramUrl, leadCode)}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="success-telegram"
          className="inline-flex min-h-11 items-center rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800"
        >
          Фото в Telegram
        </a>
        <a
          href={telegramLeadLink(contacts.whatsappUrl, leadCode)}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="success-whatsapp"
          className="inline-flex min-h-11 items-center rounded-xl bg-white px-4 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-300 transition hover:bg-emerald-50"
        >
          Фото в WhatsApp
        </a>
      </div>
    </div>
  );
}
