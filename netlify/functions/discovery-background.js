/**
 * discovery-background.js — Robot de descubrimiento de covers amateur.
 *
 * Función background (hasta 15 min) para poder analizar vídeos con Gemini.
 * Cron diario (ver netlify.toml).
 *
 * Variables de entorno (Netlify → Site config → Environment variables):
 *   YOUTUBE_API_KEY  — YouTube Data API v3
 *   GEMINI_API_KEY   — Google AI Studio (gratis: generativelanguage.googleapis.com)
 *   GITHUB_TOKEN     — Personal Access Token (permisos: Contents read+write)
 *   GITHUB_REPO      — "propietario/repo", ej: adrianagersalcedo-mad/cover-diario
 *   GITHUB_BRANCH    — rama destino, ej: main
 */

'use strict';

const CONFIG = require('./discovery-config');

// ─── YOUTUBE API ───────────────────────────────────────────────────────────────

function ytUrl(endpoint, params) {
  const qs = new URLSearchParams({ key: process.env.YOUTUBE_API_KEY, ...params });
  return `https://www.googleapis.com/youtube/v3/${endpoint}?${qs}`;
}

async function ytGet(endpoint, params) {
  const res = await fetch(ytUrl(endpoint, params));
  if (!res.ok) throw new Error(`YouTube ${endpoint}: HTTP ${res.status}`);
  return res.json();
}

async function searchVideos(query) {
  const params = {
    part: 'id',
    q: query,
    type: 'video',
    videoCategoryId: CONFIG.videoCategoryId,
    videoEmbeddable: 'true',
    maxResults: String(CONFIG.maxResultsPerQuery),
    order: CONFIG.searchOrder || 'date',
  };

  if (CONFIG.publishedAfterDays) {
    const d = new Date(Date.now() - CONFIG.publishedAfterDays * 86400000);
    params.publishedAfter = d.toISOString();
  }

  const data = await ytGet('search', params);
  return (data.items || []).map(i => i.id?.videoId).filter(Boolean);
}

async function enrichVideos(ids) {
  if (!ids.length) return [];
  const data = await ytGet('videos', {
    part: 'snippet,contentDetails,statistics,status',
    id: ids.join(','),
  });
  return data.items || [];
}

// El nº de suscriptores NO viene en videos.list (es un dato de canal).
// Hay que pedirlo a channels.list. Devuelve un Map channelId → subs.
// Si el canal oculta sus subs, queda como null (desconocido, no se filtra).
async function fetchChannelSubs(channelIds) {
  const map = new Map();
  const unique = [...new Set(channelIds.filter(Boolean))];
  for (let i = 0; i < unique.length; i += 50) {
    try {
      const data = await ytGet('channels', {
        part: 'statistics',
        id: unique.slice(i, i + 50).join(','),
      });
      for (const ch of (data.items || [])) {
        const hidden = ch.statistics?.hiddenSubscriberCount;
        const subs   = hidden ? null : parseInt(ch.statistics?.subscriberCount || '0', 10);
        map.set(ch.id, subs);
      }
    } catch (e) {
      console.warn(`  ⚠ channels lote ${i}: ${e.message}`);
    }
  }
  return map;
}

// ─── GEMINI API ────────────────────────────────────────────────────────────────
// Estrategia de clasificación en dos pasos (ver handler):
//   1) geminiEval(videoId)   → análisis del VÍDEO real (fileData/fileUri de YouTube).
//                              Es lo ideal: Gemini ve imagen y audio. Pero el tier
//                              gratuito de la API suele rechazar el análisis de
//                              vídeos de YouTube por URL y devuelve null.
//   2) geminiEvalText(video) → FALLBACK basado SOLO en metadatos (título,
//                              descripción, canal). No "ve" el vídeo, pero permite
//                              clasificar y rellenar los campos en vez de generar
//                              propuestas vacías. Devuelve el MISMO JSON.
// Solo si AMBOS fallan se descarta el vídeo.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// POST genérico a Gemini con reintento ante 429 (cuota/ritmo). Devuelve el JSON
// parseado o null. Centraliza el manejo de errores de geminiEval/geminiEvalText.
async function geminiGenerate(parts) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const model = CONFIG.geminiModel || 'gemini-2.0-flash-lite';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const body = { contents: [{ parts }], generationConfig: { responseMimeType: 'application/json' } };
  const maxRetries = CONFIG.geminiMaxRetries ?? 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.status === 429) {
        if (attempt === maxRetries) {
          console.warn(`  ⚠ Gemini 429 (cuota/ritmo) tras ${maxRetries + 1} intentos`);
          return null;
        }
        const wait = (CONFIG.geminiRetryDelayMs ?? 8000) * (attempt + 1);
        console.warn(`  ⏳ Gemini 429 — espera ${wait}ms y reintenta`);
        await sleep(wait);
        continue;
      }
      if (!res.ok) {
        const err = await res.text();
        console.warn(`  ⚠ Gemini ${res.status} — ${err.slice(0, 150)}`);
        return null;
      }
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      return JSON.parse(text);
    } catch (e) {
      console.warn(`  ⚠ Gemini ${e.message}`);
      return null;
    }
  }
  return null;
}

