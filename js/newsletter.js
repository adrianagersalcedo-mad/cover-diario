/* ─── NEWSLETTER — BUTTONDOWN ─────────────────────────────────────────────────
 *
 * ⚠ CONFIGURA ESTO: sustituye el username con el tuyo de Buttondown.
 *   Lo encuentras en buttondown.email → Settings → Username.
 *
 * ─────────────────────────────────────────────────────────────────────────── */
const BUTTONDOWN_USERNAME = 'refrito';
const ENDPOINT = `https://buttondown.email/api/emails/embed-subscribe/${BUTTONDOWN_USERNAME}`;

function initNewsletter() {
  document.querySelectorAll('.newsletter-form').forEach(form => {
    const input  = form.querySelector('.newsletter-input');
    const btn    = form.querySelector('.newsletter-btn');
    const status = form.querySelector('.newsletter-status');

    form.addEventListener('submit', async e => {
      e.preventDefault();

      const email = input.value.trim();

      if (!email || !input.validity.valid) {
        setStatus(status, 'Por favor, introduce un correo válido.', 'error');
        input.focus();
        return;
      }

      setStatus(status, 'Enviando…', 'sending');
      btn.disabled = true;

      try {
        const body = new URLSearchParams({ email, referrer_url: window.location.href });
        const res  = await fetch(ENDPOINT, {
          method:  'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
        });

        if (res.ok || res.status === 201) {
          setStatus(status, '¡Apuntada! Revisa tu bandeja para confirmar la suscripción.', 'ok');
          form.reset();
        } else {
          let detail = '';
          try { ({ detail } = await res.json()); } catch {}
          if (detail && /already/i.test(detail)) {
            setStatus(status, 'Este correo ya está suscrito. ¡Gracias!', 'ok');
          } else {
            setStatus(status, 'Algo falló. Inténtalo de nuevo en un momento.', 'error');
          }
        }
      } catch {
        setStatus(status, 'Sin conexión. Prueba de nuevo.', 'error');
      } finally {
        btn.disabled = false;
      }
    });
  });
}

function setStatus(el, msg, state) {
  el.textContent    = msg;
  el.dataset.state  = state;
}

document.addEventListener('DOMContentLoaded', initNewsletter);
