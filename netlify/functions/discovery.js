/**
 * discovery.js — Función serverless de descubrimiento de covers de rock amateur.
 *
 * Se ejecuta con un cron (configurado en netlify.toml).
 * Busca en YouTube, filtra, puntúa y escribe propuestas en /content/proposals/.
 *
 * Variables de entorno necesarias (configurar en Netlify → Site config → Env vars):
 *   YOUTUBE_API_KEY   — clave de YouTube Data API v3
 *   GITHUB_TOKEN      — Personal Access Token con permisos repo (write)
 *   GITHUB_REPO       — propietario/repo, ej: adrianagersalcedo-mad/cover-diario
 *   GITHUB_BRANCH     — rama destino, ej: main
 */

const https = require('https');

// ─── CONFIGURACIÓN (edita aquí sin tocar la lógica) ────────────────────────────

const CONFIG = {
  // Consultas de búsqueda — rotan por tanda. Añade o quita las que quieras.
  queries: [
    'rock cover bedroom',
    'rock cover garage',
    'classic rock cover amateur',
    'punk cover bedroom',
    'grunge cover acoustic',
    'rock cover living room',
    'metal cover amateur',
    'indie rock cover homemade',
    'rock cover one take',
    'rock cover 2024 amateur',
  ],

  // Cuántas consultas ejecutar por tanda (no superar ~20 para no agotar cuota)
  queriesPerRun: 8,

  // Resultados por consulta (max 50)
  maxResultsPerQuery: 30,

  // Duración mínima en segundos (descarta clips cortos / teasers)
  minDurationSeconds: 90,

  // Umbrales de "lo amateur": vistas máximas para considerar un canal pequeño.
  // Null = sin límite (desactiva el filtro de ese umbral).
  maxViewCount: 500000,     // descarta virales; null para desactivar
  maxSubscriberCount: 50000, // canales pequeños; null para desactivar

  // Cuántas propuestas escribir por tanda (las mejores puntuadas)
  topN: 10,

  // Palabras en título que descartan automáticamente (case-insensitive)
  titleBlacklist: [
    'karaoke', 'lyrics', 'letra', 'instrumental', 'backing track',
    'ai cover', 'a.i. cover', 'ai-generated', 'reaction', 'reaccion', 'reacción',
    'tutorial', 'how to play', 'tabs', 'lesson', 'remix',
    'official', 'vevo', 'music video',
  ],

  // Palabras en el nombre de canal que descartan automáticamente
  channelBlacklist: [
    'vevo', 'official', 'records', 'music', 'entertainment',
  ],

  // Categoría de YouTube para Música
  videoCategoryId: '10',
};

// ─── HELPERS HTTP ──────────────────────────────────────────────────────────────

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse error: ${e.message}\n${data.slice(0, 200)}`)); }
      });
    }).on('error', reject);
  });
}

function ytUrl(endpoint, params) {
  const qs = new URLSearchParams({ key: process.env.YOUTUBE_API_KEY, ...params });
  return `https://www.googleapis.com/youtube/v3/${endpoint}?${qs}`;
}

// ─── ISO 8601 DURATION → SECONDS ──────────────────────────────────────────────

function parseDuration(iso) {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
}

// ─── LOAD EXISTING IDS (deduplica) ────────────────────────────────────────────

async function loadExistingIds() {
  const { Octokit } = await import('https://esm.sh/@octokit/rest');
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  const [owner, repo] = process.env.GITHUB_REPO.split('/');
  const ids = new Set();

  for (const folder of ['content/covers', 'content/proposals']) {
    try {
      const { data } = await octokit.repos.getContent({ owner, repo, path: folder });
      if (!Array.isArray(data)) continue;
      for (const f of data) {
        if (!f.name.endsWith('.json') || f.name.startsWith('_')) continue;
        const { data: file } = await octokit.repos.getContent({ owner, repo, path: f.path });
        const content = JSON.parse(Buffer.from(file.content, 'base64').toString());
        if (content.youtubeId) ids.add(content.youtubeId);
      }
    } catch { /* folder might not exist yet */ }
  }
  return ids;
}

// ─── SEARCH ───────────────────────────────────────────────────────────────────

async function searchVideos(query) {
  const data = await get(ytUrl('search', {
    part: 'id,snippet',
    q: query,
    type: 'video',
    videoCategoryId: CONFIG.videoCategoryId,
    videoEmbeddable: 'true',
    maxResults: String(CONFIG.maxResultsPerQuery),
    order: 'relevance',
  }));
  return (data.items || []).map(i => i.id.videoId).filter(Boolean);
}

// ─── ENRICH ───────────────────────────────────────────────────────────────────

async function enrichVideos(ids) {
  if (!ids.length) return [];
  const data = await get(ytUrl('videos', {
    part: 'snippet,contentDetails,statistics,status',
    id: ids.join(','),
  }));
  return data.items || [];
}

// ─── FILTER (módulo separado — edita aquí para afinar) ────────────────────────

function filterVideo(v) {
  const title   = (v.snippet?.title || '').toLowerCase();
  const channel = (v.snippet?.channelTitle || '').toLowerCase();
  const dur     = parseDuration(v.contentDetails?.duration || '');
  const views   = parseInt(v.statistics?.viewCount || '0', 10);
  const subs    = parseInt(v.statistics?.subscriberCount || '0', 10);

  // Debe ser embebible
  if (v.status?.embeddable === false) return false;

  // Duración mínima
  if (dur < CONFIG.minDurationSeconds) return false;

  // Blacklist de título
  if (CONFIG.titleBlacklist.some(kw => title.includes(kw))) return false;

  // Blacklist de canal
  if (CONFIG.channelBlacklist.some(kw => channel.includes(kw))) return false;

  // Umbrales amateur (si están activados)
  if (CONFIG.maxViewCount != null && views > CONFIG.maxViewCount) return false;
  if (CONFIG.maxSubscriberCount != null && subs > CONFIG.maxSubscriberCount) return false;

  return true;
}

