/**
 * discovery-config.js — Todo lo configurable del robot de descubrimiento.
 * Edita este archivo libremente; la lógica vive en discovery-background.js.
 */

module.exports = {

  // ─── CONSULTAS DE BÚSQUEDA ────────────────────────────────────────────────────
  // Términos amplios + filtro temporal (publishedAfterDays) para encontrar
  // subidas recientes desconocidas. No buscamos lo popular: buscamos lo nuevo.
  // Consultas diversas a propósito: distintos géneros, estados de ánimo, épocas
  // e idiomas. Si fueran casi iguales (todas "cover acústico casero"), YouTube
  // devolvería siempre los mismos vídeos y el dedup los agotaría enseguida.
  queries: [
    // Inglés — grabación amateur + cover, variando estilo
    'bedroom cover acoustic guitar vocals',
    'acoustic cover one take raw',
    'home recording cover singer',
    'lo-fi cover acoustic',
    'living room session cover',
    'soul cover bedroom voice',
    'indie folk cover homemade',
    'r&b acoustic cover home',
    'jazz standard cover home voice',
    'bossa nova cover acoustic home',
    '90s song acoustic cover bedroom',
    '80s song cover acoustic homemade',
    'singer songwriter cover live take',
    'ukulele cover home recording',
    'cover acoustic raw vocals no autotune',

    // Español — variando género y región
    'cover acústico casero guitarra voz',
    'versión acústica grabación propia',
    'cantautor cover acústico',
    'cover indie español casero',
    'cover flamenco casero guitarra',
    'cover bolero casero voz guitarra',
    'cover rock español acústico casero',
    'versión acústica canción 90s español',
    'cover pop latino acústico casero',
    'cover trap reggaeton versión acústica',

    // Portugués / francés / italiano — abre el campo
    'cover acústico violão voz caseiro',
    'reprise acoustique guitare voix maison',
    'cover acustica voce chitarra casa',
  ],

  // Cuántas consultas por tanda. Al ser semanal, usamos todas (= queries.length)
  // para máxima variedad en la única ejecución de la semana.
  queriesPerRun: 28,

  // Resultados por consulta
  maxResultsPerQuery: 25,

  // Solo busca vídeos subidos en los últimos N días (underground = reciente)
  publishedAfterDays: 180,

  // Orden de resultados: 'date' para lo más nuevo primero, 'relevance' para lo más popular
  searchOrder: 'date',

  // ─── FILTROS ──────────────────────────────────────────────────────────────────

  minDurationSeconds: 90,

  // Underground: pocas vistas pero alguna tracción mínima
  minViewCount: 80,
  maxViewCount: 30000,        // underground real: <30K vistas
  maxSubscriberCount: 50000,  // canal pequeño: <50K subs

  // Máximo de vídeos del mismo canal por tanda
  maxVideosPerChannel: 1,

  // Cuántos candidatos enviar a Gemini para evaluación profunda
  // (los mejor puntuados por el scoring numérico previo). Pocos: el tier
  // gratuito tiene límite por minuto y por día.
  geminiTopN: 10,

  // Cuántas propuestas finales escribir (Gemini aprueba o descarta).
  // Semanal: ~7 para la semana + margen.
  topN: 9,

  // Calidad mínima (1-10) que Gemini debe dar para aprobar el cover.
  minCalidad: 6,

  // ─── GEMINI (ritmo y reintentos para el tier gratuito) ───────────────────────
  // false = clasifica por TEXTO (metadatos). Más rápido y fiable en gratuito.
  // true  = intenta analizar el VÍDEO real (mejor juicio, pero suele dar 429).
  geminiVideoAnalysis: false,
  // Espera entre llamadas a Gemini (ms) para no superar el límite por minuto.
  geminiDelayMs: 4500,
  // Reintentos ante 429 (cuota/ritmo) y espera base entre reintentos.
  geminiMaxRetries: 2,
  geminiRetryDelayMs: 8000,

  titleBlacklist: [
    'karaoke', 'lyrics', 'letra', 'instrumental', 'backing track',
    'ai cover', 'a.i. cover', 'ai generated', 'ai-generated', 'suno', 'udio',
    'reaction', 'reaccion', 'reacción', 'react',
    'tutorial', 'how to play', 'tabs', 'lesson', 'clase de',
    'remix', 'mashup',
    'official video', 'official music video', 'music video',
    'vevo',
    'live at madison', 'live at wembley', 'live concert',
    '#shorts', ' shorts',
    // Recopilatorios / playlists (no son una sola interpretación)
    'full album', 'compilation', 'compilación', 'best of', 'medley',
    'playlist', 'non stop', 'nonstop', 'mix ', ' mix', 'megamix',
    'collection', 'colección', 'colección', 'songs collection',
    'hit songs', 'greatest hits', 'top covers', 'best covers',
    'vol.', 'vol ', 'volume ', 'parte ', 'part ',
    '1 hour', '2 hours', 'horas de', 'hours of',
    // Instrumentos/estilos que no encajan con el proyecto
    'piano cover', 'metal cover', 'orchestra',
  ],

  channelBlacklist: [
    'vevo', 'official', 'records', 'music group', 'entertainment',
    'tv ', ' tv', 'label', 'warner', 'universal', 'sony', 'atlantic',
    'columbia', 'capitol', 'republic', 'def jam', 'interscope',
  ],

  // Categoría YouTube 10 = Música
  videoCategoryId: '10',

  // ─── CANALES DE CONFIANZA (sin cuota API) ────────────────────────────────────
  trustedChannelsEnabled: false,
  trustedChannels: [],

};
