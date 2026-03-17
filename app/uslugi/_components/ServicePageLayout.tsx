import Link from "next/link";
import Image from "next/image";

type Advantage = { icon: string; title: string; desc: string };

type Props = {
  breadcrumb: string;
  badge: string;
  h1: string;
  h1sub: string;
  description: string;
  ctaText: string;
  price: string;
  image: string;
  imageAlt: string;
  sectionTitle: string;
  sectionParagraphs: string[];
  advantagesTitle: string;
  advantages: Advantage[];
  otherServices: [string, string][];
};

export default function ServicePageLayout(props: Props) {
  return (
    <div style={{ fontFamily: "'Inter',-apple-system,sans-serif", color: "#1a1a1a", background: "#fafafa" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap');
        *{margin:0;padding:0;box-sizing:border-box}
        .s-cta{display:inline-flex;align-items:center;gap:8px;padding:16px 36px;background:#1a1a1a;color:#fff;border:none;font-size:15px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;text-decoration:none;transition:all .3s;font-family:'Inter',sans-serif}
        .s-cta:hover{background:#333;transform:translateY(-2px);box-shadow:0 8px 30px rgba(0,0,0,.2)}
        .s-cta-outline{background:transparent;color:#1a1a1a;border:2px solid #1a1a1a}.s-cta-outline:hover{background:#1a1a1a;color:#fff}
        @media(max-width:768px){.svc-hero-grid{grid-template-columns:1fr!important}.svc-adv-grid{grid-template-columns:1fr!important}}
      `}</style>

      <nav style={{ padding: "20px clamp(24px,5vw,80px)", borderBottom: "1px solid #e8e8e8", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link href="/" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 18, fontWeight: 700, letterSpacing: 3, color: "#1a1a1a", textDecoration: "none" }}>ПОТОЛКОВО</Link>
        <Link href="/#contact" className="s-cta" style={{ padding: "10px 24px", fontSize: 12 }}>Оставить заявку</Link>
      </nav>

      <div style={{ padding: "16px clamp(24px,5vw,80px)", fontSize: 13, color: "#999" }}>
        <Link href="/" style={{ color: "#999", textDecoration: "none" }}>Главная</Link>
        <span style={{ margin: "0 8px" }}>→</span>
        <Link href="/#services" style={{ color: "#999", textDecoration: "none" }}>Услуги</Link>
        <span style={{ margin: "0 8px" }}>→</span>
        <span style={{ color: "#1a1a1a", fontWeight: 500 }}>{props.breadcrumb}</span>
      </div>

      <section style={{ padding: "60px clamp(24px,5vw,80px) 80px", maxWidth: 1200, margin: "0 auto" }}>
        <div className="svc-hero-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 3, color: "#999", marginBottom: 16, fontFamily: "'JetBrains Mono',monospace", textTransform: "uppercase" }}>{props.badge}</div>
            <h1 style={{ fontSize: "clamp(32px,4vw,48px)", fontWeight: 900, lineHeight: 1.1, letterSpacing: -1.5, marginBottom: 24 }}>
              {props.h1}<br /><span style={{ color: "#999" }}>{props.h1sub}</span>
            </h1>
            <p style={{ fontSize: 17, lineHeight: 1.8, color: "#555", marginBottom: 32 }}>{props.description}</p>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 32 }}>
              <Link href="/#contact" className="s-cta">{props.ctaText} →</Link>
              <a href="tel:+79055219909" className="s-cta s-cta-outline">📞 Позвонить</a>
            </div>
            <div style={{ fontSize: 14, color: "#999" }}>{props.price} · Замер бесплатно · Договор</div>
          </div>
          <div style={{ position: "relative", aspectRatio: "4/3", overflow: "hidden" }}>
            <Image src={props.image} alt={props.imageAlt} fill sizes="(max-width:768px) 100vw, 50vw" style={{ objectFit: "cover" }} />
          </div>
        </div>
      </section>

      <section style={{ padding: "80px clamp(24px,5vw,80px)", background: "#fff", borderTop: "1px solid #e8e8e8" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 32, letterSpacing: -0.5 }}>{props.sectionTitle}</h2>
          {props.sectionParagraphs.map((t, i) => (
            <p key={i} style={{ fontSize: 16, lineHeight: 1.8, color: "#555", marginBottom: 20 }}>{t}</p>
          ))}

          <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 32, marginTop: 60, letterSpacing: -0.5 }}>{props.advantagesTitle}</h2>
          <div className="svc-adv-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {props.advantages.map((a, i) => (
              <div key={i} style={{ padding: 24, border: "1px solid #e8e8e8" }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>{a.icon}</div>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{a.title}</div>
                <div style={{ fontSize: 14, color: "#666", lineHeight: 1.6 }}>{a.desc}</div>
              </div>
            ))}
          </div>

          <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 32, marginTop: 60, letterSpacing: -0.5 }}>Как заказать</h2>
          {["Оставьте заявку на сайте или позвоните", "Приеду на бесплатный замер, составлю смету", "Согласуем дату, подпишем договор", "Монтаж за 1 день. Чисто, аккуратно, с гарантией"].map((step, i) => (
            <div key={i} style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 16 }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 700, color: "#ccc", minWidth: 32 }}>{String(i + 1).padStart(2, "0")}</div>
              <p style={{ fontSize: 16, lineHeight: 1.6, color: "#555" }}>{step}</p>
            </div>
          ))}

          <div style={{ marginTop: 60, padding: 40, background: "#1a1a1a", textAlign: "center" }}>
            <h3 style={{ fontSize: 24, fontWeight: 800, color: "#fff", marginBottom: 16 }}>Готовы заказать?</h3>
            <p style={{ fontSize: 15, color: "#888", marginBottom: 24 }}>Оставьте заявку — перезвоню в течение 2 часов</p>
            <Link href="/#contact" className="s-cta" style={{ background: "#fff", color: "#1a1a1a" }}>Оставить заявку →</Link>
          </div>
        </div>
      </section>

      <section style={{ padding: "60px clamp(24px,5vw,80px)", borderTop: "1px solid #e8e8e8" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 24 }}>Другие услуги</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {props.otherServices.map(([name, href]) => (
              <Link key={href} href={href} style={{ padding: "8px 16px", border: "1px solid #ddd", fontSize: 13, fontWeight: 500, color: "#666", textDecoration: "none" }}>{name}</Link>
            ))}
          </div>
        </div>
      </section>

      <footer style={{ padding: "32px clamp(24px,5vw,80px)", background: "#1a1a1a", color: "#888", fontSize: 13, textAlign: "center" }}>
        © {new Date().getFullYear()} ПОТОЛКОВО · <Link href="/privacy" style={{ color: "#888", textDecoration: "underline" }}>Политика конфиденциальности</Link>
      </footer>
    </div>
  );
}
