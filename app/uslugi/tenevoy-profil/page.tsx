import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Теневой профиль для натяжных потолков в Москве — ПОТОЛКОВО",
  description: "Установка натяжных потолков с теневым профилем в Москве и МО. Чёткий зазор 8 мм, без плинтуса. Частный мастер Владимир, 15+ лет опыта. Замер бесплатно.",
  keywords: "теневой профиль, натяжной потолок без плинтуса, теневой зазор, натяжные потолки москва, shadow gap",
};

export default function ServicePage() {
  return (
    <div style={{ fontFamily: "'Inter',-apple-system,sans-serif", color: "#1a1a1a", background: "#fafafa" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap');
        *{margin:0;padding:0;box-sizing:border-box}
        .s-cta{display:inline-flex;align-items:center;gap:8px;padding:16px 36px;background:#1a1a1a;color:#fff;border:none;font-size:15px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;text-decoration:none;transition:all .3s;font-family:inherit}
        .s-cta:hover{background:#333;transform:translateY(-2px);box-shadow:0 8px 30px rgba(0,0,0,.2)}
        .s-cta-outline{background:transparent;color:#1a1a1a;border:2px solid #1a1a1a}.s-cta-outline:hover{background:#1a1a1a;color:#fff}
      `}</style>

      {/* Nav */}
      <nav style={{ padding: "20px clamp(24px,5vw,80px)", borderBottom: "1px solid #e8e8e8", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link href="/" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 18, fontWeight: 700, letterSpacing: 3, color: "#1a1a1a", textDecoration: "none" }}>ПОТОЛКОВО</Link>
        <Link href="/#contact" className="s-cta" style={{ padding: "10px 24px", fontSize: 12 }}>Оставить заявку</Link>
      </nav>

      {/* Breadcrumbs */}
      <div style={{ padding: "16px clamp(24px,5vw,80px)", fontSize: 13, color: "#999" }}>
        <Link href="/" style={{ color: "#999", textDecoration: "none" }}>Главная</Link>
        <span style={{ margin: "0 8px" }}>→</span>
        <Link href="/#services" style={{ color: "#999", textDecoration: "none" }}>Услуги</Link>
        <span style={{ margin: "0 8px" }}>→</span>
        <span style={{ color: "#1a1a1a", fontWeight: 500 }}>Теневой профиль</span>
      </div>

      {/* Hero */}
      <section style={{ padding: "60px clamp(24px,5vw,80px) 80px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 3, color: "#999", marginBottom: 16, fontFamily: "'JetBrains Mono',monospace", textTransform: "uppercase" }}>Услуга</div>
            <h1 style={{ fontSize: "clamp(32px,4vw,48px)", fontWeight: 900, lineHeight: 1.1, letterSpacing: -1.5, marginBottom: 24 }}>
              Теневой профиль<br /><span style={{ color: "#999" }}>для натяжных потолков</span>
            </h1>
            <p style={{ fontSize: 17, lineHeight: 1.8, color: "#555", marginBottom: 32 }}>
              Потолок без плинтуса и резиновых вставок. Чёткий теневой зазор 8 мм между потолком и стеной. Выглядит дорого, потому что это дорого сделать правильно.
            </p>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 32 }}>
              <Link href="/#contact" className="s-cta">Заказать теневой профиль →</Link>
              <a href="tel:+79055219909" className="s-cta s-cta-outline">📞 Позвонить</a>
            </div>
            <div style={{ fontSize: 14, color: "#999" }}>от 900 ₽/м.пог · Замер бесплатно · Договор</div>
          </div>
          <div style={{ position: "relative", aspectRatio: "4/3", overflow: "hidden" }}>
            <Image src="/svc-shadow.jpeg" alt="Теневой профиль для натяжного потолка в Москве" fill sizes="50vw" style={{ objectFit: "cover" }} />
          </div>
        </div>
      </section>

      {/* Details */}
      <section style={{ padding: "80px clamp(24px,5vw,80px)", background: "#fff", borderTop: "1px solid #e8e8e8" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 32, letterSpacing: -0.5 }}>Что такое теневой профиль?</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {[
              "Теневой профиль — это специальный алюминиевый профиль, который создаёт аккуратный зазор между натяжным потолком и стеной. Никаких плинтусов, никаких резиновых вставок.",
              "Зазор составляет 8 мм и создаёт характерную тень — отсюда название. Потолок выглядит как самостоятельная плоскость, «парящая» отдельно от стен.",
              "Теневой профиль идеально скрывает неровности стен, работает с любым покрытием стен (обои, покраска, декоративная штукатурка) и придаёт интерьеру дизайнерский вид.",
            ].map((text, i) => (
              <p key={i} style={{ fontSize: 16, lineHeight: 1.8, color: "#555" }}>{text}</p>
            ))}
          </div>

          <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 32, marginTop: 60, letterSpacing: -0.5 }}>Преимущества</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {[
              { icon: "◇", title: "Без плинтуса", desc: "Чистая линия без пластиковых накладок" },
              { icon: "□", title: "Скрывает неровности", desc: "Зазор компенсирует кривизну стен" },
              { icon: "△", title: "Любые стены", desc: "Обои, покраска, штукатурка, кирпич" },
              { icon: "○", title: "Долговечность", desc: "Алюминиевый профиль не желтеет и не деформируется" },
            ].map((item, i) => (
              <div key={i} style={{ padding: 24, border: "1px solid #e8e8e8" }}>
                <div style={{ fontSize: 24, marginBottom: 8, opacity: 0.3 }}>{item.icon}</div>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{item.title}</div>
                <div style={{ fontSize: 14, color: "#666", lineHeight: 1.6 }}>{item.desc}</div>
              </div>
            ))}
          </div>

          <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 32, marginTop: 60, letterSpacing: -0.5 }}>Как заказать</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              "Оставьте заявку на сайте или позвоните",
              "Приеду на бесплатный замер, составлю смету",
              "Согласуем дату, подпишем договор",
              "Монтаж за 1 день. Чисто, аккуратно, с гарантией",
            ].map((step, i) => (
              <div key={i} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 700, color: "#ccc", minWidth: 32 }}>{String(i + 1).padStart(2, "0")}</div>
                <p style={{ fontSize: 16, lineHeight: 1.6, color: "#555" }}>{step}</p>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div style={{ marginTop: 60, padding: 40, background: "#1a1a1a", textAlign: "center" }}>
            <h3 style={{ fontSize: 24, fontWeight: 800, color: "#fff", marginBottom: 16 }}>Хотите теневой профиль?</h3>
            <p style={{ fontSize: 15, color: "#888", marginBottom: 24 }}>Оставьте заявку — перезвоню в течение 2 часов</p>
            <Link href="/#contact" className="s-cta" style={{ background: "#fff", color: "#1a1a1a" }}>Оставить заявку →</Link>
          </div>
        </div>
      </section>

      {/* Other services */}
      <section style={{ padding: "60px clamp(24px,5vw,80px)", borderTop: "1px solid #e8e8e8" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 24 }}>Другие услуги</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {[
              ["Парящие потолки", "/uslugi/paryashchie-potolki"],
              ["Световые линии", "/uslugi/svetovye-linii"],
              ["Трековое освещение", "/uslugi/trekovoe-osveshchenie"],
              ["Скрытые карнизы", "/uslugi/skrytye-karnizy"],
              ["Индивидуальные проекты", "/uslugi/individualnye-proekty"],
              ["Продажа трек-света", "/uslugi/prodazha-trekovogo-osveshcheniya"],
              ["Простые потолки", "/uslugi/prostye-potolki"],
              ["Светопрозрачные потолки", "/uslugi/svetoprozrachnye-potolki"],
            ].map(([name, href]) => (
              <Link key={href} href={href} style={{
                padding: "8px 16px", border: "1px solid #ddd", fontSize: 13, fontWeight: 500,
                color: "#666", textDecoration: "none", transition: "all .3s",
              }}>{name}</Link>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: "32px clamp(24px,5vw,80px)", background: "#1a1a1a", color: "#888", fontSize: 13, textAlign: "center" }}>
        © {new Date().getFullYear()} ПОТОЛКОВО · <Link href="/privacy" style={{ color: "#888", textDecoration: "underline" }}>Политика конфиденциальности</Link>
      </footer>
    </div>
  );
}
