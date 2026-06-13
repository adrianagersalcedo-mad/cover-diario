/**
 * discovery.js — Robot de descubrimiento de covers amateur.
 *
 * Cron diario (ver netlify.toml). Busca en YouTube, filtra, puntúa y escribe
 * candidatos en /content/proposals/ para revisión humana en el CMS.
 *
 * Variables de entorno (Netlify → Site config → Environment variables):
 *   YOUTUBE_API_KEY  — YouTube Data API v3
 *   GITHUB_TOKEN     — Personal Access Token (permisos: Contents read+write)
 *   GITHUB_REPO      — "propietario/repo", ej: adrianagersalcedo-mad/cover-diario
 *   GITHUB_BRANCH    — rama destino, ej: main
 *
 * Configuración editable: netlify/functions/discovery-config.js
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
  const data = await ytGet('search', {
    part: 'id',
    q: query,
    type: 'video',
    videoCategoryId: CONFIG.videoCategoryId,
    videoEmbeddable: 'true',
    maxResults: String(CONFIG.maxResultsPerQuery),
    order: 'relevance',
  });
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

// ─── GITHUB API (fetch nativo, sin dependencias npm) ──────────────────────────

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
  const body = {
    message,
    content: contentBase64,
    branch: process.env.GITHUB_BRANCH || 'main',
  };
  if (sha) body.sha = sha;
  const res = await fetch(url, { method: 'PUT', headers: ghHeaders(), body: JSON.stringify(body) });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub PUT ${path}: ${res.status} — ${err.slice(0, 300)}`);
  }
  return res.json();
}

// ─── DEDUPLICACIÓN VÍA _seen.json ─────────────────────────────────────────────
// Un solo archivo JSON guarda todos los videoIds ya vistos (propuestos o publicados).
// Coste: 1 lectura + 1 escritura por tanda, independientemente del nº de propuestas.

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

// ─── ISO 8601 DURATION → SEGUNDOS ─────────────────────────────────────────────

function parseDuration(iso) {
  const m = (iso || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
}

// ─── FILTRADO ─────────────────────────────────────────────────────────────────
// Módulo separado — edita las listas y umbrales en discovery-config.js.

function filterVideo(v) {
  const title   = (v.snippet?.title   || '').toLowerCase();
  const channel = (v.snippet?.channelTitle || '').toLowerCase();
  const dur     = parseDuration(v.contentDetails?.duration);
  const views   = parseInt(v.statistics?.viewCount   || '0', 10);
  const subs    = parseInt(v.statistics?.subscriberCount || '0', 10);

  if (v.status?.embeddable === false)                                   return false;
  if (dur < CONFIG.minDurationSeconds)                                  return false;
  if (CONFIG.titleBlacklist.some(kw => title.includes(kw.toLowerCase()))) return false;
  if (CONFIG.channelBlacklist.some(kw => channel.includes(kw.toLowerCase()))) return false;
  if (CONFIG.maxViewCount        != null && views > CONFIG.maxViewCount)       return false;
  if (CONFIG.maxSubscriberCount  != null && subs  > CONFIG.maxSubscriberCount) return false;

  return true;
}

// ─── PUNTUACIÓN (mayor = mejor candidato) ────────────────────────────────────
// Favorece vídeos con algunas vistas (señal de calidad) sin ser masivos,
// y cierta antigüedad (no demasiado virales por ser recientes).

function scoreVideo(v) {
  const views     = parseInt(v.statistics?.viewCount || '0', 10);
  const published = new Date(v.snippet?.publishedAt || 0).getTime();
  const ageMs     = Date.now() - published;
  const ageDays   = ageMs / (1000 * 3600 * 24);

  // Vistas normalizadas en log (0–1 respecto al máximo configurado)
  const maxV     = CONFIG.maxViewCount || 5000000;
  const viewScore = views > 50 ? Math.min(1, Math.log10(views) / Math.log10(maxV)) : 0;

  // Penaliza vídeos muy recientes (<7 días) y muy antiguos (>3 años)
  const freshnessScore = ageDays < 7   ? 0.3
                       : ageDays > 1095 ? 0.4
                       : 0.8;

  return viewScore * 0.6 + freshnessScore * 0.4;
}

// ─── PARSEO HEURÍSTICO DEL TÍTULO ─────────────────────────────────────────────
// Intenta extraer el nombre de la canción del título del vídeo.
// Muy variable; devuelve el título limpio como mejor intento.

function inferSongTitle(videoTitle) {
  let t = videoTitle;

  // Elimina etiquetas finales entre paréntesis/corchetes
  t = t.replace(/\s*[\(\[][^\)\]]*(cover|versión|version|acoustic|acústico)[^\)\]]*[\)\]]/gi, '');

  // "CANCIÓN - Artista (cover)" → queda "CANCIÓN"
  const dashCover = t.match(/^(.+?)\s*[-–—|]\s*.+?\s*(cover|versión)/i);
  if (dashCover) return dashCover[1].trim();

  // Elimina " cover" y todo lo que viene después como sufijo
  t = t.replace(/\s*([-–—]\s*)?(covers?|versión|version)\s*(by\s+\S+.*)?$/gi, '');

  // Si queda "Artista - Canción", intenta quedarse con la segunda parte
  // (heurística: suele ser artista → canción)
  const parts = t.split(/\s*[-–—]\s*/);
  if (parts.length >= 2) {
    // Queda con la parte más corta como nombre de canción (heurística burda)
    const sorted = [...parts].sort((a, b) => a.length - b.length);
    t = sorted[0];
  }

  return t.trim() || videoTitle;
}

