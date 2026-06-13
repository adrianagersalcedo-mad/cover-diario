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

// ─── main ──────────────────────────────────────────────────────────────────────

console.log('\nRefrito build\n─────────────');
console.log('Sincronizando propuestas aprobadas…');
syncApproved();
console.log('Generando _list.json…');
buildList();
console.log('─────────────────\nListo.\n');
