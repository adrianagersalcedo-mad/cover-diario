/**
 * discovery-config.js — Todo lo configurable del robot de descubrimiento.
 * Edita este archivo libremente; la lógica vive en discovery.js.
 */

module.exports = {

  // ─── CONSULTAS DE BÚSQUEDA ────────────────────────────────────────────────────
  // Rotan por tanda (una tanda = queriesPerRun consultas al día).
  // Añade, quita o edita las que quieras. Mezcla géneros e idiomas.
  queries: [
    // ── Inglés: canciones concretas muy versionadas ────────────────────────────
    // Buscar por canción real da resultados mucho más limpios que términos genéricos
    '"Creep" cover acoustic guitar',
    '"Wonderwall" cover bedroom acoustic',
    '"Blackbird" Beatles cover acoustic',
    '"Fast Car" Tracy Chapman cover acoustic',
    '"Hallelujah" cover singer songwriter',
    '"The Night We Met" cover acoustic',
    '"Moon River" cover acoustic guitar',
    '"No One" Alicia Keys cover acoustic',
    '"Free Fallin" cover bedroom guitar',
    '"Landslide" Fleetwood Mac cover acoustic',
    '"Sound of Silence" cover acoustic',
    '"Wish You Were Here" cover acoustic bedroom',
    '"Hotel California" cover acoustic guitar',
    '"Africa" Toto cover acoustic',
    '"Roxanne" cover acoustic guitar',

    // ── Español: canciones y artistas muy versionados ─────────────────────────
    '"La Flaca" cover acústico',
    '"Peces de ciudad" cover acústico',
    '"No me llames dolores" cover acústico',
    '"Resistiré" cover acústico guitarra',
    '"Bésame" Vargas Blues Band cover',
    'Vetusta Morla cover acústico',
    'Extremoduro cover acústico guitarra',
    'Rosendo cover acústico',
    'Loquillo cover acústico',
    'Heroes del Silencio cover acústico',
    'Joaquín Sabina cover acústico guitarra',
    'Manolo García cover acústico',
    'Fito Páez cover acústico',
    'Andrés Calamaro cover acústico',
    'Los Planetas cover acústico',
  ],

  // Cuántas consultas ejecutar por tanda (rota cada día).
  // Máximo recomendado: 20 × 100 unidades = 2000 unidades/día (cuota total: 10.000)
  queriesPerRun: 10,

  // Resultados por consulta (25–50). Más = más cobertura, más cuota.
  maxResultsPerQuery: 25,

  // ─── FILTROS ──────────────────────────────────────────────────────────────────

  // Duración mínima en segundos. Descarta clips cortos y teasers.
  minDurationSeconds: 90,

  // Rango amateur flexible.
  // null = sin límite (desactiva ese filtro).
  // El rango es generoso: acepta desde lo muy casero hasta amateurs cuidados.
  minViewCount: 150,           // descarta vídeos sin ninguna tracción (spam/basura)
  maxViewCount: 1000000,       // 1M vistas: amateurs que tuvieron un viral moderado
  maxSubscriberCount: 150000,  // 150K subs: amateur con cierta trayectoria, no profesional

  // Cuántas propuestas escribir por tanda (las mejor puntuadas)
  topN: 10,

  // Máximo de vídeos del mismo canal por tanda (evita repetir al mismo youtuber)
  maxVideosPerChannel: 1,

  // Palabras en el TÍTULO que descartan automáticamente (case-insensitive, substring)
  titleBlacklist: [
    'karaoke', 'lyrics', 'letra', 'instrumental', 'backing track',
    'ai cover', 'a.i. cover', 'ai generated', 'ai-generated', 'suno', 'udio',
    'reaction', 'reaccion', 'reacción', 'react',
    'tutorial', 'how to play', 'tabs', 'lesson', 'clase de',
    'remix', 'mashup',
    'official video', 'official music video', 'music video',
    'vevo',
    'live at madison', 'live at wembley', 'live concert',
    '#shorts', 'short', ' shorts',
    'full album',
    'compilation', 'compilación', 'best of',
    'medley',
    'piano cover',       // queremos guitarra/voz principalmente
    'metal cover',       // demasiado alejado del spirit del proyecto
    'orchestra',
  ],

  // Palabras en el NOMBRE DEL CANAL que descartan automáticamente
  channelBlacklist: [
    'vevo', 'official', 'records', 'music group', 'entertainment',
    'tv ', ' tv', 'label', 'warner', 'universal', 'sony', 'atlantic',
    'columbia', 'capitol', 'republic', 'def jam', 'interscope',
  ],

  // Categoría de YouTube (10 = Música). No cambies salvo que sepas lo que haces.
  videoCategoryId: '10',

  // ─── CANALES DE CONFIANZA (OPCIONAL, sin cuota de API) ────────────────────────
  // Si activas esto, el robot también trae los últimos vídeos de estos canales
  // vía su feed RSS de YouTube (gratis, no consume cuota).
  // Los vídeos pasan por el mismo filtro que el resto.
  //
  // Cómo encontrar el channel ID: ve al canal → ver código fuente → busca "channelId"
  trustedChannelsEnabled: false,
  trustedChannels: [
    // Ejemplos:
    // { id: 'UCxxxxxxxxxxxxxxxxxxxxxx', name: 'Nombre del canal' },
    // { id: 'UCyyyyyyyyyyyyyyyyyyyyyy', name: 'Otro canal bueno' },
  ],

};
