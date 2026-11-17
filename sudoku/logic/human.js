// Menschlicher Löser: findet den nächsten logischen Schritt mit bekannten Techniken.
// Wird für die Schwierigkeits-Einstufung und für die Tipps verwendet.
// Reine Logik – kein DOM.
//
// Ein Schritt (Step) sieht so aus:
// {
//   tech: 'hiddenSingle',            // Technik-ID (siehe TECHNIQUES)
//   tier: 1,                         // Stufe 1..4
//   place: { c: 40, d: 7 } | null,   // Ziffer eintragen
//   elims: [{ c, d }],               // Kandidaten streichen
//   digits: [7],                     // beteiligte Ziffern
//   units: [3],                      // beteiligte Einheiten (0–8 Reihen, 9–17 Spalten, 18–26 Blöcke)
//   cells: [40],                     // Muster-Zellen (werden im Tipp hervorgehoben)
// }

import {
  ALL, bit, UNITS, CELL_UNITS, PEERS, sees, popcount, digitsOf, singleDigit,
  rowOf, colOf, boxOf, candidatesFromValues,
} from './board.js';

export const TECHNIQUES = {
  fullHouse: { tier: 1, weight: 1 },
  hiddenSingle: { tier: 1, weight: 2 },
  nakedSingle: { tier: 1, weight: 3 },
  pointing: { tier: 2, weight: 8 },
  claiming: { tier: 2, weight: 9 },
  nakedPair: { tier: 2, weight: 10 },
  hiddenPair: { tier: 2, weight: 12 },
  nakedTriple: { tier: 3, weight: 18 },
  hiddenTriple: { tier: 3, weight: 22 },
  xWing: { tier: 3, weight: 25 },
  xyWing: { tier: 4, weight: 32 },
  xyzWing: { tier: 4, weight: 36 },
  swordfish: { tier: 4, weight: 40 },
  nakedQuad: { tier: 4, weight: 42 },
  hiddenQuad: { tier: 4, weight: 46 },
};

/** Zustand für den Löser: Ziffern + Kandidaten. elims (optional): bereits gestrichene Kandidaten je Zelle. */
export function makeState(values, elims = null) {
  const v = Int8Array.from(values);
  const c = candidatesFromValues(v);
  if (elims) for (let i = 0; i < 81; i++) c[i] &= ~(elims[i] | 0);
  return { v, c };
}

export function cloneState(s) {
  return { v: Int8Array.from(s.v), c: Uint16Array.from(s.c) };
}

export function placeDigit(s, i, d) {
  s.v[i] = d;
  s.c[i] = 0;
  const m = ~bit(d);
  for (const j of PEERS[i]) s.c[j] &= m;
}

export function applyStep(s, step) {
  if (step.place) placeDigit(s, step.place.c, step.place.d);
  for (const e of step.elims) s.c[e.c] &= ~bit(e.d);
}

export function isSolvedState(s) {
  for (let i = 0; i < 81; i++) if (!s.v[i]) return false;
  return true;
}

/** Widerspruch? (leere Zelle ohne Kandidaten oder Ziffer ohne Platz in einer Einheit) */
export function hasContradiction(s) {
  for (let i = 0; i < 81; i++) if (!s.v[i] && !s.c[i]) return true;
  for (const unit of UNITS) {
    let placed = 0, possible = 0;
    for (const i of unit) {
      if (s.v[i]) {
        if (placed & bit(s.v[i])) return true;
        placed |= bit(s.v[i]);
      } else possible |= s.c[i];
    }
    if ((placed | possible) !== ALL) return true;
  }
  return false;
}

const mk = (tech, extra) => ({ tech, tier: TECHNIQUES[tech].tier, place: null, elims: [], digits: [], units: [], cells: [], ...extra });

