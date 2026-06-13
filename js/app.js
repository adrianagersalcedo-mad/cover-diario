/* ─── PALETTE ROTATION ────────────────────────────────────────────────────── */
const PALETTES = [
  { bg: '#EFEAD9', frame: '#EF5226', text: '#16110D', player: '#3D8A60', hi: '#C03C0C' },
  { bg: '#C97A9C', frame: '#16110D', text: '#16110D', player: '#EF5226', hi: '#16110D' },
  { bg: '#7AB897', frame: '#EF5226', text: '#16110D', player: '#C9A04A', hi: '#16110D' },
  { bg: '#C9A04A', frame: '#16110D', text: '#16110D', player: '#3D8A60', hi: '#16110D' },
];

function paletteForDate(isoDate) {
  const days = Math.floor(new Date(isoDate).getTime() / 86400000);
  return PALETTES[((days % 4) + 4) % 4];
}

function applyPalette(p) {
  const r = document.documentElement.style;
  r.setProperty('--day-bg',    p.bg);
  r.setProperty('--day-frame', p.frame);
  r.setProperty('--day-text',  p.text);
  r.setProperty('--day-hi',    p.hi);
  r.setProperty('--verde',     p.player); // re-uses --verde for player border
  document.body.style.background = p.bg;
  document.body.style.color      = p.text;
}

/* ─── DATA LOADING ────────────────────────────────────────────────────────── */
async function loadList() {
  const res = await fetch('content/covers/_list.json');
  if (!res.ok) throw new Error('No list');
  return res.json(); // ["2026-06-09", ...]
}

async function loadCover(date) {
  const res = await fetch(`content/covers/${date}.json`);
  if (!res.ok) throw new Error(`No cover for ${date}`);
  return res.json();
}

function pastDates(list) {
  const today = new Date().toISOString().slice(0, 10);
  return list.filter(d => d <= today).sort();
}

/* ─── RECOMMENDATION ──────────────────────────────────────────────────────── */
async function loadAllCovers(dates) {
  const results = await Promise.all(
    dates.map(d => fetch(`content/covers/${d}.json`).then(r => r.json()).catch(() => null))
  );
  return results.filter(Boolean);
}

const TAG_REASONS = {
  'acustico':       'Otra versión a una guitarra',
  'intimo':         'Misma intimidad de cuarto',
  'piano':          'También a piano',
  'retiro':         'Mismo gesto: bajarse del mundo',
  'folk':           'Folk hasta los huesos',
  'rock':           'Del mismo palo',
  'soul':           'Misma alma',
  'live':           'También en directo',
  'john-lennon':    'Versiona al mismo autor',
  'paul-mccartney': 'Versiona al mismo autor',
  'bob-dylan':      'Versiona al mismo autor',
  'elliott-smith':  'Versiona al mismo autor',
};

function pickRecommendation(current, allCovers) {
  const currentTags = current.tags || [];
  let best = null, bestCount = -1, bestTag = null;

  for (const c of allCovers) {
    if (c.fecha === current.fecha) continue;
    const shared = (c.tags || []).filter(t => currentTags.includes(t));
    if (shared.length > bestCount) {
      bestCount = shared.length;
      best = c;
      const priority = Object.keys(TAG_REASONS);
      bestTag = shared.sort((a, b) => priority.indexOf(a) - priority.indexOf(b))[0] || null;
    }
  }

  if (!best) {
    best = allCovers
      .filter(c => c.fecha !== current.fecha)
      .sort((a, b) => b.fecha.localeCompare(a.fecha))[0] || null;
  }

  const razon = (bestTag && TAG_REASONS[bestTag]) || 'Siguiente en el mixtape';
  return { cover: best, razon };
}

