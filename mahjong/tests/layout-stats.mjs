// Werkzeug: Übersicht über alle Layouts (Anzahl, Grösse, Passform, Lösbarkeit).
//   node mahjong/tests/layout-stats.mjs
import { layouts } from '../data/layouts.js';
import { parseLayout, validateLayout, buildBoard, freeTiles, generateDeal, solve, verifySolution, fitTileWidth, layoutExtent, sizeClass } from '../engine.js';

let total = 0;
for (const def of layouts) {
  const L = parseLayout(def);
  const probs = validateLayout(L);
  const perZ = [];
  for (const t of L.tiles) perZ[t.z] = (perZ[t.z] || 0) + 1;
  const b = buildBoard(L);
  const free0 = freeTiles(b, new Uint8Array(b.n).fill(1)).length;
  const e = layoutExtent(L.tiles);
  const fitSE = fitTileWidth(L.tiles, 375, 527).toFixed(1);
  const fit13 = fitTileWidth(L.tiles, 390, 610).toFixed(1);
  let gen = 'ok', t0 = Date.now(), solved = 0, unk = 0;
  try {
    for (let s = 0; s < 10; s++) {
      const d = generateDeal(b, def.id + s);
      if (!verifySolution(b, d.faces, new Uint8Array(b.n).fill(1), d.solution)) gen = 'BADCERT';
      const r = solve(b, d.faces, new Uint8Array(b.n).fill(1), { maxNodes: 20000 });
      if (r.result === 'solved') solved++; else unk++;
    }
  } catch (err) { gen = 'FAIL ' + err.message; }
  total++;
  console.log(`${def.id.padEnd(16)} ${String(L.tiles.length).padStart(3)} ${sizeClass(L.tiles.length).padEnd(6)} z=[${perZ.join(',')}] ${L.w / 2}x${L.h / 2} free0=${String(free0).padStart(2)} fitSE=${fitSE} fit13=${fit13} gen=${gen} solve=${solved}/${solved + unk} ${Date.now() - t0}ms ${probs.length ? 'PROBLEMS: ' + probs.slice(0, 3).join('; ') : ''}`);
}
console.log('Layouts:', total);
