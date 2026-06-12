"use client";

import { useState } from "react";
import { C, S, Card, Eyebrow, GradBtn, NavRow, QuestionRow, Chip, ErrorBox, Stepper, VeredictoBig, SparkleIcon } from "./shared";
import type { ProductAnalysis } from "../api/analyze-product/route";

// ── Tipos ──────────────────────────────────────────────────────────────────
interface BuyAnswers {
  necesidad: "necesidad" | "capricho" | "entremedias" | "";
  tienes:    "no" | "sí, pero peor" | "sí, parecido" | "";
  permite:   "sí" | "justo" | "no" | "";
}
interface BuyVeredicto { titulo: string; motivo: string; emoji: string; color: string; bg: string; }

// ── Lógica de veredicto (puro JS, sin API) ────────────────────────────────
function calcularVeredictoBuy(a: BuyAnswers, analysis: ProductAnalysis): BuyVeredicto {
  const esperar   = analysis.ciclo_de_vida?.esperar === true;
  const necesidad = a.necesidad === "necesidad";
  const capricho  = a.necesidad === "capricho";
  const puedeNo   = a.permite === "no";
  const puedeJusto= a.permite === "justo";
  const tieneAlgo = a.tienes !== "no";

  // 1. Hay modelo nuevo inminente → Espera siempre
  if (esperar)
    return { titulo: "Espera", motivo: analysis.ciclo_de_vida.motivo || "Hay un modelo nuevo o sucesor próximo.", emoji: "⏳", color: C.vio, bg: "#FFF1CC" };

  // 2. No te lo puedes permitir
  if (puedeNo) {
    if (necesidad)
      return { titulo: "Cómpralo 2ª mano", motivo: "Lo necesitas pero ajusta el presupuesto: busca reacondicionado o segunda mano.", emoji: "♻️", color: "#3B8EF0", bg: "#E6F0FD" };
    return { titulo: "No lo compres", motivo: "Es un capricho que ahora mismo no cabe en tu presupuesto.", emoji: "🛑", color: "#E24B4A", bg: "#FEF2F2" };
  }

  // 3. Lo necesitas y puedes permitírtelo
  if (necesidad && !puedeJusto)
    return { titulo: "Cómpralo", motivo: "Lo necesitas y te lo puedes permitir sin agobio. Adelante.", emoji: "✅", color: C.ok, bg: "#E6F8EF" };

  // 4. Capricho y ya tienes algo parecido
  if (capricho && a.tienes === "sí, parecido")
    return { titulo: "No lo compres", motivo: "Ya tienes algo parecido y es un capricho. Guarda ese dinero.", emoji: "🛑", color: "#E24B4A", bg: "#FEF2F2" };

  // 5. Presupuesto justo → segunda mano
  if (puedeJusto)
    return { titulo: "Cómpralo 2ª mano", motivo: "Con presupuesto ajustado, busca reacondicionado para ahorrar 20-40%.", emoji: "♻️", color: "#3B8EF0", bg: "#E6F0FD" };

  // 6. Capricho sin tener nada parecido y puedes → adelante
  if (capricho && !tieneAlgo)
    return { titulo: "Cómpralo", motivo: "No lo necesitas, pero puedes permitírtelo y no tienes nada parecido.", emoji: "✅", color: C.ok, bg: "#E6F8EF" };

  // 7. Entremedias, ya tiene algo pero peor
  if (a.tienes === "sí, pero peor")
    return { titulo: "Cómpralo", motivo: "Lo que tienes ya se queda corto. Vale la pena el salto.", emoji: "✅", color: C.ok, bg: "#E6F8EF" };

  return { titulo: "Cómpralo", motivo: "El análisis es favorable. Adelante.", emoji: "✅", color: C.ok, bg: "#E6F8EF" };
}

const STEPS = ["URL", "Análisis", "Preguntas", "Veredicto"];

