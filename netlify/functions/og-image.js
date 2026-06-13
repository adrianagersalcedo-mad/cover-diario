/**
 * og-image.js — Genera la tarjeta-imagen 1080×1080 de cada cover.
 *
 * GET /.netlify/functions/og-image?fecha=YYYY-MM-DD
 * GET /.netlify/functions/og-image?fecha=YYYY-MM-DD&download=1  → descarga
 *
 * Usa @resvg/resvg-js para convertir SVG → PNG sin headless browser.
 * La tarjeta adapta colores a la paleta del día (igual que la web).
 */

'use strict';

const { Resvg } = require('@resvg/resvg-js');
const fs        = require('fs');
const path      = require('path');

// ─── PALETAS (idénticas a app.js / pista.js) ─────────────────────────────────

const PALETTES = [
  { bg: '#EFEAD9', frame: '#EF5226', text: '#16110D' },
  { bg: '#C97A9C', frame: '#16110D', text: '#16110D' },
  { bg: '#7AB897', frame: '#EF5226', text: '#16110D' },
  { bg: '#C9A04A', frame: '#16110D', text: '#16110D' },
];

function paletteForDate(iso) {
  const days = Math.floor(new Date(iso).getTime() / 86400000);
  return PALETTES[((days % 4) + 4) % 4];
}

// El texto sobre frame siempre contrasta: bermellón y tinta contrastan con crema
function onFrame(frameHex) {
  return frameHex === '#C9A04A' ? '#16110D' : '#EFEAD9';
}

// ─── FORMATO DE FECHA ─────────────────────────────────────────────────────────

const MESES = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
function fmtFecha(iso) {
  const [y, m, d] = iso.split('-');
  return `${parseInt(d)} ${MESES[parseInt(m) - 1]} ${y}`;
}

// ─── ESCAPE SVG ───────────────────────────────────────────────────────────────

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── CONSTRUCCIÓN DEL SVG ─────────────────────────────────────────────────────

