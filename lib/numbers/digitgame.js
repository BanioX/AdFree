// Zahlen-Familie – Spielzustand für Ziffern-Rätsel (Kakuro, Rechenquadrate, Killer-Sudoku,
// Mini-Sudoku …). Reine Logik, ohne DOM – gut testbar mit node --test.
//
// Rätsel (puzzle), JSON-kompatibel:
//   { rows, cols, max,            // Ziffern 1..max
//     sol:    [..],               // Lösung je Zelle, 0 = keine Spielzelle (Block/Hinweisfeld)
//     givens: [..] | undefined,   // vorgegebene Ziffern (0 = leer)
//     groups: [{ cells: [..], unique: true, kind: 'row'|'col'|'box'|'cage'|'run', … }] }
//
// Zustand (state), JSON-kompatibel, wird so gespeichert:
//   { v, puzzle, vals, notes, undo, mistakes, hints, elapsed, done, counted, created, meta }

const UNDO_MAX = 300;

export function newState(puzzle, meta = {}) {
  const n = puzzle.sol.length;
  const vals = new Array(n).fill(0);
  if (puzzle.givens) for (let i = 0; i < n; i++) if (puzzle.givens[i]) vals[i] = puzzle.givens[i];
  return {
    v: 1, puzzle, vals, notes: new Array(n).fill(0), undo: [],
    mistakes: 0, hints: 0, elapsed: 0, done: false, counted: false,
    created: Date.now() + Math.random(), meta: { ...meta },
  };
}

export function validState(st) {
  return !!(st && st.v === 1 && st.puzzle && Array.isArray(st.puzzle.sol) && Array.isArray(st.vals)
    && st.vals.length === st.puzzle.sol.length && Array.isArray(st.notes) && Array.isArray(st.puzzle.groups));
}

export const isCell = (p, i) => p.sol[i] > 0;
export const isGiven = (p, i) => !!(p.givens && p.givens[i]);
export const editable = (p, i) => isCell(p, i) && !isGiven(p, i);

// ---------- Nachbarschaften (zwischengespeichert, nicht im Zustand) ----------

const cache = new WeakMap();
function info(p) {
  let c = cache.get(p);
  if (c) return c;
  const n = p.sol.length;
  const groupsOf = Array.from({ length: n }, () => []);
  p.groups.forEach((g, gi) => { for (const i of g.cells) groupsOf[i].push(gi); });
  const peers = Array.from({ length: n }, () => new Set());
  p.groups.forEach((g) => {
    if (!g.unique) return;
    for (const a of g.cells) for (const b of g.cells) if (a !== b) peers[a].add(b);
  });
  c = { groupsOf, peers: peers.map((s) => [...s]) };
  cache.set(p, c);
  return c;
}

export const peersOf = (p, i) => info(p).peers[i];
export const groupsOf = (p, i) => info(p).groupsOf[i];

/** Zellen, die gleichzeitig Spielzellen sind (Reihenfolge = Lesereihenfolge). */
export function playCells(p) {
  const out = [];
  for (let i = 0; i < p.sol.length; i++) if (p.sol[i] > 0) out.push(i);
  return out;
}

// ---------- Abfragen ----------

export const isWrong = (st, i) => st.vals[i] > 0 && st.vals[i] !== st.puzzle.sol[i];

export function progress(st) {
  const p = st.puzzle;
  let total = 0, ok = 0;
  for (let i = 0; i < p.sol.length; i++) {
    if (!editable(p, i)) continue;
    total++;
    if (st.vals[i] === p.sol[i]) ok++;
  }
  return total ? ok / total : 1;
}

export function isSolved(st) {
  const p = st.puzzle;
  for (let i = 0; i < p.sol.length; i++) if (p.sol[i] && st.vals[i] !== p.sol[i]) return false;
  return true;
}

/** Wie oft ist die Ziffer d schon richtig gesetzt (für die Restanzeige auf den Tasten)? */
export function placedCount(st, d) {
  let c = 0;
  for (let i = 0; i < st.vals.length; i++) if (st.vals[i] === d && st.puzzle.sol[i] === d) c++;
  return c;
}

export function solCount(p, d) {
  let c = 0;
  for (const v of p.sol) if (v === d) c++;
  return c;
}

/** Konflikte: Zellen, deren Wert in einer Einzigartig-Gruppe doppelt vorkommt. */
export function conflicts(st) {
  const out = new Set();
  for (const g of st.puzzle.groups) {
    if (!g.unique) continue;
    const seen = new Map();
    for (const i of g.cells) {
      const v = st.vals[i];
      if (!v) continue;
      if (seen.has(v)) { out.add(i); out.add(seen.get(v)); } else seen.set(v, i);
    }
  }
  return out;
}

/** Einfache Kandidaten: Ziffern, die keine Nachbarzelle schon trägt. */
export function basicCandidates(st, i) {
  const p = st.puzzle;
  let m = 0;
  for (let d = 1; d <= p.max; d++) m |= 1 << d;
  for (const j of peersOf(p, i)) if (st.vals[j]) m &= ~(1 << st.vals[j]);
  return m;
}

// ---------- Aktionen (mit Rückgängig) ----------

function record(st, changes) {
  if (!changes.length) return;
  st.undo.push(changes);
  if (st.undo.length > UNDO_MAX) st.undo.splice(0, st.undo.length - UNDO_MAX);
}

