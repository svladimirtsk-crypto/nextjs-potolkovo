"use client";

import Link from "next/link";
import { UtilityHeader } from "./utility-header";
import { contacts } from "@/content/contacts";

type Props = { kind: "not-found" | "error"; reset?: () => void };

/** Recovery UI only; no automatic reload, storage reset or mutation of an order. */
export function RecoveryScreen({ kind, reset }: Props) {
  const missing = kind === "not-found";
  return <>
    <UtilityHeader />
    <main className="pk-recovery pk-wrap">
      <div className="pk-recovery-copy"><p className="pk-eyebrow">{missing ? "404 / Страница не найдена" : "Не удалось открыть страницу"}</p><h1>{missing ? <>Здесь пока<br />нет страницы.</> : <>Не получилось.<br />Попробуем ещё раз?</>}</h1><p className="pk-recovery-lead">{missing ? "Возможно, в адресе опечатка или ссылка больше не работает. Начните с главной или выберите подходящее решение." : "При загрузке произошла ошибка. Повторите попытку или свяжитесь с компанией — поможем обсудить вашу задачу."}</p><div className="pk-recovery-actions">{!missing && reset ? <button type="button" onClick={reset}>Попробовать снова <span aria-hidden="true">↻</span></button> : <Link href="/">На главную <span aria-hidden="true">↗</span></Link>}<Link href="/uslugi">Все решения <span aria-hidden="true">↗</span></Link></div><p className="pk-recovery-note">{missing ? "Нужна помощь с выбором потолка или света? Свяжитесь с компанией — обсудим задачу." : "Если ошибка возникла после отправки заявки, сначала уточните её статус у компании — не отправляйте повторную заявку вслепую."}</p></div>
      <aside className="pk-recovery-aside" aria-label="Разделы и связь"><span className="pk-recovery-number" aria-hidden="true">{missing ? "404" : "↻"}</span><nav aria-label="Полезные разделы"><Link href="/umnoe-osveshchenie">Сценарии света <span aria-hidden="true">↗</span></Link><Link href="/o-kompanii">О компании <span aria-hidden="true">↗</span></Link></nav><div className="pk-recovery-contacts"><p>ПОТОЛКОВО · Москва и область</p><a href={contacts.phoneHref}>{contacts.phoneDisplay}</a><a href={contacts.telegramUrl}>Написать в Telegram <span aria-hidden="true">↗</span></a><small>{contacts.workingHoursLabel}</small></div></aside>
    </main>
  </>;
}
