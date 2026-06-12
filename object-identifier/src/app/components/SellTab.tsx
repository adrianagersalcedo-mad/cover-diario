"use client";

import { useState, useRef, useCallback } from "react";
import {
  C, S, Card, Eyebrow, GradBtn, NavRow, QuestionRow, MetricCard,
  Chip, ErrorBox, Stepper, VeredictoBig,
  SparkleIcon, CameraIcon, GalleryIcon,
} from "./shared";

// ── Tipos ──────────────────────────────────────────────────────────────────
interface Identification {
  descripcion: string; categoria: string; marca: string; modelo: string;
  confianza: "alta" | "media" | "baja"; referencias: { titulo: string; url: string }[];
}
interface MarketInfo {
  objeto: string; rango_precio: string; demanda: string; justificacion: string;
  advertencia?: string | null; fuentes: { titulo: string; url: string }[];
}
interface Answers {
  uso: "a menudo" | "a veces" | "casi nunca" | "";
  volverá: "sí" | "no" | "";
  sentimental: "mucho" | "algo" | "nada" | "";
  dinero: "bastante" | "algo" | "no" | "";
}
interface Veredicto { titulo: string; motivo: string; emoji: string; color: string; bg: string; }

// ── Lógica de decisión ────────────────────────────────────────────────────
function calcularVeredicto(a: Answers, demanda: string): Veredicto {
  const noUsa = a.uso === "casi nunca" && a.volverá === "no";
  const buena = demanda === "Alta" || demanda === "Media";
  const dinero = a.dinero === "bastante";

  if (a.uso === "a menudo" || a.sentimental === "mucho")
    return { titulo: "¡Quédatelo!", motivo: a.uso === "a menudo" ? "Lo usas con frecuencia, tiene sentido conservarlo." : "Tiene demasiado valor emocional para soltarlo.", emoji: "💛", color: C.rose, bg: C.roset };
  if (noUsa && buena)
    return { titulo: "Véndelo", motivo: `No lo usas y tiene buena demanda.${dinero ? " Y necesitas el dinero: es el momento." : ""}`, emoji: "💸", color: C.ok, bg: "#E6F8EF" };
  if (noUsa && !buena)
    return { titulo: "Dónalo", motivo: "No lo usas y la demanda es baja. Dale una segunda vida.", emoji: "🎁", color: "#3B8EF0", bg: "#E6F0FD" };
  if (a.sentimental === "algo") {
    if (dinero && buena)
      return { titulo: "Véndelo", motivo: "Valor sentimental moderado y necesitas el dinero. Vale la pena.", emoji: "💸", color: C.ok, bg: "#E6F8EF" };
    return { titulo: "Prueba 90 días", motivo: "Guárdalo 90 días. Si no lo tocas, reconsidera.", emoji: "⏳", color: C.vio, bg: "#FFF1CC" };
  }
  if (dinero && buena)
    return { titulo: "Véndelo", motivo: "Lo usas poco y necesitas el dinero. La demanda acompaña.", emoji: "💸", color: C.ok, bg: "#E6F8EF" };
  return { titulo: "Prueba 90 días", motivo: "El caso no está del todo claro. 90 días y decides.", emoji: "⏳", color: C.vio, bg: "#FFF1CC" };
}

const STEPS = ["Foto", "Identidad", "Preguntas", "Mercado", "Veredicto"];

