/**
 * feedback.js — Recibe la opinión del sitio ("¿Qué te parece refrito.org?")
 * y la reenvía a Telegram (en vez de email / Netlify Forms, que no detectaba).
 *
 * Vars: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID (ya configuradas).
 */

'use strict';

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'método no permitido' };

  let data;
  try { data = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, body: 'json inválido' }; }

  if (data.bot) return { statusCode: 200, body: 'ok' }; // honeypot: bot → ignora

  const mensaje = String(data.mensaje || '').trim().slice(0, 2000);
  if (!mensaje) return { statusCode: 400, body: 'mensaje vacío' };
  const email = String(data.email || '').trim().slice(0, 200);

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat  = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return { statusCode: 500, body: 'telegram no configurado' };

  const texto = `💬 <b>Nueva opinión sobre refrito.org</b>\n\n${escapeHtml(mensaje)}` +
                (email ? `\n\n✉️ ${escapeHtml(email)}` : '\n\n(sin correo)');

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text: texto, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    if (!res.ok) return { statusCode: 502, body: 'no se pudo enviar a Telegram' };
  } catch {
    return { statusCode: 502, body: 'no se pudo enviar a Telegram' };
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};
