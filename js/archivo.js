const PALETTES = [
  { bg: '#EFEAD9', frame: '#EF5226', text: '#16110D', hi: '#C03C0C' },
  { bg: '#F45DAE', frame: '#16110D', text: '#16110D', hi: '#16110D' },
  { bg: '#12A357', frame: '#EF5226', text: '#EFEAD9', hi: '#EFEAD9' },
  { bg: '#E8B53C', frame: '#16110D', text: '#16110D', hi: '#16110D' },
];
function paletteForDate(iso) {
  const days = Math.floor(new Date(iso).getTime() / 86400000);
  return PALETTES[((days % 4) + 4) % 4];
}
function fmtDate(iso) {
  const [y, m, d] = iso.split('-');
  return new Date(+y, +m - 1, +d)
    .toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
    .toUpperCase().replace(/\./g, '');
}

const PER_PAGE = 20;
let allCovers = [];
let page = 0;

async function loadAll() {
  const listRes = await fetch('content/covers/_list.json');
  const dates   = await listRes.json();
  const sorted  = dates.slice().sort((a, b) => b.localeCompare(a));
  return Promise.all(
    sorted.map(d => fetch(`content/covers/${d}.json`).then(r => r.json()))
  );
}

function renderPage() {
  const today  = new Date().toISOString().slice(0, 10);
  const sorted = [...allCovers].sort((a, b) => b.fecha.localeCompare(a.fecha));
  const total  = sorted.length;
  const start  = page * PER_PAGE;
  const slice  = sorted.slice(start, start + PER_PAGE);
  const list   = document.getElementById('tracklist');

  list.innerHTML = slice.map(c => {
    const isToday = c.fecha === today;
    return `
      <li class="${isToday ? 't-today' : ''}">
        <a href="pista?fecha=${c.fecha}">
          <span class="t-num">${String(c.numeroPista).padStart(3, '0')}</span>
          <span class="t-body">
            <span class="t-song">${c.tituloCancion}</span>
            <span class="t-sub">${c.interpreteCover} ↺ ${c.artistaOriginal}</span>
          </span>
          <span class="t-date">${fmtDate(c.fecha)}${isToday ? ' · HOY' : ''}</span>
        </a>
      </li>`;
  }).join('');

  document.getElementById('count-label').textContent = `${total} pistas`;
  document.getElementById('page-label').textContent  =
    `${start + 1}–${Math.min(start + PER_PAGE, total)} / ${total}`;

  document.getElementById('btn-prev').disabled = page === 0;
  document.getElementById('btn-next').disabled = start + PER_PAGE >= total;
}

async function init() {
  const today = new Date().toISOString().slice(0, 10);
  const p = paletteForDate(today);
  document.documentElement.style.setProperty('--day-bg',    p.bg);
  document.documentElement.style.setProperty('--day-frame', p.frame);
  document.documentElement.style.setProperty('--day-text',  p.text);
  document.documentElement.style.setProperty('--day-hi',    p.hi);
  document.body.style.background = p.bg;
  document.body.style.color      = p.text;

  try {
    allCovers = await loadAll();
    renderPage();
  } catch (e) {
    document.getElementById('tracklist').innerHTML =
      '<li><p class="state-msg">No se pudo cargar el archivo.</p></li>';
  }

  document.getElementById('btn-prev').addEventListener('click', () => { page--; renderPage(); window.scrollTo(0, 0); });
  document.getElementById('btn-next').addEventListener('click', () => { page++; renderPage(); window.scrollTo(0, 0); });
}

document.addEventListener('DOMContentLoaded', init);
