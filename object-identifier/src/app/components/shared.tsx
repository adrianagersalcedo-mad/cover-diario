"use client";
import React from "react";

// ── Paleta compartida ──────────────────────────────────────────────────────
export const C = {
  ink:    "#2A2113",
  mut:    "#988353",
  bg:     "#FFF8E6",
  line:   "#F1E4B8",
  vio:    "#B4690E",
  grad:   "linear-gradient(120deg,#FFC53D 0%,#FFA31F 52%,#FF8A2B 100%)",
  ok:     "#23C16B",
  rose:   "#FB4E78",
  roset:  "#FFE7ED",
  softbg: "#FFF1CC",
};

// ── Estilos compartidos ────────────────────────────────────────────────────
export const S: Record<string, React.CSSProperties> = {
  stepperWrap: { width: "100%", maxWidth: 480, marginBottom: 24 },
  stepperTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  stepperChip: {
    display: "inline-flex", alignItems: "center", gap: 6,
    background: "#FFF4D2", border: `1px solid #F1E4B8`,
    padding: "7px 13px", borderRadius: 99, fontSize: 13, fontWeight: 700, color: "#B4690E",
  },
  seg: { height: 7, borderRadius: 99, flex: 1, background: "#F1E4B8", overflow: "hidden" },
  segFill: { height: "100%", borderRadius: 99, background: "linear-gradient(120deg,#FFC53D 0%,#FFA31F 52%,#FF8A2B 100%)" },
  node: { width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 },
  card: {
    width: "100%", maxWidth: 480, background: "#fff", borderRadius: 30, overflow: "hidden",
    boxShadow: "0 2px 0 rgba(255,255,255,.6) inset, 0 40px 80px -40px rgba(176,105,20,.38), 0 8px 24px -16px rgba(176,105,20,.30)",
    padding: "40px 36px", position: "relative",
  },
  h1: { fontFamily: "var(--font-space)", fontSize: 36, lineHeight: 1.12, fontWeight: 700, letterSpacing: "-.02em", color: "#2A2113", margin: "0 0 10px" },
  sub: { color: "#988353", fontSize: 15, lineHeight: 1.5, margin: "0 0 22px" },
  bodyText: { fontSize: 15, lineHeight: 1.6, color: "#4A3C22", marginBottom: 16 },
  ghostBtn: {
    padding: "0 20px", height: 56, borderRadius: 16, border: `1.5px solid #F1E4B8`,
    background: "transparent", color: "#988353", fontSize: 15, fontWeight: 600,
    cursor: "pointer", fontFamily: "var(--font-hanken)", whiteSpace: "nowrap",
  },
  softBtn: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    height: 52, borderRadius: 14, border: "none", background: "#FFF1CC",
    color: "#B4690E", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-hanken)",
  },
  warning: { padding: "10px 14px", background: "#FFFBE6", border: "1px solid #FFE066", borderRadius: 10, fontSize: 13, color: "#7A5C00", marginTop: 10 },
  slot: {
    display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: 220,
    borderRadius: 22, border: `2px dashed #F0D98C`, background: "linear-gradient(180deg,#FFFDF4,#FFF5D8)",
    cursor: "pointer", marginBottom: 20, overflow: "hidden", transition: "border-color .2s, transform .15s",
  },
  slotFilled: { border: `2px solid #FFC53D` },
  captureBtn: {
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    padding: "22px 12px", borderRadius: 18, border: `2px dashed #F0D98C`,
    background: "linear-gradient(180deg,#FFFDF4,#FFF5D8)", cursor: "pointer", color: "#2A2113",
    transition: "border-color .2s, transform .15s", gap: 2,
  },
  previewImg: { width: "100%", height: "100%", objectFit: "contain" },
  thumbImg: { width: "100%", height: 160, objectFit: "contain", borderRadius: 14, background: "#FFFDF4", marginBottom: 14 },
};

// ── Componentes compartidos ────────────────────────────────────────────────
export function Card({ children }: { children: React.ReactNode }) {
  return <div style={S.card}>{children}</div>;
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, letterSpacing: ".06em", textTransform: "uppercase", fontWeight: 700, color: C.vio, marginBottom: 12 }}>
      {children}
    </div>
  );
}

export function GradBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      width: "100%", height: 56, borderRadius: 16,
      background: disabled ? "#F1E4B8" : C.grad,
      color: disabled ? C.mut : C.ink,
      fontWeight: 800, fontSize: 16, border: "none", cursor: disabled ? "not-allowed" : "pointer",
      fontFamily: "var(--font-hanken)", boxShadow: disabled ? "none" : "0 14px 28px -12px rgba(255,150,30,.65)",
      transition: "transform .15s, box-shadow .2s",
    }}>{children}</button>
  );
}

export function NavRow({ onBack, onNext, nextLabel = "Siguiente →", nextDisabled = false }:
  { onBack: () => void; onNext: () => void; nextLabel?: string; nextDisabled?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
      <button onClick={onBack} style={S.ghostBtn}>← Atrás</button>
      <GradBtn onClick={onNext} disabled={nextDisabled}>{nextLabel}</GradBtn>
    </div>
  );
}

