"use client";

import { useState } from "react";
import { C } from "./components/shared";
import SellTab from "./components/SellTab";
import BuyTab  from "./components/BuyTab";

type Tab = "sell" | "buy";

export default function Home() {
  const [active, setActive] = useState<Tab>("sell");

  return (
    <div style={{ minHeight: "100dvh", background: "linear-gradient(165deg,#FFF0C2 0%,#FFE08A 40%,#FFD166 100%)", padding: "24px 16px 60px" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <p style={{ fontFamily: "var(--font-space)", fontSize: 13, fontWeight: 800, letterSpacing: ".18em", textTransform: "uppercase", color: C.vio, marginBottom: 4 }}>
          IA para tus decisiones
        </p>
        <h1 style={{ fontFamily: "var(--font-space)", fontSize: 26, fontWeight: 700, color: C.ink, letterSpacing: "-.02em", lineHeight: 1.15 }}>
          ¿Lo guardo o lo vendo?
        </h1>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
        <div style={{
          display: "flex", background: "rgba(255,255,255,.55)", borderRadius: 99,
          padding: 5, gap: 4, boxShadow: "0 2px 12px rgba(176,105,20,.18)",
        }}>
          <TabBtn label="🏷️ ¿Lo vendo?" active={active === "sell"} onClick={() => setActive("sell")} />
          <TabBtn label="🛒 ¿Lo compro?" active={active === "buy"}  onClick={() => setActive("buy")}  />
        </div>
      </div>

      {/* Both tabs mounted; inactive one hidden */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ width: "100%", display: active === "sell" ? "flex" : "none", flexDirection: "column", alignItems: "center" }}>
          <SellTab />
        </div>
        <div style={{ width: "100%", display: active === "buy" ? "flex" : "none", flexDirection: "column", alignItems: "center" }}>
          <BuyTab />
        </div>
      </div>
    </div>
  );
}

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: "10px 22px", borderRadius: 99, fontSize: 14,
      fontFamily: "var(--font-hanken)", fontWeight: active ? 800 : 600,
      background: active ? "linear-gradient(120deg,#FFC53D 0%,#FFA31F 52%,#FF8A2B 100%)" : "transparent",
      color: active ? C.ink : C.mut,
      border: "none", cursor: "pointer",
      boxShadow: active ? "0 6px 16px -6px rgba(255,150,30,.55)" : "none",
      transition: "all .2s",
    }}>{label}</button>
  );
}
