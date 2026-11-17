// Prüft alle Bilderrätsel in /nonogram/data/ auf Format und eindeutige Lösbarkeit.
//
//   node nonogram/tools/check.mjs          # Bericht, Exit-Code 1 bei Fehlern
//   node nonogram/tools/check.mjs --fix    # nicht eindeutige Bilder automatisch minimal anpassen
//                                          # (schreibt die geänderten Zeilen in die Datendatei zurück)
//   node nonogram/tools/check.mjs --show   # unklare Zellen als '?' anzeigen

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { packs } from '../data/index.js';
import { validateDef, parsePuzzle, fixRows } from '../core/puzzle.js';
import { checkUnique, estimateDifficulty } from '../core/solver.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, '..', 'data');
const FIX = process.argv.includes('--fix');
const SHOW = process.argv.includes('--show');

let errors = 0;
const ids = new Set();
const fixes = new Map(); // file -> [{id, rows}]

for (const pack of packs) {
  const diff = [0, 0, 0, 0];
  let bad = 0;
  for (const def of pack.puzzles) {
    const errs = validateDef(def);
    if (ids.has(def.id)) errs.push('id doppelt');
    ids.add(def.id);
    if (errs.length) {
      console.log(`✗ ${pack.id}/${def.id}: ${errs.join('; ')}`);
      errors++;
      continue;
    }
    const p = parsePuzzle(def);
    const used = new Set(def.rows.join('').replace(/\./g, ''));
    for (const k of Object.keys(def.palette)) if (!used.has(k)) console.log(`  Hinweis ${def.id}: Farbe «${k}» unbenutzt`);
    const res = checkUnique(p.mask, p.w, p.h);
    if (!res.ok) {
      bad++;
      console.log(`✗ ${pack.id}/${def.id} (${p.w}×${p.h}): nicht eindeutig per Zeilenlogik (${res.unknown} Felder offen)`);
      if (SHOW) {
        for (let r = 0; r < p.h; r++) {
          let s = '    ';
          for (let c = 0; c < p.w; c++) {
            const g = res.grid[r * p.w + c];
            s += g === 0 ? '?' : def.rows[r][c];
          }
          console.log(s);
        }
      }
      if (FIX) {
        const f = fixRows(def.rows, 30);
        if (f.ok) {
          console.log(`  → repariert mit ${f.flips.length} Änderung(en): ${f.flips.map((x) => `(${x.r + 1},${x.c + 1}) ${x.from}→${x.to}`).join(', ')}`);
          const file = path.join(dataDir, `${pack.id}.js`);
          if (!fixes.has(file)) fixes.set(file, []);
          fixes.get(file).push({ id: def.id, rows: f.rows });
        } else {
          console.log('  → automatische Reparatur gescheitert');
          errors++;
        }
      } else errors++;
      continue;
    }
    diff[estimateDifficulty(p.mask, p.w, p.h)]++;
  }
  console.log(`${pack.id}: ${pack.puzzles.length} Bilder, ${bad} nicht eindeutig · Schwierigkeit leicht/mittel/schwer: ${diff[1]}/${diff[2]}/${diff[3]}`);
}

for (const [file, list] of fixes) {
  let src = await readFile(file, 'utf8');
  for (const { id, rows } of list) {
    const at = src.indexOf(`id: '${id}'`);
    if (at < 0) { console.log(`  ! ${id} nicht in ${file} gefunden`); continue; }
    const rs = src.indexOf('rows: [', at);
    const re = src.indexOf(']', rs);
    const lineStart = src.lastIndexOf('\n', rs) + 1;
    const indent = src.slice(lineStart, rs);
    const body = rows.map((r) => `${indent}  '${r}',`).join('\n');
    src = src.slice(0, rs) + `rows: [\n${body}\n${indent}]` + src.slice(re + 1);
  }
  await writeFile(file, src);
  console.log(`geschrieben: ${path.relative(process.cwd(), file)}`);
}

const total = packs.reduce((n, p) => n + p.puzzles.length, 0);
console.log(`\nInsgesamt ${total} Bilder.${errors ? ` ${errors} Problem(e).` : ' Alles in Ordnung.'}`);
process.exit(errors ? 1 : 0);