// Reihenfolge der Einheiten für Einer: erst Blöcke (am natürlichsten), dann Reihen, dann Spalten.
const SINGLE_UNIT_ORDER = [18, 19, 20, 21, 22, 23, 24, 25, 26, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

// ---------- Stufe 1 ----------

function fullHouse(s) {
  for (const u of SINGLE_UNIT_ORDER) {
    let empty = -1, n = 0, placed = 0;
    for (const i of UNITS[u]) {
      if (s.v[i]) placed |= bit(s.v[i]);
      else { empty = i; n++; }
    }
    if (n === 1) {
      const m = ALL & ~placed;
      if (popcount(m) === 1 && (s.c[empty] & m)) {
        const d = singleDigit(m);
        return mk('fullHouse', { place: { c: empty, d }, digits: [d], units: [u], cells: [empty] });
      }
    }
  }
  return null;
}

function hiddenSingle(s) {
  for (const u of SINGLE_UNIT_ORDER) {
    const unit = UNITS[u];
    let placed = 0;
    for (const i of unit) if (s.v[i]) placed |= bit(s.v[i]);
    for (let d = 1; d <= 9; d++) {
      const b = bit(d);
      if (placed & b) continue;
      let pos = -1, n = 0;
      for (const i of unit) if (!s.v[i] && (s.c[i] & b)) { pos = i; if (++n > 1) break; }
      if (n === 1) return mk('hiddenSingle', { place: { c: pos, d }, digits: [d], units: [u], cells: [pos] });
    }
  }
  return null;
}

function nakedSingle(s) {
  for (let i = 0; i < 81; i++) {
    if (!s.v[i] && popcount(s.c[i]) === 1) {
      const d = singleDigit(s.c[i]);
      return mk('nakedSingle', { place: { c: i, d }, digits: [d], units: [...CELL_UNITS[i]], cells: [i] });
    }
  }
  return null;
}

// ---------- Stufe 2+ ----------

function cellsWith(unit, s, b) {
  const out = [];
  for (const i of unit) if (!s.v[i] && (s.c[i] & b)) out.push(i);
  return out;
}

function pointing(s) {
  for (let bx = 18; bx < 27; bx++) {
    for (let d = 1; d <= 9; d++) {
      const b = bit(d);
      const cells = cellsWith(UNITS[bx], s, b);
      if (cells.length < 2) continue;
      for (const lineOf of [rowOf, colOf]) {
        const line = lineOf(cells[0]);
        if (!cells.every((i) => lineOf(i) === line)) continue;
        const lu = lineOf === rowOf ? line : 9 + line;
        const elims = UNITS[lu].filter((i) => boxOf(i) !== bx - 18 && !s.v[i] && (s.c[i] & b)).map((c) => ({ c, d }));
        if (elims.length) return mk('pointing', { elims, digits: [d], units: [bx, lu], cells });
      }
    }
  }
  return null;
}

function claiming(s) {
  for (let lu = 0; lu < 18; lu++) {
    for (let d = 1; d <= 9; d++) {
      const b = bit(d);
      const cells = cellsWith(UNITS[lu], s, b);
      if (cells.length < 2) continue;
      const bx = boxOf(cells[0]);
      if (!cells.every((i) => boxOf(i) === bx)) continue;
      const inLine = (i) => (lu < 9 ? rowOf(i) === lu : colOf(i) === lu - 9);
      const elims = UNITS[18 + bx].filter((i) => !inLine(i) && !s.v[i] && (s.c[i] & b)).map((c) => ({ c, d }));
      if (elims.length) return mk('claiming', { elims, digits: [d], units: [lu, 18 + bx], cells });
    }
  }
  return null;
}

function* combos(arr, n, start = 0, acc = []) {
  if (acc.length === n) { yield acc; return; }
  for (let k = start; k <= arr.length - (n - acc.length); k++) {
    acc.push(arr[k]);
    yield* combos(arr, n, k + 1, acc);
    acc.pop();
  }
}

const NAKED = { 2: 'nakedPair', 3: 'nakedTriple', 4: 'nakedQuad' };
const HIDDEN = { 2: 'hiddenPair', 3: 'hiddenTriple', 4: 'hiddenQuad' };

function nakedSubset(s, n) {
  for (const u of SINGLE_UNIT_ORDER) {
    const unit = UNITS[u];
    const empties = unit.filter((i) => !s.v[i]);
    if (empties.length <= n) continue;
    const cand = empties.filter((i) => { const p = popcount(s.c[i]); return p >= 2 && p <= n; });
    if (cand.length < n) continue;
    for (const combo of combos(cand, n)) {
      let m = 0;
      for (const i of combo) m |= s.c[i];
      if (popcount(m) !== n) continue;
      const elims = [];
      for (const i of empties) {
        if (combo.includes(i)) continue;
        const x = s.c[i] & m;
        if (x) for (const d of digitsOf(x)) elims.push({ c: i, d });
      }
      if (elims.length) return mk(NAKED[n], { elims, digits: digitsOf(m), units: [u], cells: [...combo] });
    }
  }
  return null;
}

function hiddenSubset(s, n) {
  for (const u of SINGLE_UNIT_ORDER) {
    const unit = UNITS[u];
    const empties = unit.filter((i) => !s.v[i]);
    if (empties.length <= n) continue;
    const pos = {};
    const digits = [];
    for (let d = 1; d <= 9; d++) {
      const cells = cellsWith(unit, s, bit(d));
      if (cells.length >= 2 && cells.length <= n) { pos[d] = cells; digits.push(d); }
    }
    if (digits.length < n) continue;
    for (const combo of combos(digits, n)) {
      const cellSet = new Set();
      for (const d of combo) for (const i of pos[d]) cellSet.add(i);
      if (cellSet.size !== n) continue;
      let keep = 0;
      for (const d of combo) keep |= bit(d);
      const elims = [];
      for (const i of cellSet) {
        const x = s.c[i] & ~keep;
        if (x) for (const d of digitsOf(x)) elims.push({ c: i, d });
      }
      if (elims.length) return mk(HIDDEN[n], { elims, digits: [...combo], units: [u], cells: [...cellSet].sort((a, b) => a - b) });
    }
  }
  return null;
}

function fish(s, n, tech) {
  for (let d = 1; d <= 9; d++) {
    const b = bit(d);
    for (const byRow of [true, false]) {
      // Basis-Linien: Reihen (bzw. Spalten), in denen d 2..n Plätze hat
      const bases = [];
      for (let k = 0; k < 9; k++) {
        const unit = UNITS[byRow ? k : 9 + k];
        let mask = 0, cnt = 0;
        for (const i of unit) if (!s.v[i] && (s.c[i] & b)) { mask |= 1 << (byRow ? colOf(i) : rowOf(i)); cnt++; }
        if (cnt >= 2 && cnt <= n) bases.push({ k, mask });
      }
      if (bases.length < n) continue;
      for (const combo of combos(bases, n)) {
        let cover = 0;
        for (const x of combo) cover |= x.mask;
        if (popcount(cover) !== n) continue;
        const baseSet = new Set(combo.map((x) => x.k));
        const elims = [];
        for (let k = 0; k < 9; k++) {
          if (!(cover & (1 << k))) continue;
          for (const i of UNITS[byRow ? 9 + k : k]) {
            const line = byRow ? rowOf(i) : colOf(i);
            if (!baseSet.has(line) && !s.v[i] && (s.c[i] & b)) elims.push({ c: i, d });
          }
        }
        if (!elims.length) continue;
        const cells = [];
        for (const x of combo) for (const i of UNITS[byRow ? x.k : 9 + x.k]) if (!s.v[i] && (s.c[i] & b)) cells.push(i);
        const units = combo.map((x) => (byRow ? x.k : 9 + x.k));
        for (let k = 0; k < 9; k++) if (cover & (1 << k)) units.push(byRow ? 9 + k : k);
        return mk(tech, { elims, digits: [d], units, cells: cells.sort((a, c) => a - c) });
      }
    }
  }
  return null;
}

function xyWing(s) {
  for (let p = 0; p < 81; p++) {
    if (s.v[p] || popcount(s.c[p]) !== 2) continue;
    const pm = s.c[p];
    const wings = PEERS[p].filter((i) => !s.v[i] && popcount(s.c[i]) === 2 && popcount(s.c[i] & pm) === 1);
    for (let x = 0; x < wings.length; x++) {
      for (let y = x + 1; y < wings.length; y++) {
        const a = wings[x], b = wings[y];
        const am = s.c[a], bm = s.c[b];
        if ((am & pm) === (bm & pm)) continue; // müssen verschiedene Pivot-Ziffern teilen
        const za = am & ~pm, zb = bm & ~pm;
        if (za !== zb || popcount(za) !== 1) continue;
        const z = singleDigit(za);
        const elims = [];
        for (let i = 0; i < 81; i++) {
          if (i === p || i === a || i === b || s.v[i] || !(s.c[i] & za)) continue;
          if (sees(i, a) && sees(i, b)) elims.push({ c: i, d: z });
        }
        if (elims.length) return mk('xyWing', { elims, digits: [...digitsOf(pm), z], units: [], cells: [p, a, b] });
      }
    }
  }
  return null;
}

function xyzWing(s) {
  for (let p = 0; p < 81; p++) {
    if (s.v[p] || popcount(s.c[p]) !== 3) continue;
    const pm = s.c[p];
    const wings = PEERS[p].filter((i) => !s.v[i] && popcount(s.c[i]) === 2 && (s.c[i] & ~pm) === 0);
    for (let x = 0; x < wings.length; x++) {
      for (let y = x + 1; y < wings.length; y++) {
        const a = wings[x], b = wings[y];
        if ((s.c[a] | s.c[b]) !== pm) continue;
        const zm = s.c[a] & s.c[b];
        if (popcount(zm) !== 1) continue;
        const z = singleDigit(zm);
        const elims = [];
        for (let i = 0; i < 81; i++) {
          if (i === p || i === a || i === b || s.v[i] || !(s.c[i] & zm)) continue;
          if (sees(i, p) && sees(i, a) && sees(i, b)) elims.push({ c: i, d: z });
        }
        if (elims.length) return mk('xyzWing', { elims, digits: digitsOf(pm), units: [], cells: [p, a, b] });
      }
    }
  }
  return null;
}

/** Technik-Finder in der Reihenfolge, in der ein Mensch sie anwenden würde. */
const FINDERS = [
  [1, fullHouse],
  [1, hiddenSingle],
  [1, nakedSingle],
  [2, pointing],
  [2, claiming],
  [2, (s) => nakedSubset(s, 2)],
  [2, (s) => hiddenSubset(s, 2)],
  [3, (s) => nakedSubset(s, 3)],
  [3, (s) => hiddenSubset(s, 3)],
  [3, (s) => fish(s, 2, 'xWing')],
  [4, xyWing],
  [4, xyzWing],
  [4, (s) => fish(s, 3, 'swordfish')],
  [4, (s) => nakedSubset(s, 4)],
  [4, (s) => hiddenSubset(s, 4)],
];

/** Nächster logischer Schritt (einfachste Technik zuerst) oder null. */
export function findStep(s, maxTier = 4) {
  for (const [tier, fn] of FINDERS) {
    if (tier > maxTier) break;
    const st = fn(s);
    if (st) return st;
  }
  return null;
}

/**
 * Löst ein Rätsel nur mit Techniken bis maxTier und stuft es ein.
 * @returns {{ solved, tier, score, steps, counts, values }}
 */
export function grade(values, maxTier = 4, { keepSteps = false } = {}) {
  const s = makeState(values);
  const counts = {};
  const steps = keepSteps ? [] : null;
  let tier = 0, score = 0, n = 0;
  if (hasContradiction(s)) return { solved: false, tier: Infinity, score: 0, steps, counts, values: Array.from(s.v) };
  while (!isSolvedState(s)) {
    const st = findStep(s, maxTier);
    if (!st) return { solved: false, tier: Infinity, score, steps, counts, values: Array.from(s.v), stuckAt: n };
    applyStep(s, st);
    n++;
    counts[st.tech] = (counts[st.tech] || 0) + 1;
    score += TECHNIQUES[st.tech].weight;
    if (st.tier > tier) tier = st.tier;
    if (steps) steps.push(st);
  }
  return { solved: true, tier, score, steps, counts, values: Array.from(s.v), stepCount: n };
}
