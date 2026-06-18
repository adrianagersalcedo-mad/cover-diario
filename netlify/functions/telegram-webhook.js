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
async function tgSend(chatId, text) {
  await fetch(`${TG()}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  }).catch(() => {});
}
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

// ─── Aprobar (a la lista, SIN fecha) ─────────────────────────────────────────
// "Sí" solo marca la propuesta como aprobada: entra en el backlog de aprobados.
// NO le asigna fecha ni la publica — el orden y el día los decides tú luego.
async function aprobar(youtubeId) {
  const path = `content/proposals/${youtubeId}.json`;
  const file = await ghGet(path);
  if (!file) return { ok: false, msg: 'La propuesta ya no existe' };
  const prop = JSON.parse(Buffer.from(file.content, 'base64').toString('utf-8'));
  if (prop.estado === 'aprobada') return { ok: true };

  prop.estado = 'aprobada';
  const encoded = Buffer.from(JSON.stringify(prop, null, 2) + '\n').toString('base64');
  await ghPut(path, encoded, `proposal: ${youtubeId} aprobada vía Telegram (a la lista, sin fecha) [skip ci]`, file.sha);
  return { ok: true };
}

async function descartar(youtubeId) {
  const path = `content/proposals/${youtubeId}.json`;
  const file = await ghGet(path);
  if (!file) return { ok: false, msg: 'La propuesta ya no existe' };
  await ghDelete(path, `proposal: ${youtubeId} descartada (Telegram) [skip ci]`, file.sha);
  return { ok: true };
}

// ─── Cola de aprobados ───────────────────────────────────────────────────────
function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Propuestas con estado "aprobada", ordenadas por antigüedad (FIFO).
async function listApproved() {
  const items = await ghList('content/proposals');
  const out = [];
  for (const it of items) {
    if (!it.name.endsWith('.json') || it.name === '_seen.json') continue;
    const f = await ghGet(`content/proposals/${it.name}`);
    if (!f) continue;
    const prop = JSON.parse(Buffer.from(f.content, 'base64').toString('utf-8'));
    if (prop.estado === 'aprobada') out.push({ prop, sha: f.sha, path: `content/proposals/${it.name}` });
  }
  out.sort((a, b) => (a.prop._descubierto || '').localeCompare(b.prop._descubierto || ''));
  return out;
}

// Calcula el siguiente día y número de pista libres a partir de los covers.
async function nextSlot() {
  const items = await ghList('content/covers');
  const dates = items
    .map((f) => f.name.replace('.json', ''))
    .filter((n) => /^\d{4}-\d{2}-\d{2}$/.test(n))
    .sort();
  const hoy = new Date().toISOString().slice(0, 10);
  const ultima = dates.length ? dates[dates.length - 1] : hoy;
  const fecha = addDays(ultima >= hoy ? ultima : hoy, 1);
  return { fecha, numeroPista: dates.length + 1 };
}

// Programa el aprobado más antiguo en el primer día libre y lo publica.
async function programarSiguiente() {
  const cola = await listApproved();
  if (!cola.length) return { ok: false, msg: 'No hay covers aprobados en la lista' };

  const { prop, sha, path } = cola[0];
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
  await ghDelete(path, `proposal: ${prop.youtubeId} programada [skip ci]`, sha);
  await ghPut(`content/covers/${fecha}.json`, encoded, `cover: programa ${prop.youtubeId} → ${fecha} (Telegram)`);
  return { ok: true, fecha, numeroPista, prop, restantes: cola.length - 1 };
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

  // ── Comandos de texto: /cola y /siguiente ──
  const msg = update.message;
  if (msg && typeof msg.text === 'string') {
    const chatId = msg.chat?.id;
    const cmd = msg.text.trim().split(/\s+/)[0].toLowerCase().replace(/@.*$/, '');
    try {
      if (cmd === '/cola' || cmd === '/lista') {
        const cola = await listApproved();
        if (!cola.length) await tgSend(chatId, 'No hay covers aprobados en la lista.');
        else {
          const lineas = cola.map((c, i) =>
            `${i + 1}. <b>${c.prop.tituloCancion || c.prop._videoTitulo || '(sin título)'}</b> — ${c.prop.interpreteCover || ''}`);
          await tgSend(chatId, `🎶 <b>Aprobados en cola (${cola.length})</b>\n${lineas.join('\n')}\n\nUsa /siguiente para programar el primero en el próximo día libre.`);
        }
      } else if (cmd === '/siguiente' || cmd === '/programar') {
        const r = await programarSiguiente();
        if (!r.ok) await tgSend(chatId, r.msg);
        else await tgSend(chatId,
          `✅ Programado: <b>${r.prop.tituloCancion || r.prop._videoTitulo}</b> — ${r.prop.interpreteCover}\n📅 ${r.fecha} (pista ${r.numeroPista})\nQuedan ${r.restantes} en la cola.`);
      } else if (cmd === '/start' || cmd === '/help' || cmd === '/ayuda') {
        await tgSend(chatId, 'Refrito 🎵\nTe aviso de covers nuevos con botones Sí/No.\n• /cola — ver aprobados en espera\n• /siguiente — programar el primero en el próximo día libre');
      }
    } catch (e) {
      console.error('telegram cmd:', e);
      await tgSend(chatId, '⚠ Error procesando el comando');
    }
    return { statusCode: 200, body: 'ok' };
  }

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
      if (r.ok) await tgEditText(chatId, messageId, `${baseText}\n\n✅ <b>Aprobada</b> — en la lista (la programas tú cuando quieras)`);
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
