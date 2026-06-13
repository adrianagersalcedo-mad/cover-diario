#!/usr/bin/env node
/**
 * Build script — se ejecuta en cada deploy (Netlify) y en desarrollo.
 *
 * 1. Lee content/proposals/*.json con estado "aprobada"
 *    y los copia a content/covers/YYYY-MM-DD.json (sin el campo estado).
 * 2. Regenera content/covers/_list.json con todas las fechas disponibles.
 */

const fs   = require('fs');
const path = require('path');

const ROOT          = path.join(__dirname, '..');
const PROPOSALS_DIR = path.join(ROOT, 'content', 'proposals');
const COVERS_DIR    = path.join(ROOT, 'content', 'covers');

// ─── helpers ──────────────────────────────────────────────────────────────────

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

// ─── 1. sync approved proposals → covers ──────────────────────────────────────

function syncApproved() {
  ensureDir(PROPOSALS_DIR);
  ensureDir(COVERS_DIR);

  const files = fs.readdirSync(PROPOSALS_DIR).filter(f => f.endsWith('.json'));
  let synced  = 0;

  for (const file of files) {
    let proposal;
    try { proposal = readJSON(path.join(PROPOSALS_DIR, file)); }
    catch (e) { console.warn(`  ⚠ No se pudo leer ${file}: ${e.message}`); continue; }

    if (proposal.estado !== 'aprobada') continue;

    if (!proposal.fecha) {
      console.warn(`  ⚠ Propuesta ${file} aprobada pero sin fecha — omitida`);
      continue;
    }
    if (!proposal.numeroPista) {
      console.warn(`  ⚠ Propuesta ${file} aprobada pero sin numeroPista — omitida`);
      continue;
    }

    const coverPath = path.join(COVERS_DIR, `${proposal.fecha}.json`);

    // No sobreescribir un cover ya publicado
    if (fs.existsSync(coverPath)) continue;

    // Genera id si no existe, luego copia sin el campo estado
    if (!proposal.id) {
      proposal.id = `cover-${proposal.numeroPista}`;
    }
    const { estado, ...cover } = proposal;
    writeJSON(coverPath, cover);
    console.log(`  ✓ ${file} → covers/${proposal.fecha}.json`);
    synced++;
  }

  if (synced === 0) console.log('  · Sin propuestas nuevas aprobadas');
}

// ─── 2. regenerate _list.json ──────────────────────────────────────────────────

function buildList() {
  ensureDir(COVERS_DIR);

  const dates = fs.readdirSync(COVERS_DIR)
    .filter(f => f.endsWith('.json') && f !== '_list.json')
    .map(f => f.replace('.json', ''))
    .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();

  writeJSON(path.join(COVERS_DIR, '_list.json'), dates);
  console.log(`  ✓ _list.json → ${dates.length} pista(s)`);
}

// ─── 3. generate sitemap.xml ──────────────────────────────────────────────────

function buildSitemap() {
  const listPath = path.join(COVERS_DIR, '_list.json');
  const dates    = JSON.parse(fs.readFileSync(listPath, 'utf-8'));
  const BASE     = 'https://refrito.org';

  const staticPages = [
    { loc: `${BASE}/`,        priority: '1.0', changefreq: 'daily'   },
    { loc: `${BASE}/archivo`, priority: '0.7', changefreq: 'daily'   },
    { loc: `${BASE}/acerca`,  priority: '0.3', changefreq: 'monthly' },
  ];

  const coverEntries = dates.map(d =>
    `  <url>\n    <loc>${BASE}/pista?fecha=${d}</loc>\n    <lastmod>${d}</lastmod>\n    <changefreq>never</changefreq>\n    <priority>0.6</priority>\n  </url>`
  );

  const staticEntries = staticPages.map(p =>
    `  <url>\n    <loc>${p.loc}</loc>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>`
  );

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...staticEntries,
    ...coverEntries,
    '</urlset>',
  ].join('\n');

  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), xml + '\n');
  console.log(`  ✓ sitemap.xml → ${staticPages.length + dates.length} URL(s)`);
}

// ─── main ──────────────────────────────────────────────────────────────────────

console.log('\nRefrito build\n─────────────');
console.log('Sincronizando propuestas aprobadas…');
syncApproved();
console.log('Generando _list.json…');
buildList();
console.log('Generando sitemap.xml…');
buildSitemap();
console.log('─────────────────\nListo.\n');
