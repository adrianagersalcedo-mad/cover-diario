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

// Git Data API: permite crear/borrar VARIOS archivos en UN SOLO commit
// (= un solo deploy de Netlify = 15 créditos para todo el lote).
async function ghGit(method, path, body) {
  const [o, r] = ghRepo();
  const res = await fetch(`https://api.github.com/repos/${o}/${r}/${path}`,
    { method, headers: ghHeaders(), body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(`GitHub ${method} ${path}: ${res.status} — ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function commitMultiple(files, deletes, message) {
  const branch = ghBranch();
  const ref  = await ghGit('GET', `git/ref/heads/${branch}`);
  const base = await ghGit('GET', `git/commits/${ref.object.sha}`);
  const tree = [];
  for (const f of files)   tree.push({ path: f.path, mode: '100644', type: 'blob', content: f.content });
  for (const p of deletes) tree.push({ path: p, mode: '100644', type: 'blob', sha: null });
  const newTree   = await ghGit('POST', 'git/trees', { base_tree: base.tree.sha, tree });
  const newCommit = await ghGit('POST', 'git/commits', { message, tree: newTree.sha, parents: [ref.object.sha] });
  await ghGit('PATCH', `git/refs/heads/${branch}`, { sha: newCommit.sha });
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

// Covers con fecha futura (programados, aún no publicados), ordenados por fecha.
async function listFutureCovers() {
  const items = await ghList('content/covers');
  const hoy = new Date().toISOString().slice(0, 10);
  const fut = [];
  for (const it of items) {
    const m = it.name.match(/^(\d{4}-\d{2}-\d{2})\.json$/);
    if (!m || m[1] <= hoy) continue;
    const f = await ghGet(`content/covers/${it.name}`);
    if (!f) continue;
    const c = JSON.parse(Buffer.from(f.content, 'base64').toString('utf-8'));
    fut.push({ fecha: m[1], titulo: c.tituloCancion, interprete: c.interpreteCover });
  }
  fut.sort((a, b) => a.fecha.localeCompare(b.fecha));
  return fut;
}

// Programa los N aprobados más antiguos en los N siguientes días libres,
// TODO en un solo commit (un solo deploy). La web revela uno por día sola.
async function programarLote(n) {
  const cola = await listApproved();
  if (!cola.length) return { ok: false, msg: 'No hay covers aprobados en la lista' };

  // Punto de partida: última fecha y nº de pista existentes.
  const items = await ghList('content/covers');
  const dates = items
    .map((f) => f.name.replace('.json', ''))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();
  const hoy = new Date().toISOString().slice(0, 10);
  let ultima = dates.length ? dates[dates.length - 1] : hoy;
  if (ultima < hoy) ultima = hoy;
  const basePista = dates.length;

  const lote = cola.slice(0, n);
  const files = [], deletes = [], programados = [];
  lote.forEach((c, i) => {
    const fecha = addDays(ultima, i + 1);
    const numeroPista = basePista + i + 1;
    const cover = {
      id: `cover-${numeroPista}`,
      youtubeId: c.prop.youtubeId,
      fecha,
      numeroPista,
      tituloCancion: c.prop.tituloCancion || '',
      interpreteCover: c.prop.interpreteCover || '',
      canalCoverUrl: c.prop.canalCoverUrl || '',
      artistaOriginal: c.prop.artistaOriginal || '',
      videoOriginalUrl: c.prop.videoOriginalUrl || '',
      textoCuratorial: c.prop.textoCuratorial || '',
      tags: c.prop.tags || [],
    };
    files.push({ path: `content/covers/${fecha}.json`, content: JSON.stringify(cover, null, 2) + '\n' });
    deletes.push(c.path);
    programados.push({ fecha, titulo: cover.tituloCancion, interprete: cover.interpreteCover });
  });

  await commitMultiple(files, deletes, `cover: programa ${lote.length} en lote (Telegram)`);
  return { ok: true, programados, restantes: cola.length - lote.length };
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
        const [fut, cola] = await Promise.all([listFutureCovers(), listApproved()]);
        let txt = `📅 <b>Programados, por salir (${fut.length})</b>\n`;
        txt += fut.length
          ? fut.map((c) => `• ${c.fecha} — ${c.titulo || '(sin título)'} · ${c.interprete || ''}`).join('\n')
          : '• (ninguno)';
        txt += `\n\n✅ <b>Aprobados esperando fecha (${cola.length})</b>\n`;
        txt += cola.length
          ? cola.map((c, i) => `${i + 1}. ${c.prop.tituloCancion || c.prop._videoTitulo || '(sin título)'} · ${c.prop.interpreteCover || ''}`).join('\n')
          : '• (ninguno)';
        txt += `\n\n/siguiente — programar 1 · /programar 7 — programar una semana (1 solo deploy)`;
        await tgSend(chatId, txt);
      } else if (cmd === '/siguiente' || cmd === '/programar') {
        // /siguiente = 1 · /programar [N] = lote (por defecto 7), todo en 1 deploy
        const arg = parseInt(msg.text.trim().split(/\s+/)[1], 10);
        const n = cmd === '/siguiente' ? 1 : (Number.isFinite(arg) ? arg : 7);
        const r = await programarLote(n);
        if (!r.ok) await tgSend(chatId, r.msg);
        else {
          const lineas = r.programados.map((p) => `• ${p.fecha} — ${p.titulo || '(sin título)'} · ${p.interprete || ''}`).join('\n');
          await tgSend(chatId, `✅ <b>Programados ${r.programados.length}</b> (1 solo deploy):\n${lineas}\n\nQuedan ${r.restantes} en la cola. La web revela uno por día sola.`);
        }
      } else if (cmd === '/start' || cmd === '/help' || cmd === '/ayuda') {
        await tgSend(chatId, 'Refrito 🎵\nTe aviso de covers nuevos con botones Sí/No.\n• /cola — ver programados y aprobados en espera\n• /siguiente — programar 1 cover\n• /programar 7 — programar 7 de golpe (1 solo deploy = 15 créditos para la semana)');
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
