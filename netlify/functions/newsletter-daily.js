/**
 * newsletter-daily.js — Envía el cover del día a los suscriptores (Buttondown).
 *
 * Función PROGRAMADA (cron diario, ver netlify.toml). Solo envía si HOY hay
 * un cover publicado; si no, no hace nada.
 *
 * Variables de entorno (Netlify):
 *   BUTTONDOWN_API_KEY — token de la API de Buttondown (Settings → Programming → API)
 */

'use strict';

const BASE = 'https://refrito.org';

async function getJson(url) {
  const res = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

async function coverDeHoy() {
  const list  = await getJson(`${BASE}/content/covers/_list.json`);
  const today = new Date().toISOString().slice(0, 10);
  // Solo enviamos si HOY tiene cover (la fecha más reciente publicada == hoy)
  if (!Array.isArray(list) || !list.includes(today)) return null;
  return getJson(`${BASE}/content/covers/${today}.json`);
}

exports.handler = async () => {
  const key = process.env.BUTTONDOWN_API_KEY;
  if (!key) {
    console.warn('Falta BUTTONDOWN_API_KEY — no se envía');
    return { statusCode: 200, body: 'sin api key' };
  }

  let c;
  try {
    c = await coverDeHoy();
  } catch (e) {
    console.error('Error leyendo el cover de hoy:', e.message);
    return { statusCode: 500, body: e.message };
  }

  if (!c) {
    console.log('Hoy no hay cover nuevo — no se envía newsletter');
    return { statusCode: 200, body: 'sin cover hoy' };
  }

  const url     = `${BASE}/pista?fecha=${c.fecha}`;
  const subject = `${c.interpreteCover} versiona a ${c.artistaOriginal} — el cover de hoy`;
  const body =
    `**"${c.tituloCancion}"** · ${c.interpreteCover}\n` +
    `↺ versiona a ${c.artistaOriginal}\n\n` +
    `${(c.textoCuratorial || '').trim()}\n\n` +
    `🎧 Escúchalo en Refrito → ${url}`;

  try {
    const res = await fetch('https://api.buttondown.email/v1/emails', {
      method: 'POST',
      headers: { 'Authorization': `Token ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, body, status: 'about_to_send' }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`Buttondown ${res.status}: ${err.slice(0, 300)}`);
      return { statusCode: 502, body: 'error Buttondown' };
    }
    console.log(`Newsletter enviada: "${subject}"`);
    return { statusCode: 200, body: JSON.stringify({ enviado: c.fecha }) };
  } catch (e) {
    console.error('Error enviando a Buttondown:', e.message);
    return { statusCode: 502, body: e.message };
  }
};
