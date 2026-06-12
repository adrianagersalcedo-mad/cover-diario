import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface Citation { type: string; url?: string; title?: string; }

export interface ProductAnalysis {
  producto:          string;
  precio_actual:     string;
  comparativa_precio: { tienda: string; precio: string }[];
  valoracion: {
    nota:              string;
    num_resenas:       string;
    resumen_positivo:  string;
    resumen_negativo:  string;
  };
  alternativas:       { nombre: string; motivo: string }[];
  ciclo_de_vida: {
    esperar: boolean;
    motivo:  string;
  };
  momento_compra:    string;
  advertencia:       string | null;
  fuentes:           { titulo: string; url: string }[];
}

export async function POST(req: NextRequest) {
  const { url } = await req.json();
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "Falta la URL del producto" }, { status: 400 });
  }

  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 3000,
    tools: [{ type: "web_search_20250305" as "web_search_20250305", name: "web_search" }],
    messages: [{
      role: "user",
      content: `Analiza este producto para ayudar a alguien a decidir si comprarlo: ${url}

Busca en internet información sobre este producto (precio, reseñas, alternativas, ciclo de vida del modelo) y devuelve ÚNICAMENTE un JSON válido con esta estructura exacta, sin texto antes ni después:

{
  "producto": "nombre completo y modelo identificado",
  "precio_actual": "precio en la tienda del enlace o 'No encontrado'",
  "comparativa_precio": [
    { "tienda": "nombre tienda", "precio": "precio€" }
  ],
  "valoracion": {
    "nota": "X/5 estrellas o X/10 (si no encuentras: 'Sin datos')",
    "num_resenas": "número aproximado de reseñas (si no encuentras: 'Sin datos')",
    "resumen_positivo": "1 frase con lo mejor según reseñas",
    "resumen_negativo": "1 frase con lo peor según reseñas"
  },
  "alternativas": [
    { "nombre": "nombre del producto alternativo", "motivo": "por qué es mejor o más barato" }
  ],
  "ciclo_de_vida": {
    "esperar": true o false,
    "motivo": "razón para esperar o no (modelo nuevo, sucesor próximo, etc.)"
  },
  "momento_compra": "¿hay Black Friday, Prime Day u otra rebaja relevante próxima? ¿o es buen momento ya?",
  "advertencia": null o "aviso si hay poca información fiable o el producto es difícil de analizar"
}

IMPORTANTE: Si no encuentras datos fiables sobre algo, di 'Sin datos' en ese campo. No inventes precios ni valoraciones.

// TODO: En el futuro se podría conectar aquí una API de historial de precios
// (ej: Keepa para Amazon, CamelCamelCamel) para mostrar la evolución del precio
// y detectar si el precio actual es alto, bajo o normal históricamente.`,
    }],
  });

  const sources: { titulo: string; url: string }[] = [];
  let analysis: Partial<ProductAnalysis> = {};

  for (const block of msg.content) {
    if (block.type === "text") {
      if ("citations" in block && Array.isArray(block.citations)) {
        for (const c of block.citations as Citation[]) {
          if (c.url && !sources.find(s => s.url === c.url))
            sources.push({ titulo: c.title || c.url, url: c.url });
        }
      }
      const match = block.text.trim().match(/\{[\s\S]*\}/);
      if (match) {
        try { analysis = JSON.parse(match[0]); } catch { /* ignorar */ }
      }
    }
  }

  const result: ProductAnalysis = {
    producto:          analysis.producto          ?? "Producto no identificado",
    precio_actual:     analysis.precio_actual     ?? "Sin datos",
    comparativa_precio:analysis.comparativa_precio?? [],
    valoracion:        analysis.valoracion        ?? { nota: "Sin datos", num_resenas: "Sin datos", resumen_positivo: "Sin datos", resumen_negativo: "Sin datos" },
    alternativas:      analysis.alternativas      ?? [],
    ciclo_de_vida:     analysis.ciclo_de_vida     ?? { esperar: false, motivo: "Sin datos" },
    momento_compra:    analysis.momento_compra    ?? "Sin datos",
    advertencia:       analysis.advertencia       ?? null,
    fuentes:           sources,
  };

  return NextResponse.json(result);
}
