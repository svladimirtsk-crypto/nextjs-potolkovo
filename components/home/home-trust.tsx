import { company } from "@/content/company";
import { contacts } from "@/content/contacts";

/** The founder is attributed, not presented as the required installer of every order. */
export function HomeTrust() {
  return (
    <section id="trust" className="pk-section pk-wrap" aria-labelledby="company-title">
      <div className="pk-company">
        <div><p className="pk-eyebrow">Компания ПОТОЛКОВО</p><h2 id="company-title">Люди с опытом.<br />Общая задача.<br />Ваш результат.</h2></div>
        <div><p>{company.about.description}</p><p>{company.about.detail}</p>
          <div className="pk-founder"><span aria-hidden="true">ВС</span><div><b>{company.about.founder}</b><small>{company.about.founderRole}</small></div></div>
          <a className="pk-text-link" href={contacts.phoneHref}>Связаться с компанией <span aria-hidden="true">↗</span></a>
        </div>
      </div>
    </section>
  );
}
