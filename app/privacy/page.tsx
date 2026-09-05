import type { Metadata } from "next";
import Link from "next/link";

import { HomeFooter } from "@/components/home/home-footer";
import { Container } from "@/components/ui/container";
import { contacts } from "@/content/contacts";

export const metadata: Metadata = {
  title: { absolute: "Политика конфиденциальности — ПОТОЛКОВО" },
  description: "Политика конфиденциальности и обработки персональных данных сайта ПОТОЛКОВО.",
  alternates: {
    canonical: "/privacy",
  },
};

const privacySections: { title: string; text: string }[] = [
  {
    title: "1. Общие положения",
    text: `Настоящая Политика конфиденциальности определяет порядок обработки и защиты персональных данных физических лиц, использующих сайт potolkovo-msk.ru (далее — «Сайт»).

Оператором персональных данных является Владимир (далее — «Оператор»), оказывающий услуги по установке натяжных потолков в Москве и Московской области.

Заполняя формы на Сайте и предоставляя свои персональные данные, Пользователь выражает согласие с данной Политикой.`,
  },
  {
    title: "2. Какие данные мы собираем",
    text: `Оператор собирает следующие персональные данные:
• Имя (или псевдоним);
• Номер телефона;
• Содержание сообщения (описание задачи).

Данные собираются исключительно через формы на Сайте и передаются Оператору для связи по запросу Пользователя.`,
  },
  {
    title: "3. Цели обработки данных",
    text: `Персональные данные обрабатываются в целях:
• Связи с Пользователем для обсуждения заказа;
• Расчёта стоимости и согласования условий работы;
• Выполнения договорных обязательств.

Данные не используются для рекламных рассылок без отдельного согласия Пользователя.`,
  },
  {
    title: "4. Передача данных третьим лицам",
    text: `Оператор не передаёт персональные данные третьим лицам, за исключением случаев:
• Прямого согласия Пользователя;
• Требований законодательства Российской Федерации.

Для передачи данных из форм может использоваться технический сервис-посредник, обеспечивающий доставку заявки Оператору.`,
  },
  {
    title: "5. Защита данных",
    text: `Оператор принимает необходимые организационные и технические меры для защиты персональных данных от неправомерного доступа, изменения, раскрытия или уничтожения.

Сайт использует защищённое соединение (HTTPS).`,
  },
  {
    title: "6. Хранение данных",
    text: `Персональные данные хранятся до момента выполнения целей обработки, но не дольше срока, необходимого для связи по заявке и выполнения обязательств.

Пользователь вправе потребовать удаление своих данных, направив запрос на электронную почту, указанную в разделе контактов.`,
  },
  {
    title: "7. Права пользователя",
    text: `Пользователь имеет право:
• Запрашивать информацию о своих персональных данных;
• Требовать их исправления или удаления;
• Отозвать согласие на обработку.

Для реализации прав направьте письмо на potolkovo_msk@mail.ru.`,
  },
  {
    title: "8. Cookies и аналитика",
    text: `Сайт использует файлы cookie и аналогичные технологии для обеспечения работоспособности, запоминания настроек и анализа посещаемости.

Для сбора обезличенной статистики используется сервис Яндекс.Метрика (ООО «ЯНДЕКС», Россия). Метрика собирает данные о посещениях: страницы, источник перехода, тип устройства, действия на странице. В счётчике включён Вебвизор — он записывает обезличенные действия на странице (движения курсора, клики, прокрутку, заполнение полей форм). Содержимое полей с персональными данными в записях Вебвизора скрывается.

Собранные данные обрабатываются на стороне Яндекса в соответствии с его политикой: yandex.ru/legal/confidential.

Пользователь может отказаться от аналитики: отключив cookie в настройках браузера либо установив блокировщик Яндекс.Метрики. Отключение cookie не влияет на возможность отправить заявку.`,
  },
  {
    title: "9. Реквизиты",
    text: [
      "Оператор персональных данных:",
      `• Наименование: ${contacts.legalName}`,
      `• ИНН: ${contacts.inn}`,
      `• ОГРНИП: ${contacts.ogrnip}`,
      `• Email: ${contacts.emailDisplay}`,
      `• Телефон: ${contacts.phoneDisplay}`,
    ].join("\n"),
  },
  {
    title: "10. Изменения политики",
    text: `Оператор оставляет за собой право вносить изменения в настоящую Политику. Актуальная версия всегда доступна по адресу potolkovo-msk.ru/privacy.`,
  },
  {
    title: "11. Контакты",
    text: `По вопросам, связанным с обработкой персональных данных:
• Email: potolkovo_msk@mail.ru
• Телефон: +7 905 521 99 09
• Telegram: @potolkovo_msk`,
  },
];

export default function PrivacyPage() {
  return (
    <>
      <header className="border-b border-slate-200 bg-white">
        <Container className="flex min-h-[var(--header-height)] items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex shrink-0 items-center font-mono text-sm font-bold uppercase tracking-[0.24em] text-slate-950 sm:text-[15px]"
            aria-label={contacts.brandName}
          >
            {contacts.brandShortName}
          </Link>

          <Link
            href="/"
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-950"
          >
            ← На главную
          </Link>
        </Container>
      </header>

      <main className="bg-slate-50 py-14 sm:py-16 lg:py-20">
        <Container>
          <div className="mx-auto max-w-4xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8 lg:p-10">
            <div className="border-b border-slate-200 pb-6">
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <Link href="/" className="transition-colors hover:text-slate-950">
                  Главная
                </Link>
                <span>/</span>
                <span className="text-slate-950">Политика конфиденциальности</span>
              </div>

              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Политика конфиденциальности
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                Ниже описано, какие данные сайт получает через формы заявки, для чего они используются и
                как можно запросить их удаление или уточнение.
              </p>

              <p className="mt-4 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                Дата обновления: {new Date().toLocaleDateString("ru-RU")}
              </p>
            </div>

            <div className="mt-8 space-y-8">
              {privacySections.map((section) => (
                <section key={section.title}>
                  <h2 className="text-lg font-semibold text-slate-950 sm:text-xl">
                    {section.title}
                  </h2>
                  <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600 sm:text-base">
                    {section.text}
                  </p>
                </section>
              ))}
            </div>
          </div>
        </Container>
      </main>
      <HomeFooter />
    </>
  );
}
