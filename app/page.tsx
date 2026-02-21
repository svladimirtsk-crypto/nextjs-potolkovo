"use client";

import { useState, useEffect, useRef } from "react";

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [activeProject, setActiveProject] = useState(0);
  const [formData, setFormData] = useState({ name: "", phone: "", message: "" });
  const [formSent, setFormSent] = useState(false);
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisibleSections((prev) => new Set(prev).add(entry.target.id));
          }
        });
      },
      { threshold: 0.15 }
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

  const projects = [
    {
      title: "Купол с подсветкой",
      desc: "Индивидуальный проект: объёмный купол из натяжного полотна с интегрированной RGB-подсветкой. Полностью кастомная конструкция.",
      tags: ["Индивидуальный проект", "RGB", "Сложная геометрия"],
    },
    {
      title: "Теневой профиль + трек",
      desc: "Квартира 120 м². Теневой примыкание по периметру, трековое освещение, чистые линии без плинтусов.",
      tags: ["Теневой профиль", "Трековый свет", "Минимализм"],
    },
    {
      title: "Парящий потолок",
      desc: "Парящая конструкция с LED-лентой по контуру. Эффект «отрыва» потолка от стен. Гостиная + коридор.",
      tags: ["Парящий", "LED", "Световой контур"],
    },
    {
      title: "Световые линии",
      desc: "Офисное пространство. Геометричные световые линии вместо стандартных светильников. Расчёт освещённости по нормам.",
      tags: ["Световые линии", "Офис", "Расчёт света"],
    },
    {
      title: "Скрытый карниз",
      desc: "Ниша под карниз в натяжном потолке. Шторы «из потолка» — чистый вид, никаких накладок.",
      tags: ["Скрытый карниз", "Ниша", "Чистый вид"],
    },
  ];

  const services = [
    {
      icon: "◇",
      title: "Теневой профиль",
      desc: "Потолок без плинтуса. Чёткий теневой зазор 8 мм. Выглядит дорого, потому что это дорого сделать правильно.",
    },
    {
      icon: "△",
      title: "Парящие потолки",
      desc: "LED-подсветка по периметру. Потолок визуально отрывается от стен. Работает и как основной свет.",
    },
    {
      icon: "□",
      title: "Световые линии",
      desc: "Встроенные в полотно линейные светильники. Любая геометрия. Замена люстрам и точечникам.",
    },
    {
      icon: "○",
      title: "Трековое освещение",
      desc: "Встраиваемые треки в натяжной потолок. Направленный свет. Полный расчёт освещённости.",
    },
    {
      icon: "▽",
      title: "Скрытые карнизы",
      desc: "Ниша под шторы прямо в потолке. Карниз не виден. Шторы будто растут из потолка.",
    },
    {
      icon: "⬡",
      title: "Индивидуальные проекты",
      desc: "Купола, многоуровневые конструкции, нестандартные формы. Если это можно натянуть — я это сделаю.",
    },
  ];

  const advantages = [
    { num: "15+", label: "лет опыта", sub: "с 2010 года" },
    { num: "∞", label: "сложность", sub: "любые проекты" },
    { num: "1", label: "мастер", sub: "я лично" },
    { num: "0", label: "посредников", sub: "прямая работа" },
  ];

  return (
    <div
      style={{
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
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

        ::selection {
          background: #1a1a1a;
          color: #fff;
        }

        .fade-up {
          opacity: 0;
          transform: translateY(40px);
          transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .fade-up.visible {
          opacity: 1;
          transform: translateY(0);
        }
        .fade-up-d1 { transition-delay: 0.1s; }
        .fade-up-d2 { transition-delay: 0.2s; }
        .fade-up-d3 { transition-delay: 0.3s; }
        .fade-up-d4 { transition-delay: 0.4s; }
        .fade-up-d5 { transition-delay: 0.5s; }

        @keyframes float1 {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          33% { transform: translate(30px, -30px) rotate(120deg); }
          66% { transform: translate(-20px, 20px) rotate(240deg); }
        }
        @keyframes float2 {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          33% { transform: translate(-40px, 20px) rotate(-120deg); }
          66% { transform: translate(25px, -35px) rotate(-240deg); }
        }
        @keyframes float3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(20px, -20px) scale(1.1); }
        }
        @keyframes pulse-line {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.8; }
        }
        @keyframes dash {
          to { stroke-dashoffset: 0; }
        }
        @keyframes grain {
          0%, 100% { transform: translate(0, 0); }
          10% { transform: translate(-5%, -10%); }
          20% { transform: translate(-15%, 5%); }
          30% { transform: translate(7%, -25%); }
          40% { transform: translate(-5%, 25%); }
          50% { transform: translate(-15%, 10%); }
          60% { transform: translate(15%, 0%); }
          70% { transform: translate(0%, 15%); }
          80% { transform: translate(3%, 35%); }
          90% { transform: translate(-10%, 10%); }
        }

        .bg-shape {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.07;
          pointer-events: none;
        }

        .hero-line {
          position: absolute;
          background: #1a1a1a;
          opacity: 0.06;
        }

        button, a { cursor: pointer; }

        .cta-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 16px 36px;
          background: #1a1a1a;
          color: #fff;
          border: none;
          font-size: 15px;
          font-weight: 600;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          position: relative;
          overflow: hidden;
        }
        .cta-btn:hover {
          background: #333;
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(0,0,0,0.2);
        }
        .cta-btn-outline {
          background: transparent;
          color: #1a1a1a;
          border: 2px solid #1a1a1a;
        }
        .cta-btn-outline:hover {
          background: #1a1a1a;
          color: #fff;
        }

        .nav-link {
          color: #666;
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          transition: color 0.3s;
          cursor: pointer;
          background: none;
          border: none;
          font-family: inherit;
        }
        .nav-link:hover { color: #1a1a1a; }

        .service-card {
          padding: 40px 32px;
          background: #fff;
          border: 1px solid #e8e8e8;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          position: relative;
          overflow: hidden;
        }
        .service-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 3px;
          background: #1a1a1a;
          transform: scaleX(0);
          transform-origin: left;
          transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .service-card:hover {
          border-color: #1a1a1a;
          transform: translateY(-4px);
          box-shadow: 0 12px 40px rgba(0,0,0,0.08);
        }
        .service-card:hover::before {
          transform: scaleX(1);
        }

        .project-tab {
          padding: 12px 24px;
          background: transparent;
          border: 1px solid #ddd;
          color: #888;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.3s;
          font-family: inherit;
          white-space: nowrap;
        }
        .project-tab.active {
          background: #1a1a1a;
          color: #fff;
          border-color: #1a1a1a;
        }
        .project-tab:hover:not(.active) {
          border-color: #1a1a1a;
          color: #1a1a1a;
        }

        .advantage-card {
          text-align: center;
          padding: 40px 24px;
          background: #fff;
          border: 1px solid #e8e8e8;
          transition: all 0.3s;
        }
        .advantage-card:hover {
          border-color: #1a1a1a;
        }

        input, textarea {
          width: 100%;
          padding: 16px 20px;
          border: 1px solid #ddd;
          background: #fff;
          font-size: 15px;
          font-family: inherit;
          color: #1a1a1a;
          transition: border-color 0.3s;
          outline: none;
        }
        input:focus, textarea:focus {
          border-color: #1a1a1a;
        }
        input::placeholder, textarea::placeholder {
          color: #aaa;
        }

        .mobile-menu {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100vh;
          background: #fafafa;
          z-index: 999;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 32px;
          transform: translateY(-100%);
          transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .mobile-menu.open {
          transform: translateY(0);
        }
        .mobile-menu button {
          font-size: 24px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 2px;
          background: none;
          border: none;
          color: #1a1a1a;
          cursor: pointer;
          font-family: inherit;
        }

        .hamburger {
          display: none;
          flex-direction: column;
          gap: 5px;
          background: none;
          border: none;
          cursor: pointer;
          z-index: 1001;
          padding: 8px;
        }
        .hamburger span {
          width: 28px;
          height: 2px;
          background: #1a1a1a;
          transition: all 0.3s;
        }
        .hamburger.open span:nth-child(1) {
          transform: rotate(45deg) translate(5px, 5px);
        }
        .hamburger.open span:nth-child(2) {
          opacity: 0;
        }
        .hamburger.open span:nth-child(3) {
          transform: rotate(-45deg) translate(5px, -5px);
        }

        .tag {
          display: inline-block;
          padding: 6px 14px;
          background: #f0f0f0;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          color: #666;
        }

        .section-label {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 3px;
          text-transform: uppercase;
          color: #999;
          margin-bottom: 16px;
          font-family: 'JetBrains Mono', monospace;
        }

        .section-title {
          font-size: clamp(32px, 5vw, 56px);
          font-weight: 800;
          line-height: 1.1;
          letter-spacing: -1.5px;
          color: #1a1a1a;
          margin-bottom: 24px;
        }

        .grain-overlay {
          position: fixed;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");
          pointer-events: none;
          z-index: 9998;
          animation: grain 8s steps(10) infinite;
          opacity: 0.5;
        }

        @media (max-width: 768px) {
          .hamburger { display: flex; }
          .desktop-nav { display: none !important; }
          .hero-grid { grid-template-columns: 1fr !important; }
          .services-grid { grid-template-columns: 1fr !important; }
          .advantages-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .project-tabs { flex-wrap: wrap; }
          .footer-grid { grid-template-columns: 1fr !important; text-align: center; }
          .contact-grid { grid-template-columns: 1fr !important; }
        }

        @media (max-width: 480px) {
          .advantages-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div className="grain-overlay" />

      {/* NAV */}
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          padding: "0 clamp(24px, 5vw, 80px)",
          height: 72,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: scrollY > 50 ? "rgba(250,250,250,0.9)" : "transparent",
          backdropFilter: scrollY > 50 ? "blur(20px)" : "none",
          borderBottom: scrollY > 50 ? "1px solid #e8e8e8" : "1px solid transparent",
          zIndex: 1000,
          transition: "all 0.3s",
        }}
      >
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: 3,
            textTransform: "uppercase",
            cursor: "pointer",
          }}
          onClick={() => scrollTo("hero")}
        >
          ПОТОЛКОВО
        </div>
        <div className="desktop-nav" style={{ display: "flex", gap: 32, alignItems: "center" }}>
          {[
            ["Услуги", "services"],
            ["Проекты", "projects"],
            ["О нас", "about"],
            ["Контакт", "contact"],
          ].map(([label, id]) => (
            <button key={id} className="nav-link" onClick={() => scrollTo(id)}>
              {label}
            </button>
          ))}
          <button
            className="cta-btn"
            style={{ padding: "10px 24px", fontSize: 12 }}
            onClick={() => scrollTo("contact")}
          >
            Оставить заявку
          </button>
        </div>
        <button
          className={`hamburger ${menuOpen ? "open" : ""}`}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <span />
          <span />
          <span />
        </button>
      </nav>

      <div className={`mobile-menu ${menuOpen ? "open" : ""}`}>
        {[
          ["Услуги", "services"],
          ["Проекты", "projects"],
          ["О нас", "about"],
          ["Контакт", "contact"],
        ].map(([label, id]) => (
          <button key={id} onClick={() => scrollTo(id)}>
            {label}
          </button>
        ))}
      </div>

      {/* HERO */}
      <section
        id="hero"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          position: "relative",
          padding: "120px clamp(24px, 5vw, 80px) 80px",
          overflow: "hidden",
        }}
      >
        {/* Dynamic background shapes */}
        <div
          className="bg-shape"
          style={{
            width: 600,
            height: 600,
            background: "#1a1a1a",
            top: "-10%",
            right: "-5%",
            animation: "float1 20s ease-in-out infinite",
          }}
        />
        <div
          className="bg-shape"
          style={{
            width: 400,
            height: 400,
            background: "#666",
            bottom: "10%",
            left: "10%",
            animation: "float2 25s ease-in-out infinite",
          }}
        />
        <div
          className="bg-shape"
          style={{
            width: 300,
            height: 300,
            background: "#999",
            top: "40%",
            right: "30%",
            animation: "float3 15s ease-in-out infinite",
          }}
        />

        {/* Grid lines */}
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="hero-line"
            style={{
              width: 1,
              height: "100%",
              left: `${(i + 1) * 16.66}%`,
              top: 0,
              animation: `pulse-line ${3 + i * 0.5}s ease-in-out infinite`,
              animationDelay: `${i * 0.3}s`,
            }}
          />
        ))}

        <div style={{ maxWidth: 1400, width: "100%", margin: "0 auto", position: "relative", zIndex: 1 }}>
          <div
            className="hero-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 80,
              alignItems: "center",
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 12,
                  fontWeight: 500,
                  letterSpacing: 3,
                  color: "#999",
                  marginBottom: 24,
                  textTransform: "uppercase",
                }}
              >
                Москва и МО / с 2010 года
              </div>
              <h1
                style={{
                  fontSize: "clamp(40px, 6vw, 80px)",
                  fontWeight: 900,
                  lineHeight: 1.05,
                  letterSpacing: -3,
                  marginBottom: 32,
                }}
              >
                Натяжные
                <br />
                потолки
                <br />
                <span style={{ color: "#999" }}>без компромиссов</span>
              </h1>
              <p
                style={{
                  fontSize: 18,
                  lineHeight: 1.7,
                  color: "#666",
                  maxWidth: 480,
                  marginBottom: 48,
                }}
              >
                Я — Владимир. Не компания с колл-центром.
                Частный мастер. Делаю лично. Любая сложность.
                Теневой профиль, световые линии, треки, купола.
              </p>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <button className="cta-btn" onClick={() => scrollTo("contact")}>
                  Обсудить проект →
                </button>
                <button
                  className="cta-btn cta-btn-outline"
                  onClick={() => scrollTo("projects")}
                >
                  Смотреть работы
                </button>
              </div>
            </div>

            <div style={{ position: "relative", display: "flex", justifyContent: "center" }}>
              {/* Abstract ceiling illustration */}
              <svg
                viewBox="0 0 500 500"
                style={{
                  width: "100%",
                  maxWidth: 500,
                  opacity: 0.9,
                }}
              >
                {/* Outer frame */}
                <rect
                  x="50" y="50" width="400" height="400"
                  fill="none" stroke="#1a1a1a" strokeWidth="1" opacity="0.2"
                  strokeDasharray="1200"
                  strokeDashoffset="1200"
                  style={{ animation: "dash 2s ease forwards 0.5s" }}
                />

                {/* Inner geometric shapes */}
                <rect
                  x="100" y="100" width="300" height="300"
                  fill="#f0f0f0" stroke="#1a1a1a" strokeWidth="0.5" opacity="0.5"
                />
                <line x1="100" y1="100" x2="250" y2="250" stroke="#1a1a1a" strokeWidth="0.5" opacity="0.3" />
                <line x1="400" y1="100" x2="250" y2="250" stroke="#1a1a1a" strokeWidth="0.5" opacity="0.3" />
                <line x1="100" y1="400" x2="250" y2="250" stroke="#1a1a1a" strokeWidth="0.5" opacity="0.3" />
                <line x1="400" y1="400" x2="250" y2="250" stroke="#1a1a1a" strokeWidth="0.5" opacity="0.3" />

                {/* Shadow gap simulation */}
                <rect
                  x="95" y="95" width="310" height="310"
                  fill="none" stroke="#1a1a1a" strokeWidth="3" opacity="0.15"
                />

                {/* Light lines */}
                <line
                  x1="150" y1="180" x2="350" y2="180"
                  stroke="#1a1a1a" strokeWidth="2" opacity="0.4"
                  strokeDasharray="200"
                  strokeDashoffset="200"
                  style={{ animation: "dash 1.5s ease forwards 1s" }}
                />
                <line
                  x1="150" y1="250" x2="350" y2="250"
                  stroke="#1a1a1a" strokeWidth="2" opacity="0.25"
                  strokeDasharray="200"
                  strokeDashoffset="200"
                  style={{ animation: "dash 1.5s ease forwards 1.3s" }}
                />
                <line
                  x1="150" y1="320" x2="350" y2="320"
                  stroke="#1a1a1a" strokeWidth="2" opacity="0.15"
                  strokeDasharray="200"
                  strokeDashoffset="200"
                  style={{ animation: "dash 1.5s ease forwards 1.6s" }}
                />

                {/* Center point */}
                <circle cx="250" cy="250" r="4" fill="#1a1a1a" opacity="0.6" />
                <circle
                  cx="250" cy="250" r="20"
                  fill="none" stroke="#1a1a1a" strokeWidth="0.5" opacity="0.3"
                />

                {/* Floating accent shapes */}
                <rect
                  x="60" y="60" width="30" height="30"
                  fill="none" stroke="#1a1a1a" strokeWidth="1" opacity="0.2"
                  style={{ animation: "float3 8s ease-in-out infinite" }}
                />
                <circle
                  cx="430" cy="430" r="15"
                  fill="none" stroke="#1a1a1a" strokeWidth="1" opacity="0.2"
                  style={{ animation: "float1 10s ease-in-out infinite" }}
                />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* ADVANTAGES STRIP */}
      <section
        id="advantages"
        style={{
          padding: "80px clamp(24px, 5vw, 80px)",
          background: "#1a1a1a",
          color: "#fff",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          className="bg-shape"
          style={{
            width: 500,
            height: 500,
            background: "#fff",
            top: "-30%",
            right: "20%",
            opacity: 0.03,
            animation: "float2 20s ease-in-out infinite",
          }}
        />
        <div
          style={{ maxWidth: 1400, margin: "0 auto" }}
        >
          <div
            className={`advantages-grid fade-up ${isVisible("advantages") ? "visible" : ""}`}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 24,
            }}
          >
            {advantages.map((a, i) => (
              <div
                key={i}
                className={`fade-up fade-up-d${i + 1}`}
                style={{
                  textAlign: "center",
                  padding: "40px 24px",
                  border: "1px solid rgba(255,255,255,0.1)",
                  transition: "border-color 0.3s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")
                }
              >
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 48,
                    fontWeight: 700,
                    marginBottom: 8,
                  }}
                >
                  {a.num}
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 2,
                    marginBottom: 4,
                  }}
                >
                  {a.label}
                </div>
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
          padding: "120px clamp(24px, 5vw, 80px)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          className="bg-shape"
          style={{
            width: 500,
            height: 500,
            background: "#1a1a1a",
            bottom: "0%",
            right: "-10%",
            animation: "float1 25s ease-in-out infinite",
          }}
        />

        <div style={{ maxWidth: 1400, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <div className={`fade-up ${isVisible("services") ? "visible" : ""}`}>
            <div className="section-label">Что делаю</div>
            <h2 className="section-title">
              Полный спектр.
              <br />
              <span style={{ color: "#999" }}>Без «мы так не делаем».</span>
            </h2>
          </div>

          <div
            className="services-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 24,
              marginTop: 64,
            }}
          >
            {services.map((s, i) => (
              <div
                key={i}
                className={`service-card fade-up ${isVisible("services") ? "visible" : ""} fade-up-d${Math.min(i + 1, 5)}`}
              >
                <div
                  style={{
                    fontSize: 32,
                    marginBottom: 24,
                    opacity: 0.4,
                    fontWeight: 300,
                  }}
                >
                  {s.icon}
                </div>
                <h3
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    marginBottom: 12,
                    letterSpacing: -0.5,
                  }}
                >
                  {s.title}
                </h3>
                <p style={{ fontSize: 14, lineHeight: 1.7, color: "#666" }}>
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROJECTS */}
      <section
        id="projects"
        style={{
          padding: "120px clamp(24px, 5vw, 80px)",
          background: "#f2f2f2",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          className="bg-shape"
          style={{
            width: 400,
            height: 400,
            background: "#1a1a1a",
            top: "10%",
            left: "-5%",
            animation: "float2 18s ease-in-out infinite",
          }}
        />

        <div style={{ maxWidth: 1400, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <div className={`fade-up ${isVisible("projects") ? "visible" : ""}`}>
            <div className="section-label">Проекты</div>
            <h2 className="section-title">
              Не рендеры.
              <br />
              <span style={{ color: "#999" }}>Реальные объекты.</span>
            </h2>
          </div>

          <div
            className="project-tabs"
            style={{
              display: "flex",
              gap: 8,
              marginTop: 48,
              overflowX: "auto",
              paddingBottom: 8,
            }}
          >
            {projects.map((p, i) => (
              <button
                key={i}
                className={`project-tab ${activeProject === i ? "active" : ""}`}
                onClick={() => setActiveProject(i)}
              >
                {p.title}
              </button>
            ))}
          </div>

          <div
            style={{
              marginTop: 48,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 48,
              alignItems: "center",
            }}
            className="hero-grid"
          >
            {/* Project visual placeholder */}
            <div
              style={{
                aspectRatio: "4/3",
                background: "#e0e0e0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                overflow: "hidden",
                border: "1px solid #d0d0d0",
              }}
            >
              <svg viewBox="0 0 400 300" style={{ width: "80%", opacity: 0.6 }}>
                {/* Abstract project representation */}
                <rect
                  x="40" y="30" width="320" height="240"
                  fill="none" stroke="#1a1a1a" strokeWidth="1" opacity="0.3"
                />
                {activeProject === 0 && (
                  <>
                    {/* Dome shape */}
                    <path
                      d="M100,250 Q200,20 300,250"
                      fill="none" stroke="#1a1a1a" strokeWidth="2" opacity="0.5"
                    />
                    <path
                      d="M120,250 Q200,40 280,250"
                      fill="none" stroke="#1a1a1a" strokeWidth="1" opacity="0.3"
                    />
                    <path
                      d="M140,250 Q200,60 260,250"
                      fill="none" stroke="#1a1a1a" strokeWidth="0.5" opacity="0.2"
                    />
                  </>
                )}
                {activeProject === 1 && (
                  <>
                    {/* Shadow gap */}
                    <rect x="60" y="50" width="280" height="200" fill="#d8d8d8" />
                    <rect x="65" y="55" width="270" height="190" fill="#e0e0e0" />
                    <line x1="120" y1="100" x2="280" y2="100" stroke="#1a1a1a" strokeWidth="2" opacity="0.4" />
                    <line x1="120" y1="150" x2="280" y2="150" stroke="#1a1a1a" strokeWidth="1" opacity="0.2" />
                  </>
                )}
                {activeProject === 2 && (
                  <>
                    {/* Floating ceiling */}
                    <rect x="80" y="80" width="240" height="140" fill="#d8d8d8" />
                    <rect x="75" y="75" width="250" height="3" fill="#1a1a1a" opacity="0.4" />
                    <rect x="75" y="223" width="250" height="3" fill="#1a1a1a" opacity="0.4" />
                    <rect x="75" y="75" width="3" height="151" fill="#1a1a1a" opacity="0.4" />
                    <rect x="322" y="75" width="3" height="151" fill="#1a1a1a" opacity="0.4" />
                  </>
                )}
                {activeProject === 3 && (
                  <>
                    {/* Light lines */}
                    <rect x="60" y="50" width="280" height="200" fill="#d8d8d8" />
                    <line x1="100" y1="100" x2="300" y2="100" stroke="#1a1a1a" strokeWidth="3" opacity="0.5" />
                    <line x1="100" y1="150" x2="250" y2="150" stroke="#1a1a1a" strokeWidth="3" opacity="0.35" />
                    <line x1="150" y1="200" x2="300" y2="200" stroke="#1a1a1a" strokeWidth="3" opacity="0.2" />
                  </>
                )}
                {activeProject === 4 && (
                  <>
                    {/* Hidden cornice */}
                    <rect x="60" y="50" width="280" height="200" fill="#d8d8d8" />
                    <rect x="280" y="50" width="60" height="30" fill="#ccc" stroke="#1a1a1a" strokeWidth="0.5" opacity="0.5" />
                    <line x1="310" y1="80" x2="310" y2="250" stroke="#1a1a1a" strokeWidth="0.5" opacity="0.3" strokeDasharray="4,4" />
                  </>
                )}
                <text
                  x="200" y="285"
                  textAnchor="middle"
                  style={{
                    fontSize: 10,
                    fontFamily: "'JetBrains Mono', monospace",
                    fill: "#999",
                    letterSpacing: 2,
                  }}
                >
                  {String(activeProject + 1).padStart(2, "0")} / {String(projects.length).padStart(2, "0")}
                </text>
              </svg>
            </div>

            <div>
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 64,
                  fontWeight: 700,
                  color: "#e8e8e8",
                  lineHeight: 1,
                  marginBottom: 16,
                }}
              >
                {String(activeProject + 1).padStart(2, "0")}
              </div>
              <h3
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  letterSpacing: -1,
                  marginBottom: 16,
                }}
              >
                {projects[activeProject].title}
              </h3>
              <p
                style={{
                  fontSize: 15,
                  lineHeight: 1.8,
                  color: "#666",
                  marginBottom: 24,
                }}
              >
                {projects[activeProject].desc}
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {projects[activeProject].tags.map((tag, i) => (
                  <span key={i} className="tag">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section
        id="about"
        style={{
          padding: "120px clamp(24px, 5vw, 80px)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          className="bg-shape"
          style={{
            width: 500,
            height: 500,
            background: "#666",
            top: "20%",
            right: "0%",
            animation: "float3 22s ease-in-out infinite",
          }}
        />

        <div style={{ maxWidth: 1400, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <div
            className="hero-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 80,
              alignItems: "center",
            }}
          >
            <div className={`fade-up ${isVisible("about") ? "visible" : ""}`}>
              <div className="section-label">Обо мне</div>
              <h2 className="section-title">
                Владимир.
                <br />
                <span style={{ color: "#999" }}>Один мастер. Один стандарт.</span>
              </h2>
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
                <p style={{ fontSize: 16, lineHeight: 1.8, color: "#555" }}>
                  Работаю с теневыми профилями, парящими конструкциями,
                  световыми линиями, трековыми системами, скрытыми карнизами.
                  Делал купол из натяжного потолка с подсветкой — да, это возможно.
                </p>
              </div>
            </div>

            <div
              className={`fade-up fade-up-d2 ${isVisible("about") ? "visible" : ""}`}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 24,
              }}
            >
              {[
                {
                  q: "Почему частный мастер, а не компания?",
                  a: "Потому что я отвечаю за каждый миллиметр лично. Нет менеджеров, которые обещают одно, а делает кто-то другой.",
                },
                {
                  q: "Какую гарантию даёте?",
                  a: "Полную. На полотно — гарантия производителя. На монтаж — моя. Если что-то не так — приеду и исправлю.",
                },
                {
                  q: "Работаете за МКАД?",
                  a: "Москва и МО полностью. Дальше — обсуждаемо.",
                },
              ].map((item, i) => (
                <div
                  key={i}
                  style={{
                    padding: 32,
                    background: "#fff",
                    border: "1px solid #e8e8e8",
                  }}
                >
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      marginBottom: 8,
                      letterSpacing: -0.3,
                    }}
                  >
                    {item.q}
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.7, color: "#666" }}>
                    {item.a}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PROCESS */}
      <section
        style={{
          padding: "120px clamp(24px, 5vw, 80px)",
          background: "#1a1a1a",
          color: "#fff",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          className="bg-shape"
          style={{
            width: 600,
            height: 600,
            background: "#fff",
            bottom: "-20%",
            left: "30%",
            opacity: 0.02,
            animation: "float1 30s ease-in-out infinite",
          }}
        />

        <div style={{ maxWidth: 1400, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <div className="section-label" style={{ color: "#666" }}>
            Как работаю
          </div>
          <h2
            className="section-title"
            style={{ color: "#fff", marginBottom: 64 }}
          >
            Четыре шага.
            <br />
            <span style={{ color: "#666" }}>Без лишнего.</span>
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
              gap: 32,
            }}
          >
            {[
              {
                step: "01",
                title: "Заявка",
                desc: "Вы пишете или звоните. Обсуждаем задачу, бюджет, сроки. Без навязывания.",
              },
              {
                step: "02",
                title: "Замер",
                desc: "Приезжаю, замеряю, считаю. Точная смета на месте. Без «потом уточним».",
              },
              {
                step: "03",
                title: "Монтаж",
                desc: "Монтирую в оговорённый день. Чисто, аккуратно, по технологии. Обычно 1 день.",
              },
              {
                step: "04",
                title: "Готово",
                desc: "Принимаете работу. Всё чисто. Даю гарантию. Работа говорит за себя.",
              },
            ].map((item, i) => (
              <div
                key={i}
                style={{
                  padding: 40,
                  border: "1px solid rgba(255,255,255,0.1)",
                  transition: "border-color 0.3s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")
                }
              >
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 48,
                    fontWeight: 700,
                    color: "rgba(255,255,255,0.1)",
                    marginBottom: 16,
                  }}
                >
                  {item.step}
                </div>
                <h3
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    marginBottom: 12,
                  }}
                >
                  {item.title}
                </h3>
                <p style={{ fontSize: 14, lineHeight: 1.7, color: "#888" }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section
        id="contact"
        style={{
          padding: "120px clamp(24px, 5vw, 80px)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          className="bg-shape"
          style={{
            width: 400,
            height: 400,
            background: "#1a1a1a",
            top: "10%",
            left: "60%",
            animation: "float2 20s ease-in-out infinite",
          }}
        />

        <div style={{ maxWidth: 1400, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <div className={`fade-up ${isVisible("contact") ? "visible" : ""}`}>
            <div className="section-label">Контакт</div>
            <h2 className="section-title">
              Готовы начать?
              <br />
              <span style={{ color: "#999" }}>Напишите. Отвечу лично.</span>
            </h2>
          </div>

          <div
            className="contact-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 80,
              marginTop: 64,
            }}
          >
            <form
              onSubmit={handleSubmit}
              className={`fade-up fade-up-d1 ${isVisible("contact") ? "visible" : ""}`}
              style={{ display: "flex", flexDirection: "column", gap: 16 }}
            >
              <input
                type="text"
                placeholder="Имя"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
              />
              <input
                type="tel"
                placeholder="Телефон"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                required
              />
              <textarea
                placeholder="Опишите задачу: что за помещение, какой потолок хотите, примерная площадь"
                rows={5}
                value={formData.message}
                onChange={(e) =>
                  setFormData({ ...formData, message: e.target.value })
                }
                style={{ resize: "vertical" }}
              />
              <button
                type="submit"
                className="cta-btn"
                style={{ width: "100%", justifyContent: "center" }}
              >
                {formSent ? "✓ Заявка отправлена" : "Отправить заявку →"}
              </button>
              <p style={{ fontSize: 12, color: "#aaa", textAlign: "center" }}>
                Отвечу в течение 2 часов в рабочее время
              </p>
            </form>

            <div
              className={`fade-up fade-up-d3 ${isVisible("contact") ? "visible" : ""}`}
              style={{ display: "flex", flexDirection: "column", gap: 40 }}
            >
              <div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                    color: "#999",
                    marginBottom: 8,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  Телефон
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5 }}>
                  +7 (XXX) XXX-XX-XX
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                    color: "#999",
                    marginBottom: 8,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  Мессенджеры
                </div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>
                  WhatsApp / Telegram
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                    color: "#999",
                    marginBottom: 8,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  География
                </div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>
                  Москва и Московская область
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                    color: "#999",
                    marginBottom: 8,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  Время работы
                </div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>
                  Пн — Вс / 9:00 — 21:00
                </div>
              </div>
              <div
                style={{
                  padding: 24,
                  background: "#f2f2f2",
                  border: "1px solid #e8e8e8",
                }}
              >
                <p style={{ fontSize: 14, lineHeight: 1.7, color: "#666" }}>
                  💡 <strong>Совет:</strong> Напишите в заявке площадь помещения
                  и тип потолка, который хотите. Так я сразу смогу сориентировать
                  по цене и срокам.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer
        style={{
          padding: "60px clamp(24px, 5vw, 80px)",
          background: "#1a1a1a",
          color: "#fff",
          borderTop: "1px solid #333",
        }}
      >
        <div style={{ maxWidth: 1400, margin: "0 auto" }}>
          <div
            className="footer-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto auto",
              gap: 80,
              alignItems: "start",
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 18,
                  fontWeight: 700,
                  letterSpacing: 3,
                  marginBottom: 16,
                }}
              >
                ПОТОЛКОВО
              </div>
              <p style={{ fontSize: 14, color: "#888", lineHeight: 1.7, maxWidth: 360 }}>
                Натяжные потолки любой сложности.
                Москва и МО. Частный мастер Владимир. С 2010 года.
              </p>
            </div>
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  color: "#666",
                  marginBottom: 16,
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                Навигация
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  ["Услуги", "services"],
                  ["Проекты", "projects"],
                  ["О нас", "about"],
                  ["Контакт", "contact"],
                ].map(([label, id]) => (
                  <button
                    key={id}
                    onClick={() => scrollTo(id)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#888",
                      fontSize: 14,
                      cursor: "pointer",
                      textAlign: "left",
                      fontFamily: "inherit",
                      padding: 0,
                      transition: "color 0.3s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "#888")}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  color: "#666",
                  marginBottom: 16,
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                Услуги
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  "Теневой профиль",
                  "Парящие потолки",
                  "Световые линии",
                  "Трековое освещение",
                  "Скрытые карнизы",
                ].map((s) => (
                  <span key={s} style={{ fontSize: 14, color: "#888" }}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 60,
              paddingTop: 24,
              borderTop: "1px solid #333",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 16,
            }}
          >
            <span style={{ fontSize: 13, color: "#666" }}>
              © {new Date().getFullYear()} ПОТОЛКОВО. Все права защищены.
            </span>
            <span
              style={{
                fontSize: 12,
                color: "#444",
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              Москва и Московская область
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
