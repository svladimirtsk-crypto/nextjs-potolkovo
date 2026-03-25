// file: app/components/AiCeilingAdvisor.tsx
"use client";

import { useState, useEffect } from "react";
import type {
  RoomType,
  Priority,
  LightingNeed,
  Concern,
  BudgetLevel,
  SourceIntent,
  RoomSelectionOutput,
  TechQuestionOutput,
  AdvisorOutput,
} from "@/lib/types";
import { detectIntent } from "@/lib/intent";

// ============================================================
// SELECT OPTIONS
// ============================================================
const ROOM_OPTIONS: { value: RoomType; label: string }[] = [
  { value: "kitchen", label: "Кухня" },
  { value: "bedroom", label: "Спальня" },
  { value: "living", label: "Гостиная" },
  { value: "bathroom", label: "Ванная" },
  { value: "corridor", label: "Коридор / прихожая" },
  { value: "children", label: "Детская" },
  { value: "office", label: "Кабинет" },
  { value: "commercial", label: "Коммерческое помещение" },
];

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "practical", label: "Практично и надёжно" },
  { value: "modern", label: "Современно и стильно" },
  { value: "max-light", label: "Максимум света" },
  { value: "min-height-loss", label: "Минимальная потеря высоты" },
  { value: "design", label: "Эффектный дизайн" },
  { value: "hidden-light", label: "Скрытое освещение" },
];

const LIGHTING_OPTIONS: { value: LightingNeed; label: string }[] = [
  { value: "standard", label: "Обычные светильники" },
  { value: "tracks", label: "Трековое освещение" },
  { value: "light-lines", label: "Световые линии" },
  { value: "perimeter", label: "Подсветка по периметру" },
  { value: "cornice-niche", label: "Ниша под карниз" },
  { value: "unsure", label: "Пока не знаю" },
];

const CONCERN_OPTIONS: { value: Concern; label: string }[] = [
  { value: "low-ceiling", label: "Низкий потолок" },
  { value: "low-light", label: "Мало света" },
  { value: "unsure-choice", label: "Не знаю, что выбрать" },
  { value: "want-modern", label: "Хочу современно" },
  { value: "complex-geometry", label: "Сложная геометрия" },
  { value: "wet-room", label: "Влажное помещение" },
  { value: "clean-minimal", label: "Аккуратно и без лишнего" },
];

const BUDGET_OPTIONS: { value: BudgetLevel; label: string }[] = [
  { value: "basic", label: "Базовый" },
  { value: "medium", label: "Средний" },
  { value: "premium", label: "Выше среднего" },
  { value: "unsure", label: "Пока не знаю" },
];

// ============================================================
// STYLES
// ============================================================
const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "#555",
  marginBottom: 6,
  letterSpacing: 0.2,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 16px",
  border: "1px solid #ddd",
  background: "#fff",
  fontSize: 15,
  fontFamily: "inherit",
  color: "#1a1a1a",
  transition: "border-color .3s",
  outline: "none",
  appearance: "none",
  WebkitAppearance: "none",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23999' d='M6 8L1 3h10z'/%3E%3C/svg%3E\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 14px center",
  paddingRight: 36,
};

const btnPrimary: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "16px 36px",
  background: "#1a1a1a",
  color: "#fff",
  border: "none",
  fontSize: 15,
  fontWeight: 600,
  letterSpacing: 0.5,
  cursor: "pointer",
  transition: "all .3s",
  fontFamily: "'Inter',sans-serif",
  width: "100%",
};