async function geminiEval(videoId) {
  const prompt = `Eres el curador de un blog musical llamado Refrito. El proyecto descubre covers de canciones grabados por músicos amateurs — desde una habitación con el móvil hasta una grabación casera cuidada, pero NUNCA artistas profesionales con discográfica.

Analiza este vídeo de YouTube y responde SOLO con un objeto JSON con estos campos exactos:

{
  "esAmateur": true o false,
  "esUnaSolaCancion": true o false,
  "calidad": número entero del 1 al 10,
  "tituloCancion": "título de la canción que están versionando",
  "artistaOriginal": "artista o banda que grabó el original",
  "notaCuratorial": "una frase (máx 25 palabras) sobre qué hace especial esta versión — solo si esAmateur=true",
  "borradorCuratorial": "borrador de 2 párrafos cortos (máx 90 palabras en total), en español, tono editorial e íntimo de Refrito: el primer párrafo sitúa la canción original y su autor; el segundo, qué hace esta versión casera y por qué merece la pena. Sin clichés. Solo si esAmateur=true",
  "razon": "por qué lo descartas — solo si esAmateur=false o esUnaSolaCancion=false"
}

esAmateur=false si: artista con discográfica, canal oficial de un sello, producción claramente profesional, concierto de gran formato, playback, AI cover, karaoke, tutorial, o un canal con cientos de miles de seguidores tipo banda consolidada (ej. Boyce Avenue, Our Last Night).

esUnaSolaCancion=false si: es un recopilatorio, playlist, mix, "non stop", "best of", medley, o varias canciones seguidas. Refrito publica UNA interpretación, no compilaciones.

calidad (1-10): valora la interpretación y el encanto del cover amateur. 1-3 = desafinado/sin gracia/ruido; 4-5 = correcto pero olvidable; 6-7 = sólido, conecta; 8-10 = sobresaliente, emotivo, lo publicarías sin dudar.

esAmateur=true: grabación en casa/habitación/estudio casero, sonido imperfecto pero auténtico, músico desconocido o con pocos seguidores, interpretación personal de una canción conocida.

Si no puedes identificar la canción o el artista original, deja esos campos como cadena vacía "".
Responde SOLO el JSON, sin markdown ni explicaciones.`;

  return geminiGenerate([
    { fileData: { mimeType: 'video/*', fileUri: `https://www.youtube.com/watch?v=${videoId}` } },
    { text: prompt },
  ]);
}

