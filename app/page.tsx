"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  CONTACTS,
  NAV_ITEMS,
  HERO_IMAGES,
  WHY_CHOOSE,
  ADVANTAGES,
  SERVICES,
  PRICES,
  REVIEWS,
  PROJECTS,
  PROCESS_STEPS,
  FAQ_ITEMS,
} from "@/lib/data";

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [activeProject, setActiveProject] = useState(0);
  const [projectSlide, setProjectSlide] = useState(0);
  const [heroSlide, setHeroSlide] = useState(0);
  const [formData, setFormData] = useState({ name: "", phone: "", message: "" });
  const [formStatus, setFormStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [miniFormData, setMiniFormData] = useState({ name: "", phone: "", message: "" });
  const [miniFormStatus, setMiniFormStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set());
  const reviewsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setHeroSlide((p) => (p + 1) % HERO_IMAGES.length), 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => { setProjectSlide(0); }, [activeProject]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) setVisibleSections((prev) => new Set(prev).add(entry.target.id));
      });
    }, { threshold: 0.1 });
    document.querySelectorAll("section[id]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const isVisible = (id: string) => visibleSections.has(id);
  const scrollTo = (id: string) => { setMenuOpen(false); document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }); };

  const scrollReviews = (direction: number) => {
    if (!reviewsRef.current) return;
    const firstCard = reviewsRef.current.querySelector(".review-card") as HTMLElement;
    if (!firstCard) return;
    reviewsRef.current.scrollBy({ left: direction * (firstCard.offsetWidth + 16), behavior: "smooth" });
  };

  const submitForm = async (
    data: { name: string; phone: string; message: string },
    setStatus: (s: "idle" | "sending" | "sent" | "error") => void,
    resetData: () => void
  ) => {
    setStatus("sending");
    try {
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_key: CONTACTS.web3formsKey,
          subject: "Новая заявка с сайта ПОТОЛКОВО",
          from_name: "ПОТОЛКОВО Сайт",
          name: data.name,
          phone: data.phone,
          message: data.message || "Не указано",
        }),
      });
      const result = await response.json();
      if (result.success) {
        setStatus("sent");
        resetData();
      } else {
        setStatus("error");
        setTimeout(() => setStatus("idle"), 4000);
      }
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 4000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitForm(formData, setFormStatus, () => setFormData({ name: "", phone: "", message: "" }));
  };

  const handleMiniSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitForm(miniFormData, setMiniFormStatus, () => setMiniFormData({ name: "", phone: "", message: "" }));
  };

  return (
    <div style={{ fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", color: "#1a1a1a", background: "#fafafa", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap');
        *{margin:0;padding:0;box-sizing:border-box}html{scroll-behavior:smooth}body{overflow-x:hidden}::selection{background:#1a1a1a;color:#fff}
        .fade-up{opacity:0;transform:translateY(40px);transition:opacity .8s cubic-bezier(.16,1,.3,1),transform .8s cubic-bezier(.16,1,.3,1)}.fade-up.visible{opacity:1;transform:translateY(0)}
        .fade-up-d1{transition-delay:.1s}.fade-up-d2{transition-delay:.2s}.fade-up-d3{transition-delay:.3s}.fade-up-d4{transition-delay:.4s}.fade-up-d5{transition-delay:.5s}.fade-up-d6{transition-delay:.6s}
        @keyframes float1{0%,100%{transform:translate(0,0) rotate(0)}33%{transform:translate(30px,-30px) rotate(120deg)}66%{transform:translate(-20px,20px) rotate(240deg)}}
        @keyframes float2{0%,100%{transform:translate(0,0)}33%{transform:translate(-40px,20px)}66%{transform:translate(25px,-35px)}}
        @keyframes float3{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(20px,-20px) scale(1.1)}}
        @keyframes badgePulse{0%,100%{box-shadow:0 0 0 0 rgba(45,122,58,0.5)}70%{box-shadow:0 0 0 12px rgba(45,122,58,0)}}
        @keyframes dotBlink{0%,100%{opacity:1}50%{opacity:.3}}
        .bg-shape{position:absolute;border-radius:50%;filter:blur(80px);opacity:.07;pointer-events:none}
        button,a{cursor:pointer}
        .cta-btn{display:inline-flex;align-items:center;gap:8px;padding:16px 36px;background:#1a1a1a;color:#fff;border:none;font-size:15px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;cursor:pointer;transition:all .3s cubic-bezier(.16,1,.3,1);overflow:hidden;font-family:'Inter',sans-serif}
        .cta-btn:hover{background:#333;transform:translateY(-2px);box-shadow:0 8px 30px rgba(0,0,0,.2)}.cta-btn:disabled{opacity:.6;cursor:not-allowed;transform:none;box-shadow:none}
        .cta-btn-outline{background:transparent;color:#1a1a1a;border:2px solid #1a1a1a}.cta-btn-outline:hover{background:#1a1a1a;color:#fff}
        .cta-btn-white{background:#fff;color:#1a1a1a}.cta-btn-white:hover{background:#e8e8e8}
        .cta-btn-error{background:#c0392b}.cta-btn-error:hover{background:#c0392b}
        .nav-link{color:#666;text-decoration:none;font-size:14px;font-weight:500;letter-spacing:.5px;text-transform:uppercase;transition:color .3s;cursor:pointer;background:none;border:none;font-family:inherit}.nav-link:hover{color:#1a1a1a}
        .service-card{display:block;background:#fff;border:1px solid #e8e8e8;transition:all .4s cubic-bezier(.16,1,.3,1);position:relative;overflow:hidden;text-decoration:none;color:inherit}
        .service-card::before{content:'';position:absolute;top:0;left:0;width:100%;height:3px;background:#1a1a1a;transform:scaleX(0);transform-origin:left;transition:transform .4s cubic-bezier(.16,1,.3,1);z-index:2}
        .service-card:hover{border-color:#1a1a1a;transform:translateY(-4px);box-shadow:0 12px 40px rgba(0,0,0,.08)}.service-card:hover::before{transform:scaleX(1)}
        .service-card-arrow{opacity:0;transform:translateX(-8px);transition:all .3s}.service-card:hover .service-card-arrow{opacity:1;transform:translateX(0)}
        .project-tab{padding:12px 24px;background:transparent;border:1px solid #ddd;color:#888;font-size:13px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;cursor:pointer;transition:all .3s;font-family:inherit;white-space:nowrap}
        .project-tab.active{background:#1a1a1a;color:#fff;border-color:#1a1a1a}.project-tab:hover:not(.active){border-color:#1a1a1a;color:#1a1a1a}
        .slide-dot{width:10px;height:10px;border-radius:50%;border:2px solid #999;background:transparent;cursor:pointer;transition:all .3s;padding:0}.slide-dot.active{background:#1a1a1a;border-color:#1a1a1a}
        .slide-arrow{width:40px;height:40px;border-radius:50%;border:1px solid rgba(255,255,255,.5);background:rgba(0,0,0,.4);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .3s;font-size:18px;backdrop-filter:blur(10px);font-family:inherit}.slide-arrow:hover{background:rgba(0,0,0,.7);border-color:#fff}
        .tag{display:inline-block;padding:6px 14px;background:#f0f0f0;font-size:12px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;color:#666}
        .section-label{font-size:12px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#999;margin-bottom:16px;font-family:'JetBrains Mono',monospace}
        .section-title{font-size:clamp(32px,5vw,56px);font-weight:800;line-height:1.1;letter-spacing:-1.5px;color:#1a1a1a;margin-bottom:24px}
        input,textarea{width:100%;padding:16px 20px;border:1px solid #ddd;background:#fff;font-size:15px;font-family:inherit;color:#1a1a1a;transition:border-color .3s;outline:none}input:focus,textarea:focus{border-color:#1a1a1a}input::placeholder,textarea::placeholder{color:#aaa}
        .mobile-menu{position:fixed;top:0;left:0;width:100%;height:100vh;background:#fafafa;z-index:999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:32px;transform:translateY(-100%);transition:transform .5s cubic-bezier(.16,1,.3,1)}.mobile-menu.open{transform:translateY(0)}
        .mobile-menu button{font-size:24px;font-weight:700;text-transform:uppercase;letter-spacing:2px;background:none;border:none;color:#1a1a1a;cursor:pointer;font-family:inherit}
        .hamburger{display:none;flex-direction:column;gap:5px;background:none;border:none;cursor:pointer;z-index:1001;padding:8px}.hamburger span{width:28px;height:2px;background:#1a1a1a;transition:all .3s}
        .hamburger.open span:nth-child(1){transform:rotate(45deg) translate(5px,5px)}.hamburger.open span:nth-child(2){opacity:0}.hamburger.open span:nth-child(3){transform:rotate(-45deg) translate(5px,-5px)}
        .price-row{display:flex;justify-content:space-between;align-items:center;padding:20px 0;border-bottom:1px solid #e8e8e8;transition:background .3s}.price-row:hover{background:#f8f8f8;padding-left:12px;padding-right:12px}
        .urgency-badge{display:inline-flex;align-items:center;gap:10px;background:#2d7a3a;color:#fff;padding:12px 24px;font-family:'Inter',sans-serif;font-size:14px;font-weight:600;letter-spacing:0.3px;line-height:1.4;animation:badgePulse 2s ease-in-out infinite;border:none}
        .urgency-dot{width:8px;height:8px;min-width:8px;border-radius:50%;background:#7dff8a;display:inline-block;animation:dotBlink 1.5s ease-in-out infinite}
        .review-card{background:#fff;border:1px solid #e8e8e8;padding:24px;transition:border-color .3s;flex-shrink:0;scroll-snap-align:start;width:340px}.review-card:hover{border-color:#1a1a1a}
        .reviews-scroll{display:flex;gap:16px;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding:4px 0}
        .reviews-scroll::-webkit-scrollbar{display:none}
        .review-scroll-btn{width:44px;height:44px;min-width:44px;border-radius:50%;border:1px solid #ddd;background:#fff;color:#1a1a1a;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .3s;font-size:18px;font-family:inherit;flex-shrink:0}
        .review-scroll-btn:hover{background:#1a1a1a;color:#fff;border-color:#1a1a1a}
        .why-card{padding:28px;background:#fff;border:1px solid #e8e8e8;transition:all .3s}.why-card:hover{border-color:#1a1a1a;transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.06)}
        .hero-badge{display:inline-flex;align-items:center;gap:8px;padding:8px 16px;background:rgba(255,255,255,.12);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.15);font-size:13px;color:rgba(255,255,255,.9);font-weight:500}
        .mobile-bottom-bar{display:none;position:fixed;bottom:0;left:0;width:100%;z-index:998;background:#fff;border-top:1px solid #e8e8e8;padding:8px 12px;gap:8px;box-shadow:0 -2px 20px rgba(0,0,0,.08)}
        .mobile-bottom-bar a,.mobile-bottom-bar button{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:12px 8px;font-size:13px;font-weight:600;border:none;text-decoration:none;font-family:'Inter',sans-serif;cursor:pointer;transition:all .2s}
        .project-meta{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:24px}
        .project-meta-item{padding:8px 12px;background:#f5f5f5;font-size:12px;font-weight:600;color:#555;font-family:'JetBrains Mono',monospace;letter-spacing:.3px}
        @media(max-width:1024px){.review-card{width:300px}}
        @media(max-width:768px){
          .hamburger{display:flex}.desktop-nav{display:none!important}.hero-grid{grid-template-columns:1fr!important}
          .services-grid{grid-template-columns:1fr!important}.advantages-grid{grid-template-columns:repeat(2,1fr)!important}
          .project-tabs{flex-wrap:wrap}.footer-grid{grid-template-columns:1fr!important;text-align:center}
          .contact-grid{grid-template-columns:1fr!important}.process-grid{grid-template-columns:repeat(2,1fr)!important}
          .why-grid{grid-template-columns:1fr!important}
          .review-card{width:75vw;max-width:320px;min-width:220px}
          .review-scroll-btn{width:36px;height:36px;min-width:36px;font-size:14px}
          .urgency-badge{font-size:12px;padding:10px 16px;gap:8px}
          .mobile-bottom-bar{display:flex}
          .mobile-header-cta{display:flex!important}
          body{padding-bottom:64px}
        }
        @media(max-width:480px){
          .advantages-grid{grid-template-columns:1fr!important}.process-grid{grid-template-columns:1fr!important}
          .why-grid{grid-template-columns:1fr!important}
          .review-card{width:78vw;max-width:300px;min-width:200px}
          .review-scroll-btn{width:32px;height:32px;min-width:32px;font-size:13px}
          .urgency-badge{font-size:11px;padding:8px 14px}
        }
        @media(min-width:769px){
          .mobile-header-cta{display:none!important}
        }
      `}</style>

      {/* NAV */}
      <nav style={{ position: "fixed", top: 0, left: 0, width: "100%", padding: "0 clamp(24px,5vw,80px)", height: 72, display: "flex", alignItems: "center", justifyContent: "space-between", background: scrollY > 50 ? "rgba(250,250,250,0.95)" : "transparent", backdropFilter: scrollY > 50 ? "blur(20px)" : "none", borderBottom: scrollY > 50 ? "1px solid #e8e8e8" : "1px solid transparent", zIndex: 1000, transition: "all .3s" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={() => scrollTo("hero")}>
          <Image src="/logo.jpeg" alt="ПОТОЛКОВО логотип" width={40} height={40} priority style={{ objectFit: "contain" }} />
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 18, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: scrollY > 50 ? "#1a1a1a" : "#fff", transition: "color .3s" }}>ПОТОЛКОВО</span>
        </div>
        <div className="desktop-nav" style={{ display: "flex", gap: 32, alignItems: "center" }}>
          {NAV_ITEMS.map(([l, id]) => (
            <button key={id} className="nav-link" onClick={() => scrollTo(id)} style={{ color: scrollY > 50 ? "#666" : "rgba(255,255,255,0.8)" }}>{l}</button>
          ))}
          <button className="cta-btn" style={{ padding: "10px 24px", fontSize: 12 }} onClick={() => scrollTo("contact")}>Оставить заявку</button>
        </div>
        {/* Мобильная кнопка быстрой связи в хедере */}
        <a href={CONTACTS.telegram} target="_blank" rel="noopener noreferrer" className="mobile-header-cta" style={{ display: "none", alignItems: "center", justifyContent: "center", width: 40, height: 40, background: scrollY > 50 ? "#1a1a1a" : "rgba(255,255,255,.15)", color: scrollY > 50 ? "#fff" : "#fff", border: "none", fontSize: 18, transition: "all .3s", textDecoration: "none", marginRight: 48 }}>✈️</a>
        <button className={`hamburger ${menuOpen ? "open" : ""}`} onClick={() => setMenuOpen(!menuOpen)}>
          <span style={{ background: scrollY > 50 ? "#1a1a1a" : "#fff" }} /><span style={{ background: scrollY > 50 ? "#1a1a1a" : "#fff" }} /><span style={{ background: scrollY > 50 ? "#1a1a1a" : "#fff" }} />
        </button>
      </nav>
      <div className={`mobile-menu ${menuOpen ? "open" : ""}`}>
        {NAV_ITEMS.map(([l, id]) => (
          <button key={id} onClick={() => scrollTo(id)}>{l}</button>
        ))}
      </div>

      {/* HERO */}
      <section id="hero" style={{ minHeight: "100vh", display: "flex", alignItems: "center", position: "relative", overflow: "hidden" }}>
        {HERO_IMAGES.map((img, i) => (<div key={i} style={{ position: "absolute", inset: 0, opacity: heroSlide === i ? 1 : 0, transition: "opacity 1s ease", zIndex: 0 }}><Image src={img.src} alt={img.alt} fill priority={i === 0} quality={85} sizes="100vw" style={{ objectFit: "cover", objectPosition: "center", transform: heroSlide === i ? "scale(1)" : "scale(1.05)", transition: "transform 6s ease" }} /></div>))}
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1 }} />
        <div style={{ maxWidth: 1400, width: "100%", margin: "0 auto", position: "relative", zIndex: 2, padding: "120px clamp(24px,5vw,80px) 80px" }}>
          <div className="urgency-badge" style={{ marginBottom: 24 }}><span className="urgency-dot" />Свободные даты на этой неделе — запишитесь на замер</div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 500, letterSpacing: 3, color: "rgba(255,255,255,0.6)", marginBottom: 24, textTransform: "uppercase" }}>Москва и МО / с 2010 года</div>
          <h1 style={{ fontSize: "clamp(36px,5.5vw,72px)", fontWeight: 900, lineHeight: 1.05, letterSpacing: -2, marginBottom: 24, color: "#fff", textShadow: "0 2px 20px rgba(0,0,0,0.5)" }}>
            Современные натяжные<br />потолки в Москве и&nbsp;МО
          </h1>
          <p style={{ fontSize: 18, lineHeight: 1.7, color: "rgba(255,255,255,0.75)", maxWidth: 580, marginBottom: 40, textShadow: "0 1px 10px rgba(0,0,0,0.3)" }}>
            Теневые, парящие, световые линии и трековое освещение. Работаю лично, без посредников. Бесплатный замер и точный расчёт после осмотра.
          </p>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 32 }}>
            <button className="cta-btn cta-btn-white" onClick={() => scrollTo("contact")}>Рассчитать стоимость →</button>
            <a href={CONTACTS.telegram} target="_blank" rel="noopener noreferrer" className="cta-btn" style={{ background: "transparent", border: "2px solid rgba(255,255,255,0.5)", textDecoration: "none" }}>✈️ Написать в Telegram</a>
          </div>
          {/* Бейджи под кнопками */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 48 }}>
            {["Москва и МО", "Личный монтаж", "Без посредников", "Договор и гарантия"].map((b) => (
              <span key={b} className="hero-badge">{b}</span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>{HERO_IMAGES.map((_, i) => (<button key={i} onClick={() => setHeroSlide(i)} style={{ width: heroSlide === i ? 32 : 10, height: 4, borderRadius: 2, background: heroSlide === i ? "#fff" : "rgba(255,255,255,0.4)", border: "none", cursor: "pointer", transition: "all .3s", padding: 0 }} />))}</div>
        </div>
        <div style={{ position: "absolute", bottom: 40, right: "clamp(24px,5vw,80px)", display: "flex", gap: 8, zIndex: 3 }}>
          <button className="slide-arrow" onClick={() => setHeroSlide((heroSlide - 1 + HERO_IMAGES.length) % HERO_IMAGES.length)}>←</button>
          <button className="slide-arrow" onClick={() => setHeroSlide((heroSlide + 1) % HERO_IMAGES.length)}>→</button>
        </div>
      </section>

      {/* WHY CHOOSE */}
      <section id="why" style={{ padding: "100px clamp(24px,5vw,80px)", position: "relative", overflow: "hidden" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto" }}>
          <div className={`fade-up ${isVisible("why") ? "visible" : ""}`}>
            <div className="section-label">Почему я</div>
            <h2 className="section-title">Почему клиенты<br /><span style={{ color: "#999" }}>выбирают меня</span></h2>
          </div>
          <div className="why-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20, marginTop: 48 }}>
            {WHY_CHOOSE.map((item, i) => (
              <div key={i} className={`why-card fade-up ${isVisible("why") ? "visible" : ""} fade-up-d${Math.min(i + 1, 6)}`}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>{item.icon}</div>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, letterSpacing: -0.3 }}>{item.title}</div>
                <div style={{ fontSize: 14, lineHeight: 1.7, color: "#666" }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ADVANTAGES (цифры) */}
      <section id="advantages" style={{ padding: 0, background: "#1a1a1a", color: "#fff" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto" }}>
          <div className={`advantages-grid fade-up ${isVisible("advantages") ? "visible" : ""}`} style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 0 }}>
            {ADVANTAGES.map((a, i) => (
              <div key={i} className={`fade-up ${isVisible("advantages") ? "visible" : ""} fade-up-d${i + 1}`} style={{ position: "relative", overflow: "hidden", minHeight: 320, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: 32, borderRight: i < 3 ? "1px solid rgba(255,255,255,0.08)" : "none" }}
                onMouseEnter={e => { const o = e.currentTarget.querySelector(".adv-overlay") as HTMLElement; if (o) o.style.opacity = "0.5"; }}
                onMouseLeave={e => { const o = e.currentTarget.querySelector(".adv-overlay") as HTMLElement; if (o) o.style.opacity = "0.7"; }}>
                <Image src={a.image} alt={a.label} fill sizes="(max-width:768px) 50vw, 25vw" style={{ objectFit: "cover" }} />
                <div className="adv-overlay" style={{ position: "absolute", inset: 0, background: "#1a1a1a", opacity: 0.7, transition: "opacity .4s" }} />
                <div style={{ position: "relative", zIndex: 2, textAlign: "center" }}>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 52, fontWeight: 700, marginBottom: 8 }}>{a.num}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, marginBottom: 4 }}>{a.label}</div>
                  <div style={{ fontSize: 13, color: "#888" }}>{a.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" style={{ padding: "120px clamp(24px,5vw,80px)", position: "relative", overflow: "hidden" }}>
        <div className="bg-shape" style={{ width: 500, height: 500, background: "#1a1a1a", bottom: "0%", right: "-10%", animation: "float1 25s ease-in-out infinite" }} />
        <div style={{ maxWidth: 1400, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <div className={`fade-up ${isVisible("services") ? "visible" : ""}`}>
            <div className="section-label">Что делаю</div>
            <h2 className="section-title">Полный спектр.<br /><span style={{ color: "#999" }}>Без «мы так не делаем».</span></h2>
          </div>
          <div className="services-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24, marginTop: 64 }}>
            {SERVICES.map((s, i) => (
              <Link key={i} href={s.href} className={`service-card fade-up ${isVisible("services") ? "visible" : ""} fade-up-d${Math.min((i % 6) + 1, 6)}`}>
                <div style={{ width: "100%", height: 180, position: "relative", overflow: "hidden" }}>
                  <Image src={s.image} alt={s.title} fill sizes="(max-width:768px) 100vw, 33vw" style={{ objectFit: "cover" }} />
                </div>
                <div style={{ padding: "28px 28px 32px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <span style={{ fontSize: 24 }}>{s.emoji}</span>
                    <h3 style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.3 }}>{s.title}</h3>
                    <span className="service-card-arrow" style={{ marginLeft: "auto", fontSize: 18, color: "#999" }}>→</span>
                  </div>
                  <p style={{ fontSize: 14, lineHeight: 1.7, color: "#666", marginBottom: s.priceLabel ? 12 : 0 }}>{s.desc}</p>
                  {s.priceLabel && (
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a", fontFamily: "'JetBrains Mono',monospace" }}>{s.priceLabel}</div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* PRICES */}
      <section id="prices" style={{ padding: "120px clamp(24px,5vw,80px)", background: "#f2f2f2", position: "relative", overflow: "hidden" }}>
        <div className="bg-shape" style={{ width: 400, height: 400, background: "#1a1a1a", top: "20%", right: "-5%", animation: "float3 20s ease-in-out infinite" }} />
        <div style={{ maxWidth: 900, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <div className={`fade-up ${isVisible("prices") ? "visible" : ""}`}>
            <div className="section-label">Цены</div>
            <h2 className="section-title">Ориентировочные цены.<br /><span style={{ color: "#999" }}>Точные — после замера.</span></h2>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: "#666", maxWidth: 600, marginTop: -8 }}>Точная стоимость зависит от площади, профиля, освещения и сложности монтажа.</p>
          </div>
          <div className={`fade-up fade-up-d2 ${isVisible("prices") ? "visible" : ""}`} style={{ marginTop: 48, background: "#fff", border: "1px solid #e8e8e8", padding: "8px 32px" }}>
            {PRICES.map((p, i) => (<div key={i} className="price-row"><span style={{ fontSize: 16, fontWeight: 500 }}>{p.service}</span><span style={{ fontSize: 18, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", whiteSpace: "nowrap" }}>{p.price}</span></div>))}
          </div>
          <div className={`fade-up fade-up-d3 ${isVisible("prices") ? "visible" : ""}`} style={{ marginTop: 24, padding: 24, background: "#fff", border: "1px solid #e8e8e8" }}>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: "#666", marginBottom: 16 }}>📐 <strong>Замер бесплатный.</strong> Приезжаю, считаю точную стоимость на месте. Без «потом уточним».</p>
            <p style={{ fontSize: 13, color: "#999" }}>Цена зависит от площади, количества углов, типа профиля, освещения. Указанные цены — минимальные, для ориентира.</p>
          </div>
          <div className={`fade-up fade-up-d4 ${isVisible("prices") ? "visible" : ""}`} style={{ marginTop: 32, textAlign: "center" }}><button className="cta-btn" onClick={() => scrollTo("contact")}>Рассчитать стоимость →</button></div>
        </div>
      </section>

      {/* MINI FORM */}
      <section id="mini-form" style={{ padding: "80px clamp(24px,5vw,80px)", background: "#fff", borderTop: "1px solid #e8e8e8", borderBottom: "1px solid #e8e8e8" }}>
        <div style={{ maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
          <div className={`fade-up ${isVisible("mini-form") ? "visible" : ""}`}>
            <h2 style={{ fontSize: "clamp(24px,3.5vw,36px)", fontWeight: 800, letterSpacing: -1, marginBottom: 12 }}>Узнайте стоимость вашего потолка</h2>
            <p style={{ fontSize: 15, color: "#666", marginBottom: 40 }}>Бесплатный замер. Точная смета после осмотра.</p>
          </div>
          {miniFormStatus === "sent" ? (
            <div className={`fade-up ${isVisible("mini-form") ? "visible" : ""}`} style={{ padding: "32px 24px", background: "#f0faf0", border: "1px solid #c8e6c9" }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>✓</div>
              <h3 style={{ fontSize: 20, fontWeight: 800, color: "#2d7a3a", marginBottom: 8 }}>Заявка получена!</h3>
              <p style={{ fontSize: 14, color: "#555", marginBottom: 16 }}>Перезвоню в течение 2 часов.</p>
              <button className="cta-btn cta-btn-outline" style={{ fontSize: 12, padding: "10px 20px" }} onClick={() => setMiniFormStatus("idle")}>Отправить ещё</button>
            </div>
          ) : (
            <form onSubmit={handleMiniSubmit} className={`fade-up fade-up-d1 ${isVisible("mini-form") ? "visible" : ""}`} style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 200px" }}>
                <input type="text" placeholder="Имя" value={miniFormData.name} onChange={e => setMiniFormData({ ...miniFormData, name: e.target.value })} required disabled={miniFormStatus === "sending"} />
              </div>
              <div style={{ flex: "1 1 200px" }}>
                <input type="tel" placeholder="Телефон" value={miniFormData.phone} onChange={e => setMiniFormData({ ...miniFormData, phone: e.target.value })} required disabled={miniFormStatus === "sending"} />
              </div>
              <div style={{ flex: "2 1 100%"}}>
                <input type="text" placeholder="Что хотите сделать? (необязательно)" value={miniFormData.message} onChange={e => setMiniFormData({ ...miniFormData, message: e.target.value })} disabled={miniFormStatus === "sending"} />
              </div>
              <div style={{ flex: "1 1 100%", textAlign: "center" }}>
                <button type="submit" className={`cta-btn ${miniFormStatus === "error" ? "cta-btn-error" : ""}`} style={{ width: "100%", maxWidth: 400, justifyContent: "center" }} disabled={miniFormStatus === "sending"}>
                  {miniFormStatus === "sending" ? "Отправляю..." : miniFormStatus === "error" ? "✕ Ошибка. Попробуйте ещё" : "Рассчитать стоимость →"}
                </button>
              </div>
              <p style={{ flex: "1 1 100%", fontSize: 11, color: "#bbb", textAlign: "center", lineHeight: 1.5 }}>
                Нажимая на кнопку, вы даёте согласие на обработку персональных данных в соответствии с{" "}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "#999", textDecoration: "underline" }}>Политикой конфиденциальности</a>
              </p>
            </form>
          )}
        </div>
      </section>

      {/* REVIEWS */}
      <section id="reviews" style={{ padding: "120px 0", position: "relative", overflow: "hidden" }}>
        <div style={{ paddingLeft: "clamp(24px,5vw,80px)", paddingRight: "clamp(24px,5vw,80px)" }}>
          <div className={`fade-up ${isVisible("reviews") ? "visible" : ""}`}><div className="section-label">Отзывы</div><h2 className="section-title">Клиенты говорят<br /><span style={{ color: "#999" }}>лучше любой рекламы.</span></h2></div>
          <div className={`fade-up fade-up-d1 ${isVisible("reviews") ? "visible" : ""}`} style={{ display: "flex", alignItems: "center", gap: 24, marginTop: 32, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <span style={{ fontSize: 56, fontWeight: 900, fontFamily: "'JetBrains Mono',monospace", lineHeight: 1 }}>5.0</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <div style={{ display: "flex", gap: 3 }}>{[...Array(5)].map((_, j) => (<span key={j} style={{ fontSize: 22, color: "#f5a623" }}>★</span>))}</div>
                <span style={{ fontSize: 13, color: "#999", fontFamily: "'JetBrains Mono',monospace" }}>на основании {REVIEWS.length} оценок</span>
              </div>
            </div>
            <a href={CONTACTS.avitoUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#1a1a1a", textDecoration: "none", borderBottom: "1px solid #ccc", paddingBottom: 2 }}>Смотреть на Авито ↗</a>
          </div>
          <div className={`fade-up fade-up-d2 ${isVisible("reviews") ? "visible" : ""}`} style={{ marginTop: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button className="review-scroll-btn" onClick={() => scrollReviews(-1)}>←</button>
              <div ref={reviewsRef} className="reviews-scroll" style={{ flex: 1 }}>
                {REVIEWS.map((r, i) => (
                  <div key={i} className="review-card">
                    <div style={{ display: "flex", gap: 3, marginBottom: 12 }}>{[...Array(r.rating)].map((_, j) => (<span key={j} style={{ fontSize: 16, color: "#f5a623" }}>★</span>))}</div>
                    <p style={{ fontSize: 14, lineHeight: 1.7, color: "#555", marginBottom: 16 }}>«{r.text}»</p>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a" }}>{r.name}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 4 }}>
                        <span style={{ fontSize: 11, color: "#999", fontFamily: "'JetBrains Mono',monospace" }}>Авито · Сделка состоялась</span>
                        <span style={{ fontSize: 11, color: "#bbb", fontFamily: "'JetBrains Mono',monospace", whiteSpace: "nowrap" }}>{r.date}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button className="review-scroll-btn" onClick={() => scrollReviews(1)}>→</button>
            </div>
          </div>
        </div>
        <div className={`fade-up fade-up-d3 ${isVisible("reviews") ? "visible" : ""}`} style={{ textAlign: "center", marginTop: 40 }}>
          <a href={CONTACTS.avitoUrl} target="_blank" rel="noopener noreferrer" className="cta-btn cta-btn-outline" style={{ textDecoration: "none" }}>Все отзывы на Авито →</a>
        </div>
      </section>

      {/* PROJECTS */}
      <section id="projects" style={{ padding: "120px clamp(24px,5vw,80px)", background: "#f2f2f2", position: "relative", overflow: "hidden" }}>
        <div className="bg-shape" style={{ width: 400, height: 400, background: "#1a1a1a", top: "10%", left: "-5%", animation: "float2 18s ease-in-out infinite" }} />
        <div style={{ maxWidth: 1400, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <div className={`fade-up ${isVisible("projects") ? "visible" : ""}`}><div className="section-label">Проекты</div><h2 className="section-title">Не рендеры.<br /><span style={{ color: "#999" }}>Реальные объекты.</span></h2></div>
          <div className="project-tabs" style={{ display: "flex", gap: 8, marginTop: 48, overflowX: "auto", paddingBottom: 8 }}>
            {PROJECTS.map((p, i) => (<button key={i} className={`project-tab ${activeProject === i ? "active" : ""}`} onClick={() => setActiveProject(i)}>{p.title}</button>))}
          </div>
          <div className="hero-grid" style={{ marginTop: 48, display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 48, alignItems: "center" }}>
            <div style={{ position: "relative", overflow: "hidden" }}>
              <div style={{ aspectRatio: "4/3", position: "relative", background: "#e0e0e0", overflow: "hidden" }}>
                {PROJECTS[activeProject].images.map((img, i) => (<div key={`${activeProject}-${i}`} style={{ position: "absolute", inset: 0, opacity: projectSlide === i ? 1 : 0, transition: "opacity .6s ease" }}><Image src={img} alt={`${PROJECTS[activeProject].title} — фото ${i + 1}`} fill sizes="(max-width:768px) 100vw, 60vw" style={{ objectFit: "cover" }} /></div>))}
                <div style={{ position: "absolute", bottom: 16, left: 16, fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "#fff", background: "rgba(0,0,0,0.6)", padding: "6px 12px", backdropFilter: "blur(10px)", zIndex: 2 }}>{String(projectSlide + 1).padStart(2, "0")} / {String(PROJECTS[activeProject].images.length).padStart(2, "0")}</div>
                <div style={{ position: "absolute", bottom: 16, right: 16, display: "flex", gap: 8, zIndex: 2 }}>
                  <button className="slide-arrow" style={{ width: 36, height: 36, fontSize: 14 }} onClick={() => setProjectSlide((projectSlide - 1 + PROJECTS[activeProject].images.length) % PROJECTS[activeProject].images.length)}>←</button>
                  <button className="slide-arrow" style={{ width: 36, height: 36, fontSize: 14 }} onClick={() => setProjectSlide((projectSlide + 1) % PROJECTS[activeProject].images.length)}>→</button>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 12, justifyContent: "center" }}>{PROJECTS[activeProject].images.map((_, i) => (<button key={i} className={`slide-dot ${projectSlide === i ? "active" : ""}`} onClick={() => setProjectSlide(i)} />))}</div>
            </div>
            <div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 64, fontWeight: 700, color: "#e0e0e0", lineHeight: 1, marginBottom: 16 }}>{String(activeProject + 1).padStart(2, "0")}</div>
              <h3 style={{ fontSize: 28, fontWeight: 800, letterSpacing: -1, marginBottom: 16 }}>{PROJECTS[activeProject].title}</h3>
              {/* Project meta */}
              <div className="project-meta">
                {PROJECTS[activeProject].type && <span className="project-meta-item">{PROJECTS[activeProject].type}</span>}
                {PROJECTS[activeProject].area && <span className="project-meta-item">📐 {PROJECTS[activeProject].area}</span>}
                {PROJECTS[activeProject].duration && <span className="project-meta-item">⏱️ {PROJECTS[activeProject].duration}</span>}
                {PROJECTS[activeProject].priceFrom && <span className="project-meta-item">💰 {PROJECTS[activeProject].priceFrom}</span>}
              </div>
              <p style={{ fontSize: 15, lineHeight: 1.8, color: "#666", marginBottom: 24 }}>{PROJECTS[activeProject].desc}</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 32 }}>{PROJECTS[activeProject].tags.map((tag, i) => (<span key={i} className="tag">{tag}</span>))}</div>
              <button className="cta-btn" style={{ fontSize: 13, padding: "14px 28px" }} onClick={() => scrollTo("contact")}>Хочу такой же →</button>
            </div>
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" style={{ padding: "120px clamp(24px,5vw,80px)", position: "relative", overflow: "hidden" }}>
        <div className="bg-shape" style={{ width: 500, height: 500, background: "#666", top: "20%", right: "0%", animation: "float3 22s ease-in-out infinite" }} />
        <div style={{ maxWidth: 1400, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <div className="hero-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "start" }}>
            <div className={`fade-up ${isVisible("about") ? "visible" : ""}`}>
              <div className="section-label">Обо мне</div>
              <h2 className="section-title">Владимир.<br /><span style={{ color: "#999" }}>Один мастер. Один стандарт.</span></h2>
              <div style={{ width: "100%", aspectRatio: "3/2", marginBottom: 32, position: "relative", overflow: "hidden", border: "1px solid #e8e8e8" }}>
                <Image src="/about-master.jpeg" alt="Владимир — мастер по натяжным потолкам в Москве" fill sizes="(max-width:768px) 100vw, 50vw" style={{ objectFit: "cover" }} />
                <div style={{ position: "absolute", bottom: 16, left: 16, background: "#1a1a1a", color: "#fff", padding: "8px 16px", fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: 1, textTransform: "uppercase", zIndex: 2 }}>Владимир / Основатель</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <p style={{ fontSize: 16, lineHeight: 1.8, color: "#555" }}>Я не франшиза. Не бригада с текучкой. Я — частный мастер, который с 2010 года занимается одним делом: натяжными потолками. Более 15 лет опыта на объектах любой сложности.</p>
                <p style={{ fontSize: 16, lineHeight: 1.8, color: "#555" }}>Сам замеряю. Сам проектирую. Сам монтирую. Беру ограниченное количество заказов — это позволяет держать качество и контроль на каждом этапе. Каждый объект — моя личная репутация.</p>
                <p style={{ fontSize: 16, lineHeight: 1.8, color: "#555" }}>Работаю чисто: пневмопистолеты вместо перфоратора, а при сверлении — пылесборник. Составляю договор, даю гарантию на монтаж. Лично веду объект от замера до сдачи.</p>
              </div>
            </div>
            <div className={`fade-up fade-up-d2 ${isVisible("about") ? "visible" : ""}`} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#999", fontFamily: "'JetBrains Mono',monospace", marginBottom: 4 }}>Частые вопросы</div>
              {FAQ_ITEMS.map((item, i) => (
                <div key={i} style={{ padding: 24, background: "#fff", border: "1px solid #e8e8e8", transition: "border-color .3s" }} onMouseEnter={e => (e.currentTarget.style.borderColor = "#1a1a1a")} onMouseLeave={e => (e.currentTarget.style.borderColor = "#e8e8e8")}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}><span style={{ fontSize: 20 }}>{item.icon}</span><div style={{ fontSize: 15, fontWeight: 700, letterSpacing: -0.3 }}>{item.q}</div></div>
                  <div style={{ fontSize: 14, lineHeight: 1.7, color: "#666", paddingLeft: 30 }}>{item.a}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PROCESS */}
      <section id="process" style={{ padding: "120px clamp(24px,5vw,80px)", background: "#1a1a1a", color: "#fff", position: "relative", overflow: "hidden" }}>
        <div className="bg-shape" style={{ width: 600, height: 600, background: "#fff", bottom: "-20%", left: "30%", opacity: 0.02, animation: "float1 30s ease-in-out infinite" }} />
        <div style={{ maxWidth: 1400, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <div className={`fade-up ${isVisible("process") ? "visible" : ""}`}><div className="section-label" style={{ color: "#666" }}>Как работаю</div><h2 className="section-title" style={{ color: "#fff", marginBottom: 64 }}>Четыре шага.<br /><span style={{ color: "#666" }}>Без лишнего.</span></h2></div>
          <div className="process-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 24 }}>
            {PROCESS_STEPS.map((item, i) => (
              <div key={i} className={`fade-up ${isVisible("process") ? "visible" : ""} fade-up-d${i + 1}`} style={{ border: "1px solid rgba(255,255,255,0.1)", transition: "border-color .3s", overflow: "hidden" }} onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)")} onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}>
                <div style={{ width: "100%", height: 160, position: "relative", overflow: "hidden" }}>
                  <Image src={item.image} alt={item.title} fill sizes="(max-width:768px) 50vw, 25vw" style={{ objectFit: "cover" }} />
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom,rgba(26,26,26,0.3),rgba(26,26,26,0.8))" }} />
                  <div style={{ position: "absolute", top: 16, left: 16, fontFamily: "'JetBrains Mono',monospace", fontSize: 36, fontWeight: 700, color: "rgba(255,255,255,0.3)" }}>{item.step}</div>
                  <div style={{ position: "absolute", bottom: 16, right: 16, fontSize: 28 }}>{item.icon}</div>
                </div>
                <div style={{ padding: 24 }}><h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>{item.title}</h3><p style={{ fontSize: 14, lineHeight: 1.7, color: "#888" }}>{item.desc}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA BANNER */}
      <section style={{ padding: "80px clamp(24px,5vw,80px)", position: "relative", overflow: "hidden", minHeight: 400, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Image src="/cta-banner.jpeg" alt="Интерьер с натяжным потолком ПОТОЛКОВО" fill sizes="100vw" style={{ objectFit: "cover" }} />
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)" }} />
        <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center", position: "relative", zIndex: 1 }}>
          <div className="urgency-badge" style={{ marginBottom: 24, display: "inline-flex" }}><span className="urgency-dot" />Есть свободные даты на этой неделе</div>
          <h2 style={{ fontSize: "clamp(28px,4vw,48px)", fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: 16, letterSpacing: -1 }}>Готовы к потолку, который удивляет?</h2>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.7)", marginBottom: 32 }}>Звоните или оставьте заявку — отвечу лично в течение 2 часов</p>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
            <a href={CONTACTS.phoneHref} className="cta-btn cta-btn-white" style={{ textDecoration: "none" }}>📞 {CONTACTS.phone}</a>
            <button className="cta-btn" style={{ background: "transparent", border: "2px solid rgba(255,255,255,0.5)" }} onClick={() => scrollTo("contact")}>Оставить заявку →</button>
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" style={{ padding: "120px clamp(24px,5vw,80px)", position: "relative", overflow: "hidden" }}>
        <div className="bg-shape" style={{ width: 400, height: 400, background: "#1a1a1a", top: "10%", left: "60%", animation: "float2 20s ease-in-out infinite" }} />
        <div style={{ maxWidth: 1400, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <div className={`fade-up ${isVisible("contact") ? "visible" : ""}`}><div className="section-label">Контакт</div><h2 className="section-title">Готовы начать?<br /><span style={{ color: "#999" }}>Напишите. Отвечу лично.</span></h2></div>
          <div className="contact-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, marginTop: 64 }}>
            <div className={`fade-up fade-up-d1 ${isVisible("contact") ? "visible" : ""}`}>
              {formStatus === "sent" ? (
                <div style={{ textAlign: "center", background: "#f0faf0", border: "1px solid #c8e6c9", padding: "48px 32px" }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
                  <h3 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12, color: "#2d7a3a" }}>Заявка получена!</h3>
                  <p style={{ fontSize: 16, lineHeight: 1.7, color: "#555", marginBottom: 24 }}>Владимир перезвонит вам в течение 2 часов.</p>
                  <p style={{ fontSize: 14, color: "#888", marginBottom: 24 }}>Если срочно — звоните:</p>
                  <a href={CONTACTS.phoneHref} style={{ fontSize: 20, fontWeight: 700, color: "#1a1a1a", textDecoration: "none" }}>📞 {CONTACTS.phone}</a>
                  <div style={{ marginTop: 32 }}><button className="cta-btn cta-btn-outline" style={{ fontSize: 13, padding: "12px 24px" }} onClick={() => setFormStatus("idle")}>Отправить ещё заявку</button></div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <input type="text" placeholder="Имя" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required disabled={formStatus === "sending"} />
                  <input type="tel" placeholder="Телефон" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} required disabled={formStatus === "sending"} />
                  <textarea placeholder="Опишите задачу: помещение, тип потолка, площадь" rows={5} value={formData.message} onChange={e => setFormData({ ...formData, message: e.target.value })} style={{ resize: "vertical" }} disabled={formStatus === "sending"} />
                  <button type="submit" className={`cta-btn ${formStatus === "error" ? "cta-btn-error" : ""}`} style={{ width: "100%", justifyContent: "center" }} disabled={formStatus === "sending"}>
                    {formStatus === "sending" ? "Отправляю..." : formStatus === "error" ? "✕ Ошибка. Попробуйте ещё раз" : "Отправить заявку →"}
                  </button>
                  <p style={{ fontSize: 12, color: "#aaa", textAlign: "center" }}>Отвечу в течение 2 часов в рабочее время</p>
                  <p style={{ fontSize: 11, color: "#bbb", textAlign: "center", lineHeight: 1.5 }}>
                    Нажимая на кнопку, вы даёте согласие на обработку персональных данных в соответствии с{" "}
                    <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "#999", textDecoration: "underline" }}>Политикой конфиденциальности</a>
                  </p>
                </form>
              )}
            </div>
            <div className={`fade-up fade-up-d3 ${isVisible("contact") ? "visible" : ""}`} style={{ display: "flex", flexDirection: "column", gap: 28 }}>
              {[
                { label: "Телефон", value: CONTACTS.phone, icon: "📞", href: CONTACTS.phoneHref },
                { label: "Telegram", value: "Написать в Telegram", icon: "✈️", href: CONTACTS.telegram },
                { label: "Email", value: CONTACTS.email, icon: "📧", href: CONTACTS.emailHref },
                { label: "География", value: CONTACTS.geo, icon: "📍" },
                { label: "Время работы", value: CONTACTS.workHours, icon: "🕘" },
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                  <div style={{ width: 48, height: 48, display: "flex", alignItems: "center", justifyContent: "center", background: "#f2f2f2", fontSize: 20, flexShrink: 0 }}>{item.icon}</div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#999", marginBottom: 4, fontFamily: "'JetBrains Mono',monospace" }}>{item.label}</div>
                    {item.href ? (<a href={item.href} target="_blank" rel="noopener noreferrer" style={{ fontSize: 18, fontWeight: 600, color: "#1a1a1a", textDecoration: "none", borderBottom: "1px solid #ddd", paddingBottom: 2 }}>{item.value}</a>) : (<div style={{ fontSize: 18, fontWeight: 600 }}>{item.value}</div>)}
                  </div>
                </div>
              ))}
              <div style={{ padding: 24, background: "#f8f8f8", border: "1px solid #e8e8e8", marginTop: 4 }}>
                <p style={{ fontSize: 14, lineHeight: 1.7, color: "#666" }}>💡 <strong>Совет:</strong> Напишите площадь помещения и тип потолка — так я сразу сориентирую по цене и срокам.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ padding: "60px clamp(24px,5vw,80px)", background: "#1a1a1a", color: "#fff", borderTop: "1px solid #333" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto" }}>
          <div className="footer-grid" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 80, alignItems: "start" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <Image src="/logo.jpeg" alt="ПОТОЛКОВО" width={36} height={36} style={{ objectFit: "contain" }} />
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 18, fontWeight: 700, letterSpacing: 3 }}>ПОТОЛКОВО</span>
              </div>
              <p style={{ fontSize: 14, color: "#888", lineHeight: 1.7, maxWidth: 360, marginBottom: 24 }}>Натяжные потолки любой сложности. Москва и МО. Частный мастер Владимир. С 2010 года.</p>
              <a href={CONTACTS.phoneHref} style={{ fontSize: 20, fontWeight: 700, color: "#fff", textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>📞 {CONTACTS.phone}</a>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#666", marginBottom: 16, fontFamily: "'JetBrains Mono',monospace" }}>Навигация</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {NAV_ITEMS.map(([l, id]) => (
                  <button key={id} onClick={() => scrollTo(id)} style={{ background: "none", border: "none", color: "#888", fontSize: 14, cursor: "pointer", textAlign: "left", fontFamily: "inherit", padding: 0, transition: "color .3s" }} onMouseEnter={e => (e.currentTarget.style.color = "#fff")} onMouseLeave={e => (e.currentTarget.style.color = "#888")}>{l}</button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#666", marginBottom: 16, fontFamily: "'JetBrains Mono',monospace" }}>Услуги</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {SERVICES.map(s => (
                  <Link key={s.href} href={s.href} style={{ fontSize: 14, color: "#888", textDecoration: "none", transition: "color .3s" }} onMouseEnter={e => (e.currentTarget.style.color = "#fff")} onMouseLeave={e => (e.currentTarget.style.color = "#888")}>{s.title}</Link>
                ))}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 60, paddingTop: 24, borderTop: "1px solid #333", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
            <span style={{ fontSize: 13, color: "#666" }}>
              © {new Date().getFullYear()} ПОТОЛКОВО.{" "}
              <a href="/privacy" style={{ color: "#666", textDecoration: "underline" }}>Политика конфиденциальности</a>
            </span>
            <span style={{ fontSize: 12, color: "#444", fontFamily: "'JetBrains Mono',monospace" }}>Москва и Московская область</span>
          </div>
        </div>
      </footer>

      {/* MOBILE BOTTOM BAR */}
      <div className="mobile-bottom-bar">
        <a href={CONTACTS.phoneHref} style={{ background: "#1a1a1a", color: "#fff" }}>📞 Позвонить</a>
        <a href={CONTACTS.telegram} target="_blank" rel="noopener noreferrer" style={{ background: "#f2f2f2", color: "#1a1a1a" }}>✈️ Telegram</a>
        <button onClick={() => scrollTo("contact")} style={{ background: "#2d7a3a", color: "#fff" }}>📝 Заявка</button>
      </div>
    </div>
  );
}
