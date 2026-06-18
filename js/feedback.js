/* feedback.js — Envía la opinión sobre el sitio a la función /feedback,
   que la reenvía a Telegram al instante. Sin recargar la página. */

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

    if (form.querySelector('[name="bot"]')?.value) return; // honeypot

    const mensaje = form.querySelector('[name="mensaje"]')?.value.trim() || '';
    const email   = form.querySelector('[name="email"]')?.value.trim() || '';
    if (!mensaje) { setStatus('Escribe algo antes de enviar.', 'error'); return; }

    btn.disabled = true;
    setStatus('Enviando…', 'sending');

    try {
      const res = await fetch('/.netlify/functions/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensaje, email }),
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
