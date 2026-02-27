"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

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
  const scrollTo = (id: string) => { setMenuOpen(false); document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }); };
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); setFormSent(true); setTimeout(() => setFormSent(false), 4000); setFormData({ name: "", phone: "", message: "" }); };

  const heroImages = [
    { src: "/hero1.jpeg", alt: "Натяжной потолок — теневой профиль" },
    { src: "/hero2.jpeg", alt: "Парящий натяжной потолок с подсветкой" },
    { src: "/hero3.jpeg", alt: "Световые линии в натяжном потолке" },
  ];

  const advantages = [
    { num: "15+", label: "лет опыта", sub: "с 2010 года", image: "/adv-experience.jpeg" },
    { num: "∞", label: "сложность", sub: "любые проекты", image: "/adv-complexity.jpeg" },
    { num: "1", label: "мастер", sub: "я лично", image: "/adv-master.jpeg" },
    { num: "0", label: "посредников", sub: "прямая работа", image: "/adv-direct.jpeg" },
  ];

  const services = [
    { image: "/svc-shadow.jpeg", emoji: "⬛", title: "Теневой профиль", desc: "Потолок без плинтуса. Чёткий теневой зазор 8 мм. Выглядит дорого, потому что это дорого сделать правильно." },
    { image: "/svc-floating.jpeg", emoji: "💡", title: "Парящие потолки", desc: "LED-подсветка по периметру. Потолок визуально отрывается от стен. Работает и как основной свет." },
    { image: "/svc-lightlines.jpeg", emoji: "📐", title: "Световые линии", desc: "Встроенные в полотно линейные светильники. Любая геометрия. Замена люстрам и точечникам." },
    { image: "/svc-track.jpeg", emoji: "🔦", title: "Трековое освещение", desc: "Встраиваемые треки в натяжной потолок. Направленный свет. Полный расчёт освещённости." },
    { image: "/svc-cornice.jpeg", emoji: "🪟", title: "Скрытые карнизы", desc: "Ниша под шторы прямо в потолке. Карниз не виден. Шторы будто растут из потолка." },
    { image: "/svc-custom.jpeg", emoji: "🏗️", title: "Индивидуальные проекты", desc: "Купола, многоуровневые конструкции, нестандартные формы. Если можно натянуть — сделаю." },
    { image: "/svc-tracksale.jpeg", emoji: "🛒", title: "Продажа трекового освещения", desc: "Подберу и продам трековые системы под ваш проект. Магнитные треки, споты, линейные светильники." },
    { image: "/svc-simple.jpeg", emoji: "🏠", title: "Простые потолки для квартиры", desc: "Классический белый матовый или сатиновый потолок. Быстро, ровно, недорого. Идеально для ремонта квартир." },
    { image: "/svc-multilevel.jpeg", emoji: "✨", title: "Светопрозрачные потолки", desc: "Полностью светящийся потолок. Полупрозрачное полотно с LED-подсветкой за ним — равномерное свечение по всей площади. Эффект окна в потолке." },
  ];

  const projects = [
    { title: "Купол с подсветкой", desc: "Индивидуальный проект: объёмный купол из натяжного полотна с интегрированной RGB-подсветкой. Полностью кастомная конструкция.", tags: ["Индивидуальный проект", "RGB", "Сложная геометрия"], images: ["/proj-dome-1.jpeg", "/proj-dome-2.jpeg", "/proj-dome-3.jpeg"] },
    { title: "Теневой профиль + трек", desc: "Квартира 120 м². Теневое примыкание по периметру, трековое освещение, чистые линии без плинтусов.", tags: ["Теневой профиль", "Трековый свет", "Минимализм"], images: ["/proj-shadow-1.jpeg", "/proj-shadow-2.jpeg", "/proj-shadow-3.jpeg"] },
    { title: "Парящий потолок", desc: "Парящая конструкция с LED-лентой по контуру. Эффект «отрыва» потолка от стен. Гостиная + коридор.", tags: ["Парящий", "LED", "Световой контур"], images: ["/proj-float-1.jpeg", "/proj-float-2.jpeg", "/proj-float-3.jpeg"] },
    { title: "Световые линии", desc: "Офисное пространство. Геометричные световые линии вместо стандартных светильников. Расчёт освещённости по нормам.", tags: ["Световые линии", "Офис", "Расчёт света"], images: ["/proj-lines-1.jpeg", "/proj-lines-2.jpeg", "/proj-lines-3.jpeg"] },
    { title: "Скрытый карниз", desc: "Ниша под карниз в натяжном потолке. Шторы «из потолка» — чистый вид, никаких накладок.", tags: ["Скрытый карниз", "Ниша", "Чистый вид"], images: ["/proj-cornice-1.jpeg", "/proj-cornice-2.jpeg", "/proj-cornice-3.jpeg"] },
    { title: "Матовые потолки", desc: "Классика, которая не устаревает. Ровная матовая поверхность без бликов. Идеально для жилых комнат и спален.", tags: ["Матовый", "Классика", "Квартира"], images: ["/proj-matte-1.jpeg", "/proj-matte-2.jpeg", "/proj-matte-3.jpeg"] },
    { title: "Контурная подсветка", desc: "Светодиодная лента по контуру потолка за полупрозрачной вставкой. Мягкое свечение, уютная атмосфера, управление с пульта.", tags: ["Контурная подсветка", "LED", "Атмосфера"], images: ["/proj-contour-1.jpeg", "/proj-contour-2.jpeg", "/proj-contour-3.jpeg"] },
  ];

  const processSteps = [
    { step: "01", title: "Заявка", desc: "Вы пишете или звоните. Обсуждаем задачу, бюджет, сроки. Без навязывания.", icon: "📱", image: "/step-request.jpeg" },
    { step: "02", title: "Замер", desc: "Приезжаю, замеряю, считаю. Точная смета на месте. Без «потом уточним».", icon: "📏", image: "/step-measure.jpeg" },
    { step: "03", title: "Монтаж", desc: "Монтирую в оговорённый день. Чисто, аккуратно, по технологии. Обычно 1 день.", icon: "⚙️", image: "/step-install.jpeg" },
    { step: "04", title: "Готово", desc: "Принимаете работу. Всё чисто. Даю гарантию. Работа говорит за себя.", icon: "✅", image: "/step-done.jpeg" },
  ];

  const faqItems = [
    { q: "Почему частный мастер, а не компания?", a: "Потому что я отвечаю за каждый миллиметр лично. Нет менеджеров, которые обещают одно, а делает кто-то другой.", icon: "👤" },
    { q: "Какую гарантию даёте?", a: "Полную. На полотно — гарантия производителя. На монтаж — моя личная гарантия. Составляю договор. Если что-то не так — приеду и исправлю.", icon: "🛡️" },
    { q: "Работаете за МКАД?", a: "Москва и МО полностью. Дальше — обсуждаемо.", icon: "📍" },
    { q: "Продаёте освещение?", a: "Да. Подберу трековые системы, магнитные треки, споты — под ваш проект, по адекватной цене.", icon: "💡" },
    { q: "Будет ли шум и пыль?", a: "Работаю без лишнего шума и пыли. Использую пневмопистолеты вместо перфоратора где возможно, а при сверлении — перфоратор с пылесборником. Ваша квартира останется чистой.", icon: "🔇" },
    { q: "Составляете договор?", a: "Да, обязательно. Договор, смета, гарантийный талон. Всё официально и прозрачно.", icon: "📄" },
  ];

  return (
    <div style={{
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      color: "#1a1a1a", background: "#fafafa", overflowX: "hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap');
        *{margin:0;padding:0;box-sizing:border-box}
        html{scroll-behavior:smooth}
        body{overflow-x:hidden}
        ::selection{background:#1a1a1a;color:#fff}
        .fade-up{opacity:0;transform:translateY(40px);transition:opacity .8s cubic-bezier(.16,1,.3,1),transform .8s cubic-bezier(.16,1,.3,1)}
        .fade-up.visible{opacity:1;transform:translateY(0)}
        .fade-up-d1{transition-delay:.1s}.fade-up-d2{transition-delay:.2s}.fade-up-d3{transition-delay:.3s}.fade-up-d4{transition-delay:.4s}.fade-up-d5{transition-delay:.5s}.fade-up-d6{transition-delay:.6s}
        @keyframes float1{0%,100%{transform:translate(0,0) rotate(0)}33%{transform:translate(30px,-30px) rotate(120deg)}66%{transform:translate(-20px,20px) rotate(240deg)}}
        @keyframes float2{0%,100%{transform:translate(0,0) rotate(0)}33%{transform:translate(-40px,20px) rotate(-120deg)}66%{transform:translate(25px,-35px) rotate(-240deg)}}
        @keyframes float3{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(20px,-20px) scale(1.1)}}
        .bg-shape{position:absolute;border-radius:50%;filter:blur(80px);opacity:.07;pointer-events:none}
        button,a{cursor:pointer}
        .cta-btn{display:inline-flex;align-items:center;gap:8px;padding:16px 36px;background:#1a1a1a;color:#fff;border:none;font-size:15px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;cursor:pointer;transition:all .3s cubic-bezier(.16,1,.3,1);position:relative;overflow:hidden;font-family:inherit}
        .cta-btn:hover{background:#333;transform:translateY(-2px);box-shadow:0 8px 30px rgba(0,0,0,.2)}
        .cta-btn-outline{background:transparent;color:#1a1a1a;border:2px solid #1a1a1a}
        .cta-btn-outline:hover{background:#1a1a1a;color:#fff}
        .cta-btn-white{background:#fff;color:#1a1a1a}
        .cta-btn-white:hover{background:#e8e8e8}
        .nav-link{color:#666;text-decoration:none;font-size:14px;font-weight:500;letter-spacing:.5px;text-transform:uppercase;transition:color .3s;cursor:pointer;background:none;border:none;font-family:inherit}
        .nav-link:hover{color:#1a1a1a}
        .service-card{background:#fff;border:1px solid #e8e8e8;transition:all .4s cubic-bezier(.16,1,.3,1);position:relative;overflow:hidden}
        .service-card::before{content:'';position:absolute;top:0;left:0;width:100%;height:3px;background:#1a1a1a;transform:scaleX(0);transform-origin:left;transition:transform .4s cubic-bezier(.16,1,.3,1);z-index:2}
        .service-card:hover{border-color:#1a1a1a;transform:translateY(-4px);box-shadow:0 12px 40px rgba(0,0,0,.08)}
        .service-card:hover::before{transform:scaleX(1)}
        .project-tab{padding:12px 24px;background:transparent;border:1px solid #ddd;color:#888;font-size:13px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;cursor:pointer;transition:all .3s;font-family:inherit;white-space:nowrap}
        .project-tab.active{background:#1a1a1a;color:#fff;border-color:#1a1a1a}
        .project-tab:hover:not(.active){border-color:#1a1a1a;color:#1a1a1a}
        .slide-dot{width:10px;height:10px;border-radius:50%;border:2px solid #999;background:transparent;cursor:pointer;transition:all .3s;padding:0}
        .slide-dot.active{background:#1a1a1a;border-color:#1a1a1a}
        .slide-dot:hover{border-color:#1a1a1a}
        .slide-arrow{width:40px;height:40px;border-radius:50%;border:1px solid rgba(255,255,255,.5);background:rgba(0,0,0,.4);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .3s;font-size:18px;backdrop-filter:blur(10px);font-family:inherit}
        .slide-arrow:hover{background:rgba(0,0,0,.7);border-color:#fff}
        .tag{display:inline-block;padding:6px 14px;background:#f0f0f0;font-size:12px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;color:#666}
        .section-label{font-size:12px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#999;margin-bottom:16px;font-family:'JetBrains Mono',monospace}
        .section-title{font-size:clamp(32px,5vw,56px);font-weight:800;line-height:1.1;letter-spacing:-1.5px;color:#1a1a1a;margin-bottom:24px}
        input,textarea{width:100%;padding:16px 20px;border:1px solid #ddd;background:#fff;font-size:15px;font-family:inherit;color:#1a1a1a;transition:border-color .3s;outline:none}
        input:focus,textarea:focus{border-color:#1a1a1a}
        input::placeholder,textarea::placeholder{color:#aaa}
        .mobile-menu{position:fixed;top:0;left:0;width:100%;height:100vh;background:#fafafa;z-index:999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:32px;transform:translateY(-100%);transition:transform .5s cubic-bezier(.16,1,.3,1)}
        .mobile-menu.open{transform:translateY(0)}
        .mobile-menu button{font-size:24px;font-weight:700;text-transform:uppercase;letter-spacing:2px;background:none;border:none;color:#1a1a1a;cursor:pointer;font-family:inherit}
        .hamburger{display:none;flex-direction:column;gap:5px;background:none;border:none;cursor:pointer;z-index:1001;padding:8px}
        .hamburger span{width:28px;height:2px;background:#1a1a1a;transition:all .3s}
        .hamburger.open span:nth-child(1){transform:rotate(45deg) translate(5px,5px)}
        .hamburger.open span:nth-child(2){opacity:0}
        .hamburger.open span:nth-child(3){transform:rotate(-45deg) translate(5px,-5px)}
        .nav-logo{overflow:hidden;flex-shrink:0}
        @media(max-width:768px){
          .hamburger{display:flex}
          .desktop-nav{display:none!important}
          .hero-grid{grid-template-columns:1fr!important}
          .services-grid{grid-template-columns:1fr!important}
          .advantages-grid{grid-template-columns:repeat(2,1fr)!important}
          .project-tabs{flex-wrap:wrap}
          .footer-grid{grid-template-columns:1fr!important;text-align:center}
          .contact-grid{grid-template-columns:1fr!important}
          .process-grid{grid-template-columns:repeat(2,1fr)!important}
        }
        @media(max-width:480px){
          .advantages-grid{grid-template-columns:1fr!important}
          .process-grid{grid-template-columns:1fr!important}
        }
      `}</style>

      {/* NAV */}
      <nav style={{
        position: "fixed", top: 0, left: 0, width: "100%", padding: "0 clamp(24px,5vw,80px)", height: 72,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: scrollY > 50 ? "rgba(250,250,250,0.95)" : "transparent",
        backdropFilter: scrollY > 50 ? "blur(20px)" : "none",
        borderBottom: scrollY > 50 ? "1px solid #e8e8e8" : "1px solid transparent",
        zIndex: 1000, transition: "all .3s",
      }}>
        <div
          style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
          onClick={() => scrollTo("hero")}
        >
          <div className="nav-logo" style={{ width: 40, height: 40, position: "relative" }}>
            <Image
              src="/logo.jpeg"
              alt="ПОТОЛКОВО логотип"
              width={40}
              height={40}
              style={{ objectFit: "cover", borderRadius: "50%" }}
              priority
            />
          </div>
          <span style={{
            fontFamily: "'JetBrains Mono',monospace", fontSize: 18, fontWeight: 700,
            letterSpacing: 3, textTransform: "uppercase",
            color: scrollY > 50 ? "#1a1a1a" : "#fff", transition: "color .3s",
          }}>
            ПОТОЛКОВО
          </span>
        </div>
        <div className="desktop-nav" style={{ display: "flex", gap: 32, alignItems: "center" }}>
          {[["Услуги", "services"], ["Проекты", "projects"], ["О нас", "about"], ["Контакт", "contact"]].map(([l, id]) => (
            <button key={id} className="nav-link" onClick={() => scrollTo(id)} style={{ color: scrollY > 50 ? "#666" : "rgba(255,255,255,0.8)" }}>{l}</button>
          ))}
          <button className="cta-btn" style={{ padding: "10px 24px", fontSize: 12 }} onClick={() => scrollTo("contact")}>Оставить заявку</button>
        </div>
        <button className={`hamburger ${menuOpen ? "open" : ""}`} onClick={() => setMenuOpen(!menuOpen)}>
          <span style={{ background: scrollY > 50 ? "#1a1a1a" : "#fff" }} />
          <span style={{ background: scrollY > 50 ? "#1a1a1a" : "#fff" }} />
          <span style={{ background: scrollY > 50 ? "#1a1a1a" : "#fff" }} />
        </button>
      </nav>

      <div className={`mobile-menu ${menuOpen ? "open" : ""}`}>
        {[["Услуги", "services"], ["Проекты", "projects"], ["О нас", "about"], ["Контакт", "contact"]].map(([l, id]) => (
          <button key={id} onClick={() => scrollTo(id)}>{l}</button>
        ))}
      </div>

      {/* HERO */}
      <section id="hero" style={{ minHeight: "100vh", display: "flex", alignItems: "center", position: "relative", overflow: "hidden" }}>
        {heroImages.map((img, i) => (
          <div key={i} style={{ position: "absolute", inset: 0, opacity: heroSlide === i ? 1 : 0, transition: "opacity 1s ease", zIndex: 0 }}>
            <Image src={img.src} alt={img.alt} fill priority={i === 0} quality={85} sizes="100vw"
              style={{ objectFit: "cover", objectPosition: "center", transform: heroSlide === i ? "scale(1)" : "scale(1.05)", transition: "transform 6s ease, opacity 1s ease" }} />
          </div>
        ))}
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1 }} />
        <div style={{ maxWidth: 1400, width: "100%", margin: "0 auto", position: "relative", zIndex: 2, padding: "120px clamp(24px,5vw,80px) 80px" }}>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 500, letterSpacing: 3, color: "rgba(255,255,255,0.6)", marginBottom: 24, textTransform: "uppercase" }}>
            Москва и МО / с 2010 года
          </div>
          <h1 style={{ fontSize: "clamp(40px,6vw,80px)", fontWeight: 900, lineHeight: 1.05, letterSpacing: -3, marginBottom: 32, color: "#fff" }}>
            Натяжные<br />потолки<br /><span style={{ color: "rgba(255,255,255,0.5)" }}>без компромиссов</span>
          </h1>
          <p style={{ fontSize: 18, lineHeight: 1.7, color: "rgba(255,255,255,0.7)", maxWidth: 520, marginBottom: 48 }}>
            Я — Владимир. Не компания с колл-центром. Частный мастер. Делаю лично. Любая сложность. Теневой профиль, световые линии, треки, купола.
          </p>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 48 }}>
            <button className="cta-btn cta-btn-white" onClick={() => scrollTo("contact")}>Обсудить проект →</button>
            <button className="cta-btn" style={{ background: "transparent", border: "2px solid rgba(255,255,255,0.5)" }} onClick={() => scrollTo("projects")}>Смотреть работы</button>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {heroImages.map((_, i) => (
              <button key={i} onClick={() => setHeroSlide(i)} style={{
                width: heroSlide === i ? 32 : 10, height: 4, borderRadius: 2,
                background: heroSlide === i ? "#fff" : "rgba(255,255,255,0.4)",
                border: "none", cursor: "pointer", transition: "all .3s", padding: 0,
              }} />
            ))}
          </div>
        </div>
        <div style={{ position: "absolute", bottom: 40, right: "clamp(24px,5vw,80px)", display: "flex", gap: 8, zIndex: 3 }}>
          <button className="slide-arrow" onClick={() => setHeroSlide((heroSlide - 1 + heroImages.length) % heroImages.length)}>←</button>
          <button className="slide-arrow" onClick={() => setHeroSlide((heroSlide + 1) % heroImages.length)}>→</button>
        </div>
      </section>

      {/* ADVANTAGES — без иконок-эмодзи */}
      <section id="advantages" style={{ padding: 0, background: "#1a1a1a", color: "#fff", position: "relative", overflow: "hidden" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto" }}>
          <div className={`advantages-grid fade-up ${isVisible("advantages") ? "visible" : ""}`} style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 0 }}>
            {advantages.map((a, i) => (
              <div key={i} className={`fade-up ${isVisible("advantages") ? "visible" : ""} fade-up-d${i + 1}`}
                style={{
                  position: "relative", overflow: "hidden", minHeight: 320,
                  display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: 32,
                  borderRight: i < 3 ? "1px solid rgba(255,255,255,0.08)" : "none",
                  transition: "all .3s", cursor: "default",
                }}
                onMouseEnter={e => { const o = e.currentTarget.querySelector('.adv-overlay') as HTMLElement; if (o) o.style.opacity = '0.5' }}
                onMouseLeave={e => { const o = e.currentTarget.querySelector('.adv-overlay') as HTMLElement; if (o) o.style.opacity = '0.7' }}
              >
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
            {services.map((s, i) => (
              <div key={i} className={`service-card fade-up ${isVisible("services") ? "visible" : ""} fade-up-d${Math.min((i % 6) + 1, 6)}`}>
                <div style={{ width: "100%", height: 180, position: "relative", overflow: "hidden" }}>
                  <Image src={s.image} alt={s.title} fill sizes="(max-width:768px) 100vw, 33vw" style={{ objectFit: "cover" }} />
                </div>
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
      <section id="projects" style={{ padding: "120px clamp(24px,5vw,80px)", background: "#f2f2f2", position: "relative", overflow: "hidden" }}>
        <div className="bg-shape" style={{ width: 400, height: 400, background: "#1a1a1a", top: "10%", left: "-5%", animation: "float2 18s ease-in-out infinite" }} />
        <div style={{ maxWidth: 1400, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <div className={`fade-up ${isVisible("projects") ? "visible" : ""}`}>
            <div className="section-label">Проекты</div>
            <h2 className="section-title">Не рендеры.<br /><span style={{ color: "#999" }}>Реальные объекты.</span></h2>
          </div>
          <div className="project-tabs" style={{ display: "flex", gap: 8, marginTop: 48, overflowX: "auto", paddingBottom: 8 }}>
            {projects.map((p, i) => (<button key={i} className={`project-tab ${activeProject === i ? "active" : ""}`} onClick={() => setActiveProject(i)}>{p.title}</button>))}
          </div>
          <div className="hero-grid" style={{ marginTop: 48, display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 48, alignItems: "center" }}>
            <div style={{ position: "relative", overflow: "hidden" }}>
              <div style={{ aspectRatio: "4/3", position: "relative", background: "#e0e0e0", overflow: "hidden" }}>
                {projects[activeProject].images.map((img, i) => (
                  <div key={`${activeProject}-${i}`} style={{ position: "absolute", inset: 0, opacity: projectSlide === i ? 1 : 0, transition: "opacity .6s ease" }}>
                    <Image src={img} alt={`${projects[activeProject].title} — фото ${i + 1}`} fill sizes="(max-width:768px) 100vw, 60vw" style={{ objectFit: "cover" }} />
                  </div>
                ))}
                <div style={{ position: "absolute", bottom: 16, left: 16, fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "#fff", background: "rgba(0,0,0,0.6)", padding: "6px 12px", backdropFilter: "blur(10px)", zIndex: 2 }}>
                  {String(projectSlide + 1).padStart(2, "0")} / {String(projects[activeProject].images.length).padStart(2, "0")}
                </div>
                <div style={{ position: "absolute", bottom: 16, right: 16, display: "flex", gap: 8, zIndex: 2 }}>
                  <button className="slide-arrow" style={{ width: 36, height: 36, fontSize: 14 }} onClick={() => setProjectSlide((projectSlide - 1 + projects[activeProject].images.length) % projects[activeProject].images.length)}>←</button>
                  <button className="slide-arrow" style={{ width: 36, height: 36, fontSize: 14 }} onClick={() => setProjectSlide((projectSlide + 1) % projects[activeProject].images.length)}>→</button>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 12, justifyContent: "center" }}>
                {projects[activeProject].images.map((_, i) => (<button key={i} className={`slide-dot ${projectSlide === i ? "active" : ""}`} onClick={() => setProjectSlide(i)} />))}
              </div>
            </div>
            <div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 64, fontWeight: 700, color: "#e0e0e0", lineHeight: 1, marginBottom: 16 }}>
                {String(activeProject + 1).padStart(2, "0")}
              </div>
              <h3 style={{ fontSize: 28, fontWeight: 800, letterSpacing: -1, marginBottom: 16 }}>{projects[activeProject].title}</h3>
              <p style={{ fontSize: 15, lineHeight: 1.8, color: "#666", marginBottom: 24 }}>{projects[activeProject].desc}</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 32 }}>
                {projects[activeProject].tags.map((tag, i) => (<span key={i} className="tag">{tag}</span>))}
              </div>
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
                <Image src="/about-master.jpeg" alt="Владимир — мастер по натяжным потолкам" fill sizes="(max-width:768px) 100vw, 50vw" style={{ objectFit: "cover" }} />
                <div style={{ position: "absolute", bottom: 16, left: 16, background: "#1a1a1a", color: "#fff", padding: "8px 16px", fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: 1, textTransform: "uppercase", zIndex: 2 }}>
                  Владимир / Основатель
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <p style={{ fontSize: 16, lineHeight: 1.8, color: "#555" }}>
                  Я не франшиза. Не бригада с текучкой. Я — частный мастер, который с 2010 года занимается одним делом: натяжными потолками. Более 15 лет опыта на объектах любой сложности.
                </p>
                <p style={{ fontSize: 16, lineHeight: 1.8, color: "#555" }}>
                  Сам замеряю. Сам проектирую. Сам монтирую. Каждый объект — моя личная репутация. Поэтому халтуры не бывает.
                </p>
                <p style={{ fontSize: 16, lineHeight: 1.8, color: "#555" }}>
                  Работаю чисто: пневмопистолеты вместо перфоратора, а при сверлении — пылесборник. Составляю договор, даю гарантию на монтаж.
                </p>
              </div>
            </div>
            <div className={`fade-up fade-up-d2 ${isVisible("about") ? "visible" : ""}`} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#999", fontFamily: "'JetBrains Mono',monospace", marginBottom: 4 }}>Частые вопросы</div>
              {faqItems.map((item, i) => (
                <div key={i} style={{ padding: 24, background: "#fff", border: "1px solid #e8e8e8", transition: "border-color .3s" }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = "#1a1a1a")}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = "#e8e8e8")}>
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
      <section id="process" style={{ padding: "120px clamp(24px,5vw,80px)", background: "#1a1a1a", color: "#fff", position: "relative", overflow: "hidden" }}>
        <div className="bg-shape" style={{ width: 600, height: 600, background: "#fff", bottom: "-20%", left: "30%", opacity: 0.02, animation: "float1 30s ease-in-out infinite" }} />
        <div style={{ maxWidth: 1400, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <div className={`fade-up ${isVisible("process") ? "visible" : ""}`}>
            <div className="section-label" style={{ color: "#666" }}>Как работаю</div>
            <h2 className="section-title" style={{ color: "#fff", marginBottom: 64 }}>Четыре шага.<br /><span style={{ color: "#666" }}>Без лишнего.</span></h2>
          </div>
          <div className="process-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 24 }}>
            {processSteps.map((item, i) => (
              <div key={i} className={`fade-up ${isVisible("process") ? "visible" : ""} fade-up-d${i + 1}`}
                style={{ border: "1px solid rgba(255,255,255,0.1)", transition: "border-color .3s", overflow: "hidden" }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}>
                <div style={{ width: "100%", height: 160, position: "relative", overflow: "hidden" }}>
                  <Image src={item.image} alt={item.title} fill sizes="(max-width:768px) 50vw, 25vw" style={{ objectFit: "cover" }} />
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom,rgba(26,26,26,0.3),rgba(26,26,26,0.8))" }} />
                  <div style={{ position: "absolute", top: 16, left: 16, fontFamily: "'JetBrains Mono',monospace", fontSize: 36, fontWeight: 700, color: "rgba(255,255,255,0.3)" }}>{item.step}</div>
                  <div style={{ position: "absolute", bottom: 16, right: 16, fontSize: 28 }}>{item.icon}</div>
                </div>
                <div style={{ padding: 24 }}>
                  <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>{item.title}</h3>
                  <p style={{ fontSize: 14, lineHeight: 1.7, color: "#888" }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA BANNER */}
      <section style={{ padding: "80px clamp(24px,5vw,80px)", position: "relative", overflow: "hidden", minHeight: 400, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Image src="/cta-banner.jpeg" alt="Интерьер с натяжным потолком" fill sizes="100vw" style={{ objectFit: "cover" }} />
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)" }} />
        <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center", position: "relative", zIndex: 1 }}>
          <h2 style={{ fontSize: "clamp(28px,4vw,48px)", fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: 16, letterSpacing: -1 }}>
            Готовы к потолку, который удивляет?
          </h2>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.7)", marginBottom: 32 }}>Звоните или оставьте заявку — отвечу лично в течение 2 часов</p>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="tel:+79055219909" className="cta-btn cta-btn-white" style={{ textDecoration: "none" }}>📞 +7 905 521 99 09</a>
            <button className="cta-btn" style={{ background: "transparent", border: "2px solid rgba(255,255,255,0.5)" }} onClick={() => scrollTo("contact")}>Оставить заявку →</button>
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" style={{ padding: "120px clamp(24px,5vw,80px)", position: "relative", overflow: "hidden" }}>
        <div className="bg-shape" style={{ width: 400, height: 400, background: "#1a1a1a", top: "10%", left: "60%", animation: "float2 20s ease-in-out infinite" }} />
        <div style={{ maxWidth: 1400, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <div className={`fade-up ${isVisible("contact") ? "visible" : ""}`}>
            <div className="section-label">Контакт</div>
            <h2 className="section-title">Готовы начать?<br /><span style={{ color: "#999" }}>Напишите. Отвечу лично.</span></h2>
          </div>
          <div className="contact-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, marginTop: 64 }}>
            <form onSubmit={handleSubmit} className={`fade-up fade-up-d1 ${isVisible("contact") ? "visible" : ""}`} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <input type="text" placeholder="Имя" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
              <input type="tel" placeholder="Телефон" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} required />
              <textarea placeholder="Опишите задачу: помещение, тип потолка, площадь" rows={5} value={formData.message} onChange={e => setFormData({ ...formData, message: e.target.value })} style={{ resize: "vertical" }} />
              <button type="submit" className="cta-btn" style={{ width: "100%", justifyContent: "center" }}>
                {formSent ? "✓ Заявка отправлена" : "Отправить заявку →"}
              </button>
              <p style={{ fontSize: 12, color: "#aaa", textAlign: "center" }}>Отвечу в течение 2 часов в рабочее время</p>
            </form>
            <div className={`fade-up fade-up-d3 ${isVisible("contact") ? "visible" : ""}`} style={{ display: "flex", flexDirection: "column", gap: 28 }}>
              {[
                { label: "Телефон", value: "+7 905 521 99 09", icon: "📞", href: "tel:+79055219909" },
                { label: "Telegram", value: "Написать в Telegram", icon: "✈️", href: "https://t.me/potolkovo_msk" },
                { label: "Email", value: "potolkovo_msk@mail.ru", icon: "📧", href: "mailto:potolkovo_msk@mail.ru" },
                { label: "География", value: "Москва и Московская область", icon: "📍" },
                { label: "Время работы", value: "Пн — Вс / 9:00 — 21:00", icon: "🕘" },
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                  <div style={{ width: 48, height: 48, display: "flex", alignItems: "center", justifyContent: "center", background: "#f2f2f2", fontSize: 20, flexShrink: 0 }}>{item.icon}</div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#999", marginBottom: 4, fontFamily: "'JetBrains Mono',monospace" }}>{item.label}</div>
                    {item.href ? (
                      <a href={item.href} target="_blank" rel="noopener noreferrer" style={{ fontSize: 18, fontWeight: 600, color: "#1a1a1a", textDecoration: "none", borderBottom: "1px solid #ddd", paddingBottom: 2 }}>{item.value}</a>
                    ) : (<div style={{ fontSize: 18, fontWeight: 600 }}>{item.value}</div>)}
                  </div>
                </div>
              ))}
              <div style={{ padding: 24, background: "#f8f8f8", border: "1px solid #e8e8e8", marginTop: 4 }}>
                <p style={{ fontSize: 14, lineHeight: 1.7, color: "#666" }}>
                  💡 <strong>Совет:</strong> Напишите площадь помещения и тип потолка — так я сразу сориентирую по цене и срокам.
                </p>
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
                <Image src="/logo.jpeg" alt="ПОТОЛКОВО" width={36} height={36} style={{ borderRadius: "50%", objectFit: "cover" }} />
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 18, fontWeight: 700, letterSpacing: 3 }}>ПОТОЛКОВО</span>
              </div>
              <p style={{ fontSize: 14, color: "#888", lineHeight: 1.7, maxWidth: 360, marginBottom: 24 }}>
                Натяжные потолки любой сложности. Москва и МО. Частный мастер Владимир. С 2010 года.
              </p>
              <a href="tel:+79055219909" style={{ fontSize: 20, fontWeight: 700, color: "#fff", textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>📞 +7 905 521 99 09</a>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#666", marginBottom: 16, fontFamily: "'JetBrains Mono',monospace" }}>Навигация</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[["Услуги", "services"], ["Проекты", "projects"], ["О нас", "about"], ["Контакт", "contact"]].map(([l, id]) => (
                  <button key={id} onClick={() => scrollTo(id)} style={{ background: "none", border: "none", color: "#888", fontSize: 14, cursor: "pointer", textAlign: "left", fontFamily: "inherit", padding: 0, transition: "color .3s" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
                    onMouseLeave={e => (e.currentTarget.style.color = "#888")}>{l}</button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#666", marginBottom: 16, fontFamily: "'JetBrains Mono',monospace" }}>Услуги</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {["Теневой профиль", "Парящие потолки", "Световые линии", "Трековое освещение", "Скрытые карнизы", "Простые потолки", "Светопрозрачные", "Продажа трек-света"].map(s => (
                  <span key={s} style={{ fontSize: 14, color: "#888" }}>{s}</span>
                ))}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 60, paddingTop: 24, borderTop: "1px solid #333", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
            <span style={{ fontSize: 13, color: "#666" }}>© {new Date().getFullYear()} ПОТОЛКОВО. Все права защищены.</span>
            <span style={{ fontSize: 12, color: "#444", fontFamily: "'JetBrains Mono',monospace" }}>Москва и Московская область</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
