// Solitär – reine Spiellogik (kein DOM, mit `node --test` testbar).
//
// Karten-Codes: code = farbe * 13 + (wert - 1)
//   Farben: 0 Pik ♠ (schwarz), 1 Herz ♥ (rot), 2 Kreuz ♣ (schwarz), 3 Karo ♦ (rot)
//   Werte: 1 = Ass … 11 = Bube, 12 = Dame, 13 = König
// Jede physische Karte hat eine id (0..51 bzw. 0..103 bei Spider); state.codes[id] = Code.
//
// Zustand (JSON-kompatibel):
//   { v, mode, game, draw, suits, seed, codes:[…], up:[0|1 …], piles:[[ids…] …] }
// Stapel-Reihenfolge je Spiel siehe LAYOUTS. Ein Stapel ist ein Array von ids, letzte = oberste Karte.
//
// Züge werden als Liste atomarer Operationen ("ops") beschrieben, die sich exakt rückgängig machen lassen:
//   { o:'mv', f, t, n }   n oberste Karten von Stapel f nach t (Reihenfolge bleibt)
//   { o:'flip', id }      Karte umdrehen (Aufdecken; rückgängig = wieder zudecken)
//   { o:'draw', n }       Klondike: n Karten vom Talon auf den Ablagestapel (aufgedeckt)
//   { o:'recycle' }       Klondike: Ablagestapel zurück auf den Talon (zugedeckt)
//   { o:'deal' }          Spider: je eine Karte vom Talon auf jede Spalte

import { makeRng, hashString } from '../../shared/rng.js';

export const SPADES = 0, HEARTS = 1, CLUBS = 2, DIAMONDS = 3;
export const suitOf = (code) => (code / 13) | 0;
export const rankOf = (code) => (code % 13) + 1;
export const isRed = (code) => (suitOf(code) & 1) === 1;
export const makeCode = (s, r) => s * 13 + r - 1;

/** Alle Spielarten. id = Modus-Schlüssel (Statistik, Spielstand, Partie-Listen). */
export const MODES = {
  klondike1: { id: 'klondike1', game: 'klondike', draw: 1, title: 'Klondike', sub: 'Ziehe 1' },
  klondike3: { id: 'klondike3', game: 'klondike', draw: 3, title: 'Klondike', sub: 'Ziehe 3' },
  spider1: { id: 'spider1', game: 'spider', suits: 1, title: 'Spider', sub: '1 Farbe' },
  spider2: { id: 'spider2', game: 'spider', suits: 2, title: 'Spider', sub: '2 Farben' },
  spider4: { id: 'spider4', game: 'spider', suits: 4, title: 'Spider', sub: '4 Farben' },
  freecell: { id: 'freecell', game: 'freecell', title: 'FreeCell', sub: '4 freie Zellen' },
};
export const MODE_IDS = Object.keys(MODES);

function buildLayout(spec) {
  const kinds = [];
  const L = { stock: -1, waste: -1, found: [], tab: [], cells: [] };
  if (spec.cells) for (let i = 0; i < spec.cells; i++) { L.cells.push(kinds.length); kinds.push('cell'); }
  if (spec.stock) { L.stock = kinds.length; kinds.push('stock'); }
  if (spec.waste) { L.waste = kinds.length; kinds.push('waste'); }
  for (let i = 0; i < spec.found; i++) { L.found.push(kinds.length); kinds.push('found'); }
  for (let i = 0; i < spec.tab; i++) { L.tab.push(kinds.length); kinds.push('tab'); }
  L.kinds = kinds;
  L.count = kinds.length;
  return L;
}

export const LAYOUTS = {
  klondike: buildLayout({ stock: 1, waste: 1, found: 4, tab: 7 }),
  freecell: buildLayout({ cells: 4, found: 4, tab: 8 }),
  spider: buildLayout({ stock: 1, found: 8, tab: 10 }),
};

export const layoutOf = (st) => LAYOUTS[st.game];
export const kindOf = (st, p) => LAYOUTS[st.game].kinds[p];
export const codeOf = (st, id) => st.codes[id];
export const top = (st, p) => { const a = st.piles[p]; return a.length ? a[a.length - 1] : -1; };

// ---------------------------------------------------------------- Mischen & Geben

