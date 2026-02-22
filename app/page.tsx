"use client";

import { useState, useEffect } from "react";

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [activeProject, setActiveProject] = useState(0);
  const [projectSlide, setProjectSlide] = useState(0);
  const [heroSlide, setHeroSlide] = useState(0);
  const [formData, setFormData] = useState({ name: "", phone: "", message: "" });
  const [formSent, setFormSent] = useState(false);
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setHeroSlide((prev) => (prev + 1) % heroImages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setProjectSlide(0);
  }, [activeProject]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisibleSections((prev) => new Set(prev).add(entry.target.id));
          }
        });
      },
      { threshold: 0.1 }
    );
    document.querySelectorAll("section[id]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const isVisible = (id: string) => visibleSections.has(id);

  const scrollTo = (id: string) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormSent(true);
    setTimeout(() => setFormSent(false), 4000);
    setFormData({ name: "", phone: "", message: "" });
  };

  const heroImages = [
    "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1400&q=80",
    "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=1400&q=80",
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1400&q=80",
  ];

  const projects = [
    {
      title: "Купол с подсветкой",
      desc: "Индивидуальный проект: объёмный купол из натяжного полотна с интегрированной RGB-подсветкой. Полностью кастомная конструкция.",
      tags: ["Индивидуальный проект", "RGB", "Сложная геометрия"],
      images: [
        "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=800&q=80",
        "https://images.unsplash.com/photo-1631679706909-1844bbd07221?w=800&q=80",
        "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=800&q=80",
      ],
    },
    {
      title: "Теневой профиль + трек",
      desc: "Квартира 120 м². Теневое примыкание по периметру, трековое освещение, чистые линии без плинтусов.",
      tags: ["Теневой профиль", "Трековый свет", "Минимализм"],
      images: [
        "https://images.unsplash.com/photo-1600607687644-c7171b42498f?w=800&q=80",
        "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=800&q=80",
        "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=800&q=80",
      ],
    },
    {
      title: "Парящий потолок",
      desc: "Парящая конструкция с LED-лентой по контуру. Эффект «отрыва» потолка от стен. Гостиная + коридор.",
      tags: ["Парящий", "LED", "Световой контур"],
      images: [
        "https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800&q=80",
        "https://images.unsplash.com/photo-1600573472591-ee6b68d14c68?w=800&q=80",
        "https://images.unsplash.com/photo-1616137466211-f736a1eb238a?w=800&q=80",
      ],
    },
    {
      title: "Световые линии",
      desc: "Офисное пространство. Геометричные световые линии вместо стандартных светильников. Расчёт освещённости по нормам.",
      tags: ["Световые линии", "Офис", "Расчёт света"],
      images: [
        "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80",
        "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800&q=80",
        "https://images.unsplash.com/photo-1604328698692-f76ea9498e76?w=800&q=80",
      ],
    },
    {
      title: "Скрытый карниз",
      desc: "Ниша под карниз в натяжном потолке. Шторы «из потолка» — чистый вид, никаких накладок.",
      tags: ["Скрытый карниз", "Ниша", "Чистый вид"],
      images: [
        "https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?w=800&q=80",
        "https://images.unsplash.com/photo-1616486029423-aaa4789e8c9a?w=800&q=80",
        "https://images.unsplash.com/photo-1600210491892-03d54c0aaf87?w=800&q=80",
      ],
    },
  ];

  const services = [
    {
      icon: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=400&q=80",
      emoji: "⬛",
      title: "Теневой профиль",
      desc: "Потолок без плинтуса. Чёткий теневой зазор 8 мм. Выглядит дорого, потому что это дорого сделать правильно.",
    },
    {
      icon: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&q=80",
      emoji: "💡",
      title: "Парящие потолки",
      desc: "LED-подсветка по периметру. Потолок визуально отрывается от стен. Работает и как основной свет.",
    },
    {
      icon: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&q=80",
      emoji: "📐",
      title: "Световые линии",
      desc: "Встроенные в полотно линейные светильники. Любая геометрия. Замена люстрам и точечникам.",
    },
    {
      icon: "https://images.unsplash.com/photo-1565814329452-e1efa11c5b89?w=400&q=80",
      emoji: "🔦",
      title: "Трековое освещение",
      desc: "Встраиваемые треки в натяжной потолок. Направленный свет. Полный расчёт освещённости.",
    },
    {
      icon: "https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?w=400&q=80",
      emoji: "🪟",
      title: "Скрытые карнизы",
      desc: "Ниша под шторы прямо в потолке. Карниз не виден. Шторы будто растут из потолка.",
    },
    {
      icon: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=400&q=80",
      emoji: "🏗️",
      title: "Индивидуальные проекты",
      desc: "Купола, многоуровневые конструкции, нестандартные формы. Если можно натянуть — сделаю.",
    },
    {
      icon: "https://images.unsplash.com/photo-1524484485831-a92ffc0de03f?w=400&q=80",
      emoji: "🛒",
      title: "Продажа трекового освещения",
      desc: "Подберу и продам трековые системы под ваш проект. Магнитные треки, споты, линейные светильники. Только проверенные бренды.",
    },
  ];

  const advantages = [
    { num: "15+", label: "лет опыта", sub: "с 2010 года", icon: "📅" },
    { num: "∞", label: "сложность", sub: "любые проекты", icon: "🔧" },
    { num: "1", label: "мастер", sub: "я лично", icon: "👤" },
    { num: "0", label: "посредников", sub: "прямая работа", icon: "🤝" },
  ];

  const processSteps = [
    {
      step: "01",
      title: "Заявка",
      desc: "Вы пишете или звоните. Обсуждаем задачу, бюджет, сроки. Без навязывания.",
      icon: "📱",
      image: "https://images.unsplash.com/photo-1423666639041-f56000c27a9a?w=400&q=80",
    },
    {
      step: "02",
      title: "Замер",
      desc: "Приезжаю, замеряю, считаю. Точная смета на месте. Без «потом уточним».",
      icon: "📏",
      image: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&q=80",
    },
    {
      step: "03",
      title: "Монтаж",
      desc: "Монтирую в оговорённый день. Чисто, аккуратно, по технологии. Обычно 1 день.",
      icon: "⚙️",
      image: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400&q=80",
    },
    {
      step: "04",
      title: "Готово",
      desc: "Принимаете работу. Всё чисто. Даю гарантию. Работа говорит за себя.",
      icon: "✅",
      image: "https://images.unsplash.com/photo-1600210491369-e753d80a41f3?w=400&q=80",
    },
  ];

  return (
    <div
      style={{
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: "#1a1a1a",
        background: "#fafafa",
        overflowX: "hidden",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body { overflow-x: hidden; }
        ::selection { background: #1a1a1a; color: #fff; }

        .fade-up {
          opacity: 0; transform: translateY(40px);
          transition: opacity 0.8s cubic-bezier(0.16,1,0.3,1), transform 0.8s cubic-bezier(0.16,1,0.3,1);
        }
        .fade-up.visible { opacity: 1; transform: translateY(0); }
        .fade-up-d1 { transition-delay: 0.1s; }
        .fade-up-d2 { transition-delay: 0.2s; }
        .fade-up-d3 { transition-delay: 0.3s; }
        .fade-up-d4 { transition-delay: 0.4s; }
        .fade-up-d5 { transition-delay: 0.5s; }
        .fade-up-d6 { transition-delay: 0.6s; }

        @keyframes float1 {
          0%,100%{transform:translate(0,0) rotate(0deg)}
          33%{transform:translate(30px,-30px) rotate(120deg)}
          66%{transform:translate(-20px,20px) rotate(240deg)}
        }
        @keyframes float2 {
          0%,100%{transform:translate(0,0) rotate(0deg)}
          33%{transform:translate(-40px,20px) rotate(-120deg)}
          66%{transform:translate(25px,-35px) rotate(-240deg)}
        }
        @keyframes float3 {
          0%,100%{transform:translate(0,0) scale(1)}
          50%{transform:translate(20px,-20px) scale(1.1)}
        }
        @keyframes heroFade {
          0%{opacity:0;transform:scale(1.05)}
          10%{opacity:1;transform:scale(1)}
          90%{opacity:1;transform:scale(1)}
          100%{opacity:0;transform:scale(1.05)}
        }

        .bg-shape {
          position:absolute;border-radius:50%;filter:blur(80px);opacity:0.07;pointer-events:none;
        }

        button, a { cursor: pointer; }

        .cta-btn {
          display:inline-flex;align-items:center;gap:8px;padding:16px 36px;
          background:#1a1a1a;color:#fff;border:none;font-size:15px;font-weight:600;
          letter-spacing:0.5px;text-transform:uppercase;cursor:pointer;
          transition:all 0.3s cubic-bezier(0.16,1,0.3,1);position:relative;overflow:hidden;
          font-family:inherit;
        }
        .cta-btn:hover {
          background:#333;transform:translateY(-2px);box-shadow:0 8px 30px rgba(0,0,0,0.2);
        }
        .cta-btn-outline {
          background:transparent;color:#1a1a1a;border:2px solid #1a1a1a;
        }
        .cta-btn-outline:hover { background:#1a1a1a;color:#fff; }
        .cta-btn-white {
          background:#fff;color:#1a1a1a;
        }
        .cta-btn-white:hover {
          background:#e8e8e8;
        }

        .nav-link {
          color:#666;text-decoration:none;font-size:14px;font-weight:500;
          letter-spacing:0.5px;text-transform:uppercase;transition:color 0.3s;
          cursor:pointer;background:none;border:none;font-family:inherit;
        }
        .nav-link:hover { color:#1a1a1a; }

        .service-card {
          background:#fff;border:1px solid #e8e8e8;
          transition:all 0.4s cubic-bezier(0.16,1,0.3,1);
          position:relative;overflow:hidden;
        }
        .service-card::before {
          content:'';position:absolute;top:0;left:0;width:100%;height:3px;
          background:#1a1a1a;transform:scaleX(0);transform-origin:left;
          transition:transform 0.4s cubic-bezier(0.16,1,0.3,1);
        }
        .service-card:hover {
          border-color:#1a1a1a;transform:translateY(-4px);
          box-shadow:0 12px 40px rgba(0,0,0,0.08);
        }
        .service-card:hover::before { transform:scaleX(1); }

        .project-tab {
          padding:12px 24px;background:transparent;border:1px solid #ddd;
          color:#888;font-size:13px;font-weight:600;letter-spacing:0.5px;
          text-transform:uppercase;cursor:pointer;transition:all 0.3s;
          font-family:inherit;white-space:nowrap;
        }
        .project-tab.active { background:#1a1a1a;color:#fff;border-color:#1a1a1a; }
        .project-tab:hover:not(.active) { border-color:#1a1a1a;color:#1a1a1a; }

        .slide-dot {
          width:10px;height:10px;border-radius:50%;border:2px solid #999;
          background:transparent;cursor:pointer;transition:all 0.3s;padding:0;
        }
        .slide-dot.active { background:#1a1a1a;border-color:#1a1a1a; }
        .slide-dot:hover { border-color:#1a1a1a; }

        .slide-arrow {
          width:40px;height:40px;border-radius:50%;border:1px solid rgba(255,255,255,0.5);
          background:rgba(0,0,0,0.4);color:#fff;display:flex;align-items:center;
          justify-content:center;cursor:pointer;transition:all 0.3s;font-size:18px;
          backdrop-filter:blur(10px);font-family:inherit;
        }
        .slide-arrow:hover { background:rgba(0,0,0,0.7);border-color:#fff; }

        .tag {
          display:inline-block;padding:6px 14px;background:#f0f0f0;font-size:12px;
          font-weight:600;letter-spacing:0.5px;text-transform:uppercase;color:#666;
        }

        .section-label {
          font-size:12px;font-weight:700;letter-spacing:3px;text-transform:uppercase;
          color:#999;margin-bottom:16px;font-family:'JetBrains Mono',monospace;
        }
        .section-title {
          font-size:clamp(32px,5vw,56px);font-weight:800;line-height:1.1;
          letter-spacing:-1.5px;color:#1a1a1a;margin-bottom:24px;
        }

        input, textarea {
          width:100%;padding:16px 20px;border:1px solid #ddd;background:#fff;
          font-size:15px;font-family:inherit;color:#1a1a1a;transition:border-color 0.3s;outline:none;
        }
        input:focus, textarea:focus { border-color:#1a1a1a; }
        input::placeholder, textarea::placeholder { color:#aaa; }

        .mobile-menu {
          position:fixed;top:0;left:0;width:100%;height:100vh;background:#fafafa;
          z-index:999;display:flex;flex-direction:column;align-items:center;
          justify-content:center;gap:32px;transform:translateY(-100%);
          transition:transform 0.5s cubic-bezier(0.16,1,0.3,1);
        }
        .mobile-menu.open { transform:translateY(0); }
        .mobile-menu button {
          font-size:24px;font-weight:700;text-transform:uppercase;letter-spacing:2px;
          background:none;border:none;color:#1a1a1a;cursor:pointer;font-family:inherit;
        }

        .hamburger {
          display:none;flex-direction:column;gap:5px;background:none;border:none;
          cursor:pointer;z-index:1001;padding:8px;
        }
        .hamburger span { width:28px;height:2px;background:#1a1a1a;transition:all 0.3s; }
        .hamburger.open span:nth-child(1) { transform:rotate(45deg) translate(5px,5px); }
        .hamburger.open span:nth-child(2) { opacity:0; }
        .hamburger.open span:nth-child(3) { transform:rotate(-45deg) translate(5px,-5px); }

        @media (max-width:768px) {
          .hamburger { display:flex; }
          .desktop-nav { display:none !important; }
          .hero-grid { grid-template-columns:1fr !important; }
          .services-grid { grid-template-columns:1fr !important; }
          .advantages-grid { grid-template-columns:repeat(2,1fr) !important; }
          .project-tabs { flex-wrap:wrap; }
          .footer-grid { grid-template-columns:1fr !important; text-align:center; }
          .contact-grid { grid-template-columns:1fr !important; }
          .process-grid { grid-template-columns:1fr !important; }
        }
        @media (max-width:480px) {
          .advantages-grid { grid-template-columns:1fr !important; }
        }
      `}</style>

      {/* NAV */}
      <nav
        style={{
          position: "fixed", top: 0, left: 0, width: "100%",
          padding: "0 clamp(24px,5vw,80px)", height: 72,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: scrollY > 50 ? "rgba(250,250,250,0.95)" : "transparent",
          backdropFilter: scrollY > 50 ? "blur(20px)" : "none",
          borderBottom: scrollY > 50 ? "1px solid #e8e8e8" : "1px solid transparent",
          zIndex: 1000, transition: "all 0.3s",
        }}
      >
        <div
          style={{
            fontFamily: "'JetBrains Mono',monospace", fontSize: 18, fontWeight: 700,
            letterSpacing: 3, textTransform: "uppercase", cursor: "pointer",
            color: scrollY > 50 ? "#1a1a1a" : "#fff",
            transition: "color 0.3s",
          }}
          onClick={() => scrollTo("hero")}
        >
          ПОТОЛКОВО
        </div>
        <div className="desktop-nav" style={{ display: "flex", gap: 32, alignItems: "center" }}>
          {[["Услуги", "services"], ["Проекты", "projects"], ["О нас", "about"], ["Контакт", "contact"]].map(([label, id]) => (
            <button
              key={id}
              className="nav-link"
              onClick={() => scrollTo(id)}
              style={{ color: scrollY > 50 ? "#666" : "rgba(255,255,255,0.8)" }}
            >
              {label}
            </button>
          ))}
          <button className="cta-btn" style={{ padding: "10px 24px", fontSize: 12 }} onClick={() => scrollTo("contact")}>
            Оставить заявку
          </button>
        </div>
        <button className={`hamburger ${menuOpen ? "open" : ""}`} onClick={() => setMenuOpen(!menuOpen)}>
          <span style={{ background: scrollY > 50 ? "#1a1a1a" : "#fff" }} />
          <span style={{ background: scrollY > 50 ? "#1a1a1a" : "#fff" }} />
          <span style={{ background: scrollY > 50 ? "#1a1a1a" : "#fff" }} />
        </button>
      </nav>

      <div className={`mobile-menu ${menuOpen ? "open" : ""}`}>
        {[["Услуги", "services"], ["Проекты", "projects"], ["О нас", "about"], ["Контакт", "contact"]].map(([label, id]) => (
          <button key={id} onClick={() => scrollTo(id)}>{label}</button>
        ))}
      </div>

      {/* HERO WITH PHOTO SLIDER */}
      <section
        id="hero"
        style={{
          minHeight: "100vh", display: "flex", alignItems: "center",
          position: "relative", overflow: "hidden",
        }}
      >
        {/* Background slider */}
        {heroImages.map((img, i) => (
          <div
            key={i}
            style={{
              position: "absolute", inset: 0,
              backgroundImage: `url(${img})`,
              backgroundSize: "cover", backgroundPosition: "center",
              opacity: heroSlide === i ? 1 : 0,
              transform: heroSlide === i ? "scale(1)" : "scale(1.05)",
              transition: "opacity 1s ease, transform 6s ease",
            }}
          />
        ))}
        {/* Dark overlay */}
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)" }} />

        <div style={{
          maxWidth: 1400, width: "100%", margin: "0 auto", position: "relative", zIndex: 1,
          padding: "120px clamp(24px,5vw,80px) 80px",
        }}>
          <div style={{
            fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 500,
            letterSpacing: 3, color: "rgba(255,255,255,0.6)", marginBottom: 24, textTransform: "uppercase",
          }}>
            Москва и МО / с 2010 года
          </div>
          <h1 style={{
            fontSize: "clamp(40px,6vw,80px)", fontWeight: 900, lineHeight: 1.05,
            letterSpacing: -3, marginBottom: 32, color: "#fff",
          }}>
            Натяжные<br />потолки<br />
            <span style={{ color: "rgba(255,255,255,0.5)" }}>без компромиссов</span>
          </h1>
          <p style={{
            fontSize: 18, lineHeight: 1.7, color: "rgba(255,255,255,0.7)",
            maxWidth: 520, marginBottom: 48,
          }}>
            Я — Владимир. Не компания с колл-центром. Частный мастер. Делаю лично.
            Любая сложность. Теневой профиль, световые линии, треки, купола.
          </p>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 48 }}>
            <button className="cta-btn cta-btn-white" onClick={() => scrollTo("contact")}>
              Обсудить проект →
            </button>
            <button className="cta-btn" style={{ background: "transparent", border: "2px solid rgba(255,255,255,0.5)" }} onClick={() => scrollTo("projects")}>
              Смотреть работы
            </button>
          </div>
          {/* Slide indicators */}
          <div style={{ display: "flex", gap: 8 }}>
            {heroImages.map((_, i) => (
              <button
                key={i}
                onClick={() => setHeroSlide(i)}
                style={{
                  width: heroSlide === i ? 32 : 10, height: 4, borderRadius: 2,
                  background: heroSlide === i ? "#fff" : "rgba(255,255,255,0.4)",
                  border: "none", cursor: "pointer", transition: "all 0.3s", padding: 0,
                }}
              />
            ))}
          </div>
        </div>

        {/* Slide arrows */}
        <div style={{ position: "absolute", bottom: 40, right: "clamp(24px,5vw,80px)", display: "flex", gap: 8, zIndex: 2 }}>
          <button className="slide-arrow" onClick={() => setHeroSlide((heroSlide - 1 + heroImages.length) % heroImages.length)}>←</button>
          <button className="slide-arrow" onClick={() => setHeroSlide((heroSlide + 1) % heroImages.length)}>→</button>
        </div>
      </section>

      {/* ADVANTAGES */}
      <section
        id="advantages"
        style={{
          padding: "80px clamp(24px,5vw,80px)", background: "#1a1a1a",
          color: "#fff", position: "relative", overflow: "hidden",
        }}
      >
        <div className="bg-shape" style={{
          width: 500, height: 500, background: "#fff", top: "-30%", right: "20%",
          opacity: 0.03, animation: "float2 20s ease-in-out infinite",
        }} />
        <div style={{ maxWidth: 1400, margin: "0 auto" }}>
          <div
            className={`advantages-grid fade-up ${isVisible("advantages") ? "visible" : ""}`}
            style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 24 }}
          >
            {advantages.map((a, i) => (
              <div
                key={i}
                className={`fade-up ${isVisible("advantages") ? "visible" : ""} fade-up-d${i + 1}`}
                style={{
                  textAlign: "center", padding: "40px 24px",
                  border: "1px solid rgba(255,255,255,0.1)", transition: "border-color 0.3s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
              >
                <div style={{ fontSize: 32, marginBottom: 12 }}>{a.icon}</div>
                <div style={{
                  fontFamily: "'JetBrains Mono',monospace", fontSize: 48,
                  fontWeight: 700, marginBottom: 8,
                }}>{a.num}</div>
                <div style={{
                  fontSize: 14, fontWeight: 700, textTransform: "uppercase",
                  letterSpacing: 2, marginBottom: 4,
                }}>{a.label}</div>
                <div style={{ fontSize: 13, color: "#888" }}>{a.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section
        id="services"
        style={{
          padding: "120px clamp(24px,5vw,80px)", position: "relative", overflow: "hidden",
        }}
      >
        <div className="bg-shape" style={{
          width: 500, height: 500, background: "#1a1a1a",
          bottom: "0%", right: "-10%", animation: "float1 25s ease-in-out infinite",
        }} />
        <div style={{ maxWidth: 1400, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <div className={`fade-up ${isVisible("services") ? "visible" : ""}`}>
            <div className="section-label">Что делаю</div>
            <h2 className="section-title">
              Полный спектр.<br />
              <span style={{ color: "#999" }}>Без «мы так не делаем».</span>
            </h2>
          </div>
          <div
            className="services-grid"
            style={{
              display: "grid", gridTemplateColumns: "repeat(3,1fr)",
              gap: 24, marginTop: 64,
            }}
          >
            {services.map((s, i) => (
              <div
                key={i}
                className={`service-card fade-up ${isVisible("services") ? "visible" : ""} fade-up-d${Math.min(i + 1, 6)}`}
              >
                {/* Service image */}
                <div style={{
                  width: "100%", height: 180, overflow: "hidden",
                  backgroundImage: `url(${s.icon})`, backgroundSize: "cover",
                  backgroundPosition: "center",
                }} />
                <div style={{ padding: "28px 28px 32px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <span style={{ fontSize: 24 }}>{s.emoji}</span>
                    <h3 style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.3 }}>{s.title}</h3>
                  </div>
                  <p style={{ fontSize: 14, lineHeight: 1.7, color: "#666" }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROJECTS */}
      <section
        id="projects"
        style={{
          padding: "120px clamp(24px,5vw,80px)", background: "#f2f2f2",
          position: "relative", overflow: "hidden",
        }}
      >
        <div className="bg-shape" style={{
          width: 400, height: 400, background: "#1a1a1a",
          top: "10%", left: "-5%", animation: "float2 18s ease-in-out infinite",
        }} />
        <div style={{ maxWidth: 1400, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <div className={`fade-up ${isVisible("projects") ? "visible" : ""}`}>
            <div className="section-label">Проекты</div>
            <h2 className="section-title">
              Не рендеры.<br /><span style={{ color: "#999" }}>Реальные объекты.</span>
            </h2>
          </div>

          <div className="project-tabs" style={{
            display: "flex", gap: 8, marginTop: 48, overflowX: "auto", paddingBottom: 8,
          }}>
            {projects.map((p, i) => (
              <button key={i} className={`project-tab ${activeProject === i ? "active" : ""}`} onClick={() => setActiveProject(i)}>
                {p.title}
              </button>
            ))}
          </div>

          <div className="hero-grid" style={{
            marginTop: 48, display: "grid", gridTemplateColumns: "1.2fr 1fr",
            gap: 48, alignItems: "center",
          }}>
            {/* Project image slider */}
            <div style={{ position: "relative", borderRadius: 0, overflow: "hidden" }}>
              <div style={{
                aspectRatio: "4/3", position: "relative", background: "#e0e0e0", overflow: "hidden",
              }}>
                {projects[activeProject].images.map((img, i) => (
                  <div
                    key={`${activeProject}-${i}`}
                    style={{
                      position: "absolute", inset: 0,
                      backgroundImage: `url(${img})`, backgroundSize: "cover",
                      backgroundPosition: "center",
                      opacity: projectSlide === i ? 1 : 0,
                      transition: "opacity 0.6s ease",
                    }}
                  />
                ))}
                {/* Slide counter */}
                <div style={{
                  position: "absolute", bottom: 16, left: 16,
                  fontFamily: "'JetBrains Mono',monospace", fontSize: 12,
                  color: "#fff", background: "rgba(0,0,0,0.6)", padding: "6px 12px",
                  backdropFilter: "blur(10px)",
                }}>
                  {String(projectSlide + 1).padStart(2, "0")} / {String(projects[activeProject].images.length).padStart(2, "0")}
                </div>
                {/* Arrows */}
                <div style={{
                  position: "absolute", bottom: 16, right: 16, display: "flex", gap: 8,
                }}>
                  <button className="slide-arrow" style={{ width: 36, height: 36, fontSize: 14 }}
                    onClick={() => setProjectSlide((projectSlide - 1 + projects[activeProject].images.length) % projects[activeProject].images.length)}>←</button>
                  <button className="slide-arrow" style={{ width: 36, height: 36, fontSize: 14 }}
                    onClick={() => setProjectSlide((projectSlide + 1) % projects[activeProject].images.length)}>→</button>
                </div>
              </div>
              {/* Dots */}
              <div style={{ display: "flex", gap: 6, marginTop: 12, justifyContent: "center" }}>
                {projects[activeProject].images.map((_, i) => (
                  <button key={i} className={`slide-dot ${projectSlide === i ? "active" : ""}`} onClick={() => setProjectSlide(i)} />
                ))}
              </div>
            </div>

            <div>
              <div style={{
                fontFamily: "'JetBrains Mono',monospace", fontSize: 64,
                fontWeight: 700, color: "#e0e0e0", lineHeight: 1, marginBottom: 16,
              }}>
                {String(activeProject + 1).padStart(2, "0")}
              </div>
              <h3 style={{ fontSize: 28, fontWeight: 800, letterSpacing: -1, marginBottom: 16 }}>
                {projects[activeProject].title}
              </h3>
              <p style={{ fontSize: 15, lineHeight: 1.8, color: "#666", marginBottom: 24 }}>
                {projects[activeProject].desc}
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 32 }}>
                {projects[activeProject].tags.map((tag, i) => (
                  <span key={i} className="tag">{tag}</span>
                ))}
              </div>
              <button className="cta-btn" style={{ fontSize: 13, padding: "14px 28px" }} onClick={() => scrollTo("contact")}>
                Хочу такой же →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section
        id="about"
        style={{
          padding: "120px clamp(24px,5vw,80px)", position: "relative", overflow: "hidden",
        }}
      >
        <div className="bg-shape" style={{
          width: 500, height: 500, background: "#666",
          top: "20%", right: "0%", animation: "float3 22s ease-in-out infinite",
        }} />
        <div style={{ maxWidth: 1400, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <div className="hero-grid" style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center",
          }}>
            <div className={`fade-up ${isVisible("about") ? "visible" : ""}`}>
              <div className="section-label">Обо мне</div>
              <h2 className="section-title">
                Владимир.<br />
                <span style={{ color: "#999" }}>Один мастер. Один стандарт.</span>
              </h2>

              {/* Photo placeholder */}
              <div style={{
                width: "100%", aspectRatio: "3/2", marginBottom: 32,
                backgroundImage: "url(https://images.unsplash.com/photo-1540569014015-19a7be504e3a?w=800&q=80)",
                backgroundSize: "cover", backgroundPosition: "center",
                border: "1px solid #e8e8e8", position: "relative",
              }}>
                <div style={{
                  position: "absolute", bottom: 16, left: 16,
                  background: "#1a1a1a", color: "#fff", padding: "8px 16px",
                  fontFamily: "'JetBrains Mono',monospace", fontSize: 11,
                  letterSpacing: 1, textTransform: "uppercase",
                }}>
                  Владимир / Основатель
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <p style={{ fontSize: 16, lineHeight: 1.8, color: "#555" }}>
                  Я не франшиза. Не бригада с текучкой. Я — частный мастер,
                  который с 2010 года занимается одним делом: натяжными потолками.
                  Более 15 лет опыта на объектах любой сложности.
                </p>
                <p style={{ fontSize: 16, lineHeight: 1.8, color: "#555" }}>
                  Сам замеряю. Сам проектирую. Сам монтирую. Каждый объект —
                  моя личная репутация. Поэтому халтуры не бывает.
                </p>
              </div>
            </div>

            <div className={`fade-up fade-up-d2 ${isVisible("about") ? "visible" : ""}`} style={{
              display: "flex", flexDirection: "column", gap: 24,
            }}>
              {[
                { q: "Почему частный мастер, а не компания?", a: "Потому что я отвечаю за каждый миллиметр лично. Нет менеджеров, которые обещают одно, а делает кто-то другой.", icon: "👤" },
                { q: "Какую гарантию даёте?", a: "Полную. На полотно — гарантия производителя. На монтаж — моя. Если что-то не так — приеду и исправлю.", icon: "🛡️" },
                { q: "Работаете за МКАД?", a: "Москва и МО полностью. Дальше — обсуждаемо.", icon: "📍" },
                { q: "Продаёте освещение?", a: "Да. Подберу трековые системы, магнитные треки, споты — под ваш проект, по адекватной цене.", icon: "💡" },
              ].map((item, i) => (
                <div key={i} style={{
                  padding: 28, background: "#fff", border: "1px solid #e8e8e8",
                  transition: "border-color 0.3s",
                }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#1a1a1a")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e8e8e8")}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 20 }}>{item.icon}</span>
                    <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: -0.3 }}>{item.q}</div>
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.7, color: "#666", paddingLeft: 30 }}>{item.a}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PROCESS */}
      <section
        id="process"
        style={{
          padding: "120px clamp(24px,5vw,80px)", background: "#1a1a1a",
          color: "#fff", position: "relative", overflow: "hidden",
        }}
      >
        <div className="bg-shape" style={{
          width: 600, height: 600, background: "#fff", bottom: "-20%", left: "30%",
          opacity: 0.02, animation: "float1 30s ease-in-out infinite",
        }} />
        <div style={{ maxWidth: 1400, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <div className={`fade-up ${isVisible("process") ? "visible" : ""}`}>
            <div className="section-label" style={{ color: "#666" }}>Как работаю</div>
            <h2 className="section-title" style={{ color: "#fff", marginBottom: 64 }}>
              Четыре шага.<br /><span style={{ color: "#666" }}>Без лишнего.</span>
            </h2>
          </div>
          <div className="process-grid" style={{
            display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 24,
          }}>
            {processSteps.map((item, i) => (
              <div
                key={i}
                className={`fade-up ${isVisible("process") ? "visible" : ""} fade-up-d${i + 1}`}
                style={{
                  border: "1px solid rgba(255,255,255,0.1)", transition: "border-color 0.3s",
                  overflow: "hidden",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
              >
                {/* Step image */}
                <div style={{
                  width: "100%", height: 160,
                  backgroundImage: `url(${item.image})`, backgroundSize: "cover",
                  backgroundPosition: "center", position: "relative",
                }}>
                  <div style={{
                    position: "absolute", inset: 0,
                    background: "linear-gradient(to bottom, rgba(26,26,26,0.3), rgba(26,26,26,0.8))",
                  }} />
                  <div style={{
                    position: "absolute", top: 16, left: 16,
                    fontFamily: "'JetBrains Mono',monospace", fontSize: 36,
                    fontWeight: 700, color: "rgba(255,255,255,0.3)",
                  }}>
                    {item.step}
                  </div>
                  <div style={{
                    position: "absolute", bottom: 16, right: 16, fontSize: 28,
                  }}>
                    {item.icon}
                  </div>
                </div>
                <div style={{ padding: "24px" }}>
                  <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>{item.title}</h3>
                  <p style={{ fontSize: 14, lineHeight: 1.7, color: "#888" }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA BANNER */}
      <section style={{
        padding: "80px clamp(24px,5vw,80px)",
        backgroundImage: "url(https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=1400&q=80)",
        backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "fixed",
        position: "relative",
      }}>
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)" }} />
        <div style={{
          maxWidth: 800, margin: "0 auto", textAlign: "center", position: "relative", zIndex: 1,
        }}>
          <h2 style={{
            fontSize: "clamp(28px,4vw,48px)", fontWeight: 800, color: "#fff",
            lineHeight: 1.2, marginBottom: 16, letterSpacing: -1,
          }}>
            Готовы к потолку, который удивляет?
          </h2>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.7)", marginBottom: 32 }}>
            Звоните или оставьте заявку — отвечу лично в течение 2 часов
          </p>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
            <a
              href="tel:+79055219909"
              className="cta-btn cta-btn-white"
              style={{ textDecoration: "none" }}
            >
              📞 +7 905 521 99 09
            </a>
            <button className="cta-btn" style={{
              background: "transparent", border: "2px solid rgba(255,255,255,0.5)",
            }} onClick={() => scrollTo("contact")}>
              Оставить заявку →
            </button>
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section
        id="contact"
        style={{
          padding: "120px clamp(24px,5vw,80px)", position: "relative", overflow: "hidden",
        }}
      >
        <div className="bg-shape" style={{
          width: 400, height: 400, background: "#1a1a1a",
          top: "10%", left: "60%", animation: "float2 20s ease-in-out infinite",
        }} />
        <div style={{ maxWidth: 1400, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <div className={`fade-up ${isVisible("contact") ? "visible" : ""}`}>
            <div className="section-label">Контакт</div>
            <h2 className="section-title">
              Готовы начать?<br /><span style={{ color: "#999" }}>Напишите. Отвечу лично.</span>
            </h2>
          </div>
          <div className="contact-grid" style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, marginTop: 64,
          }}>
            <form
              onSubmit={handleSubmit}
              className={`fade-up fade-up-d1 ${isVisible("contact") ? "visible" : ""}`}
              style={{ display: "flex", flexDirection: "column", gap: 16 }}
            >
              <input type="text" placeholder="Имя" value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
              <input type="tel" placeholder="Телефон" value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })} required />
              <textarea placeholder="Опишите задачу: помещение, тип потолка, площадь" rows={5}
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                style={{ resize: "vertical" }} />
              <button type="submit" className="cta-btn" style={{ width: "100%", justifyContent: "center" }}>
                {formSent ? "✓ Заявка отправлена" : "Отправить заявку →"}
              </button>
              <p style={{ fontSize: 12, color: "#aaa", textAlign: "center" }}>
                Отвечу в течение 2 часов в рабочее время
              </p>
            </form>

            <div className={`fade-up fade-up-d3 ${isVisible("contact") ? "visible" : ""}`} style={{
              display: "flex", flexDirection: "column", gap: 32,
            }}>
              {[
                { label: "Телефон", value: "+7 905 521 99 09", icon: "📞", href: "tel:+79055219909" },
                { label: "WhatsApp", value: "Написать в WhatsApp", icon: "💬", href: "https://wa.me/79055219909" },
                { label: "Telegram", value: "@potolkovo", icon: "✈️", href: "https://t.me/potolkovo" },
                { label: "География", value: "Москва и Московская область", icon: "📍" },
                { label: "Время работы", value: "Пн — Вс / 9:00 — 21:00", icon: "🕘" },
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                  <div style={{
                    width: 48, height: 48, display: "flex", alignItems: "center",
                    justifyContent: "center", background: "#f2f2f2", fontSize: 20, flexShrink: 0,
                  }}>
                    {item.icon}
                  </div>
                  <div>
                    <div style={{
                      fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase",
                      color: "#999", marginBottom: 4, fontFamily: "'JetBrains Mono',monospace",
                    }}>{item.label}</div>
                    {item.href ? (
                      <a href={item.href} target="_blank" rel="noopener noreferrer" style={{
                        fontSize: 18, fontWeight: 600, color: "#1a1a1a", textDecoration: "none",
                        borderBottom: "1px solid #ddd", paddingBottom: 2,
                      }}>
                        {item.value}
                      </a>
                    ) : (
                      <div style={{ fontSize: 18, fontWeight: 600 }}>{item.value}</div>
                    )}
                  </div>
                </div>
              ))}

              <div style={{
                padding: 24, background: "#f8f8f8", border: "1px solid #e8e8e8", marginTop: 8,
              }}>
                <p style={{ fontSize: 14, lineHeight: 1.7, color: "#666" }}>
                  💡 <strong>Совет:</strong> Напишите площадь помещения и тип потолка — так я сразу сориентирую по цене и срокам.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{
        padding: "60px clamp(24px,5vw,80px)", background: "#1a1a1a",
        color: "#fff", borderTop: "1px solid #333",
      }}>
        <div style={{ maxWidth: 1400, margin: "0 auto" }}>
          <div className="footer-grid" style={{
            display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 80, alignItems: "start",
          }}>
            <div>
              <div style={{
                fontFamily: "'JetBrains Mono',monospace", fontSize: 18,
                fontWeight: 700, letterSpacing: 3, marginBottom: 16,
              }}>ПОТОЛКОВО</div>
              <p style={{ fontSize: 14, color: "#888", lineHeight: 1.7, maxWidth: 360, marginBottom: 24 }}>
                Натяжные потолки любой сложности. Москва и МО. Частный мастер Владимир. С 2010 года.
              </p>
              <a href="tel:+79055219909" style={{
                fontSize: 20, fontWeight: 700, color: "#fff", textDecoration: "none",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                📞 +7 905 521 99 09
              </a>
            </div>
            <div>
              <div style={{
                fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase",
                color: "#666", marginBottom: 16, fontFamily: "'JetBrains Mono',monospace",
              }}>Навигация</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[["Услуги", "services"], ["Проекты", "projects"], ["О нас", "about"], ["Контакт", "contact"]].map(([label, id]) => (
                  <button key={id} onClick={() => scrollTo(id)} style={{
                    background: "none", border: "none", color: "#888", fontSize: 14,
                    cursor: "pointer", textAlign: "left", fontFamily: "inherit", padding: 0,
                    transition: "color 0.3s",
                  }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "#888")}
                  >{label}</button>
                ))}
              </div>
            </div>
            <div>
              <div style={{
                fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase",
                color: "#666", marginBottom: 16, fontFamily: "'JetBrains Mono',monospace",
              }}>Услуги</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {["Теневой профиль", "Парящие потолки", "Световые линии", "Трековое освещение", "Скрытые карнизы", "Продажа трек-света"].map((s) => (
                  <span key={s} style={{ fontSize: 14, color: "#888" }}>{s}</span>
                ))}
              </div>
            </div>
          </div>
          <div style={{
            marginTop: 60, paddingTop: 24, borderTop: "1px solid #333",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            flexWrap: "wrap", gap: 16,
          }}>
            <span style={{ fontSize: 13, color: "#666" }}>
              © {new Date().getFullYear()} ПОТОЛКОВО. Все права защищены.
            </span>
            <span style={{
              fontSize: 12, color: "#444", fontFamily: "'JetBrains Mono',monospace",
            }}>
              Москва и Московская область
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