// ─── CONSTRUCCIÓN DE PROPUESTA ────────────────────────────────────────────────

function buildProposal(video, sourceQuery) {
  const id      = video.id;
  const snippet = video.snippet || {};
  const stats   = video.statistics || {};
  const thumb   = snippet.thumbnails?.medium?.url
               || snippet.thumbnails?.default?.url
               || '';

  return {
    youtubeId:        id,
    estado:           'pendiente',
    tituloCancion:    inferSongTitle(snippet.title || ''),
    interpreteCover:  snippet.channelTitle || '',
    canalCoverUrl:    `https://www.youtube.com/channel/${snippet.channelId}`,
    artistaOriginal:  '',   // rellenar antes de aprobar
    videoOriginalUrl: '',   // rellenar antes de aprobar
    textoCuratorial:  '',   // escribir antes de aprobar
    miniatura:        thumb,
    fecha:            '',   // asignar antes de aprobar
    numeroPista:      null, // asignar antes de aprobar
    // Campos de referencia (no aparecen en el CMS como campos editables)
    _videoTitulo:     snippet.title || '',
    _vistas:          parseInt(stats.viewCount || '0', 10),
    _subs:            parseInt(stats.subscriberCount || '0', 10),
    _descubierto:     new Date().toISOString(),
    _query:           sourceQuery,
  };
}

// ─── ESCRITURA DE PROPUESTA EN GITHUB ─────────────────────────────────────────

async function writeProposal(video, sourceQuery) {
  const path    = `content/proposals/${video.id}.json`;
  const already = await ghGet(path);
  if (already) {
    console.log(`  · ${video.id} ya existe — omitido`);
    return false;
  }

  const proposal = buildProposal(video, sourceQuery);
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

// ─── RSS DE CANALES DE CONFIANZA (opcional, sin cuota API) ────────────────────

async function fetchTrustedChannelIds() {
  if (!CONFIG.trustedChannelsEnabled || !CONFIG.trustedChannels.length) return [];

  const ids = [];
  for (const ch of CONFIG.trustedChannels) {
    try {
      const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${ch.id}`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const xml = await res.text();
      const found = [...xml.matchAll(/<yt:videoId>([^<]+)<\/yt:videoId>/g)].map(m => m[1]);
      console.log(`  RSS ${ch.name}: ${found.length} vídeos`);
      ids.push(...found);
    } catch (e) {
      console.warn(`  ⚠ RSS ${ch.name}: ${e.message}`);
    }
  }
  return ids;
}

// ─── HANDLER PRINCIPAL ────────────────────────────────────────────────────────

exports.handler = async function () {
  const key   = process.env.YOUTUBE_API_KEY;
  const token = process.env.GITHUB_TOKEN;
  const ghRepo = process.env.GITHUB_REPO;

  if (!key)    return { statusCode: 500, body: 'Falta YOUTUBE_API_KEY' };
  if (!token)  return { statusCode: 500, body: 'Falta GITHUB_TOKEN' };
  if (!ghRepo) return { statusCode: 500, body: 'Falta GITHUB_REPO' };

  console.log('\nRefrito Discovery — inicio', new Date().toISOString());

  try {
    // 1. Carga índice de IDs ya vistos (dedup eficiente)
    const { ids: seenIds, sha: seenSha } = await loadSeen();
    console.log(`IDs ya vistos: ${seenIds.size}`);

    // 2. Selecciona consultas de esta tanda (rota por día)
    const dayIdx  = Math.floor(Date.now() / 86400000);
    const start   = (dayIdx * CONFIG.queriesPerRun) % CONFIG.queries.length;
    const queries = Array.from({ length: CONFIG.queriesPerRun },
      (_, i) => CONFIG.queries[(start + i) % CONFIG.queries.length]);
    console.log(`Consultas: ${queries.join(' | ')}`);

    // 3. Búsqueda
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

    // 4. Añade IDs de canales de confianza (RSS, sin cuota)
    const rssIds = await fetchTrustedChannelIds();
    rssIds.forEach(id => candidateIds.add(id));

    // 5. Filtra los ya vistos
    const newIds = [...candidateIds].filter(id => !seenIds.has(id));
    console.log(`Candidatos nuevos (tras dedup): ${newIds.length}`);

    if (!newIds.length) {
      return { statusCode: 200, body: JSON.stringify({ propuestas: 0, msg: 'sin candidatos nuevos' }) };
    }

    // 6. Enriquece en lotes de 50
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

    // 7. Filtra y puntúa
    const filtered = enriched.filter(filterVideo);
    console.log(`Tras filtro: ${filtered.length}`);

    const top = filtered
      .map(v => ({ v, score: scoreVideo(v) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, CONFIG.topN)
      .map(x => x.v);
    console.log(`Top ${top.length} seleccionados`);

    // 8. Escribe propuestas y actualiza _seen.json
    // Primero añade los IDs al índice (aunque luego fallen, no los repetimos)
    top.forEach(v => seenIds.add(v.id));
    newIds.forEach(id => seenIds.add(id)); // marca todos los candidatos como vistos

    let escritas = 0;
    for (const video of top) {
      // Construye el sourceQuery buscando cuál query encontró este video
      const sourceQuery = queries.find(q => q) || 'unknown';
      const ok = await writeProposal(video, sourceQuery);
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
