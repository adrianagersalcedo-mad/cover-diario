/**
 * telegram-webhook.js — Recibe los Sí/No que pulsas en Telegram.
 *
 * Telegram envía aquí un "callback_query" cuando tocas un botón de una propuesta.
 *   ok:<youtubeId>  → aprueba: programa el cover para el siguiente día libre y lo publica
 *   no:<youtubeId>  → descarta: borra la propuesta (queda en _seen, no se re-sugiere)
 *
 * Variables de entorno (Netlify):
 *   TELEGRAM_BOT_TOKEN       — token del bot (de @BotFather)
 *   TELEGRAM_WEBHOOK_SECRET  — secreto que validamos en cada petición
 *   GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH — para leer/escribir el repo
 */

'use strict';

const TG = () => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

// ─── GitHub ─────────────────────────────────────────────────────────────────
function ghHeaders() {
  return {
    'Authorization': `token ${process.env.GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Refrito-Telegram/1.0',
    'Content-Type': 'application/json',
  };
}
function ghRepo() { return process.env.GITHUB_REPO.split('/'); }
function ghBranch() { return process.env.GITHUB_BRANCH || 'main'; }

async function ghGet(path) {
  const [o, r] = ghRepo();
  const res = await fetch(`https://api.github.com/repos/${o}/${r}/contents/${path}?ref=${ghBranch()}`, { headers: ghHeaders() });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub GET ${path}: ${res.status}`);
  return res.json();
}
async function ghPut(path, contentBase64, message, sha) {
  const [o, r] = ghRepo();
  const body = { message, content: contentBase64, branch: ghBranch() };
  if (sha) body.sha = sha;
  const res = await fetch(`https://api.github.com/repos/${o}/${r}/contents/${path}`,
    { method: 'PUT', headers: ghHeaders(), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`GitHub PUT ${path}: ${res.status} — ${(await res.text()).slice(0, 200)}`);
  return res.json();
}
async function ghDelete(path, message, sha) {
  const [o, r] = ghRepo();
  const res = await fetch(`https://api.github.com/repos/${o}/${r}/contents/${path}`,
    { method: 'DELETE', headers: ghHeaders(), body: JSON.stringify({ message, sha, branch: ghBranch() }) });
  if (!res.ok) throw new Error(`GitHub DELETE ${path}: ${res.status}`);
  return res.json();
}
async function ghList(dir) {
  const data = await ghGet(dir);
  return Array.isArray(data) ? data : [];
}

// ─── Telegram ───────────────────────────────────────────────────────────────
async function tgAnswerCallback(id, text) {
  await fetch(`${TG()}/answerCallbackQuery`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: id, text: text || '' }),
  }).catch(() => {});
}
async function tgEditText(chatId, messageId, text) {
  await fetch(`${TG()}/editMessageText`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  }).catch(() => {});
}

// ─── Programación del cover al aprobar ───────────────────────────────────────
function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function nextSlot() {
  // Lee las pistas ya publicadas para calcular el siguiente día/número libres.
  const items = await ghList('content/covers');
  const dates = items
    .map((f) => f.name.replace('.json', ''))
    .filter((n) => /^\d{4}-\d{2}-\d{2}$/.test(n))
    .sort();
  const hoy = new Date().toISOString().slice(0, 10);
  const ultima = dates.length ? dates[dates.length - 1] : hoy;
  const fecha = addDays(ultima >= hoy ? ultima : hoy, 1);
  const numeroPista = dates.length + 1;
  return { fecha, numeroPista };
}

async function aprobar(youtubeId) {
  const path = `content/proposals/${youtubeId}.json`;
  const file = await ghGet(path);
  if (!file) return { ok: false, msg: 'La propuesta ya no existe' };
  const prop = JSON.parse(Buffer.from(file.content, 'base64').toString('utf-8'));

  const { fecha, numeroPista } = await nextSlot();
  const cover = {
    id: `cover-${numeroPista}`,
    youtubeId: prop.youtubeId,
    fecha,
    numeroPista,
    tituloCancion: prop.tituloCancion || '',
    interpreteCover: prop.interpreteCover || '',
    canalCoverUrl: prop.canalCoverUrl || '',
    artistaOriginal: prop.artistaOriginal || '',
    videoOriginalUrl: prop.videoOriginalUrl || '',
    textoCuratorial: prop.textoCuratorial || '',
    tags: prop.tags || [],
  };
  const encoded = Buffer.from(JSON.stringify(cover, null, 2) + '\n').toString('base64');
  await ghPut(`content/covers/${fecha}.json`, encoded, `cover: aprueba ${youtubeId} vía Telegram → ${fecha}`);
  await ghDelete(path, `proposal: ${youtubeId} aprobada (Telegram)`, file.sha);
  return { ok: true, fecha, numeroPista, cover };
}

async function descartar(youtubeId) {
  const path = `content/proposals/${youtubeId}.json`;
  const file = await ghGet(path);
  if (!file) return { ok: false, msg: 'La propuesta ya no existe' };
  await ghDelete(path, `proposal: ${youtubeId} descartada (Telegram)`, file.sha);
  return { ok: true };
}

// ─── Handler ─────────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  // Seguridad: Telegram manda el secreto en esta cabecera (lo fijamos al registrar)
  const secret = event.headers['x-telegram-bot-api-secret-token'];
  if (!process.env.TELEGRAM_WEBHOOK_SECRET || secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return { statusCode: 401, body: 'no autorizado' };
  }

  let update;
  try { update = JSON.parse(event.body || '{}'); } catch { return { statusCode: 200, body: 'ok' }; }

  const cq = update.callback_query;
  if (!cq) return { statusCode: 200, body: 'ok' };

  const data = cq.data || '';
  const chatId = cq.message?.chat?.id;
  const messageId = cq.message?.message_id;
  const baseText = cq.message?.text || '';
  const [accion, youtubeId] = data.split(':');

  try {
    if (accion === 'ok') {
      const r = await aprobar(youtubeId);
      await tgAnswerCallback(cq.id, r.ok ? '✅ Aprobada' : r.msg);
      if (r.ok) await tgEditText(chatId, messageId, `${baseText}\n\n✅ <b>Aprobada</b> — se publica el ${r.fecha} (pista ${r.numeroPista})`);
    } else if (accion === 'no') {
      const r = await descartar(youtubeId);
      await tgAnswerCallback(cq.id, r.ok ? '❌ Descartada' : r.msg);
      if (r.ok) await tgEditText(chatId, messageId, `${baseText}\n\n❌ <b>Descartada</b>`);
    } else {
      await tgAnswerCallback(cq.id, '');
    }
  } catch (e) {
    console.error('telegram-webhook:', e);
    await tgAnswerCallback(cq.id, '⚠ Error procesando');
  }

  return { statusCode: 200, body: 'ok' };
};
