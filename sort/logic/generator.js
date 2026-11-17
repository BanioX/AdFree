// Farbfluss – Level-Generator (reine Logik, kein DOM, deterministisch).
//
// generate(params, rng) erzeugt einen zufälligen, aber vom Löser geprüften Startzustand.
//   params = {
//     colors: 7,          // Anzahl Farben (je 4 Schichten)
//     empties: 2,         // leere Gläser
//     tall: null,         // null | 'filled' (einige volle Gläser fassen 5–6) | 'empty' (ein leeres Glas fasst 6)
//     hidden: false,      // «Geheimnis»: nur die oberste Schicht ist sichtbar
//     minMoves: 10,       // Mindestlänge der Lösung (nicht zu leicht)
//     attempts: 40,       // Versuche, bevor der beste Kandidat genommen wird
//     budget: 50000,      // Suchknoten pro Löserlauf
//   }
// Rückgabe: { state, par, optimal, attempts }  (par = Länge der gefundenen Lösung)

import { PER_COLOR, validateState } from './rules.js';
import { solveBest, lowerBound } from './solver.js';

/** Welche vollen Gläser werden durch grosse ersetzt? (Summe bleibt gleich, ein Glas weniger) */
const TALL_SETS = [
  { min: 4, replace: 3, caps: [6, 6] },
  { min: 5, replace: 4, caps: [6, 5, 5] },
  { min: 6, replace: 5, caps: [5, 5, 5, 5] },
];

export function tubeCaps(params, rng) {
  const k = params.colors;
  const per = PER_COLOR;
  let filled = new Array(k).fill(per);
  const empties = new Array(params.empties ?? 2).fill(per);
  if (params.tall === 'filled') {
    const options = TALL_SETS.filter((t) => k >= t.min);
    if (options.length) {
      const set = rng.pick(options);
      filled = [...set.caps, ...new Array(k - set.replace).fill(per)];
    }
  } else if (params.tall === 'empty') {
    empties[0] = 6;
  }
  return { filled, empties };
}

function adjacentPairs(tubes) {
  let n = 0;
  for (const t of tubes) for (let i = 1; i < t.length; i++) if (t[i] === t[i - 1]) n++;
  return n;
}

/** Ein zufälliger Startzustand (ohne Lösbarkeitsprüfung). */
export function randomLayout(params, rng) {
  const k = params.colors;
  const { filled, empties } = tubeCaps(params, rng);
  const maxAdj = params.hidden ? 0 : (params.maxAdjacent ?? Math.max(1, Math.floor(k / 3)));
  let tubes = null;
  for (let tries = 0; tries < 400; tries++) {
    const units = [];
    for (let c = 0; c < k; c++) for (let i = 0; i < PER_COLOR; i++) units.push(c);
    rng.shuffle(units);
    const ts = [];
    let p = 0;
    for (const cap of filled) { ts.push(units.slice(p, p + cap)); p += cap; }
    // Kein Glas darf schon fertig sein, kein Glas fast fertig (3 gleiche + 1)
    let ok = true;
    for (const t of ts) {
      const counts = new Map();
      for (const c of t) counts.set(c, (counts.get(c) || 0) + 1);
      for (const v of counts.values()) if (v >= PER_COLOR) ok = false;
    }
    if (!ok) continue;
    const adj = adjacentPairs(ts);
    if (adj > maxAdj) continue;
    tubes = ts;
    break;
  }
  if (!tubes) return null;
  // Gläser mischen, damit grosse Gläser nicht immer vorne stehen; leere hinten
  rng.shuffle(tubes);
  const all = [
    ...tubes.map((l) => ({ cap: l.length, l, h: params.hidden ? l.length - 1 : 0 })),
    ...empties.map((cap) => ({ cap, l: [], h: 0 })),
  ];
  return { per: PER_COLOR, tubes: all };
}

export function generate(params, rng) {
  const attempts = params.attempts ?? 40;
  const budget = params.budget ?? 50000;
  const minMoves = params.minMoves ?? 0;
  let best = null;
  for (let a = 1; a <= attempts; a++) {
    const state = randomLayout(params, rng);
    if (!state) continue;
    if (validateState(state)) continue;
    // Schnelle Vorprüfung: untere Schranke schon zu klein → zu leicht
    if (lowerBound(state) < Math.min(minMoves, 4) * 0.5) continue;
    const r = solveBest(state, { budget, weights: params.weights ?? [1, 1.5, 3, 6] });
    if (!r || !r.moves) continue;
    const len = r.moves.length;
    const cand = { state, par: len, optimal: r.optimal, solution: r.moves, attempts: a };
    if (len >= minMoves) return cand;
    if (!best || len > best.par) best = cand;
  }
  return best;
}
