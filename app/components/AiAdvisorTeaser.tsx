// file: app/components/AiAdvisorTeaser.tsx
"use client";

export default function AiAdvisorTeaser() {
  const scrollToAdvisor = () => {
    document.getElementById("ai-advisor")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div
      style={{
        maxWidth: 900,
        margin: "0 auto",
        padding: "32px",
        background: "#fff",
        border: "1px solid #e8e8e8",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 24,
        flexWrap: "wrap",
      }}
    >
      <div style={{ flex: "1 1 300px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 24 }}>✦</span>
          <span
            style={{
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: -0.3,
              color: "#1a1a1a",
            }}
          >
            Не уверены, какой вариант подойдёт?
          </span>
        </div>
        <p style={{ fontSize: 14, color: "#666", lineHeight: 1.6 }}>
          Получите подбор потолка и освещения под вашу комнату. Бесплатно, за 2 минуты.
        </p>
      </div>
      <button
        onClick={scrollToAdvisor}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "14px 28px",
          background: "#1a1a1a",
          color: "#fff",
          border: "none",
          fontSize: 14,
          fontWeight: 600,
          letterSpacing: 0.3,
          cursor: "pointer",
          transition: "all .3s",
          fontFamily: "'Inter',sans-serif",
          whiteSpace: "nowrap",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "#333";
          e.currentTarget.style.transform = "translateY(-1px)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "#1a1a1a";
          e.currentTarget.style.transform = "translateY(0)";
        }}
      >
        ✦ AI-подбор потолка →
      </button>
    </div>
  );
}