// ── Componente ─────────────────────────────────────────────────────────────
export default function SellTab() {
  const [step, setStep]                     = useState(1);
  const [preview, setPreview]               = useState<string | null>(null);
  const [result, setResult]                 = useState<string | null>(null);
  const [identification, setIdentification] = useState<Identification | null>(null);
  const [market, setMarket]                 = useState<MarketInfo | null>(null);
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [answers, setAnswers]               = useState<Answers>({ uso: "", volverá: "", sentimental: "", dinero: "" });
  const [veredicto, setVeredicto]           = useState<Veredicto | null>(null);

  const fileRef      = useRef<HTMLInputElement>(null);
  const videoRef     = useRef<HTMLVideoElement>(null);
  const streamRef    = useRef<MediaStream | null>(null);
  const capturedFile = useRef<File | null>(null);
  const [cameraOpen, setCameraOpen]   = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const openCamera = useCallback(async () => {
    setCameraError(null); setCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setTimeout(() => { if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); } }, 100);
    } catch { setCameraError("No se pudo acceder a la cámara. Comprueba los permisos del navegador."); }
  }, []);

  const closeCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null; setCameraOpen(false); setCameraError(null);
  }, []);

  const capturePhoto = useCallback(() => {
    const video = videoRef.current; if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      if (!blob) return;
      capturedFile.current = new File([blob], "captura.jpg", { type: "image/jpeg" });
      setPreview(URL.createObjectURL(blob)); setError(null); closeCamera();
    }, "image/jpeg", 0.92);
  }, [closeCamera]);

  function resetAll() {
    capturedFile.current = null;
    setStep(1); setPreview(null); setResult(null); setIdentification(null); setMarket(null);
    setError(null); setAnswers({ uso: "", volverá: "", sentimental: "", dinero: "" }); setVeredicto(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    capturedFile.current = f; setPreview(URL.createObjectURL(f)); setError(null);
  }

  async function handleIdentify() {
    const f = capturedFile.current ?? fileRef.current?.files?.[0]; if (!f) return;
    setLoading(true); setError(null);
    const fd = new FormData(); fd.append("image", f);
    try {
      const res = await fetch("/api/identify", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error desconocido");
      setResult(data.result); setIdentification(data.identification ?? null); setMarket(data.market ?? null); setStep(2);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Error al identificar"); }
    finally { setLoading(false); }
  }

  function handleVeredicto() {
    if (!market) return;
    setVeredicto(calcularVeredicto(answers, market.demanda)); setStep(5);
  }

  const answersOk = answers.uso !== "" && answers.volverá !== "" && answers.sentimental !== "" && answers.dinero !== "";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
      {step < 5 && <Stepper step={step} steps={STEPS} />}

      {/* Paso 1 */}
      {step === 1 && (
        <Card>
          <Eyebrow><SparkleIcon /> Empieza aquí</Eyebrow>
          <h1 style={S.h1}>Fotografía<br />tu objeto</h1>
          <p style={S.sub}>Haz una foto ahora o elige una de tu galería.</p>

          {preview && <div style={{ ...S.slot, ...S.slotFilled, marginBottom: 12 }}><img src={preview} alt="preview" style={S.previewImg} /></div>}

          {!preview && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
              <button onClick={openCamera} style={S.captureBtn as React.CSSProperties}>
                <CameraIcon /><span style={{ fontSize: 13, fontWeight: 700, marginTop: 6 }}>Hacer foto</span><span style={{ fontSize: 11, color: C.mut }}>Cámara</span>
              </button>
              <label style={S.captureBtn as React.CSSProperties}>
                <GalleryIcon /><span style={{ fontSize: 13, fontWeight: 700, marginTop: 6 }}>Elegir foto</span><span style={{ fontSize: 11, color: C.mut }}>Galería</span>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
              </label>
            </div>
          )}

          {preview && (
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <button onClick={openCamera} style={{ ...S.ghostBtn, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, flex: 1, cursor: "pointer", height: 42, borderRadius: 12, fontSize: 13, border: `1.5px solid ${C.line}`, background: "transparent", fontFamily: "var(--font-hanken)" } as React.CSSProperties}>
                <CameraIcon size={16} /> Repetir
              </button>
              <label style={{ ...S.ghostBtn, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, flex: 1, cursor: "pointer", height: 42, borderRadius: 12, fontSize: 13 } as React.CSSProperties}>
                <GalleryIcon size={16} /> Cambiar
                <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
              </label>
            </div>
          )}

          {cameraOpen && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 100, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20 }}>
              <div style={{ width: "100%", maxWidth: 480, background: "#1a1208", borderRadius: 24, overflow: "hidden" }}>
                {cameraError
                  ? <div style={{ padding: 32, textAlign: "center", color: "#fff" }}><p style={{ marginBottom: 16, fontSize: 15 }}>{cameraError}</p><button onClick={closeCamera} style={{ ...S.ghostBtn, color: "#fff", border: "1.5px solid rgba(255,255,255,.3)" }}>Cerrar</button></div>
                  : <><video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", display: "block", maxHeight: 380, objectFit: "cover" }} /><div style={{ display: "flex", gap: 12, padding: 16 }}><button onClick={closeCamera} style={{ flex: 1, height: 50, borderRadius: 14, border: "1.5px solid rgba(255,255,255,.2)", background: "transparent", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-hanken)" }}>Cancelar</button><button onClick={capturePhoto} style={{ flex: 2, height: 50, borderRadius: 14, border: "none", background: C.grad, color: C.ink, fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "var(--font-hanken)", boxShadow: "0 8px 20px -8px rgba(255,150,30,.7)" }}>📸 Capturar</button></div></>
                }
              </div>
            </div>
          )}

          {error && <ErrorBox msg={error} />}
          <GradBtn onClick={handleIdentify} disabled={!preview || loading}>{loading ? "Analizando…" : <><SparkleIcon /> Identificar objeto</>}</GradBtn>
        </Card>
      )}

      {/* Paso 2 */}
      {step === 2 && result && (
        <Card>
          <Eyebrow>Objeto identificado</Eyebrow>
          <h1 style={{ ...S.h1, fontSize: 26 }}>¿Qué hemos encontrado?</h1>
          {preview && <img src={preview} alt="objeto" style={S.thumbImg} />}
          {identification && (identification.marca !== "Desconocida" || identification.modelo !== "Desconocido") && (
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              {identification.marca !== "Desconocida" && <Chip>{identification.marca}</Chip>}
              {identification.modelo !== "Desconocido" && <Chip>{identification.modelo}</Chip>}
              <Chip accent={identification.confianza === "alta"}>Confianza {identification.confianza}</Chip>
            </div>
          )}
          <p style={S.bodyText}>{result}</p>
          {identification?.referencias && identification.referencias.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, color: C.mut, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 6 }}>Referencias visuales</p>
              {identification.referencias.map((r, i) => (
                <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" style={{ display: "block", fontSize: 13, color: "#2563eb", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>🔗 {r.titulo}</a>
              ))}
            </div>
          )}
          <NavRow onBack={() => setStep(1)} onNext={() => setStep(3)} nextLabel="Siguiente →" />
        </Card>
      )}

      {/* Paso 3 */}
      {step === 3 && (
        <Card>
          <Eyebrow>Cuéntanos un poco</Eyebrow>
          <h1 style={{ ...S.h1, fontSize: 26 }}>4 preguntas rápidas</h1>
          <div style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 24 }}>
            <QuestionRow label="¿Con qué frecuencia lo usas?" options={["a menudo", "a veces", "casi nunca"]} labels={["A menudo", "A veces", "Casi nunca"]} value={answers.uso} onChange={(v) => setAnswers(a => ({ ...a, uso: v as Answers["uso"] }))} />
            <QuestionRow label="¿Crees que lo volverás a usar?" options={["sí", "no"]} labels={["Sí", "No"]} value={answers.volverá} onChange={(v) => setAnswers(a => ({ ...a, volverá: v as Answers["volverá"] }))} />
            <QuestionRow label="¿Tiene valor sentimental?" options={["mucho", "algo", "nada"]} labels={["Mucho", "Algo", "Nada"]} value={answers.sentimental} onChange={(v) => setAnswers(a => ({ ...a, sentimental: v as Answers["sentimental"] }))} />
            <QuestionRow label="¿Necesitas el dinero ahora?" options={["bastante", "algo", "no"]} labels={["Bastante", "Algo", "No"]} value={answers.dinero} onChange={(v) => setAnswers(a => ({ ...a, dinero: v as Answers["dinero"] }))} />
          </div>
          <NavRow onBack={() => setStep(2)} onNext={() => setStep(4)} nextLabel="Siguiente →" nextDisabled={!answersOk} />
        </Card>
      )}

      {/* Paso 4 */}
      {step === 4 && market && (
        <Card>
          <Eyebrow>Análisis de mercado</Eyebrow>
          <h1 style={{ ...S.h1, fontSize: 26 }}>¿Cuánto vale?</h1>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <MetricCard label="Precio estimado" value={market.rango_precio} />
            <MetricCard label="Demanda" value={market.demanda} accent={market.demanda === "Alta" ? C.ok : market.demanda === "Baja" ? "#E24B4A" : C.vio} />
          </div>
          <p style={S.bodyText}>{market.justificacion}</p>
          {market.advertencia && market.advertencia !== "null" && <div style={S.warning}>⚠️ {market.advertencia}</div>}
          {market.fuentes.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 11, color: C.mut, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 6 }}>Fuentes</p>
              {market.fuentes.slice(0, 4).map((f, i) => <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" style={{ display: "block", fontSize: 12, color: "#2563eb", marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.titulo}</a>)}
            </div>
          )}
          <NavRow onBack={() => setStep(3)} onNext={handleVeredicto} nextLabel="Ver veredicto →" />
        </Card>
      )}

      {/* Paso 5 */}
      {step === 5 && veredicto && (
        <VeredictoBig
          {...veredicto}
          chips={market && <><Chip>{market.rango_precio}</Chip><Chip accent={market.demanda === "Alta"}>Demanda {market.demanda}</Chip></>}
          onReset={resetAll}
          resetLabel="Analizar otro objeto"
        />
      )}
    </div>
  );
}