/**
 * Setzt Ziffer d in Zelle i (gleiche Ziffer nochmals = löschen).
 * Gibt { changed, wrong, cleared, groups: [fertige Gruppen-Indizes], won, notesCleared: [Zellen] } zurück.
 */
export function place(st, i, d, { autoNotes = true } = {}) {
  const p = st.puzzle;
  const res = { changed: false, wrong: false, cleared: false, groups: [], won: false, notesCleared: [] };
  if (st.done || !editable(p, i) || d < 1 || d > p.max) return res;
  const changes = [[i, st.vals[i], st.notes[i]]];
  if (st.vals[i] === d) {
    st.vals[i] = 0;
    res.cleared = true;
  } else {
    st.vals[i] = d;
    st.notes[i] = 0;
    if (d !== p.sol[i]) {
      res.wrong = true;
      st.mistakes++;
    } else {
      if (autoNotes) {
        for (const j of peersOf(p, i)) {
          if (st.notes[j] & (1 << d)) {
            changes.push([j, st.vals[j], st.notes[j]]);
            st.notes[j] &= ~(1 << d);
            res.notesCleared.push(j);
          }
        }
      }
      res.groups = completedGroups(st, i);
    }
  }
  record(st, changes);
  res.changed = true;
  if (!res.wrong && isSolved(st)) { st.done = true; res.won = true; }
  return res;
}

/** Gruppen, die Zelle i enthalten und jetzt vollständig richtig sind. */
export function completedGroups(st, i) {
  const p = st.puzzle;
  return groupsOf(p, i).filter((gi) => p.groups[gi].cells.every((j) => st.vals[j] === p.sol[j]));
}

export function toggleNote(st, i, d) {
  const p = st.puzzle;
  if (st.done || !editable(p, i) || d < 1 || d > p.max) return false;
  if (st.vals[i] && st.vals[i] === p.sol[i]) return false;
  record(st, [[i, st.vals[i], st.notes[i]]]);
  if (st.vals[i]) st.vals[i] = 0;
  st.notes[i] ^= 1 << d;
  return true;
}

export function erase(st, i) {
  const p = st.puzzle;
  if (st.done || !editable(p, i)) return false;
  if (!st.vals[i] && !st.notes[i]) return false;
  if (st.vals[i] && st.vals[i] === p.sol[i]) return false; // richtige Ziffern bleiben stehen
  record(st, [[i, st.vals[i], st.notes[i]]]);
  st.vals[i] = 0;
  st.notes[i] = 0;
  return true;
}

/** Macht den letzten Schritt rückgängig. Gibt die betroffenen Zellen zurück (oder null). */
export function undo(st) {
  if (st.done) return null;
  const changes = st.undo.pop();
  if (!changes) return null;
  for (let k = changes.length - 1; k >= 0; k--) {
    const [i, v, n] = changes[k];
    st.vals[i] = v;
    st.notes[i] = n;
  }
  return changes.map((c) => c[0]);
}

/**
 * Tipp: welche Zelle soll aufgedeckt werden? Bevorzugt die gewählte Zelle (leer oder falsch),
 * sonst eine falsche Zelle, sonst die leere Zelle mit den wenigsten Kandidaten.
 * candidates(st, i) → Maske (optional, sonst basicCandidates).
 */
export function hintCell(st, sel = -1, candidates = basicCandidates) {
  const p = st.puzzle;
  if (sel >= 0 && editable(p, sel) && st.vals[sel] !== p.sol[sel]) return sel;
  for (let i = 0; i < p.sol.length; i++) if (editable(p, i) && isWrong(st, i)) return i;
  let best = -1, bestC = 99;
  for (let i = 0; i < p.sol.length; i++) {
    if (!editable(p, i) || st.vals[i]) continue;
    let c = 0, m = candidates(st, i);
    while (m) { m &= m - 1; c++; }
    if (c < bestC) { bestC = c; best = i; }
  }
  return best;
}

/** Deckt Zelle i auf (zählt als Tipp). Gibt dasselbe Ergebnis wie place() zurück. */
export function reveal(st, i) {
  const p = st.puzzle;
  if (!editable(p, i) || st.vals[i] === p.sol[i]) return null;
  st.hints++;
  if (st.vals[i]) { st.vals[i] = 0; }
  return place(st, i, p.sol[i]);
}

/** Füllt alle Notizen leerer Zellen mit den Kandidaten (ein Schritt fürs Rückgängig). */
export function fillNotes(st, candidates = basicCandidates) {
  const p = st.puzzle;
  if (st.done) return 0;
  const changes = [];
  for (let i = 0; i < p.sol.length; i++) {
    if (!editable(p, i) || st.vals[i]) continue;
    const m = candidates(st, i);
    if (m !== st.notes[i]) { changes.push([i, st.vals[i], st.notes[i]]); st.notes[i] = m; }
  }
  record(st, changes);
  return changes.length;
}

/** Alles zurück auf Anfang (Zeit läuft weiter, Fehler/Tipps bleiben gezählt). */
export function restart(st) {
  const p = st.puzzle;
  for (let i = 0; i < p.sol.length; i++) { st.vals[i] = p.givens && p.givens[i] ? p.givens[i] : 0; st.notes[i] = 0; }
  st.undo = [];
  st.done = false;
}

/** Sterne 1–3: 3 = ohne Fehler und Tipps, 2 = höchstens 3 Fehler/Tipps zusammen. */
export function starsFor(st) {
  const k = st.mistakes + st.hints;
  return k === 0 ? 3 : k <= 3 ? 2 : 1;
}