function buildSvg(cover) {
  const p  = paletteForDate(cover.fecha);
  const ft = onFrame(p.frame);       // texto sobre franja frame-color
  const ht = p.bg;                   // texto sobre header (siempre = bg color)

  const nameUpper = esc((cover.interpreteCover || '').toUpperCase());
  const song      = esc(`"${cover.tituloCancion || ''}"`);
  const original  = esc(cover.artistaOriginal || '');
  const pistaStr  = cover.numeroPista ? `PISTA Nº ${cover.numeroPista}` : 'REFRITO';
  const fechaStr  = cover.fecha ? fmtFecha(cover.fecha) : '';
  const trackInfo = esc(`${pistaStr} · ${fechaStr}`);
  const versiona  = esc(`↺ versiona a ${cover.artistaOriginal || ''} · "${cover.tituloCancion || ''}"`);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080" width="1080" height="1080">

  <!-- Fondo -->
  <rect width="1080" height="1080" fill="${p.bg}"/>

  <!-- ── HEADER (bg = tinta, texto = bg color) ─────────────────────────── -->
  <rect x="0" y="0" width="1080" height="130" fill="${p.text}"/>

  <!-- Vinilo en header -->
  <circle cx="70" cy="65" r="44" stroke="${ht}" stroke-width="5" fill="none"/>
  <circle cx="70" cy="65" r="30" stroke="${ht}" stroke-width="3" fill="none"/>
  <circle cx="70" cy="65" r="16" stroke="${ht}" stroke-width="3" fill="none"/>
  <circle cx="70" cy="65" r="6"  fill="${ht}"/>
  <rect   x="114" y="56" width="26" height="18" rx="9" fill="${p.frame}"/>

  <!-- REFRITO wordmark -->
  <text x="162" y="91"
    font-family="Liberation Sans, DejaVu Sans, Arial, Helvetica, sans-serif"
    font-weight="700" font-size="66" fill="${ht}" letter-spacing="4">REFRITO</text>

  <!-- ── TRACK INFO ──────────────────────────────────────────────────────── -->
  <text x="48" y="192"
    font-family="Liberation Sans, DejaVu Sans, Arial, Helvetica, sans-serif"
    font-size="26" fill="${p.text}" opacity="0.45" letter-spacing="3">${trackInfo}</text>

  <!-- ── FRANJA CANCIÓN (frame-color) ───────────────────────────────────── -->
  <rect x="0" y="214" width="1080" height="152" fill="${p.frame}"/>

  <!-- Título de la canción -->
  <text x="48" y="286"
    font-family="Liberation Sans, DejaVu Sans, Arial, Helvetica, sans-serif"
    font-weight="700" font-size="56" fill="${ft}"
    textLength="984" lengthAdjust="spacingAndGlyphs">${song}</text>

  <!-- Artista original -->
  <text x="48" y="348"
    font-family="Liberation Sans, DejaVu Sans, Arial, Helvetica, sans-serif"
    font-size="34" fill="${ft}" opacity="0.82">${original}</text>

  <!-- ── NOMBRE INTÉRPRETE (el cartel) ──────────────────────────────────── -->
  <text x="48" y="590"
    font-family="Liberation Sans, DejaVu Sans, Arial, Helvetica, sans-serif"
    font-weight="700" font-size="150" fill="${p.text}"
    textLength="984" lengthAdjust="spacingAndGlyphs">${nameUpper}</text>

  <!-- ── VERSIONA A ─────────────────────────────────────────────────────── -->
  <text x="48" y="665"
    font-family="Liberation Sans, DejaVu Sans, Arial, Helvetica, sans-serif"
    font-size="36" fill="${p.text}" opacity="0.6">${versiona}</text>

  <!-- ── FOOTER (frame-color) ───────────────────────────────────────────── -->
  <rect x="0" y="960" width="1080" height="120" fill="${p.frame}"/>

  <!-- Vinilo pequeño en footer -->
  <circle cx="48" cy="1020" r="32" stroke="${ft}" stroke-width="4" fill="none" opacity="0.7"/>
  <circle cx="48" cy="1020" r="20" stroke="${ft}" stroke-width="2" fill="none" opacity="0.7"/>
  <circle cx="48" cy="1020" r="6"  fill="${ft}" opacity="0.7"/>
  <rect   x="80" y="1013" width="20" height="14" rx="7" fill="${ft}" opacity="0.5"/>

  <text x="116" y="1033"
    font-family="Liberation Sans, DejaVu Sans, Arial, Helvetica, sans-serif"
    font-size="36" fill="${ft}">el cover de hoy en refrito.org</text>

</svg>`;
}

// ─── HANDLER ──────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  const params   = event.queryStringParameters || {};
  const fecha    = (params.fecha || '').trim();
  const download = params.download === '1';

  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return { statusCode: 400, body: 'Parámetro requerido: ?fecha=YYYY-MM-DD' };
  }

  const coverPath = path.join(__dirname, '../../content/covers', `${fecha}.json`);

  if (!fs.existsSync(coverPath)) {
    return { statusCode: 404, body: `Sin cover para ${fecha}` };
  }

  let cover;
  try {
    cover = JSON.parse(fs.readFileSync(coverPath, 'utf-8'));
  } catch {
    return { statusCode: 500, body: 'Error leyendo el cover' };
  }

  const svg = buildSvg(cover);

  let pngBuffer;
  try {
    const resvg = new Resvg(svg, {
      fitTo:  { mode: 'width', value: 1080 },
      font:   { loadSystemFonts: true },
    });
    pngBuffer = resvg.render().asPng();
  } catch (e) {
    console.error('resvg error:', e);
    return { statusCode: 500, body: 'Error generando la imagen' };
  }

  const disposition = download
    ? `attachment; filename="refrito-${fecha}.png"`
    : `inline; filename="refrito-${fecha}.png"`;

  return {
    statusCode: 200,
    headers: {
      'Content-Type':        'image/png',
      'Cache-Control':       'public, max-age=86400, stale-while-revalidate=604800',
      'Content-Disposition': disposition,
    },
    body:             pngBuffer.toString('base64'),
    isBase64Encoded:  true,
  };
};
