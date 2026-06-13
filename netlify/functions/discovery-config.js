/**
 * discovery-config.js — Todo lo configurable del robot de descubrimiento.
 * Edita este archivo libremente; la lógica vive en discovery.js.
 */

module.exports = {

  // ─── CONSULTAS DE BÚSQUEDA ────────────────────────────────────────────────────
  // Rotan por tanda (una tanda = queriesPerRun consultas al día).
  // Añade, quita o edita las que quieras. Mezcla géneros e idiomas.
  queries: [
    // Inglés — rock, pop, folk, indie
    'rock cover bedroom',
    'rock cover acoustic',
    'pop cover acoustic bedroom',
    'indie cover homemade',
    'folk cover original',
    'singer songwriter cover acoustic',
    'classic rock cover amateur',
    'pop cover one take',
    'acoustic cover living room',
    'indie folk cover bedroom guitar',
    'alternative rock cover homemade',
    'pop punk cover bedroom recording',
    'cover session acoustic guitar singer',
    'rock cover phone camera',

    // Español — rock, pop, folk, indie
    'cover acústico rock',
    'versión acústica pop',
    'cover folk cantautor',
    'cover casero guitarra',
    'cover indie amateur',
    'versión acústica indie',
    'cover rock español amateur',
    'cover pop acústico',
    'cover acústico guitarra voz',
    'versión propia canción rock',
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
  maxViewCount: 5000000,       // 5M vistas: cubre amateurs que tuvieron un viral
  maxSubscriberCount: 500000,  // 500K subs: generoso para amateurs con trayectoria

  // Cuántas propuestas escribir por tanda (las mejor puntuadas)
  topN: 10,

  // Palabras en el TÍTULO que descartan automáticamente (case-insensitive, substring)
  titleBlacklist: [
    'karaoke', 'lyrics', 'letra', 'instrumental', 'backing track',
    'ai cover', 'a.i. cover', 'ai generated', 'ai-generated', 'suno', 'udio',
    'reaction', 'reaccion', 'reacción', 'react',
    'tutorial', 'how to play', 'tabs', 'lesson', 'clase de',
    'remix', 'mashup',
    'official video', 'official music video', 'music video',
    'vevo',
    'live at madison', 'live at wembley', 'live concert',  // conciertos de profesionales
    '#shorts',
    'full album',
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
