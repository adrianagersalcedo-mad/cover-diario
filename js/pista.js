/* ─── PALETTE ─────────────────────────────────────────────────────────────── */
const PALETTES = [
  { bg: '#EFEAD9', frame: '#EF5226', text: '#16110D', player: '#3D8A60' },
  { bg: '#C97A9C', frame: '#16110D', text: '#16110D', player: '#EF5226' },
  { bg: '#7AB897', frame: '#EF5226', text: '#16110D', player: '#C9A04A' },
  { bg: '#C9A04A', frame: '#16110D', text: '#16110D', player: '#EF5226' },
];
function paletteForDate(iso) {
  const days = Math.floor(new Date(iso).getTime() / 86400000);
  return PALETTES[((days % 4) + 4) % 4];
}
function applyPalette(p) {
  const r = document.documentElement.style;
  r.setProperty('--day-bg',    p.bg);
  r.setProperty('--day-frame', p.frame);
  r.setProperty('--day-text',  p.text);
  r.setProperty('--verde',     p.player);
  document.body.style.background = p.bg;
  document.body.style.color      = p.text;
}

/* ─── DATA ────────────────────────────────────────────────────────────────── */
async function loadList() {
  const res = await fetch('content/covers/_list.json');
  return res.json();
}
async function loadCover(date) {
  const res = await fetch(`content/covers/${date}.json`);
  if (!res.ok) throw new Error(`No cover for ${date}`);
  return res.json();
}

/* ─── FORMAT ──────────────────────────────────────────────────────────────── */
function fmtDate(iso) {
  const [y, m, d] = iso.split('-');
  return new Date(+y, +m - 1, +d)
    .toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
    .toUpperCase().replace(/\./g, '');
}

/* ─── RENDER ──────────────────────────────────────────────────────────────── */
function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function setLink(id, href, text) {
  const el = document.getElementById(id);
  if (!el) return;
  el.href        = href;
  el.textContent = text;
}

function renderCover(c, list) {
  applyPalette(paletteForDate(c.fecha));
  const today = new Date().toISOString().slice(0, 10);

  // Mono bar
  setText('meta-num',      `PISTA Nº ${c.numeroPista}`);
  setText('meta-date',     fmtDate(c.fecha));
  setText('meta-hoy-label', c.fecha === today ? 'HOY SUENA' : c.fecha);

  // Video
  const iframe = document.getElementById('yt-iframe');
  iframe.src   = `https://www.youtube-nocookie.com/embed/${c.youtubeId}?rel=0&modestbranding=1`;
  iframe.title = `${c.tituloCancion} — ${c.interpreteCover} (cover)`;

  // Left meta
  setText('meta-interprete', c.interpreteCover);
  setText('meta-fecha-col',  fmtDate(c.fecha));

  // Right meta links
  setLink('link-yt',       `https://www.youtube.com/watch?v=${c.youtubeId}`,   'Ver en YouTube ↗');
  setLink('link-canal',    c.canalCoverUrl,                                     'Canal del intérprete ↗');
  setLink('link-original', c.videoOriginalUrl,                                  'Ver original ↗');

  // Firma
  setText('cover-name',      c.interpreteCover.toUpperCase());
  setText('original-script', `↺ versiona a ${c.artistaOriginal} · "${c.tituloCancion}"`);

  // Stripe
  setText('stripe-title',    `"${c.tituloCancion}"`);
  setText('stripe-original', c.artistaOriginal);

  // Curatorial
  document.getElementById('curatorial-text').innerHTML = c.textoCuratorial
    .split(/\n\n+/).filter(Boolean)
    .map(p => `<p>${p.trim()}</p>`).join('');

  // Credits
  setText('cred-cover-name', c.interpreteCover);
  setLink('cred-cover-link', c.canalCoverUrl, 'Canal ↗');
  setText('cred-orig-name',  `${c.artistaOriginal} · "${c.tituloCancion}"`);
  setLink('cred-orig-link',  c.videoOriginalUrl, 'Ver original ↗');
  setLink('cred-yt-link',    `https://www.youtube.com/watch?v=${c.youtubeId}`, 'YouTube ↗');

  // Prev / Next navigation
  const sorted = list.slice().sort();
  const idx    = sorted.indexOf(c.fecha);
  const prevEl = document.getElementById('nav-prev');
  const nextEl = document.getElementById('nav-next');

  if (idx > 0) {
    prevEl.href = `pista?fecha=${sorted[idx - 1]}`;
    prevEl.style.opacity = '1';
  } else {
    prevEl.style.opacity = '.3';
    prevEl.style.pointerEvents = 'none';
  }
  if (idx < sorted.length - 1) {
    nextEl.href = `pista?fecha=${sorted[idx + 1]}`;
    nextEl.style.opacity = '1';
  } else {
    nextEl.style.opacity = '.3';
    nextEl.style.pointerEvents = 'none';
  }

  // Share
  document.getElementById('btn-share').dataset.title =
    `Pista ${c.numeroPista}: ${c.interpreteCover} versiona a ${c.artistaOriginal}`;

  // Botón descarga tarjeta Instagram
  const dlBtn = document.getElementById('btn-download');
  if (dlBtn && c.fecha) {
    dlBtn.href     = `/.netlify/functions/og-image?fecha=${c.fecha}&download=1`;
    dlBtn.download = `refrito-${c.fecha}.png`;
  }

  // Page title & meta
  document.title = `Pista ${c.numeroPista} · ${c.interpreteCover} — Refrito`;
  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.content = `${c.interpreteCover} versiona "${c.tituloCancion}" de ${c.artistaOriginal}`;
}

/* ─── SHARE ───────────────────────────────────────────────────────────────── */
function initShare() {
  const btn    = document.getElementById('btn-share');
  const notice = document.getElementById('share-notice');
  btn.addEventListener('click', async () => {
    const url  = window.location.href;
    const text = btn.dataset.title || 'Refrito';
    if (navigator.share) {
      try { await navigator.share({ title: text, url }); } catch {}
      return;
    }
    try { await navigator.clipboard.writeText(url); }
    catch {
      const t = Object.assign(document.createElement('textarea'),
        { value: url, style: 'position:fixed;opacity:0' });
      document.body.append(t); t.select(); document.execCommand('copy'); t.remove();
    }
    notice.classList.add('show');
    setTimeout(() => notice.classList.remove('show'), 2500);
  });
}

/* ─── INIT ────────────────────────────────────────────────────────────────── */
async function init() {
  const params = new URLSearchParams(window.location.search);
  const fecha  = params.get('fecha');

  if (!fecha) {
    document.getElementById('main-content').innerHTML =
      '<p class="state-msg">No se especificó ninguna pista. <a href="archivo.html">Ver archivo →</a></p>';
    return;
  }

  try {
    const [cover, list] = await Promise.all([loadCover(fecha), loadList()]);
    renderCover(cover, list);
    initShare();
  } catch (err) {
    console.error(err);
    document.getElementById('main-content').innerHTML =
      `<p class="state-msg">No se encontró la pista ${fecha}. <a href="archivo.html">Ver archivo →</a></p>`;
  }
}

document.addEventListener('DOMContentLoaded', init);
