// Erzeugt den Rätsel-Vorrat data/pool.js (sofortiger Start ohne Wartezeit).
//   node sudoku/tools/gen-pool.mjs            (200 pro Stufe)
//   node sudoku/tools/gen-pool.mjs 300        (300 pro Stufe)
//   node sudoku/tools/gen-pool.mjs 200 mittel (nur diese Stufe(n) neu, Rest bleibt wie er ist)
// Jedes Rätsel wird geprüft: genau eine Lösung, Stufe passt (menschlicher Löser).
// Innerhalb einer Stufe sortiert nach Punktzahl: die ersten Rätsel sind die sanftesten.
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { generate, fitsSpec } from '../logic/generator.js';
import { pool as oldPool } from '../data/pool.js';
import { grade } from '../logic/human.js';
import { parse } from '../logic/board.js';
import { countSolutions } from '../logic/solver.js';
import { difficulties } from '../data/difficulties.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const N = +process.argv[2] || 200;
const only = process.argv[3] ? process.argv[3].split(',') : null;
const out = {};
const report = [];

for (const spec of difficulties) {
  if (only && !only.includes(spec.id)) { out[spec.id] = oldPool[spec.id] || []; continue; }
  const seen = new Set();
  const list = [];
  const t0 = Date.now();
  for (let k = 0; list.length < N; k++) {
    const r = generate(spec, `pool-${spec.id}-${k}`);
    if (!r || seen.has(r.puzzle)) continue;
    const p = parse(r.puzzle);
    if (countSolutions(p, 2) !== 1) throw new Error('nicht eindeutig');
    const g = grade(p, 4);
    if (!fitsSpec(g, r.givens, spec)) continue;
    seen.add(r.puzzle);
    list.push({ p: r.puzzle, score: g.score, givens: r.givens, tier: g.tier });
  }
  list.sort((a, b) => a.score - b.score || a.p.localeCompare(b.p));
  out[spec.id] = list.map((x) => x.p);
  const sc = list.map((x) => x.score);
  const gv = list.map((x) => x.givens);
  const tiers = {};
  for (const x of list) tiers[x.tier] = (tiers[x.tier] || 0) + 1;
  report.push(`${spec.id}: ${list.length} Rätsel, Vorgaben ${Math.min(...gv)}–${Math.max(...gv)}, Punkte ${sc[0]}–${sc[sc.length - 1]} (Median ${sc[sc.length >> 1]}), Stufen ${JSON.stringify(tiers)}, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}

const body = `// Rätsel-Vorrat für Sudoku – automatisch erzeugt mit sudoku/tools/gen-pool.mjs.
// Pro Stufe ein Array mit 81-stelligen Rätseln ('0' = leeres Feld), sortiert von sanft nach knifflig.
// Eigene Rätsel dürfen ergänzt werden (siehe CONTENT.md) – die Tests prüfen jedes auf Eindeutigkeit und Stufe.
export const pool = {
${Object.entries(out).map(([k, arr]) => `  ${k}: [\n${arr.map((p) => `    '${p}',`).join('\n')}\n  ],`).join('\n')}
};
`;
await writeFile(path.join(here, '../data/pool.js'), body);
console.log(report.join('\n'));