function renderRecommendation(rec, razon) {
  const band = document.getElementById('recm-band');
  if (!band || !rec) return;

  const perf  = (rec.interpreteCover || '').trim().toUpperCase();
  const meta  = `versiona a ${rec.artistaOriginal} · "${rec.tituloCancion}"`;
  const label = `Siguiente en la cinta: ${rec.interpreteCover.trim()} versiona a ${rec.artistaOriginal}, "${rec.tituloCancion}". ${razon}.`;

  const seg = `<span class="recm-seg">` +
    `<span class="recm-eye">↺ Siguiente en la cinta</span>` +
    `<span class="recm-perf">${perf}</span>` +
    `<span class="recm-meta">${meta}</span>` +
    `<span class="recm-rea">${razon}</span>` +
    `<span class="recm-arr">↗</span>` +
    `<span class="recm-sep">/</span>` +
    `</span>`;

  band.querySelector('.recm-track').innerHTML = seg.repeat(4);
  band.href = `pista?fecha=${rec.fecha}`;
  band.setAttribute('aria-label', label);
  band.dataset.animate = '1';
  band.hidden = false;
}

/* ─── DATE FORMAT ─────────────────────────────────────────────────────────── */
function fmtDate(iso) {
  const [y, m, d] = iso.split('-');
  return new Date(+y, +m - 1, +d)
    .toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
    .toUpperCase().replace(/\./g, '');
}

/* ─── RENDER ──────────────────────────────────────────────────────────────── */
function renderCover(c) {
  // Palette
  applyPalette(paletteForDate(c.fecha));

  // Mono bar
  setText('meta-num',  `PISTA Nº ${c.numeroPista}`);
  setText('meta-date', fmtDate(c.fecha));

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

  // Firma visual
  setText('cover-name',     c.interpreteCover.toUpperCase());
  setText('original-script',`↺ versiona a ${c.artistaOriginal} · "${c.tituloCancion}"`);

  // Song stripe
  setText('stripe-title',   `"${c.tituloCancion}"`);
  setText('stripe-original', c.artistaOriginal);

  // Curatorial
  const el = document.getElementById('curatorial-text');
  el.innerHTML = c.textoCuratorial
    .split(/\n\n+/).filter(Boolean)
    .map(p => `<p>${p.trim()}</p>`).join('');

  // Credits
  setText('cred-cover-name',   c.interpreteCover);
  setLink('cred-cover-link',   c.canalCoverUrl, 'Canal ↗');
  setText('cred-orig-name',    `${c.artistaOriginal} · "${c.tituloCancion}"`);
  setLink('cred-orig-link',    c.videoOriginalUrl, 'Ver original ↗');
  setLink('cred-yt-link',      `https://www.youtube.com/watch?v=${c.youtubeId}`, 'YouTube ↗');

  // Share data
  const btn = document.getElementById('btn-share');
  if (btn) btn.dataset.title = `Pista ${c.numeroPista}: ${c.interpreteCover} versiona a ${c.artistaOriginal}`;

  // Page title
  document.title = `Pista ${c.numeroPista} · ${c.interpreteCover} — Refrito`;
}

/* ─── HELPERS ─────────────────────────────────────────────────────────────── */
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
function setLink(id, href, text) {
  const el = document.getElementById(id);
  if (!el) return;
  el.href        = href;
  el.textContent = text;
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
      document.body.append(t); t.select(); document.execCommand('copy');
      t.remove();
    }
    notice.classList.add('show');
    setTimeout(() => notice.classList.remove('show'), 2500);
  });
}

/* ─── INIT ────────────────────────────────────────────────────────────────── */
function renderNav(cover, list) {
  const sorted  = list.slice().sort();
  const idx     = sorted.indexOf(cover.fecha);
  const prevEl  = document.getElementById('nav-prev');
  const nextEl  = document.getElementById('nav-next');
  if (!prevEl || !nextEl) return;

  if (idx > 0) {
    prevEl.href = `pista?fecha=${sorted[idx - 1]}`;
    prevEl.classList.remove('disabled');
  } else {
    prevEl.classList.add('disabled');
  }
  if (idx < sorted.length - 1) {
    nextEl.href = `pista?fecha=${sorted[idx + 1]}`;
    nextEl.classList.remove('disabled');
  } else {
    nextEl.classList.add('disabled');
  }
}

async function init() {
  try {
    const list  = await loadList();
    const past  = pastDates(list);
    const date  = past.at(-1); // most recent published
    const cover = await loadCover(date);
    renderCover(cover);
    renderNav(cover, past);
    initShare();
  } catch (err) {
    console.error(err);
    document.getElementById('main-content').innerHTML =
      '<p class="state-msg">No se pudo cargar la pista de hoy.</p>';
  }
}

document.addEventListener('DOMContentLoaded', init);
