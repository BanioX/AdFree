// Zahlensummen – Spielzustand (rein, JSON-speicherbar).
// marks[i]: 0 = offen, 1 = bleibt (eingekreist), 2 = weg (ausradiert)

import { generate, lines, deduceOne } from './puzzle.js';
import { difficultyById, DAILY, LIVES } from '../data/difficulties.js';

export const seedFor = (diff, number, day) => (day ? `numbersums-daily-${day}` : `numbersums-${diff}-${number}`);

/** Farbe je Bereich, so dass Nachbarbereiche verschieden sind (gierige Färbung). */
export function colorRegions(p, palette = 8) {
  if (!p.region) return null;
  const { n } = p;
  const k = p.regionSums.length;
  const adj = [...Array(k)].map(() => new Set());
  for (let i = 0; i < n * n; i++) {
    const r = Math.floor(i / n), c = i % n;
    if (c < n - 1 && p.region[i] !== p.region[i + 1]) { adj[p.region[i]].add(p.region[i + 1]); adj[p.region[i + 1]].add(p.region[i]); }
    if (r < n - 1 && p.region[i] !== p.region[i + n]) { adj[p.region[i]].add(p.region[i + n]); adj[p.region[i + n]].add(p.region[i]); }
  }
  const col = new Array(k).fill(-1);
  for (let g = 0; g < k; g++) {
    const used = new Set([...adj[g]].map((x) => col[x]));
    let c = g % palette;
    for (let t = 0; t < palette && used.has(c); t++) c = (c + 1) % palette;
    col[g] = c;
  }
  return col;
}

export function newGame({ diff = 'leicht', number = 1, day = null } = {}) {
  const spec = day ? DAILY : difficultyById(diff);
  const puzzle = generate(seedFor(spec.id, number, day), spec);
  return {
    v: 1,
    diff: spec.id,
    number,
    day,
    puzzle,
    marks: new Array(puzzle.n * puzzle.n).fill(0),
    lives: LIVES,
    mistakes: 0,
    refills: 0,
    hints: 0,
    elapsed: 0,
    done: false,
    created: Date.now(),
  };
}

export function validState(st) {
  return !!(st && st.v === 1 && st.puzzle && Array.isArray(st.marks) && st.marks.length === st.puzzle.n * st.puzzle.n);
}

const lineKey = (L) => `${L.kind}-${L.idx}`;

function linesOf(p) {
  if (!p._lines) Object.defineProperty(p, '_lines', { value: lines(p), enumerable: false });
  return p._lines;
}

/** Linien, die eine Zelle enthalten. */
function linesWith(p, i) {
  return linesOf(p).filter((L) => L.cells.includes(i));
}

export function lineDone(st, L) {
  return L.cells.every((i) => st.marks[i] !== 0);
}

/** Alle fertigen Linien als Set von Schlüsseln ('row-2', 'col-0', 'region-3'). */
export function doneLines(st) {
  const s = new Set();
  for (const L of linesOf(st.puzzle)) if (lineDone(st, L)) s.add(lineKey(L));
  return s;
}

/**
 * Wendet ein Werkzeug an: tool 'keep' (einkreisen) oder 'erase' (radieren).
 * Ergebnis: { ok, wrong, auto: [Zellen, die automatisch ergänzt wurden], lines: [neu fertige Linien], won, out }
 */
export function act(st, i, tool) {
  const p = st.puzzle;
  if (st.done || st.lives <= 0 || st.marks[i] !== 0) return { ok: false };
  const want = p.keep[i] ? 'keep' : 'erase';
  if (tool !== want) {
    st.lives--;
    st.mistakes++;
    return { ok: false, wrong: true, out: st.lives <= 0 };
  }
  return resolve(st, [i]);
}

/** Markiert Zellen richtig und ergänzt fertige Linien (Rest einkreisen bzw. radieren). */
function resolve(st, cellsToMark) {
  const p = st.puzzle;
  const before = doneLines(st);
  const auto = [];
  const queue = [];
  for (const i of cellsToMark) { st.marks[i] = p.keep[i] ? 1 : 2; queue.push(i); }
  while (queue.length) {
    const i = queue.shift();
    for (const L of linesWith(p, i)) {
      const open = L.cells.filter((k) => st.marks[k] === 0);
      if (!open.length) continue;
      // Alle falschen weg → Rest bleibt; alle richtigen eingekreist → Rest weg (beides sichtbar ableitbar)
      const erasedAll = L.cells.every((k) => p.keep[k] || st.marks[k] === 2);
      const keptAll = L.cells.every((k) => !p.keep[k] || st.marks[k] === 1);
      if (erasedAll || keptAll) {
        for (const k of open) { st.marks[k] = p.keep[k] ? 1 : 2; auto.push(k); queue.push(k); }
      }
    }
  }
  const after = doneLines(st);
  const fresh = [...after].filter((k) => !before.has(k));
  const won = st.marks.every((m) => m !== 0);
  if (won) st.done = true;
  return { ok: true, auto, lines: fresh, won };
}

/** Tipp: ein logisch erzwungenes Feld (oder notfalls irgendein offenes) und warum. */
export function findHint(st) {
  const p = st.puzzle;
  const d = deduceOne(p, st.marks, linesOf(p));
  if (d) return d;
  const open = st.marks.map((m, i) => (m === 0 ? i : -1)).filter((i) => i >= 0);
  if (!open.length) return null;
  const i = open[0];
  return { i, keep: p.keep[i], line: null };
}

/** Ein erzwungenes Feld mit bevorzugter Aktion (für den Coach-Mark), sonst irgendeins. */
export function findHintPrefer(st, keep) {
  const p = st.puzzle;
  for (const L of linesOf(p)) {
    const d = deduceOne(p, st.marks, [L]);
    if (d && d.keep === keep) return d;
  }
  return findHint(st);
}

export function applyHint(st) {
  const h = findHint(st);
  if (!h) return null;
  st.hints++;
  return { hint: h, res: resolve(st, [h.i]) };
}

export function restart(st) {
  st.marks = st.marks.map(() => 0);
  st.lives = LIVES;
  st.done = false;
  return st;
}

export function refill(st) {
  st.lives = LIVES;
  st.refills++;
  return st;
}

export function progress(st) {
  const total = st.marks.length;
  return st.marks.filter((m) => m !== 0).length / total;
}

export function starsFor(st) {
  if (st.refills > 0) return 1;
  return Math.max(1, 3 - st.mistakes - (st.hints > 2 ? 1 : 0));
}
