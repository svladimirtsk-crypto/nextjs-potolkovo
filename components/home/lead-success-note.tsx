"use client";

/**
 * N-061 · Экран успеха после отправки заявки (F-20).
 *
 * Раньше здесь было только «перезвоню завтра» и телефон: человек остаётся
 * с ожиданием и без единого действия. При этом самое полезное, что он может
 * сделать прямо сейчас, — прислать фотографии помещения: по ним видно
 * геометрию, ниши и высоту, и часть выездов «просто посмотреть» отпадает.
 */
import { contacts } from "@/content/contacts";
import { TelegramPhotoCta } from "@/components/home/telegram-photo-cta";

export function LeadSuccessNote({
  leadId,
  title,
  message,
}: {
  leadId: string | null;
  title: string;
  message: string;
}) {
  return (
    <div
      className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950"
      aria-live="polite"
    >
      <p className="font-semibold">{leadId ? `Заявка №${leadId} принята` : title}</p>
      <p className="mt-2 whitespace-pre-line">{message}</p>

      <TelegramPhotoCta leadCode={leadId} className="mt-3" />

      <p className="mt-3 flex flex-wrap items-center gap-2">
        <a href={contacts.phoneHref} className="font-semibold underline underline-offset-2">
          {contacts.phoneDisplay}
        </a>
        <span aria-hidden="true">·</span>
        <a
          href={contacts.telegramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-blue-700 underline underline-offset-2"
        >
          Написать в Telegram
        </a>
      </p>
    </div>
  );
}