/** Deterministisch gemischtes Array (Fisher-Yates mit mulberry32). */
export function shuffled(n, seed, salt) {
  const rng = makeRng(hashString(`${salt}:${seed >>> 0}`));
  const a = Array.from({ length: n }, (_, i) => i);
  return rng.shuffle(a);
}

/** Neue Partie für einen Modus und eine Partie-Nummer (seed). */
export function newDeal(modeId, seed) {
  const mode = MODES[modeId];
  if (!mode) throw new Error('Unbekannter Modus ' + modeId);
  seed = seed >>> 0;
  const L = LAYOUTS[mode.game];
  const st = {
    v: 1, mode: modeId, game: mode.game, seed,
    draw: mode.draw || 0, suits: mode.suits || 0,
    codes: [], up: [], piles: L.kinds.map(() => []),
  };
  if (mode.game === 'spider') {
    const suitsFor = mode.suits === 1 ? [SPADES] : mode.suits === 2 ? [SPADES, HEARTS] : [SPADES, HEARTS, CLUBS, DIAMONDS];
    for (let i = 0; i < 104; i++) {
      const deck = (i / 13) | 0;
      st.codes.push(makeCode(suitsFor[deck % suitsFor.length], (i % 13) + 1));
    }
    st.up = new Array(104).fill(0);
    const order = shuffled(104, seed, 'spider' + mode.suits);
    for (let i = 0; i < 54; i++) st.piles[L.tab[i % 10]].push(order[i]);
    for (let i = 54; i < 104; i++) st.piles[L.stock].push(order[i]);
    for (const p of L.tab) st.up[top(st, p)] = 1;
  } else {
    for (let i = 0; i < 52; i++) st.codes.push(i);
    st.up = new Array(52).fill(0);
    const order = shuffled(52, seed, mode.game);
    if (mode.game === 'klondike') {
      let k = 0;
      for (let r = 0; r < 7; r++) {
        for (let c = r; c < 7; c++) {
          const id = order[k++];
          st.piles[L.tab[c]].push(id);
          if (c === r) st.up[id] = 1;
        }
      }
      while (k < 52) st.piles[L.stock].push(order[k++]);
    } else {
      for (let i = 0; i < 52; i++) {
        st.piles[L.tab[i % 8]].push(order[i]);
        st.up[order[i]] = 1;
      }
    }
  }
  return st;
}

export function cloneState(st) {
  return { ...st, codes: st.codes, up: st.up.slice(), piles: st.piles.map((p) => p.slice()) };
}

/** Prüft die Struktur eines (z.B. geladenen) Zustands. */
export function validState(st) {
  try {
    if (!st || !MODES[st.mode]) return false;
    const L = LAYOUTS[st.game];
    if (!L || st.piles.length !== L.count) return false;
    const n = st.game === 'spider' ? 104 : 52;
    if (st.codes.length !== n || st.up.length !== n) return false;
    const seen = new Uint8Array(n);
    let total = 0;
    for (const p of st.piles) for (const id of p) {
      if (!(id >= 0 && id < n) || seen[id]) return false;
      seen[id] = 1; total++;
    }
    return total === n;
  } catch { return false; }
}

// ---------------------------------------------------------------- Operationen

export function applyOp(st, op) {
  const P = st.piles;
  const L = LAYOUTS[st.game];
  switch (op.o) {
    case 'mv': {
      const f = P[op.f];
      const moved = f.splice(f.length - op.n, op.n);
      for (const id of moved) P[op.t].push(id);
      break;
    }
    case 'flip': st.up[op.id] = st.up[op.id] ? 0 : 1; break;
    case 'draw':
      for (let i = 0; i < op.n; i++) { const id = P[L.stock].pop(); st.up[id] = 1; P[L.waste].push(id); }
      break;
    case 'recycle': {
      const w = P[L.waste];
      P[L.waste] = [];
      for (let i = w.length - 1; i >= 0; i--) { st.up[w[i]] = 0; P[L.stock].push(w[i]); }
      break;
    }
    case 'deal':
      for (const t of L.tab) { const id = P[L.stock].pop(); st.up[id] = 1; P[t].push(id); }
      break;
    default: throw new Error('op ' + op.o);
  }
}