// FALLBACK basado en TEXTO. Mismo modelo, mismo endpoint, mismo JSON de salida,
// pero clasificando a partir de los METADATOS del vídeo (título, descripción,
// canal) en lugar del vídeo en sí. Se usa cuando geminiEval() devuelve null.
async function geminiEvalText(video) {
  const titulo      = video.snippet?.title        || '';
  const canal       = video.snippet?.channelTitle || '';
  const descripcion = (video.snippet?.description || '').slice(0, 1500);

  const prompt = `Eres el curador de un blog musical llamado Refrito. El proyecto descubre covers de canciones grabados por músicos amateurs — desde una habitación con el móvil hasta una grabación casera cuidada, pero NUNCA artistas profesionales con discográfica.

NO puedes ver ni escuchar el vídeo. Clasifícalo ÚNICAMENTE a partir de sus METADATOS de YouTube:

TÍTULO: ${titulo}
CANAL: ${canal}
DESCRIPCIÓN: ${descripcion}

Responde SOLO con un objeto JSON con estos campos exactos:

{
  "esAmateur": true o false,
  "esUnaSolaCancion": true o false,
  "calidad": número entero del 1 al 10,
  "tituloCancion": "título de la canción que están versionando",
  "artistaOriginal": "artista o banda que grabó el original",
  "notaCuratorial": "una frase (máx 25 palabras) sobre qué hace especial esta versión — solo si esAmateur=true",
  "borradorCuratorial": "borrador de 2 párrafos cortos (máx 90 palabras en total), en español, tono editorial e íntimo de Refrito: el primer párrafo sitúa la canción original y su autor; el segundo, qué hace esta versión casera y por qué merece la pena. Sin clichés. Solo si esAmateur=true",
  "razon": "por qué lo descartas — solo si esAmateur=false o esUnaSolaCancion=false"
}

esAmateur=false si: artista con discográfica, canal oficial de un sello, producción claramente profesional, concierto de gran formato, playback, AI cover, karaoke, tutorial, o un canal con cientos de miles de seguidores tipo banda consolidada (ej. Boyce Avenue, Our Last Night).

esUnaSolaCancion=false si: es un recopilatorio, playlist, mix, "non stop", "best of", medley, o varias canciones seguidas. Refrito publica UNA interpretación, no compilaciones.

calidad (1-10): al no ver el vídeo, estima a partir de la canción versionada, el cuidado del título/descripción y las señales de que es un cover amateur con encanto. 1-3 = poco prometedor; 4-5 = correcto; 6-7 = sólido; 8-10 = muy prometedor.

esAmateur=true: indicios de grabación en casa/habitación/estudio casero, músico desconocido o con pocos seguidores, interpretación personal de una canción conocida.

Si no puedes identificar la canción o el artista original, deja esos campos como cadena vacía "".
Responde SOLO el JSON, sin markdown ni explicaciones.`;

  return geminiGenerate([{ text: prompt }]);
}

// ─── GITHUB API ───────────────────────────────────────────────────────────────

function ghHeaders() {
  return {
    'Authorization': `token ${process.env.GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Refrito-Discovery/1.0',
    'Content-Type': 'application/json',
  };
}

async function ghGet(path) {
  const [owner, repo] = process.env.GITHUB_REPO.split('/');
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const res = await fetch(url, { headers: ghHeaders() });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`GitHub GET ${path}: ${res.status}`);
  }
  return res.json();
}

async function ghPut(path, contentBase64, message, sha) {
  const [owner, repo] = process.env.GITHUB_REPO.split('/');
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const body = { message, content: contentBase64, branch: process.env.GITHUB_BRANCH || 'main' };
  if (sha) body.sha = sha;
  const res = await fetch(url, { method: 'PUT', headers: ghHeaders(), body: JSON.stringify(body) });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub PUT ${path}: ${res.status} — ${err.slice(0, 300)}`);
  }
  return res.json();
}

// ─── DEDUPLICACIÓN ────────────────────────────────────────────────────────────

async function loadSeen() {
  const file = await ghGet('content/proposals/_seen.json');
  if (!file) return { ids: new Set(), sha: null };
  const arr = JSON.parse(Buffer.from(file.content, 'base64').toString('utf-8'));
  return { ids: new Set(arr), sha: file.sha };
}

async function saveSeen(ids, sha) {
  const sorted  = [...ids].sort();
  const encoded = Buffer.from(JSON.stringify(sorted, null, 2) + '\n').toString('base64');
  await ghPut('content/proposals/_seen.json', encoded, 'discovery: actualiza índice _seen.json', sha);
}

// ─── FILTROS ──────────────────────────────────────────────────────────────────

