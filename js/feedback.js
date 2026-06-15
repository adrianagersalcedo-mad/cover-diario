/* feedback.js — Envía la opinión sobre el sitio a Netlify Forms sin recargar.
   Netlify detecta el formulario "opiniones" en el HTML estático y guarda cada
   envío en el panel; activa la notificación por email en
   Netlify → Forms → opiniones → Settings → Form notifications. */

(function () {
  const form = document.querySelector('form.feedback-form');
  if (!form) return;

  const status = form.querySelector('.feedback-status');
  const btn    = form.querySelector('.feedback-btn');

  function setStatus(msg, state) {
    if (!status) return;
    status.textContent = msg;
    if (state) status.dataset.state = state; else delete status.dataset.state;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = new FormData(form);
    if (data.get('bot-field')) return; // honeypot: bot → ignora en silencio

    btn.disabled = true;
    setStatus('Enviando…', 'sending');

    try {
      const res = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(data).toString(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      form.reset();
      setStatus('¡Gracias! Lo hemos recibido.', 'ok');
    } catch (err) {
      setStatus('No se pudo enviar. Escríbenos a refritocovers@gmail.com', 'error');
    } finally {
      btn.disabled = false;
    }
  });
})();
