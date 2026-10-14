import Link from "next/link";
import { contacts } from "@/content/contacts";

/** Existing real contact channels; no new checkout or inaccurate consultation orderIntent. */
export function EditorialContact({ lighting = false }: { lighting?: boolean }) {
  return (
    <section id="action" className="pk-editorial-contact" aria-labelledby="editorial-contact-title">
      <div className="pk-wrap pk-editorial-contact-grid">
        <div><p className="pk-eyebrow">Начнём с разговора</p><h2 id="editorial-contact-title">{lighting ? <>Какой свет<br />нужен вам?</> : <>Расскажите<br />о вашем помещении.</>}</h2><p>{lighting ? "Опишите желаемые сценарии, этап ремонта и способ управления. Если оборудование уже выбрано — подготовьте модели и характеристики." : "Можно начать с идеи, размеров или плана. Обсудим потолок, свет и детали, которые важно учесть до монтажа."}</p><p className="pk-contact-region">{contacts.regionLabel}<br />{contacts.workingHoursLabel}</p></div>
        <div className="pk-contact-channels"><a href={contacts.phoneHref} className="pk-contact-phone">{contacts.phoneDisplay}<span>Позвонить в ПОТОЛКОВО <span aria-hidden="true">↗</span></span></a><a href={contacts.telegramUrl} className="pk-contact-channel">Написать в Telegram <span aria-hidden="true">↗</span></a><a href={contacts.whatsappUrl} className="pk-contact-channel">Написать в WhatsApp <span aria-hidden="true">↗</span></a><a href={contacts.emailHref} className="pk-contact-channel">{contacts.emailDisplay} <span aria-hidden="true">↗</span></a><p className="pk-contact-form-link">Для заявки на замер потолка — <Link href="/#action">форма на главной</Link>. Управление светом сначала обсуждаем по телефону или в переписке.</p></div>
      </div>
    </section>
  );
}