// ── Componente ─────────────────────────────────────────────────────────────
export default function BuyTab() {
  const [step, setStep]           = useState(1);
  const [url, setUrl]             = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [analysis, setAnalysis]   = useState<ProductAnalysis | null>(null);
  const [answers, setAnswers]     = useState<BuyAnswers>({ necesidad: "", tienes: "", permite: "" });
  const [veredicto, setVeredicto] = useState<BuyVeredicto | null>(null);

  function resetAll() {
    setStep(1); setUrl(""); setAnalysis(null); setError(null);
    setAnswers({ necesidad: "", tienes: "", permite: "" }); setVeredicto(null);
  }

  async function handleAnalyze() {
    if (!url.trim()) return;
    setLoading(true); setError(null);
    try {
      const res  = await fetch("/api/analyze-product", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: url.trim() }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al analizar");
      setAnalysis(data); setStep(2);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Error al analizar"); }
    finally { setLoading(false); }
  }

  function handleVeredicto() {
    if (!analysis) return;
    setVeredicto(calcularVeredictoBuy(answers, analysis)); setStep(4);
  }

  const answersOk = answers.necesidad !== "" && answers.tienes !== "" && answers.permite !== "";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
      {step < 4 && <Stepper step={step} steps={STEPS} />}

      {/* Paso 1: URL */}
      {step === 1 && (
        <Card>
          <Eyebrow><SparkleIcon /> Pega el enlace</Eyebrow>
          <h1 style={S.h1}>¿Vale la pena<br />comprarlo?</h1>
          <p style={S.sub}>Pega la URL del producto y analizamos precio, reseñas, alternativas y si es buen momento.</p>

          <div style={{ marginBottom: 20 }}>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAnalyze()}
              placeholder="https://www.amazon.es/producto..."
              style={{
                width: "100%", height: 52, padding: "0 16px", borderRadius: 14,
                border: `2px solid ${url ? "#FFC53D" : C.line}`,
                background: "#FFFDF4", fontSize: 14, color: C.ink,
                fontFamily: "var(--font-hanken)", outline: "none",
                transition: "border-color .2s",
              }}
            />
            <p style={{ fontSize: 12, color: C.mut, marginTop: 8 }}>
              Compatible con Amazon, PcComponentes, MediaMarkt, El Corte Inglés, etc.
            </p>
          </div>

          {error && <ErrorBox msg={error} />}
          <GradBtn onClick={handleAnalyze} disabled={!url.trim() || loading}>
            {loading ? "Investigando el producto…" : <><SparkleIcon /> Analizar producto</>}
          </GradBtn>
        </Card>
      )}

      {/* Paso 2: Análisis */}
      {step === 2 && analysis && (
        <Card>
          <Eyebrow>Producto analizado</Eyebrow>
          <h1 style={{ ...S.h1, fontSize: 22, marginBottom: 4 }}>{analysis.producto}</h1>
          {analysis.advertencia && <div style={{ ...S.warning, marginBottom: 16 }}>⚠️ {analysis.advertencia}</div>}

          {/* Precio */}
          <Section title="💶 Precio">
            <div style={{ display: "grid", gridTemplateColumns: analysis.comparativa_precio.length > 0 ? "1fr 1fr" : "1fr", gap: 10 }}>
              <PriceCard label="Precio encontrado" value={analysis.precio_actual} highlight />
              {analysis.comparativa_precio.slice(0, 1).map((p, i) => (
                <PriceCard key={i} label={p.tienda} value={p.precio} />
              ))}
            </div>
            {analysis.comparativa_precio.length > 1 && (
              <div style={{ marginTop: 8 }}>
                {analysis.comparativa_precio.slice(1).map((p, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.ink, padding: "5px 0", borderTop: `1px solid ${C.line}` }}>
                    <span>{p.tienda}</span><span style={{ fontWeight: 700 }}>{p.precio}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Valoración */}
          <Section title="⭐ Valoración">
            <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
              {analysis.valoracion.nota !== "Sin datos" && <Chip accent>{analysis.valoracion.nota}</Chip>}
              {analysis.valoracion.num_resenas !== "Sin datos" && <Chip>{analysis.valoracion.num_resenas} reseñas</Chip>}
            </div>
            {analysis.valoracion.resumen_positivo !== "Sin datos" && <p style={{ fontSize: 13, color: "#166534", background: "#F0FDF4", borderRadius: 8, padding: "8px 12px", marginBottom: 6 }}>👍 {analysis.valoracion.resumen_positivo}</p>}
            {analysis.valoracion.resumen_negativo !== "Sin datos" && <p style={{ fontSize: 13, color: "#991B1B", background: "#FEF2F2", borderRadius: 8, padding: "8px 12px" }}>👎 {analysis.valoracion.resumen_negativo}</p>}
          </Section>

          {/* Ciclo de vida */}
          {analysis.ciclo_de_vida.motivo && analysis.ciclo_de_vida.motivo !== "Sin datos" && (
            <Section title={analysis.ciclo_de_vida.esperar ? "⚠️ Ciclo de vida" : "✅ Ciclo de vida"}>
              <p style={{ fontSize: 13, color: analysis.ciclo_de_vida.esperar ? "#92400E" : "#166534", background: analysis.ciclo_de_vida.esperar ? "#FFFBEB" : "#F0FDF4", borderRadius: 8, padding: "8px 12px" }}>
                {analysis.ciclo_de_vida.motivo}
              </p>
            </Section>
          )}

          {/* Alternativas */}
          {analysis.alternativas.length > 0 && (
            <Section title="🔄 Alternativas">
              {analysis.alternativas.map((alt, i) => (
                <div key={i} style={{ fontSize: 13, padding: "8px 0", borderTop: i > 0 ? `1px solid ${C.line}` : "none" }}>
                  <span style={{ fontWeight: 700, color: C.ink }}>{alt.nombre}</span>
                  <span style={{ color: C.mut }}> — {alt.motivo}</span>
                </div>
              ))}
            </Section>
          )}

          {/* Momento compra */}
          {analysis.momento_compra && analysis.momento_compra !== "Sin datos" && (
            <Section title="📅 Momento de compra">
              <p style={{ fontSize: 13, color: C.ink }}>{analysis.momento_compra}</p>
            </Section>
          )}

          {/* Fuentes */}
          {analysis.fuentes.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 11, color: C.mut, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 6 }}>Fuentes</p>
              {analysis.fuentes.slice(0, 4).map((f, i) => (
                <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" style={{ display: "block", fontSize: 12, color: "#2563eb", marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.titulo}</a>
              ))}
            </div>
          )}

          <NavRow onBack={() => setStep(1)} onNext={() => setStep(3)} nextLabel="Siguiente →" />
        </Card>
      )}

      {/* Paso 3: Preguntas */}
      {step === 3 && (
        <Card>
          <Eyebrow>Cuéntanos un poco</Eyebrow>
          <h1 style={{ ...S.h1, fontSize: 26 }}>3 preguntas rápidas</h1>
          <div style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 24 }}>
            <QuestionRow
              label="¿Es una necesidad o un capricho?"
              options={["necesidad", "entremedias", "capricho"]}
              labels={["Necesidad", "Entremedias", "Capricho"]}
              value={answers.necesidad}
              onChange={(v) => setAnswers(a => ({ ...a, necesidad: v as BuyAnswers["necesidad"] }))}
            />
            <QuestionRow
              label="¿Tienes ya algo que cumple esta función?"
              options={["no", "sí, pero peor", "sí, parecido"]}
              labels={["No", "Sí, pero peor", "Sí, parecido"]}
              value={answers.tienes}
              onChange={(v) => setAnswers(a => ({ ...a, tienes: v as BuyAnswers["tienes"] }))}
            />
            <QuestionRow
              label="¿Te lo puedes permitir sin agobio?"
              options={["sí", "justo", "no"]}
              labels={["Sí", "Justo", "No"]}
              value={answers.permite}
              onChange={(v) => setAnswers(a => ({ ...a, permite: v as BuyAnswers["permite"] }))}
            />
          </div>
          <NavRow onBack={() => setStep(2)} onNext={handleVeredicto} nextLabel="Ver veredicto →" nextDisabled={!answersOk} />
        </Card>
      )}

      {/* Paso 4: Veredicto */}
      {step === 4 && veredicto && (
        <VeredictoBig
          {...veredicto}
          chips={analysis && (
            <>
              {analysis.precio_actual !== "Sin datos" && <Chip>{analysis.precio_actual}</Chip>}
              {analysis.ciclo_de_vida.esperar && <Chip>Modelo nuevo próximo</Chip>}
            </>
          )}
          onReset={resetAll}
          resetLabel="Analizar otro producto"
        />
      )}
    </div>
  );
}

// ── Sub-componentes locales ────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: C.mut, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8 }}>{title}</p>
      {children}
    </div>
  );
}

function PriceCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ background: highlight ? "#FFF9ED" : "#F8F8F8", borderRadius: 12, padding: "12px 14px", border: `1px solid ${highlight ? C.line : "#E8E8E8"}` }}>
      <p style={{ fontSize: 11, color: C.mut, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 3 }}>{label}</p>
      <p style={{ fontSize: 17, fontWeight: 800, color: highlight ? C.vio : C.ink, fontFamily: "var(--font-space)" }}>{value}</p>
    </div>
  );
}
