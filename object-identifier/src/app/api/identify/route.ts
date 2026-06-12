import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Tipos ──────────────────────────────────────────────────────────────────
interface Citation { type: string; url?: string; title?: string; }

interface LensMatch { title?: string; link?: string; source?: string; thumbnail?: string; }

interface Identification {
  descripcion: string;
  categoria:   string;
  marca:       string;
  modelo:      string;
  confianza:   "alta" | "media" | "baja";
  referencias: { titulo: string; url: string }[];
}

interface MarketInfo {
  objeto:      string;
  rango_precio:string;
  demanda:     string;
  justificacion:string;
  advertencia?: string;
  fuentes:     { titulo: string; url: string }[];
}

// ── Helpers externos ───────────────────────────────────────────────────────

/** Sube la imagen a ImgBB y devuelve su URL pública, o null si falla. */
async function uploadToImgBB(buffer: Buffer): Promise<string | null> {
  const key = process.env.IMGBB_KEY;
  if (!key) return null;
  try {
    const form = new FormData();
    form.append("image", buffer.toString("base64"));
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${key}`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data?.url ?? null;
  } catch { return null; }
}

/** Llama a SerpApi Google Lens con una URL pública. Devuelve las coincidencias visuales. */
async function googleLensSearch(imageUrl: string): Promise<LensMatch[]> {
  const key = process.env.SERPAPI_KEY;
  if (!key) return [];
  try {
    const params = new URLSearchParams({
      engine:  "google_lens",
      url:     imageUrl,
      api_key: key,
    });
    const res = await fetch(`https://serpapi.com/search.json?${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.visual_matches) ? data.visual_matches.slice(0, 6) : [];
  } catch { return []; }
}

// ── Handler principal ──────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("image") as File | null;
  if (!file) return NextResponse.json({ error: "No se recibió ninguna imagen" }, { status: 400 });

  const arrayBuf  = await file.arrayBuffer();
  const buffer    = Buffer.from(arrayBuf);
  const base64    = buffer.toString("base64");
  const mediaType = file.type as "image/jpeg" | "image/png" | "image/gif" | "image/webp";

  // ── 1. Búsqueda inversa con SerpApi (opcional, falla elegantemente) ──────
  let lensMatches: LensMatch[] = [];
  let referencias: { titulo: string; url: string }[] = [];

  const imageUrl = await uploadToImgBB(buffer);
  if (imageUrl) {
    lensMatches = await googleLensSearch(imageUrl);
    referencias = lensMatches
      .filter(m => m.link && m.title)
      .slice(0, 2)
      .map(m => ({ titulo: m.title!, url: m.link! }));
  }

  // ── 2. Identificación final con Claude ────────────────────────────────────
  const candidatosTexto = lensMatches.length > 0
    ? `\n\nResultados de búsqueda inversa de imagen (úsalos como pistas, no los inventes si no encajan):\n` +
      lensMatches.slice(0, 5).map((m, i) => `${i + 1}. ${m.title ?? "(sin título)"} — ${m.source ?? ""}`).join("\n")
    : "";

  const identifyMsg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
        {
          type: "text",
          text: `Identifica el objeto principal de esta imagen.${candidatosTexto}

Devuelve ÚNICAMENTE un JSON válido con esta estructura, sin texto antes ni después:
{
  "descripcion": "2-3 oraciones describiendo el objeto en español",
  "categoria": "categoría general (ej: electrónica, ropa, mueble, herramienta...)",
  "marca": "marca si es visible o reconocible, o 'Desconocida'",
  "modelo": "modelo específico si lo sabes, o 'Desconocido'",
  "confianza": "alta | media | baja"
}`,
        },
      ],
    }],
  });

  // Parsear JSON de identificación
  let identification: Identification = {
    descripcion:  "",
    categoria:    "Objeto",
    marca:        "Desconocida",
    modelo:       "Desconocido",
    confianza:    "media",
    referencias,
  };

  const rawText = identifyMsg.content[0]?.type === "text" ? identifyMsg.content[0].text : "";
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      identification = { ...identification, ...parsed, referencias };
    } catch { identification.descripcion = rawText; }
  } else {
    identification.descripcion = rawText;
  }

  // ── 3. Búsqueda de precio y demanda con web search ────────────────────────
  const objectName = [identification.marca, identification.modelo, identification.categoria]
    .filter(v => v && v !== "Desconocida" && v !== "Desconocido")
    .join(" ") || identification.descripcion.slice(0, 80);

  const searchMsg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    tools: [{
      type: "web_search_20250305" as "web_search_20250305",
      name: "web_search",
    }],
    messages: [{
      role: "user",
      content: `El objeto identificado es: "${objectName}".

Busca en internet el precio de reventa de segunda mano en euros (Wallapop, eBay España, Vinted, Milanuncios, etc.) y el nivel de demanda actual.

Devuelve ÚNICAMENTE un JSON válido, sin texto adicional:
{
  "objeto": "nombre del objeto",
  "rango_precio": "X€ - Y€ (o 'Sin datos fiables' si no encuentras información)",
  "demanda": "Alta | Media | Baja | Sin datos",
  "justificacion": "1-2 frases explicando precio y demanda",
  "advertencia": "null o una frase si hay poca info fiable o mucha variación"
}`,
    }],
  });

  let marketInfo: MarketInfo = {
    objeto:       objectName,
    rango_precio: "Sin datos",
    demanda:      "Sin datos",
    justificacion:"",
    fuentes:      [],
  };

  const sources: { titulo: string; url: string }[] = [];

  for (const block of searchMsg.content) {
    if (block.type === "text") {
      if ("citations" in block && Array.isArray(block.citations)) {
        for (const c of block.citations as Citation[]) {
          if (c.url && !sources.find(s => s.url === c.url))
            sources.push({ titulo: c.title || c.url, url: c.url });
        }
      }
      const match = block.text.trim().match(/\{[\s\S]*\}/);
      if (match) {
        try { marketInfo = { ...JSON.parse(match[0]), fuentes: [] }; } catch { /* ignorar */ }
      }
    }
  }

  marketInfo.fuentes = sources;

  return NextResponse.json({
    result:     identification.descripcion,
    identification,
    market:     marketInfo,
  });
}