export function revertOp(st, op) {
  const P = st.piles;
  const L = LAYOUTS[st.game];
  switch (op.o) {
    case 'mv': {
      const t = P[op.t];
      const moved = t.splice(t.length - op.n, op.n);
      for (const id of moved) P[op.f].push(id);
      break;
    }
    case 'flip': st.up[op.id] = st.up[op.id] ? 0 : 1; break;
    case 'draw':
      for (let i = 0; i < op.n; i++) { const id = P[L.waste].pop(); st.up[id] = 0; P[L.stock].push(id); }
      break;
    case 'recycle': {
      const s = P[L.stock];
      P[L.stock] = [];
      for (let i = s.length - 1; i >= 0; i--) { st.up[s[i]] = 1; P[L.waste].push(s[i]); }
      break;
    }
    case 'deal':
      for (let k = L.tab.length - 1; k >= 0; k--) { const id = P[L.tab[k]].pop(); st.up[id] = 0; P[L.stock].push(id); }
      break;
    default: throw new Error('op ' + op.o);
  }
}

export function applyOps(st, ops) { for (const op of ops) applyOp(st, op); }
export function revertOps(st, ops) { for (let i = ops.length - 1; i >= 0; i--) revertOp(st, ops[i]); }

// ---------------------------------------------------------------- Regeln

/** Rot/Schwarz abwechselnd, absteigend (Klondike, FreeCell). */
export const altFits = (a, b) => rankOf(b) === rankOf(a) + 1 && isRed(a) !== isRed(b);

/** Foundation-Füllstand pro Farbe (Klondike/FreeCell). */
export function foundCounts(st) {
  const out = [0, 0, 0, 0];
  for (const p of LAYOUTS[st.game].found) {
    const a = st.piles[p];
    if (a.length && st.game !== 'spider') out[suitOf(st.codes[a[0]])] = a.length;
  }
  return out;
}

export function emptyCells(st) {
  let n = 0;
  for (const p of LAYOUTS[st.game].cells) if (!st.piles[p].length) n++;
  return n;
}

export function emptyTabs(st, except = -1) {
  let n = 0;
  for (const p of LAYOUTS[st.game].tab) if (p !== except && !st.piles[p].length) n++;
  return n;
}

/** FreeCell: wie viele Karten auf einmal bewegt werden dürfen (Ziel t). */
export function maxMovable(st, t = -1) {
  const toEmpty = t >= 0 && st.piles[t].length === 0 && kindOf(st, t) === 'tab';
  const cols = emptyTabs(st) - (toEmpty ? 1 : 0);
  return (emptyCells(st) + 1) * Math.pow(2, Math.max(0, cols));
}

/** Ist die Folge ab Index i im Stapel p eine gültige, bewegliche Folge? */
function validRun(st, p, i) {
  const a = st.piles[p];
  for (let k = i; k < a.length; k++) {
    if (!st.up[a[k]]) return false;
    if (k > i) {
      const prev = st.codes[a[k - 1]], cur = st.codes[a[k]];
      if (st.game === 'spider') {
        if (suitOf(prev) !== suitOf(cur) || rankOf(prev) !== rankOf(cur) + 1) return false;
      } else if (!altFits(cur, prev)) return false;
    }
  }
  return true;
}

/** Darf man die Karten ab Index i von Stapel p aufnehmen? */
export function canPick(st, p, i) {
  const a = st.piles[p];
  if (i < 0 || i >= a.length) return false;
  const kind = kindOf(st, p);
  switch (kind) {
    case 'tab': {
      if (!validRun(st, p, i)) return false;
      if (st.game === 'freecell') return a.length - i <= maxMovable(st);
      return true;
    }
    case 'waste': return i === a.length - 1;
    case 'cell': return i === a.length - 1;
    case 'found': return st.game === 'klondike' && i === a.length - 1 && a.length > 0;
    default: return false;
  }
}

