/**
 * discovery-config.js — Todo lo configurable del robot de descubrimiento.
 * Edita este archivo libremente; la lógica vive en discovery-background.js.
 */

module.exports = {

  // ─── CONSULTAS DE BÚSQUEDA ────────────────────────────────────────────────────
  // Términos amplios + filtro temporal (publishedAfterDays) para encontrar
  // subidas recientes desconocidas. No buscamos lo popular: buscamos lo nuevo.
  queries: [
    // Inglés — señales de grabación amateur + cover
    'bedroom cover acoustic guitar vocals',
    'acoustic cover one take raw',
    'home recording cover singer',
    'lo-fi cover acoustic original',
    'cover session living room acoustic',
    'singer songwriter cover phone recording',
    'indie folk cover homemade recording',
    'acoustic cover first upload',
    'cover acoustic no effects raw vocals',
    'bedroom pop cover guitar',

    // Español — idem
    'cover acústico casero guitarra voz',
    'versión acústica grabación propia',
    'cover casero guitarra acústica',
    'cantautor cover acústico original',
    'cover indie español casero',
    'versión propia acústica guitarra',
    'cover folk acústico grabado en casa',
    'cover acústico sin producción',
    'cover rock acústico casero',
    'cover pop acústico guitarra voz',
  ],

  // Cuántas consultas por tanda. Al ser semanal, usamos todas (= queries.length)
  // para máxima variedad en la única ejecución de la semana.
  queriesPerRun: 20,

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
  // (los mejor puntuados por el scoring numérico previo)
  geminiTopN: 18,

  // Cuántas propuestas finales escribir (Gemini aprueba o descarta).
  // Semanal: ~7 para la semana + margen.
  topN: 9,

  // Calidad mínima (1-10) que Gemini debe dar para aprobar el cover.
  minCalidad: 6,

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
