import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Парящие натяжные потолки с подсветкой в Москве — ПОТОЛКОВО",
  description: "Парящие натяжные потолки с LED-подсветкой в Москве и МО. Эффект невесомости, управление с пульта. Частный мастер, 15+ лет. Замер бесплатно.",
  keywords: "парящий потолок, натяжной потолок с подсветкой, LED потолок, парящие потолки москва",
};

export default function ServicePage() {
  const otherServices = [
    ["Теневой профиль", "/uslugi/tenevoy-profil"],
    ["Световые линии", "/uslugi/svetovye-linii"],
    ["Трековое освещение", "/uslugi/trekovoe-osveshchenie"],
    ["Скрытые карнизы", "/uslugi/skrytye-karnizy"],
    ["Индивидуальные проекты", "/uslugi/individualnye-proekty"],
    ["Продажа трек-света", "/uslugi/prodazha-trekovogo-osveshcheniya"],
    ["Простые потолки", "/uslugi/prostye-potolki"],
    ["Светопрозрачные потолки", "/uslugi/svetoprozrachnye-potolki"],
  ];

  return (
    <div style={{ fontFamily: "'Inter',-apple-system,sans-serif", color: "#1a1a1a", background: "#fafafa" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap');*{margin:0;padding:0;box-sizing:border-box}.s-cta{display:inline-flex;align-items:center;gap:8px;padding:16px 36px;background:#1a1a1a;color:#fff;border:none;font-size:15px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;text-decoration:none;transition:all .3s;font-family:inherit}.s-cta:hover{background:#333;transform:translateY(-2px)}.s-cta-outline{background:transparent;color:#1a1a1a;border:2px solid #1a1a1a}.s-cta-outline:hover{background:#1a1a1a;color:#fff}`}</style>
      <nav style={{ padding: "20px clamp(24px,5vw,80px)", borderBottom: "1px solid #e8e8e8", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link href="/" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 18, fontWeight: 700, letterSpacing: 3, color: "#1a1a1a", textDecoration: "none" }}>ПОТОЛКОВО</Link>
        <Link href="/#contact" className="s-cta" style={{ padding: "10px 24px", fontSize: 12 }}>Оставить заявку</Link>
      </nav>
      <div style={{ padding: "16px clamp(24px,5vw,80px)", fontSize: 13, color: "#999" }}>
        <Link href="/" style={{ color: "#999", textDecoration: "none" }}>Главная</Link> <span style={{ margin: "0 8px" }}>→</span>
        <Link href="/#services" style={{ color: "#999", textDecoration: "none" }}>Услуги</Link> <span style={{ margin: "0 8px" }}>→</span>
        <span style={{ color: "#1a1a1a", fontWeight: 500 }}>Парящие потолки</span>
      </div>
      <section style={{ padding: "60px clamp(24px,5vw,80px) 80px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 3, color: "#999", marginBottom: 16, fontFamily: "'JetBrains Mono',monospace", textTransform: "uppercase" }}>Услуга</div>
            <h1 style={{ fontSize: "clamp(32px,4vw,48px)", fontWeight: 900, lineHeight: 1.1, letterSpacing: -1.5, marginBottom: 24 }}>Парящие потолки<br /><span style={{ color: "#999" }}>с LED-подсветкой</span></h1>
            <p style={{ fontSize: 17, lineHeight: 1.8, color: "#555", marginBottom: 32 }}>Потолок визуально «отрывается» от стен благодаря LED-ленте по периметру. Мягкое свечение создаёт эффект невесомости. Управление с пульта или смартфона.</p>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 32 }}>
              <Link href="/#contact" className="s-cta">Заказать парящий потолок →</Link>
              <a href="tel:+79055219909" className="s-cta s-cta-outline">📞 Позвонить</a>
            </div>
            <div style={{ fontSize: 14, color: "#999" }}>от 2 500 ₽/м.пог · Замер бесплатно · Договор</div>
          </div>
          <div style={{ position: "relative", aspectRatio: "4/3", overflow: "hidden" }}>
            <Image src="/svc-floating.jpeg" alt="Парящий натяжной потолок с LED подсветкой" fill sizes="50vw" style={{ objectFit: "cover" }} />
          </div>
        </div>
      </section>
      <section style={{ padding: "80px clamp(24px,5vw,80px)", background: "#fff", borderTop: "1px solid #e8e8e8" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 32 }}>Как это работает</h2>
          {["Специальный профиль с пазом для LED-ленты крепится по периметру помещения. Лента светит вниз на стену, создавая световой контур.", "Визуально потолок «парит» в воздухе, отделённый от стен полосой света. Эффект усиливается в вечернее время.", "Управление яркостью и цветом (тёплый белый, холодный белый или RGB) — с пульта или через приложение на смартфоне."].map((t, i) => (
            <p key={i} style={{ fontSize: 16, lineHeight: 1.8, color: "#555", marginBottom: 20 }}>{t}</p>
          ))}
          <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 32, marginTop: 60 }}>Где использовать</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {[{ icon: "🛏️", title: "Спальня", desc: "Как ночник или основной свет" }, { icon: "🛋️", title: "Гостиная", desc: "Декоративная подсветка зоны отдыха" }, { icon: "🚪", title: "Коридор", desc: "Основной свет без люстр" }, { icon: "🍳", title: "Кухня", desc: "Дополнительный контурный свет" }].map((item, i) => (
              <div key={i} style={{ padding: 24, border: "1px solid #e8e8e8" }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>{item.icon}</div>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{item.title}</div>
                <div style={{ fontSize: 14, color: "#666" }}>{item.desc}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 60, padding: 40, background: "#1a1a1a", textAlign: "center" }}>
            <h3 style={{ fontSize: 24, fontWeight: 800, color: "#fff", marginBottom: 16 }}>Хотите парящий потолок?</h3>
            <p style={{ fontSize: 15, color: "#888", marginBottom: 24 }}>Оставьте заявку — перезвоню в течение 2 часов</p>
            <Link href="/#contact" className="s-cta" style={{ background: "#fff", color: "#1a1a1a" }}>Оставить заявку →</Link>
          </div>
        </div>
      </section>
      <section style={{ padding: "60px clamp(24px,5vw,80px)", borderTop: "1px solid #e8e8e8" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 24 }}>Другие услуги</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {otherServices.map(([name, href]) => (<Link key={href} href={href} style={{ padding: "8px 16px", border: "1px solid #ddd", fontSize: 13, fontWeight: 500, color: "#666", textDecoration: "none" }}>{name}</Link>))}
          </div>
        </div>
      </section>
      <footer style={{ padding: "32px clamp(24px,5vw,80px)", background: "#1a1a1a", color: "#888", fontSize: 13, textAlign: "center" }}>
        © {new Date().getFullYear()} ПОТОЛКОВО · <Link href="/privacy" style={{ color: "#888", textDecoration: "underline" }}>Политика конфиденциальности</Link>
      </footer>
    </div>
  );
}