// ============================================================
// COMPONENT
// ============================================================
export default function AiCeilingAdvisor() {
  // *** Вкладка "tech" открыта по умолчанию ***
  const [activeTab, setActiveTab] = useState<"room" | "tech">("tech");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [result, setResult] = useState<AdvisorOutput | null>(null);
  const [sourceIntent, setSourceIntent] = useState<SourceIntent>("general");
  const [utmTerm, setUtmTerm] = useState("");
  const [utmContent, setUtmContent] = useState("");
  const [utmCampaign, setUtmCampaign] = useState("");

  // Room form state
  const [roomType, setRoomType] = useState<RoomType>("living");
  const [area, setArea] = useState("");
  const [ceilingHeight, setCeilingHeight] = useState("");
  const [priority, setPriority] = useState<Priority>("modern");
  const [lightingNeed, setLightingNeed] = useState<LightingNeed>("unsure");
  const [concern, setConcern] = useState<Concern>("unsure-choice");
  const [budget, setBudget] = useState<BudgetLevel>("unsure");
  const [contact, setContact] = useState("");

  // Tech form state
  const [question, setQuestion] = useState("");
  const [techRoomType, setTechRoomType] = useState<RoomType | "">("");
  const [techCeilingHeight, setTechCeilingHeight] = useState("");
  const [details, setDetails] = useState("");
  const [techBudget, setTechBudget] = useState<BudgetLevel | "">("");
  const [techContact, setTechContact] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const uTerm = params.get("utm_term") || "";
    const uContent = params.get("utm_content") || "";
    const uCampaign = params.get("utm_campaign") || "";
    const intentParam = params.get("intent") || "";
    setUtmTerm(uTerm);
    setUtmContent(uContent);
    setUtmCampaign(uCampaign);
    setSourceIntent(detectIntent(uTerm, uContent, uCampaign, intentParam));
  }, []);

  const handleRoomSubmit = async () => {
    const areaNum = parseFloat(area);
    const heightNum = parseFloat(ceilingHeight);
    if (!areaNum || areaNum < 1 || !heightNum || heightNum < 200) return;
    setStatus("loading");
    setResult(null);
    try {
      const resp = await fetch("/api/ceiling-advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario: "room-selection",
          roomType,
          area: areaNum,
          ceilingHeight: heightNum,
          priority,
          lightingNeed,
          concern,
          budget,
          contact: contact || undefined,
          sourceIntent,
          utmTerm: utmTerm || undefined,
          utmContent: utmContent || undefined,
          utmCampaign: utmCampaign || undefined,
        }),
      });
      if (!resp.ok) throw new Error("API error");
      const data = await resp.json();
      setResult(data);
      setStatus("success");
    } catch {
      setStatus("error");
    }
  };

  const handleTechSubmit = async () => {
    if (!question.trim() || question.trim().length < 5) return;
    setStatus("loading");
    setResult(null);
    try {
      const heightNum = techCeilingHeight ? parseFloat(techCeilingHeight) : undefined;
      const resp = await fetch("/api/ceiling-advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario: "tech-question",
          question: question.trim(),
          roomType: techRoomType || undefined,
          ceilingHeight: heightNum && heightNum >= 200 ? heightNum : undefined,
          details: details || undefined,
          budget: techBudget || undefined,
          contact: techContact || undefined,
          sourceIntent,
          utmTerm: utmTerm || undefined,
          utmContent: utmContent || undefined,
          utmCampaign: utmCampaign || undefined,
        }),
      });
      if (!resp.ok) throw new Error("API error");
      const data = await resp.json();
      setResult(data);
      setStatus("success");
    } catch {
      setStatus("error");
    }
  };

  const resetForm = () => {
    setStatus("idle");
    setResult(null);
  };

  const scrollToContact = () => {
    document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" });
  };

  // ============================================================
  // RENDER RESULT — ROOM
  // ============================================================
  const renderRoomResult = (r: RoomSelectionOutput) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <div style={{ padding: 24, background: "#f8faf8", border: "1px solid #d4e5d4" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#2d7a3a", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8, fontFamily: "'JetBrains Mono',monospace" }}>Рекомендация</div>
        <p style={{ fontSize: 16, lineHeight: 1.7, color: "#333" }}>{r.quickSummary}</p>
      </div>

      <div style={{ padding: 24, background: "#fff", border: "1px solid #e8e8e8" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#999", letterSpacing: 1, textTransform: "uppercase", marginBottom: 16, fontFamily: "'JetBrains Mono',monospace" }}>Подобранное решение</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          {[
            { label: "Потолок", value: r.recommendedSolution.ceilingType },
            { label: "Фактура", value: r.recommendedSolution.texture },
            { label: "Профиль", value: r.recommendedSolution.profile },
            { label: "Освещение", value: r.recommendedSolution.lighting },
            { label: "Потеря высоты", value: r.recommendedSolution.heightLoss },
          ].map((item) => (
            <div key={item.label}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#aaa", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4, fontFamily: "'JetBrains Mono',monospace" }}>{item.label}</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: "#333", lineHeight: 1.5 }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#999", letterSpacing: 1, textTransform: "uppercase", marginBottom: 12, fontFamily: "'JetBrains Mono',monospace" }}>Почему это подойдёт</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {r.whyItFits.map((item, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ color: "#2d7a3a", fontWeight: 700, fontSize: 14, marginTop: 1 }}>✓</span>
              <span style={{ fontSize: 14, lineHeight: 1.6, color: "#555" }}>{item}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#999", letterSpacing: 1, textTransform: "uppercase", marginBottom: 12, fontFamily: "'JetBrains Mono',monospace" }}>Что важно учесть</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {r.whatToConsider.map((item, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ color: "#e6a817", fontSize: 14, marginTop: 1 }}>⚡</span>
              <span style={{ fontSize: 14, lineHeight: 1.6, color: "#555" }}>{item}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#999", letterSpacing: 1, textTransform: "uppercase", marginBottom: 16, fontFamily: "'JetBrains Mono',monospace" }}>Варианты по бюджету</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          {r.priceOptions.map((opt, i) => (
            <div key={i} style={{ padding: 20, border: i === 1 ? "2px solid #1a1a1a" : "1px solid #e8e8e8", background: "#fff", position: "relative" }}>
              {i === 1 && <div style={{ position: "absolute", top: -1, left: 20, right: 20, height: 3, background: "#1a1a1a" }} />}
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{opt.name}</div>
              <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: "#1a1a1a", marginBottom: 8 }}>{opt.priceFrom}</div>
              <div style={{ fontSize: 13, color: "#666", lineHeight: 1.5 }}>{opt.description}</div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: "#aaa", marginTop: 8 }}>* Все цены ориентировочные. Точная стоимость рассчитывается после бесплатного замера.</p>
      </div>

      {renderCTA(r.nextStep)}
    </div>
  );

  // ============================================================
  // RENDER RESULT — TECH
  // ============================================================
  const renderTechResult = (r: TechQuestionOutput) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <div style={{ padding: 24, background: "#f8faf8", border: "1px solid #d4e5d4" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#2d7a3a", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8, fontFamily: "'JetBrains Mono',monospace" }}>Ответ</div>
        <p style={{ fontSize: 16, lineHeight: 1.7, color: "#333" }}>{r.shortAnswer}</p>
      </div>

      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#999", letterSpacing: 1, textTransform: "uppercase", marginBottom: 12, fontFamily: "'JetBrains Mono',monospace" }}>Варианты решения</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {r.recommendedOptions.map((opt, i) => (
            <div key={i} style={{ padding: 20, border: "1px solid #e8e8e8", background: "#fff" }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{opt.name}</div>
              <div style={{ fontSize: 14, lineHeight: 1.6, color: "#555" }}>{opt.description}</div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#999", letterSpacing: 1, textTransform: "uppercase", marginBottom: 12, fontFamily: "'JetBrains Mono',monospace" }}>Что важно учесть</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {r.whatToConsider.map((item, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ color: "#e6a817", fontSize: 14, marginTop: 1 }}>⚡</span>
              <span style={{ fontSize: 14, lineHeight: 1.6, color: "#555" }}>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {(r.estimatedImpact.heightLoss || r.estimatedImpact.budgetNote) && (
        <div style={{ padding: 20, background: "#f5f5f5", border: "1px solid #e8e8e8" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#999", letterSpacing: 1, textTransform: "uppercase", marginBottom: 12, fontFamily: "'JetBrains Mono',monospace" }}>Ориентиры</div>
          <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
            {r.estimatedImpact.heightLoss && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#aaa", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4, fontFamily: "'JetBrains Mono',monospace" }}>Потеря высоты</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "#333" }}>{r.estimatedImpact.heightLoss}</div>
              </div>
            )}
            {r.estimatedImpact.budgetNote && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#aaa", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4, fontFamily: "'JetBrains Mono',monospace" }}>Бюджет</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "#333" }}>{r.estimatedImpact.budgetNote}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {renderCTA(r.nextStep)}
    </div>
  );

  // ============================================================
  // SHARED CTA
  // ============================================================
  const renderCTA = (nextStep: string) => (
    <div style={{ padding: 32, background: "#1a1a1a", textAlign: "center" }}>
      <h3 style={{ fontSize: 20, fontWeight: 800, color: "#fff", marginBottom: 12 }}>
        Хотите точное решение под вашу комнату?
      </h3>
      <p style={{ fontSize: 14, color: "#888", marginBottom: 8, lineHeight: 1.6 }}>{nextStep}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center", marginBottom: 20 }}>
        {["Бесплатный замер", "Точная смета после осмотра", "Рекомендации по свету и конструкции на месте"].map((b) => (
          <div key={b} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#7dff8a", fontSize: 12 }}>✓</span>
            <span style={{ fontSize: 13, color: "#ccc" }}>{b}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
        <button
          onClick={scrollToContact}
          style={{ ...btnPrimary, background: "#fff", color: "#1a1a1a", width: "auto", padding: "14px 32px" }}
        >
          Записаться на замер →
        </button>
        <button
          onClick={resetForm}
          style={{ ...btnPrimary, background: "transparent", border: "1px solid rgba(255,255,255,.3)", color: "#fff", width: "auto", padding: "14px 24px", fontSize: 13 }}
        >
          Заполнить заново
        </button>
      </div>
    </div>
  );

  // ============================================================
  // TABS
  // ============================================================
  const tabStyle = (isActive: boolean): React.CSSProperties => ({
    flex: 1,
    padding: "14px 20px",
    background: isActive ? "#1a1a1a" : "transparent",
    color: isActive ? "#fff" : "#888",
    border: isActive ? "1px solid #1a1a1a" : "1px solid #ddd",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all .3s",
    fontFamily: "'Inter',sans-serif",
    textAlign: "center" as const,
  });

  // ============================================================
  // MAIN RENDER
  // ============================================================
  return (
    <section
      id="ai-advisor"
      style={{
        padding: "100px clamp(24px,5vw,80px)",
        background: "#f7f7f7",
        borderTop: "1px solid #e8e8e8",
        borderBottom: "1px solid #e8e8e8",
      }}
    >
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 16px",
              background: "#1a1a1a",
              color: "#fff",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase",
              fontFamily: "'JetBrains Mono',monospace",
              marginBottom: 20,
            }}
          >
            ✦ AI-помощник
          </div>
          <h2
            style={{
              fontSize: "clamp(24px,4vw,40px)",
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: -1,
              color: "#1a1a1a",
              marginBottom: 12,
              whiteSpace: "pre-line",
            }}
          >
            {activeTab === "tech"
              ? "Есть вопрос по потолку,\nсвету или конструкции?"
              : "Подберите потолок и освещение\nпод вашу комнату"}
          </h2>
          <p style={{ fontSize: 15, color: "#666", lineHeight: 1.6, maxWidth: 520, margin: "0 auto" }}>
            {activeTab === "tech"
              ? "Опишите ситуацию, и мы покажем понятное решение без сложных технических терминов."
              : "Получите рекомендацию по типу потолка, варианту света, ориентиру по бюджету и тому, что важно учесть до замера."}
          </p>
        </div>

        {/* Tabs — технический вопрос первый */}
        {status === "idle" && (
          <div style={{ display: "flex", gap: 0, marginBottom: 32 }}>
            <button style={tabStyle(activeTab === "tech")} onClick={() => { setActiveTab("tech"); resetForm(); }}>
              💬 Технический вопрос
            </button>
            <button style={tabStyle(activeTab === "room")} onClick={() => { setActiveTab("room"); resetForm(); }}>
              📐 Подбор потолка и света
            </button>
          </div>
        )}

        {/* TECH FORM */}
        {status === "idle" && activeTab === "tech" && (
          <div style={{ background: "#fff", border: "1px solid #e8e8e8", padding: "32px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <label style={labelStyle}>Ваш вопрос *</label>
                <textarea
                  style={{ ...inputStyle, resize: "vertical" as const, minHeight: 100 }}
                  placeholder="Например: Сколько ватт освещения нужно для помещения 20 м2? Какой тип освещения выбрать? Какие светодиодные ленты выбрать?"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                <div>
                  <label style={labelStyle}>Тип помещения <span style={{ color: "#bbb", fontWeight: 400 }}>(необязательно)</span></label>
                  <select style={selectStyle} value={techRoomType} onChange={(e) => setTechRoomType(e.target.value as RoomType | "")}>
                    <option value="">Не указано</option>
                    {ROOM_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Высота потолка, см <span style={{ color: "#bbb", fontWeight: 400 }}>(необязательно)</span></label>
                  <input style={inputStyle} type="number" placeholder="например, 260" min={200} max={600} value={techCeilingHeight} onChange={(e) => setTechCeilingHeight(e.target.value)} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Дополнительные условия <span style={{ color: "#bbb", fontWeight: 400 }}>(необязательно)</span></label>
                <input style={inputStyle} type="text" placeholder="например, есть трубы, эркер, неровные стены..." value={details} onChange={(e) => setDetails(e.target.value)} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                <div>
                  <label style={labelStyle}>Ориентир бюджета <span style={{ color: "#bbb", fontWeight: 400 }}>(необязательно)</span></label>
                  <select style={selectStyle} value={techBudget} onChange={(e) => setTechBudget(e.target.value as BudgetLevel | "")}>
                    <option value="">Не указано</option>
                    {BUDGET_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Телефон или Telegram <span style={{ color: "#bbb", fontWeight: 400 }}>(необязательно)</span></label>
                  <input style={inputStyle} type="text" placeholder="для отправки результата" value={techContact} onChange={(e) => setTechContact(e.target.value)} />
                </div>
              </div>
            </div>
            <button
              style={{ ...btnPrimary, marginTop: 24 }}
              onClick={handleTechSubmit}
              disabled={!question.trim() || question.trim().length < 5}
              onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = "#333"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#1a1a1a"; }}
            >
              ✦ Получить ответ →
            </button>
          </div>
        )}

        {/* ROOM FORM */}
        {status === "idle" && activeTab === "room" && (
          <div style={{ background: "#fff", border: "1px solid #e8e8e8", padding: "32px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div>
                <label style={labelStyle}>Тип помещения *</label>
                <select style={selectStyle} value={roomType} onChange={(e) => setRoomType(e.target.value as RoomType)}>
                  {ROOM_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Площадь, м² *</label>
                <input style={inputStyle} type="number" placeholder="например, 18" min={1} max={500} value={area} onChange={(e) => setArea(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Высота потолка, см *</label>
                <input style={inputStyle} type="number" placeholder="например, 270" min={200} max={600} value={ceilingHeight} onChange={(e) => setCeilingHeight(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Что важнее всего</label>
                <select style={selectStyle} value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                  {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Какой свет хотите</label>
                <select style={selectStyle} value={lightingNeed} onChange={(e) => setLightingNeed(e.target.value as LightingNeed)}>
                  {LIGHTING_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Что беспокоит</label>
                <select style={selectStyle} value={concern} onChange={(e) => setConcern(e.target.value as Concern)}>
                  {CONCERN_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Ориентир бюджета</label>
                <select style={selectStyle} value={budget} onChange={(e) => setBudget(e.target.value as BudgetLevel)}>
                  {BUDGET_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Телефон или Telegram <span style={{ color: "#bbb", fontWeight: 400 }}>(необязательно)</span></label>
                <input style={inputStyle} type="text" placeholder="для отправки результата" value={contact} onChange={(e) => setContact(e.target.value)} />
              </div>
            </div>
            <button
              style={{ ...btnPrimary, marginTop: 24 }}
              onClick={handleRoomSubmit}
              disabled={!area || !ceilingHeight || parseFloat(area) < 1 || parseFloat(ceilingHeight) < 200}
              onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = "#333"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#1a1a1a"; }}
            >
              ✦ Подобрать решение →
            </button>
          </div>
        )}

        {/* LOADING */}
        {status === "loading" && (
          <div style={{ textAlign: "center", padding: "80px 32px", background: "#fff", border: "1px solid #e8e8e8" }}>
            <div style={{ fontSize: 32, marginBottom: 16, animation: "spin 2s linear infinite" }}>✦</div>
            <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
            <p style={{ fontSize: 16, fontWeight: 600, color: "#1a1a1a", marginBottom: 8 }}>Подбираем решение...</p>
            <p style={{ fontSize: 14, color: "#888" }}>Обычно это занимает 5–15 секунд</p>
          </div>
        )}

        {/* ERROR */}
        {status === "error" && (
          <div style={{ textAlign: "center", padding: "48px 32px", background: "#fff", border: "1px solid #e8e8e8" }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>⚠️</div>
            <p style={{ fontSize: 16, fontWeight: 600, color: "#1a1a1a", marginBottom: 8 }}>Не удалось получить рекомендацию</p>
            <p style={{ fontSize: 14, color: "#888", marginBottom: 24 }}>Попробуйте ещё раз или свяжитесь с нами напрямую</p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <button onClick={resetForm} style={{ ...btnPrimary, width: "auto", padding: "12px 24px" }}>Попробовать ещё раз</button>
              <button onClick={scrollToContact} style={{ ...btnPrimary, width: "auto", padding: "12px 24px", background: "transparent", color: "#1a1a1a", border: "2px solid #1a1a1a" }}>Связаться напрямую</button>
            </div>
          </div>
        )}

        {/* SUCCESS */}
        {status === "success" && result && (
          <div>
            {result.scenario === "room-selection"
              ? renderRoomResult(result as RoomSelectionOutput)
              : renderTechResult(result as TechQuestionOutput)
            }
          </div>
        )}
      </div>
    </section>
  );
}
