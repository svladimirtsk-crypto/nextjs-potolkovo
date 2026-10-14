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
      className={`pk-photo-cta ${className}`.trim()}
    >
      <p className="pk-photo-cta-title">Фото к вашей заявке</p>
      <p className="pk-photo-cta-copy">
        Пришлите 2–3 фото помещения — они помогут обсудить детали до замера.
      </p>
      {/*
        Два мессенджера рядом: человек пришлёт фото туда, где у него уже
        открыт чат, а не туда, где удобнее нам. Оба ведут в один и тот же
        разговор с компанией и несут номер заявки в тексте.
      */}
      <div className="pk-photo-cta-actions">
        <a
          href={telegramLeadLink(contacts.telegramUrl, leadCode)}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="success-telegram"
          className="pk-photo-cta-primary"
        >
          Фото в Telegram
        </a>
        <a
          href={telegramLeadLink(contacts.whatsappUrl, leadCode)}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="success-whatsapp"
          className="pk-photo-cta-secondary"
        >
          Фото в WhatsApp
        </a>
      </div>
    </div>
  );
}