/** Darf die Folge ab (p, i) auf Stapel t abgelegt werden? */
export function canDrop(st, p, i, t) {
  if (p === t) return false;
  const a = st.piles[p];
  const n = a.length - i;
  if (n <= 0) return false;
  const first = st.codes[a[i]];
  const dest = st.piles[t];
  const tk = kindOf(st, t);
  if (tk === 'found') {
    if (st.game === 'spider' || n !== 1) return false;
    if (!dest.length) return rankOf(first) === 1;
    const tc = st.codes[dest[dest.length - 1]];
    return suitOf(tc) === suitOf(first) && rankOf(first) === rankOf(tc) + 1;
  }
  if (tk === 'cell') return n === 1 && dest.length === 0;
  if (tk !== 'tab') return false;
  if (st.game === 'freecell' && n > maxMovable(st, t)) return false;
  if (!dest.length) return st.game === 'klondike' ? rankOf(first) === 13 : true;
  const tc = st.codes[dest[dest.length - 1]];
  if (!st.up[dest[dest.length - 1]]) return false;
  if (st.game === 'spider') return rankOf(tc) === rankOf(first) + 1;
  return altFits(first, tc);
}

/**
 * Ziele für Antippen, nach Vorliebe sortiert: Ablage zuerst, dann passende Spalten,
 * dann leere Spalten, dann freie Zellen.
 */
export function tapTargets(st, p, i) {
  if (!canPick(st, p, i)) return [];
  const L = LAYOUTS[st.game];
  const a = st.piles[p];
  const n = a.length - i;
  const first = st.codes[a[i]];
  const out = [];
  if (n === 1 && kindOf(st, p) !== 'found') {
    // passende Ablage (bei Ass: erste leere)
    for (const t of L.found) if (st.piles[t].length && canDrop(st, p, i, t)) out.push(t);
    if (!out.length) for (const t of L.found) if (canDrop(st, p, i, t)) { out.push(t); break; }
  }
  const sameSuit = [], other = [], empty = [];
  const startOfColumn = kindOf(st, p) === 'tab' && i === 0;
  for (const t of L.tab) {
    if (!canDrop(st, p, i, t)) continue;
    if (!st.piles[t].length) {
      if (startOfColumn) continue; // sinnlos: ganze Spalte in leere Spalte
      if (!empty.length) empty.push(t);
      continue;
    }
    const tc = st.codes[top(st, t)];
    if (st.game === 'spider' && suitOf(tc) === suitOf(first)) sameSuit.push(t);
    else other.push(t);
  }
  out.push(...sameSuit, ...other, ...empty);
  if (st.game === 'freecell' && n === 1 && kindOf(st, p) !== 'cell') {
    for (const t of L.cells) if (canDrop(st, p, i, t)) { out.push(t); break; }
  }
  return out;
}

/** Führt einen Zug aus (vorher canDrop prüfen!) und liefert die angewendeten ops. */
export function doMove(st, p, i, t) {
  const ops = [];
  const n = st.piles[p].length - i;
  const run = (op) => { applyOp(st, op); ops.push(op); };
  run({ o: 'mv', f: p, t, n });
  flipTop(st, p, run);
  if (st.game === 'spider') checkRun(st, t, run);
  return ops;
}

function flipTop(st, p, run) {
  if (kindOf(st, p) !== 'tab') return;
  const id = top(st, p);
  if (id >= 0 && !st.up[id]) run({ o: 'flip', id });
}

/** Spider: vollständige Folge K→A gleicher Farbe oben auf Spalte t? → auf die Ablage. */
function checkRun(st, t, run) {
  const a = st.piles[t];
  if (a.length < 13) return;
  const base = a.length - 13;
  const s = suitOf(st.codes[a[base]]);
  for (let k = 0; k < 13; k++) {
    const id = a[base + k];
    const c = st.codes[id];
    if (!st.up[id] || suitOf(c) !== s || rankOf(c) !== 13 - k) return;
  }
  const L = LAYOUTS.spider;
  const f = L.found.find((q) => st.piles[q].length === 0);
  if (f == null) return;
  run({ o: 'mv', f: t, t: f, n: 13 });
  flipTop(st, t, run);
}