function parseDuration(iso) {
  const m = (iso || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
}

function filterVideo(v, subsByChannel) {
  const title   = (v.snippet?.title        || '').toLowerCase();
  const channel = (v.snippet?.channelTitle || '').toLowerCase();
  const dur     = parseDuration(v.contentDetails?.duration);
  const views   = parseInt(v.statistics?.viewCount || '0', 10);
  // subs reales del canal (Map). null = oculto/desconocido → no se filtra por subs.
  const subs    = subsByChannel ? subsByChannel.get(v.snippet?.channelId) : null;

  if (v.status?.embeddable === false)                                          return false;
  if (dur < CONFIG.minDurationSeconds)                                         return false;
  if (CONFIG.titleBlacklist.some(kw => title.includes(kw.toLowerCase())))     return false;
  if (CONFIG.channelBlacklist.some(kw => channel.includes(kw.toLowerCase()))) return false;
  if (CONFIG.minViewCount       != null && views < CONFIG.minViewCount)        return false;
  if (CONFIG.maxViewCount       != null && views > CONFIG.maxViewCount)        return false;
  if (CONFIG.maxSubscriberCount != null && subs != null && subs > CONFIG.maxSubscriberCount) return false;

  return true;
}

// ─── SCORING PREVIO A GEMINI (numérico, rápido) ───────────────────────────────
// Selecciona los mejores candidatos para enviar a Gemini.
// Prioriza: engagement alto (likes/vistas) + subida reciente.

function scoreVideo(v) {
  const views    = parseInt(v.statistics?.viewCount    || '0', 10);
  const likes    = parseInt(v.statistics?.likeCount    || '0', 10);
  const comments = parseInt(v.statistics?.commentCount || '0', 10);
  const ageDays  = (Date.now() - new Date(v.snippet?.publishedAt || 0).getTime()) / 86400000;

  // Underground: sweet spot en 200–5000 vistas (no 0, no masivo)
  const viewScore = views < 100  ? 0
                  : views < 500  ? 0.4
                  : views < 5000 ? 1.0   // ideal
                  : views < 15000 ? 0.7
                  : 0.4;

  // Ratio likes/vistas: la mejor señal de que conectó con su pequeña audiencia
  const likeRatio   = views > 0 ? likes / views : 0;
  const engageScore = Math.min(1, likeRatio / 0.04); // 4% likes = máximo

  // Comentarios: señal de comunidad
  const commentScore = comments > 3 ? Math.min(1, Math.log10(comments) / 2) : 0;

  // Recencia: underground = reciente. <30 días ideal, penaliza >6 meses.
  const freshScore = ageDays < 30  ? 1.0
                   : ageDays < 90  ? 0.8
                   : ageDays < 180 ? 0.6
                   : 0.3;

  return viewScore * 0.25 + engageScore * 0.40 + commentScore * 0.10 + freshScore * 0.25;
}

// ─── ESCRITURA DE PROPUESTA ───────────────────────────────────────────────────

function buildProposal(video, geminiResult, sourceQuery) {
  const id      = video.id;
  const snippet = video.snippet    || {};
  const stats   = video.statistics || {};
  const thumb   = snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || '';

  return {
    youtubeId:        id,
    estado:           'pendiente',
    tituloCancion:    geminiResult?.tituloCancion    || '',
    interpreteCover:  snippet.channelTitle           || '',
    canalCoverUrl:    `https://www.youtube.com/channel/${snippet.channelId}`,
    artistaOriginal:  geminiResult?.artistaOriginal  || '',
    videoOriginalUrl: '',
    textoCuratorial:  geminiResult?.borradorCuratorial || geminiResult?.notaCuratorial || '',
    miniatura:        thumb,
    fecha:            '',
    numeroPista:      null,
    _videoTitulo:     snippet.title                  || '',
    _vistas:          parseInt(stats.viewCount       || '0', 10),
    _calidad:         geminiResult?.calidad ?? null,
    _descubierto:     new Date().toISOString(),
    _query:           sourceQuery,
  };
}

async function writeProposal(video, geminiResult, sourceQuery) {
  const path    = `content/proposals/${video.id}.json`;
  const already = await ghGet(path);
  if (already) {
    console.log(`  · ${video.id} ya existe — omitido`);
    return false;
  }

  const proposal = buildProposal(video, geminiResult, sourceQuery);
  const encoded  = Buffer.from(JSON.stringify(proposal, null, 2) + '\n').toString('base64');
  try {
    await ghPut(path, encoded, `discovery: nueva propuesta ${video.id}`);
  } catch (e) {
    if (e.message.includes('409')) {
      console.log(`  · ${video.id} conflicto (ya existe en otra ejecución) — omitido`);
      return false;
    }
    throw e;
  }
  console.log(`  ✓ ${video.id}  "${(video.snippet?.title || '').slice(0, 60)}"`);
  return true;
}

// ─── RSS CANALES DE CONFIANZA ─────────────────────────────────────────────────

async function fetchTrustedChannelIds() {
  if (!CONFIG.trustedChannelsEnabled || !CONFIG.trustedChannels.length) return [];
  const ids = [];
  for (const ch of CONFIG.trustedChannels) {
    try {
      const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${ch.id}`);
      if (!res.ok) continue;
      const xml = await res.text();
      const found = [...xml.matchAll(/<yt:videoId>([^<]+)<\/yt:videoId>/g)].map(m => m[1]);
      ids.push(...found);
    } catch (e) {
      console.warn(`  ⚠ RSS ${ch.name}: ${e.message}`);
    }
  }
  return ids;
}

// ─── HANDLER PRINCIPAL ────────────────────────────────────────────────────────

exports.handler = async function () {
  const key    = process.env.YOUTUBE_API_KEY;
  const token  = process.env.GITHUB_TOKEN;
  const ghRepo = process.env.GITHUB_REPO;

  if (!key)    return { statusCode: 500, body: 'Falta YOUTUBE_API_KEY' };
  if (!token)  return { statusCode: 500, body: 'Falta GITHUB_TOKEN' };
  if (!ghRepo) return { statusCode: 500, body: 'Falta GITHUB_REPO' };

  const useGemini = !!process.env.GEMINI_API_KEY;
  console.log(`\nRefrito Discovery — inicio ${new Date().toISOString()} | Gemini: ${useGemini ? 'ON' : 'OFF (sin GEMINI_API_KEY)'}`);

  try {
    const { ids: seenIds, sha: seenSha } = await loadSeen();
    console.log(`IDs ya vistos: ${seenIds.size}`);

    // Selecciona consultas de la tanda de hoy (rotación diaria)
    const dayIdx  = Math.floor(Date.now() / 86400000);
    const start   = (dayIdx * CONFIG.queriesPerRun) % CONFIG.queries.length;
    const queries = Array.from({ length: CONFIG.queriesPerRun },
      (_, i) => CONFIG.queries[(start + i) % CONFIG.queries.length]);
    console.log(`Consultas (${CONFIG.publishedAfterDays}d): ${queries.join(' | ')}`);

    // Búsqueda YouTube
    const candidateIds = new Set();
    for (const q of queries) {
      try {
        const ids = await searchVideos(q);
        ids.forEach(id => candidateIds.add(id));
        console.log(`  "${q}" → ${ids.length} IDs`);
      } catch (e) {
        console.warn(`  ⚠ búsqueda "${q}": ${e.message}`);
      }
    }

    // RSS canales de confianza
    const rssIds = await fetchTrustedChannelIds();
    rssIds.forEach(id => candidateIds.add(id));

    // Filtra ya vistos
    const newIds = [...candidateIds].filter(id => !seenIds.has(id));
    console.log(`Candidatos nuevos (tras dedup): ${newIds.length}`);
    if (!newIds.length) {
      return { statusCode: 200, body: JSON.stringify({ propuestas: 0, msg: 'sin candidatos nuevos' }) };
    }

    // Enriquece en lotes de 50
    const enriched = [];
    for (let i = 0; i < newIds.length; i += 50) {
      try {
        const batch = await enrichVideos(newIds.slice(i, i + 50));
        enriched.push(...batch);
      } catch (e) {
        console.warn(`  ⚠ enrich lote ${i}: ${e.message}`);
      }
    }
    console.log(`Enriquecidos: ${enriched.length}`);

    // Subs reales de cada canal (videos.list no los trae)
    const subsByChannel = await fetchChannelSubs(enriched.map(v => v.snippet?.channelId));

    // Filtro numérico + diversidad de canal
    const channelCount = {};
    const maxPerCh     = CONFIG.maxVideosPerChannel || 1;
    const filtered = enriched
      .filter(v => filterVideo(v, subsByChannel))
      .filter(v => {
        const ch = v.snippet?.channelId || 'x';
        channelCount[ch] = (channelCount[ch] || 0) + 1;
        return channelCount[ch] <= maxPerCh;
      });
    console.log(`Tras filtro numérico: ${filtered.length}`);

    // Pre-ranking numérico → selecciona los mejores para Gemini
    const preRanked = filtered
      .map(v => ({ v, score: scoreVideo(v) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, CONFIG.geminiTopN || 12)
      .map(x => x.v);
    console.log(`Enviando ${preRanked.length} a Gemini para análisis…`);

    // Evaluación con Gemini (ve el vídeo real de YouTube)
    const approved = [];
    let geminiCalls = 0;
    let fallosSeguidos = 0;
    for (const video of preRanked) {
      if (!useGemini) {
        // Sin Gemini: aprueba todo el pre-ranking
        approved.push({ video, gemini: null });
        continue;
      }

      // Control de ritmo: espacia las llamadas para no superar el límite por
      // minuto del tier gratuito (causa de los 429 en ráfaga).
      if (geminiCalls > 0) await sleep(CONFIG.geminiDelayMs ?? 4500);
      geminiCalls++;

      // Por defecto clasificamos por TEXTO (rápido y fiable en el tier gratuito).
      // El análisis del vídeo real solo si CONFIG.geminiVideoAnalysis = true
      // (consume mucha más cuota y suele dar 429 en gratuito).
      let result, modo;
      if (CONFIG.geminiVideoAnalysis) {
        result = await geminiEval(video.id);
        modo   = 'vídeo';
        if (!result) { result = await geminiEvalText(video); modo = 'texto'; }
      } else {
        result = await geminiEvalText(video);
        modo   = 'texto';
      }
      if (!result) {
        // Ni vídeo ni texto: Gemini activo pero sin respuesta (error/cuota).
        console.log(`  ✗ ${video.id} — Gemini sin respuesta, descartado`);
        // Corte rápido: si las primeras llamadas fallan seguidas (típico de cuota
        // agotada), abortamos para no perder 5 min reintentando en vano.
        if (++fallosSeguidos >= 3 && approved.length === 0) {
          console.log('  ⛔ Gemini falla repetidamente (cuota agotada) — aborto la ronda');
          break;
        }
        continue;
      }
      fallosSeguidos = 0;
      console.log(`  · ${video.id} — analizado vía ${modo}`);

      if (result.esAmateur === false) {
        console.log(`  ✗ ${video.id} — Gemini: no amateur (${result.razon || '—'})`);
        continue;
      }
      if (result.esUnaSolaCancion === false) {
        console.log(`  ✗ ${video.id} — Gemini: recopilatorio/playlist (${result.razon || '—'})`);
        continue;
      }
      const calidad = Number(result.calidad);
      if (CONFIG.minCalidad != null && Number.isFinite(calidad) && calidad < CONFIG.minCalidad) {
        console.log(`  ✗ ${video.id} — Gemini: calidad ${calidad} < ${CONFIG.minCalidad}`);
        continue;
      }

      console.log(`  ✓ ${video.id} — "${result.tituloCancion}" (${result.artistaOriginal}) · calidad ${calidad || '?'}`);
      approved.push({ video, gemini: result });

      if (approved.length >= CONFIG.topN) break;
    }
    console.log(`Gemini aprobó: ${approved.length}`);

    // Marca como vistos SOLO los vídeos que se enviaron a Gemini (preRanked):
    // son los que ya hemos "gastado" en analizar. Los demás (filtrados por
    // números o fuera del top) quedan disponibles para futuras tandas, así el
    // pozo de candidatos no se agota tan rápido.
    preRanked.forEach(v => seenIds.add(v.id));

    // Escribe propuestas
    let escritas = 0;
    for (const { video, gemini } of approved) {
      const sourceQuery = queries.find(q => q) || 'unknown';
      const ok = await writeProposal(video, gemini, sourceQuery);
      if (ok) escritas++;
    }

    await saveSeen(seenIds, seenSha);
    console.log(`Propuestas escritas: ${escritas} | _seen.json actualizado (${seenIds.size} IDs)`);

    return {
      statusCode: 200,
      body: JSON.stringify({ propuestas: escritas, vistos_total: seenIds.size }),
    };

  } catch (err) {
    console.error('Error en discovery:', err);
    return { statusCode: 500, body: err.message };
  }
};