// ─── SCORE (mayor = mejor) ────────────────────────────────────────────────────

function scoreVideo(v) {
  const views      = parseInt(v.statistics?.viewCount || '0', 10);
  const published  = new Date(v.snippet?.publishedAt || 0).getTime();
  const recencyMs  = Date.now() - published;
  const recencyScore = Math.max(0, 1 - recencyMs / (365 * 24 * 3600 * 1000)); // 0–1, más reciente = mayor

  // Preferimos vídeos con algunas vistas (signal de calidad) pero no demasiadas (no amateur)
  const viewScore = views > 100 ? Math.log10(views) / Math.log10(CONFIG.maxViewCount || 500000) : 0;

  return recencyScore * 0.4 + viewScore * 0.6;
}

// ─── WRITE PROPOSAL TO GITHUB ─────────────────────────────────────────────────

async function writeProposal(video) {
  const { Octokit } = await import('https://esm.sh/@octokit/rest');
  const octokit     = new Octokit({ auth: process.env.GITHUB_TOKEN });
  const [owner, repo] = process.env.GITHUB_REPO.split('/');
  const branch      = process.env.GITHUB_BRANCH || 'main';

  const id      = video.id;
  const snippet = video.snippet || {};
  const thumb   = snippet.thumbnails?.medium?.url || '';

  const proposal = {
    youtubeId:       id,
    estado:          'pendiente',
    tituloCancion:   snippet.title || '',
    interpreteCover: snippet.channelTitle || '',
    canalCoverUrl:   `https://www.youtube.com/channel/${snippet.channelId}`,
    artistaOriginal: '',   // a rellenar manualmente
    videoOriginalUrl: '',  // a rellenar manualmente
    textoCuratorial: '',   // a escribir antes de aprobar
    miniatura:       thumb,
    fecha:           '',   // a rellenar antes de aprobar
    numeroPista:     null, // a rellenar antes de aprobar
    _descubierto:    new Date().toISOString(),
  };

  const path    = `content/proposals/${id}.json`;
  const content = Buffer.from(JSON.stringify(proposal, null, 2) + '\n').toString('base64');

  try {
    // Si ya existe, no sobreescribir
    await octokit.repos.getContent({ owner, repo, path });
    console.log(`  · ${id} ya existe como propuesta — omitido`);
  } catch {
    await octokit.repos.createOrUpdateFileContents({
      owner, repo, path, branch,
      message: `discovery: nueva propuesta ${id}`,
      content,
    });
    console.log(`  ✓ propuesta creada: ${id} (${snippet.title?.slice(0, 50)})`);
  }
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────

exports.handler = async function (event, context) {
  if (!process.env.YOUTUBE_API_KEY) {
    return { statusCode: 500, body: 'YOUTUBE_API_KEY no configurada' };
  }
  if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_REPO) {
    return { statusCode: 500, body: 'GITHUB_TOKEN o GITHUB_REPO no configurados' };
  }

  console.log('\nCoverDiario Discovery — inicio');

  try {
    const existingIds = await loadExistingIds();
    console.log(`IDs existentes (covers + proposals): ${existingIds.size}`);

    // Selecciona qué consultas ejecutar esta tanda (rota por día)
    const dayIndex  = Math.floor(Date.now() / 86400000);
    const start     = (dayIndex * CONFIG.queriesPerRun) % CONFIG.queries.length;
    const queries   = [];
    for (let i = 0; i < CONFIG.queriesPerRun; i++) {
      queries.push(CONFIG.queries[(start + i) % CONFIG.queries.length]);
    }
    console.log(`Consultas esta tanda: ${queries.join(', ')}`);

    // Búsqueda
    const allIds = new Set();
    for (const q of queries) {
      const ids = await searchVideos(q);
      ids.forEach(id => allIds.add(id));
      console.log(`  "${q}" → ${ids.length} IDs`);
    }

    // Deduplica contra existentes
    const newIds = [...allIds].filter(id => !existingIds.has(id));
    console.log(`Nuevos IDs tras dedup: ${newIds.length}`);

    if (!newIds.length) {
      return { statusCode: 200, body: 'Sin candidatos nuevos' };
    }

    // Enriquece en lotes de 50 (límite de la API)
    const enriched = [];
    for (let i = 0; i < newIds.length; i += 50) {
      const batch = await enrichVideos(newIds.slice(i, i + 50));
      enriched.push(...batch);
    }
    console.log(`Enriquecidos: ${enriched.length}`);

    // Filtra
    const filtered = enriched.filter(filterVideo);
    console.log(`Tras filtro: ${filtered.length}`);

    // Puntúa y ordena
    const scored = filtered
      .map(v => ({ v, score: scoreVideo(v) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, CONFIG.topN)
      .map(x => x.v);
    console.log(`Top ${scored.length} seleccionados`);

    // Escribe propuestas
    for (const video of scored) {
      await writeProposal(video);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ propuestas_escritas: scored.length }),
    };

  } catch (err) {
    console.error('Error en discovery:', err);
    return { statusCode: 500, body: err.message };
  }
};
