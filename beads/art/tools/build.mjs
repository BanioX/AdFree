// Baut die Perlenbild-Musterdaten aus den Quellen in tools/src/ und schreibt reine Daten-Module
// nach /beads/art/<stufe>.js (die /beads/art/index.js statisch importiert).
//
//   node beads/art/tools/build.mjs            # alles bauen
//   node beads/art/tools/build.mjs --print fox # zusätzlich ein Muster als ASCII ausgeben
//
// Danach: node beads/art/tools/validate.mjs  und  node beads/art/tools/contact-sheet.cjs

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Grid } from './raster.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const artDir = path.resolve(here, '..');
export const TIERS = ['small', 'medium', 'large', 'showpieces'];

function resolveEntry(e) {
  let rows = e.rows;
  if (typeof e.build === 'function') rows = e.build();
  if (rows instanceof Grid) rows = rows.rows();
  if (!Array.isArray(rows)) throw new Error(`${e.id}: keine Zeilen`);
  return { id: e.id, title: e.title, category: e.category, palette: e.palette, rows };
}

const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

function serialize(list, src) {
  const out = [
    `// Automatisch erzeugt von tools/build.mjs aus tools/src/${src}.mjs – bitte dort ändern.`,
    `// Format siehe DEV.md («Datenformat: Perlenbild»). '.' = keine Perle.`,
    '',
    'export default [',
  ];
  for (const p of list) {
    const pal = Object.entries(p.palette).map(([k, v]) => `${k}: ${q(v)}`).join(', ');
    out.push('  {');
    out.push(`    id: ${q(p.id)}, title: ${q(p.title)}, category: ${q(p.category)},`);
    out.push(`    palette: { ${pal} },`);
    out.push('    rows: [');
    for (const r of p.rows) out.push(`      ${q(r)},`);
    out.push('    ],');
    out.push('  },');
  }
  out.push('];', '');
  return out.join('\n');
}

const args = process.argv.slice(2);
const printIds = new Set();
for (let i = 0; i < args.length; i++) if (args[i] === '--print') printIds.add(args[++i]);

for (const tier of [...TIERS, 'scratch', 'scratch2', 'scratch3']) {
  let mod;
  try {
    mod = await import(`./src/${tier}.mjs?t=${Date.now()}`);
  } catch (err) {
    if (err.code === 'ERR_MODULE_NOT_FOUND' && String(err.message).includes(`${tier}.mjs`)) {
      if (!tier.startsWith('scratch')) console.warn(`(übersprungen: src/${tier}.mjs fehlt)`);
      continue;
    }
    throw err;
  }
  const list = mod.default.map(resolveEntry);
  await writeFile(tier.startsWith('scratch') ? path.join(here, 'out', `${tier}.js`) : path.join(artDir, `${tier}.js`), serialize(list, tier));
  console.log(`${tier}.js: ${list.length} Muster`);
  for (const p of list) {
    if (printIds.has(p.id) || printIds.has('all')) {
      console.log(`\n${p.id} ${p.rows[0].length}x${p.rows.length}`);
      console.log(p.rows.join('\n'));
    }
  }
}
