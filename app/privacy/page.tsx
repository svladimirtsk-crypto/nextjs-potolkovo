import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Политика конфиденциальности — ПОТОЛКОВО",
  description: "Политика конфиденциальности и обработки персональных данных сайта ПОТОЛКОВО.",
};

export default function PrivacyPage() {
  return (
    <div style={{
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      color: "#1a1a1a", background: "#fafafa", minHeight: "100vh",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }
      `}</style>

      {/* Header */}
      <header style={{
        padding: "24px clamp(24px,5vw,80px)", borderBottom: "1px solid #e8e8e8",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <Link href="/" style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700,
          letterSpacing: 3, textTransform: "uppercase", color: "#1a1a1a", textDecoration: "none",
        }}>
          ПОТОЛКОВО
        </Link>
        <Link href="/" style={{
          fontSize: 14, fontWeight: 500, color: "#666", textDecoration: "none",
          borderBottom: "1px solid #ddd", paddingBottom: 2,
        }}>
          ← На главную
        </Link>
      </header>

      {/* Content */}
      <main style={{ maxWidth: 800, margin: "0 auto", padding: "80px clamp(24px,5vw,80px)" }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 32, letterSpacing: -1 }}>
          Политика конфиденциальности
        </h1>
        <p style={{ fontSize: 13, color: "#999", marginBottom: 40, fontFamily: "'JetBrains Mono', monospace" }}>
          Дата последнего обновления: {new Date().toLocaleDateString("ru-RU")}
        </p>

        {[
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

Данные собираются исключительно через форму заявки на Сайте и передаются Оператору посредством сервиса Web3Forms.`,
          },
          {
            title: "3. Цели обработки данных",
            text: `Персональные данные обрабатываются в целях:
• Связи с Пользователем для обсуждения заказа;
• Расчёта стоимости и согласования условий работы;
• Выполнения договорных обязательств.

Данные не используются для рассылок, рекламы или иных целей без согласия Пользователя.`,
          },
          {
            title: "4. Передача данных третьим лицам",
            text: `Оператор не передаёт персональные данные третьим лицам, за исключением случаев:
• Прямого согласия Пользователя;
• Требований законодательства Российской Федерации.

Для передачи данных из формы на Сайте используется сервис Web3Forms (web3forms.com), который выступает техническим посредником и не хранит данные на постоянной основе.`,
          },
          {
            title: "5. Защита данных",
            text: `Оператор принимает необходимые организационные и технические меры для защиты персональных данных от неправомерного доступа, изменения, раскрытия или уничтожения.

Сайт использует защищённое соединение (HTTPS).`,
          },
          {
            title: "6. Хранение данных",
            text: `Персональные данные хранятся до момента выполнения целей обработки, но не более 1 (одного) года с момента последнего взаимодействия с Пользователем.

Пользователь вправе в любой момент потребовать удаления своих данных, направив запрос на potolkovo_msk@mail.ru.`,
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
            title: "8. Файлы cookie",
            text: `Сайт может использовать файлы cookie и аналогичные технологии для обеспечения работоспособности и анализа посещаемости. Пользователь может отключить cookie в настройках своего браузера.`,
          },
          {
            title: "9. Изменения политики",
            text: `Оператор оставляет за собой право вносить изменения в настоящую Политику. Актуальная версия всегда доступна по адресу potolkovo-msk.ru/privacy.`,
          },
          {
            title: "10. Контакты",
            text: `По вопросам, связанным с обработкой персональных данных:
• Email: potolkovo_msk@mail.ru
• Телефон: +7 905 521 99 09
• Telegram: @potolkovo_msk`,
          },
        ].map((section, i) => (
          <div key={i} style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>{section.title}</h2>
            <p style={{ fontSize: 15, lineHeight: 1.8, color: "#555", whiteSpace: "pre-line" }}>{section.text}</p>
          </div>
        ))}
      </main>

      {/* Footer */}
      <footer style={{
        padding: "32px clamp(24px,5vw,80px)", borderTop: "1px solid #e8e8e8",
        textAlign: "center", fontSize: 13, color: "#999",
      }}>
        © {new Date().getFullYear()} ПОТОЛКОВО. Все права защищены.
      </footer>
    </div>
  );
}
