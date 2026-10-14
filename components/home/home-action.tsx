import { contacts } from "@/content/contacts";
import { homepage } from "@/content/homepage";
import { ActionForm } from "./action-form";

const actionContent = homepage.action;

export function HomeAction() {
  return (
    <section id={actionContent.anchorId ?? "action"} className="pk-home-action">
      <div className="pk-wrap pk-home-action-grid">
        <div className="pk-home-action-intro"><p className="pk-eyebrow">Начнём с вашей задачи</p><h2>{actionContent.sectionTitle}</h2><p>{actionContent.sectionSubtitle}</p><ul className="pk-action-facts"><li>Замер бесплатно</li><li>Смета до старта</li><li>Согласованный состав</li></ul></div>
        <div className="pk-home-action-form"><p className="pk-eyebrow">Связь с компанией</p>{actionContent.formTitle ? <h3>{actionContent.formTitle}</h3> : null}<p className="pk-action-form-intro">Укажите имя и телефон. Район и этап ремонта можно добавить по желанию.</p><ActionForm source="home" placement="home" /></div>
        <div className="pk-home-action-contacts"><h3>{actionContent.secondaryContactsTitle}</h3><a className="pk-action-phone" href={contacts.phoneHref}>{contacts.phoneDisplay}</a><p>{contacts.workingHoursLabel}</p><div className="pk-action-contact-links"><a href={contacts.telegramUrl}>Telegram <span aria-hidden="true">↗</span></a><a href={contacts.whatsappUrl}>WhatsApp <span aria-hidden="true">↗</span></a><a href={contacts.emailHref}>{contacts.emailDisplay} <span aria-hidden="true">↗</span></a></div><p className="pk-action-region">{contacts.regionLabel}</p></div>
      </div>
    </section>
  );
}