/** Talon antippen. Liefert { ops } oder { error } (ops sind schon angewendet). */
export function stockAction(st) {
  const L = LAYOUTS[st.game];
  if (L.stock < 0) return { error: 'none' };
  const stock = st.piles[L.stock];
  if (st.game === 'klondike') {
    if (stock.length) {
      const op = { o: 'draw', n: Math.min(st.draw, stock.length) };
      applyOp(st, op);
      return { ops: [op] };
    }
    if (!st.piles[L.waste].length) return { error: 'empty' };
    const op = { o: 'recycle' };
    applyOp(st, op);
    return { ops: [op] };
  }
  // Spider
  if (!stock.length) return { error: 'empty' };
  const tabCards = L.tab.reduce((s, p) => s + st.piles[p].length, 0);
  if (emptyTabs(st) > 0 && tabCards >= L.tab.length) return { error: 'gap' };
  const ops = [];
  const run = (op) => { applyOp(st, op); ops.push(op); };
  run({ o: 'deal' });
  for (const t of L.tab) checkRun(st, t, run);
  return { ops };
}

export function canStock(st) {
  const L = LAYOUTS[st.game];
  if (L.stock < 0) return false;
  if (st.game === 'klondike') return st.piles[L.stock].length > 0 || st.piles[L.waste].length > 0;
  if (!st.piles[L.stock].length) return false;
  const tabCards = L.tab.reduce((s, p) => s + st.piles[p].length, 0);
  return !(emptyTabs(st) > 0 && tabCards >= L.tab.length);
}

/** Kann diese Karte gefahrlos auf die Ablage (wird nie mehr in den Spalten gebraucht)? */
export function isSafeToFound(st, code, fc = foundCounts(st)) {
  const r = rankOf(code);
  if (r <= 2) return true;
  const red = isRed(code);
  // beide Farben der Gegenfarbe müssen mindestens r-1 abgelegt haben
  for (let s = 0; s < 4; s++) if (((s & 1) === 1) !== red && fc[s] < r - 1) return false;
  return true;
}

/** Nächster automatischer Ablage-Zug (nur "sichere" Karten). null = keiner. */
export function autoFoundationMove(st) {
  if (st.game === 'spider') return null;
  const L = LAYOUTS[st.game];
  const fc = foundCounts(st);
  const sources = [...L.tab, ...L.cells];
  if (L.waste >= 0) sources.unshift(L.waste);
  for (const p of sources) {
    const a = st.piles[p];
    if (!a.length) continue;
    const id = a[a.length - 1];
    if (!st.up[id]) continue;
    const code = st.codes[id];
    if (!isSafeToFound(st, code, fc)) continue;
    for (const t of L.found) if (canDrop(st, p, a.length - 1, t)) {
      // bevorzugt die Ablage, die schon diese Farbe trägt
      if (!st.piles[t].length) {
        const same = L.found.find((q) => st.piles[q].length && canDrop(st, p, a.length - 1, q));
        if (same != null) return { from: p, index: a.length - 1, to: same };
      }
      return { from: p, index: a.length - 1, to: t };
    }
  }
  return null;
}

export function isWon(st) {
  const L = LAYOUTS[st.game];
  for (const p of L.found) if (st.piles[p].length !== 13) return false;
  return true;
}

export function foundTotal(st) {
  let n = 0;
  for (const p of LAYOUTS[st.game].found) n += st.piles[p].length;
  return n;
}

/** Anzahl verdeckter Karten in den Spalten. */
export function hiddenCount(st) {
  let n = 0;
  for (const p of LAYOUTS[st.game].tab) for (const id of st.piles[p]) if (!st.up[id]) n++;
  return n;
}

/** Ort jeder Karte: id → [pile, index] */
export function locate(st) {
  const loc = new Array(st.codes.length);
  st.piles.forEach((a, p) => a.forEach((id, i) => { loc[id] = [p, i]; }));
  return loc;
}

/** Alle legalen Züge (für Hinweise/Tests): [{from, index, to}] */
export function legalMoves(st) {
  const L = LAYOUTS[st.game];
  const out = [];
  st.piles.forEach((a, p) => {
    const kind = L.kinds[p];
    if (kind === 'stock' || !a.length) return;
    const starts = kind === 'tab' ? a.map((_, i) => i) : [a.length - 1];
    for (const i of starts) {
      if (!canPick(st, p, i)) continue;
      for (let t = 0; t < L.count; t++) if (canDrop(st, p, i, t)) out.push({ from: p, index: i, to: t });
    }
  });
  return out;
}