export function QuestionRow({ label, options, labels, value, onChange }:
  { label: string; options: string[]; labels: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <p style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginBottom: 10 }}>{label}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {options.map((opt, i) => (
          <button key={opt} onClick={() => onChange(opt)} style={{
            padding: "10px 18px", borderRadius: 99, fontSize: 14, cursor: "pointer",
            fontFamily: "var(--font-hanken)", fontWeight: value === opt ? 800 : 500,
            background: value === opt ? C.grad : "#fff", color: value === opt ? C.ink : C.mut,
            border: value === opt ? "none" : `1.5px solid ${C.line}`,
            boxShadow: value === opt ? "0 6px 14px -6px rgba(255,150,30,.5)" : "none",
            transition: "all .15s",
          }}>{labels[i]}</button>
        ))}
      </div>
    </div>
  );
}

export function MetricCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ background: "#FFF9ED", borderRadius: 14, padding: "14px 16px", border: `1px solid ${C.line}` }}>
      <p style={{ fontSize: 11, color: C.mut, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 18, fontWeight: 800, color: accent || C.ink, fontFamily: "var(--font-space)" }}>{value}</p>
    </div>
  );
}

export function Chip({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      background: accent ? "#E6F8EF" : "#FFF4D2",
      border: `1px solid ${accent ? "#A3E2C0" : C.line}`,
      padding: "7px 14px", borderRadius: 99, fontSize: 13, fontWeight: 700, color: accent ? C.ok : C.vio,
    }}>{children}</span>
  );
}

export function ErrorBox({ msg }: { msg: string }) {
  return (
    <div style={{ margin: "12px 0", padding: "12px 14px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, fontSize: 13, color: "#B91C1C" }}>
      {msg}
    </div>
  );
}

export function Stepper({ step, steps }: { step: number; steps: string[] }) {
  const pct = Math.round(((step - 1) / (steps.length - 1)) * 100);
  return (
    <div style={S.stepperWrap}>
      <div style={S.stepperTop}>
        <div style={S.stepperChip}><BoltIcon /> Paso {step} de {steps.length}</div>
        <span style={{ fontWeight: 700, fontSize: 14, color: C.vio, fontFamily: "var(--font-space)" }}>{pct}%</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {steps.map((_, i) => (
          <div key={i} style={S.seg}>
            <div style={{ ...S.segFill, width: i < step - 1 ? "100%" : i === step - 1 ? "55%" : "0%", transition: "width 0.4s ease" }} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
        {steps.map((label, i) => {
          const done = i < step - 1, active = i === step - 1;
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, width: 64 }}>
              <div style={{ ...S.node, background: done ? C.grad : active ? "#fff" : "#FBEFC4", color: done ? C.ink : active ? C.vio : C.mut, border: active ? `2px solid ${C.vio}` : "none" }}>
                {done ? <CheckIcon /> : i + 1}
              </div>
              <span style={{ fontSize: 10, fontWeight: active || done ? 700 : 600, letterSpacing: ".04em", color: active ? C.ink : C.mut }}>{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function VeredictoBig({ titulo, motivo, emoji, color, bg, chips, onReset, resetLabel }:
  { titulo: string; motivo: string; emoji: string; color: string; bg: string; chips?: React.ReactNode; onReset: () => void; resetLabel: string }) {
  return (
    <div style={{ ...S.card, textAlign: "center", padding: "40px 36px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 5, background: C.grad }} />
      <div style={{ position: "relative", width: 108, height: 108, margin: "0 auto 20px" }}>
        <div className="anim-burst" style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `2px solid ${color}` }} />
        <div className="anim-pop anim-glow" style={{ width: 108, height: 108, borderRadius: "50%", background: bg, color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 50 }}>{emoji}</div>
      </div>
      <p className="anim-rise" style={{ fontSize: 12, letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 800, color, animationDelay: ".12s" }}>El veredicto</p>
      <h1 className="anim-rise" style={{ fontFamily: "var(--font-space)", fontSize: 54, lineHeight: 1.05, fontWeight: 700, letterSpacing: "-.02em", margin: "8px 0 14px", color, animationDelay: ".18s" }}>{titulo}</h1>
      <p className="anim-rise" style={{ fontSize: 17, lineHeight: 1.5, color: "#4A3C22", maxWidth: 360, margin: "0 auto 24px", animationDelay: ".26s" }}>{motivo}</p>
      {chips && <div className="anim-rise" style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 24, animationDelay: ".34s", flexWrap: "wrap" }}>{chips}</div>}
      <button className="anim-rise" onClick={onReset} style={{ ...S.softBtn, width: "100%", animationDelay: ".42s" }}>🔄 {resetLabel}</button>
    </div>
  );
}

// ── Iconos compartidos ─────────────────────────────────────────────────────
const I = (p: React.SVGProps<SVGSVGElement>) => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" {...p} />
);
export const CheckIcon   = () => <I width={13} height={13}><path d="M4.5 12.5l5 5 10-11"/></I>;
export const SparkleIcon = () => <I width={16} height={16}><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/></I>;
export const BoltIcon    = () => <I width={14} height={14}><path d="M13 2L4.5 13.5H11L10 22l8.5-11.5H13L13 2z"/></I>;
export const CameraIcon  = ({ size = 32 }: { size?: number }) => <I width={size} height={size} strokeWidth={1.8}><path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2L8 5h8l1.5 2h2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z"/><circle cx="12" cy="13" r="3.4"/></I>;
export const GalleryIcon = ({ size = 32 }: { size?: number }) => <I width={size} height={size} strokeWidth={1.8}><rect x="3" y="4.5" width="18" height="15" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M21 16l-5-4.5L7 19"/></I>;
