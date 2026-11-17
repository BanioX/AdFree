// Mahjong – reine Spiellogik (kein DOM, mit node --test prüfbar).
//
// Koordinaten: Halbe Steinbreiten/-höhen ("Halbe"). Ein Stein belegt 2×2 Halbe
// auf seiner Ebene z. So sind auch halb versetzte Steine möglich.
//
// Steinbilder (faces) 0..41 – für alle Steinsätze gleich aufgebaut:
//   0..8 Kreise 1–9 · 9..17 Bambus 1–9 · 18..26 Zeichen 1–9
//   27..30 Winde · 31..33 Drachen · 34..37 Blumen · 38..41 Jahreszeiten
// Blumen passen zu jeder Blume, Jahreszeiten zu jeder Jahreszeit.

import { makeRng } from '../shared/rng.js';

export const FACE_COUNT = 42;
export const NORMAL_KINDS = 34;
export const FLOWER = 34;
export const SEASON = 38;
export const MAX_TILES = 144;

/** Gruppe zum Vergleichen: normale Steine = eigene Nummer, Blumen = 34, Jahreszeiten = 38. */
export function matchKey(face) {
  return face < 34 ? face : face < 38 ? FLOWER : SEASON;
}
export function facesMatch(a, b) { return matchKey(a) === matchKey(b); }

// ---------------------------------------------------------------- Layouts

/**
 * Wandelt eine Layout-Definition (siehe data/layouts.js) in Steinpositionen um.
 * def.layers: Array von Ebenen. Eine Ebene ist entweder ein Array von Zeilen
 * (z = Index) oder ein Objekt { rows, z?, dx?, dy? } (dx/dy in Steinen, 0.5-Schritte).
 * Jedes Zeichen ausser '.' und ' ' ist ein Stein.
 */
export function parseLayout(def) {
  const raw = [];
  (def.layers || []).forEach((layer, idx) => {
    const L = Array.isArray(layer) ? { rows: layer } : layer;
    const z = Number.isInteger(L.z) ? L.z : idx;
    const dx = Math.round((L.dx || 0) * 2);
    const dy = Math.round((L.dy || 0) * 2);
    (L.rows || []).forEach((row, r) => {
      for (let c = 0; c < row.length; c++) {
        const ch = row[c];
        if (ch === '.' || ch === ' ') continue;
        raw.push({ x: c * 2 + dx, y: r * 2 + dy, z });
      }
    });
  });
  return normalizeTiles(raw, def);
}

/** Verschiebt auf (0,0), sortiert in Zeichenreihenfolge und berechnet die Ausdehnung. */
export function normalizeTiles(raw, meta = {}) {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  for (const t of raw) { minX = Math.min(minX, t.x); minY = Math.min(minY, t.y); minZ = Math.min(minZ, t.z); }
  if (!raw.length) { minX = minY = minZ = 0; }
  const tiles = raw.map((t) => ({ x: t.x - minX, y: t.y - minY, z: t.z - minZ }));
  tiles.sort((a, b) => a.z - b.z || a.y - b.y || a.x - b.x);
  let w = 0, h = 0, depth = 0;
  for (const t of tiles) { w = Math.max(w, t.x + 2); h = Math.max(h, t.y + 2); depth = Math.max(depth, t.z + 1); }
  return { id: meta.id || '', name: meta.name || '', tiles, w, h, depth };
}

/** Kompakte Text-Form der Positionen (für Spielstände): "x.y.z,x.y.z,…" */
export function tilesToString(tiles) {
  return tiles.map((t) => `${t.x}.${t.y}.${t.z}`).join(',');
}
export function tilesFromString(s) {
  if (!s) return [];
  return s.split(',').map((p) => {
    const [x, y, z] = p.split('.').map(Number);
    return { x, y, z };
  });
}

/** Prüft eine geparste Layout-Struktur. Gibt eine Liste von Problemen zurück (leer = ok). */
export function validateLayout(layout, { maxTiles = MAX_TILES } = {}) {
  const problems = [];
  const t = layout.tiles;
  if (t.length < 2) problems.push('zu wenige Steine');
  if (t.length % 2) problems.push(`ungerade Anzahl Steine (${t.length})`);
  if (t.length > maxTiles) problems.push(`zu viele Steine (${t.length} > ${maxTiles})`);
  for (let i = 0; i < t.length; i++) {
    for (let j = i + 1; j < t.length; j++) {
      if (t[i].z === t[j].z && Math.abs(t[i].x - t[j].x) < 2 && Math.abs(t[i].y - t[j].y) < 2) {
        problems.push(`Steine überlappen auf Ebene ${t[i].z} bei (${t[i].x / 2}, ${t[i].y / 2})`);
      }
    }
    if (t[i].z > 0) {
      const sup = t.some((u) => u.z === t[i].z - 1 && Math.abs(u.x - t[i].x) < 2 && Math.abs(u.y - t[i].y) < 2);
      if (!sup) problems.push(`Stein schwebt auf Ebene ${t[i].z} bei (${t[i].x / 2}, ${t[i].y / 2})`);
    }
  }
  return problems;
}

// ---------------------------------------------------------------- Brett (Nachbarschaften)

/**
 * Berechnet für jeden Stein, welche Steine darauf liegen bzw. links/rechts anstossen.
 * Ein Stein ist frei, wenn nichts darauf liegt und links ODER rechts frei ist.
 */
export function buildBoard(layout) {
  const tiles = layout.tiles;
  const n = tiles.length;
  const above = Array.from({ length: n }, () => []);
  const left = Array.from({ length: n }, () => []);
  const right = Array.from({ length: n }, () => []);
  const below = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) {
    const a = tiles[i];
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const b = tiles[j];
      const ox = Math.abs(a.x - b.x) < 2, oy = Math.abs(a.y - b.y) < 2;
      if (ox && oy) {
        if (b.z > a.z) above[i].push(j);
        else if (b.z === a.z - 1) below[i].push(j);
      }
      if (b.z === a.z && oy) {
        if (b.x === a.x - 2) left[i].push(j);
        else if (b.x === a.x + 2) right[i].push(j);
      }
    }
  }
  // Wie viele Steine hängen (direkt) an diesem Stein? Für Heuristiken.
  const weight = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    for (const j of above[i]) weight[j] += 1.5;
    for (const j of left[i]) weight[j] += 0.5;
    for (const j of right[i]) weight[j] += 0.5;
  }
  return { layout, tiles, n, above, left, right, below, weight };
}

export function isFree(board, present, i) {
  if (!present[i]) return false;
  for (const j of board.above[i]) if (present[j]) return false;
  let lf = true, rf = true;
  for (const j of board.left[i]) if (present[j]) { lf = false; break; }
  if (lf) return true;
  for (const j of board.right[i]) if (present[j]) { rf = false; break; }
  return rf;
}

export function freeTiles(board, present) {
  const out = [];
  for (let i = 0; i < board.n; i++) if (isFree(board, present, i)) out.push(i);
  return out;
}

/** Welche Steine blockieren Stein i gerade? { above:[…], sides:[…] } */
export function blockersOf(board, present, i) {
  const above = board.above[i].filter((j) => present[j]);
  const l = board.left[i].filter((j) => present[j]);
  const r = board.right[i].filter((j) => present[j]);
  return { above, sides: l.length && r.length ? [...l, ...r] : [] };
}

/** Alle passenden Paare unter den freien Steinen. */
export function availablePairs(board, faces, present) {
  const free = freeTiles(board, present);
  const pairs = [];
  for (let a = 0; a < free.length; a++) {
    for (let b = a + 1; b < free.length; b++) {
      if (facesMatch(faces[free[a]], faces[free[b]])) pairs.push([free[a], free[b]]);
    }
  }
  return pairs;
}

export function hasMoves(board, faces, present) {
  const free = freeTiles(board, present);
  const seen = new Set();
  for (const i of free) {
    const k = matchKey(faces[i]);
    if (seen.has(k)) return true;
    seen.add(k);
  }
  return false;
}

export function countPresent(present) {
  let c = 0;
  for (let i = 0; i < present.length; i++) c += present[i] ? 1 : 0;
  return c;
}

// ---------------------------------------------------------------- Generator

/**
 * Spielt das Brett rückwärts auf: wiederholt zwei gerade freie Plätze wählen
 * und als Paar entfernen. Die Reihenfolge ist danach eine garantierte Lösung.
 * Gibt eine Paar-Liste zurück oder null (Sackgasse – neuer Versuch nötig).
 */
export function pairOrder(board, present0, rng) {
  const present = Uint8Array.from(present0);
  let remaining = countPresent(present);
  const order = [];
  const { tiles } = board;
  while (remaining > 0) {
    const free = freeTiles(board, present);
    if (free.length < 2) return null;
    // Gewichtet ziehen: Steine, die viele andere blockieren, und hohe Steine bevorzugen.
    // So entstehen weniger Sackgassen beim Aufbau und die Paare liegen gut verteilt.
    const wts = free.map((i) => 1 + board.weight[i] * 0.8 + tiles[i].z * 0.6);
    const a = weightedPick(free, wts, rng);
    const rest = [];
    const rw = [];
    for (let k = 0; k < free.length; k++) {
      const j = free[k];
      if (j === a) continue;
      // Direkte Nachbarn (gleiche Reihe nebeneinander) seltener paaren – sonst zu leicht.
      const ta = tiles[a], tj = tiles[j];
      const adjacent = ta.z === tj.z && Math.abs(ta.y - tj.y) < 2 && Math.abs(ta.x - tj.x) <= 2;
      const dist = Math.hypot((ta.x - tj.x) / 2, (ta.y - tj.y) / 2);
      rest.push(j);
      rw.push((adjacent ? 0.25 : 1) * (1 + Math.min(dist, 6) * 0.15) * (1 + board.weight[j] * 0.5 + tj.z * 0.4));
    }
    const b = weightedPick(rest, rw, rng);
    present[a] = 0; present[b] = 0;
    remaining -= 2;
    order.push([a, b]);
  }
  return order;
}

function weightedPick(items, weights, rng) {
  let sum = 0;
  for (const w of weights) sum += w;
  let r = rng.next() * sum;
  for (let k = 0; k < items.length; k++) {
    r -= weights[k];
    if (r <= 0) return items[k];
  }
  return items[items.length - 1];
}

/**
 * Wählt numPairs Bild-Paare aus dem Vorrat (34 Arten × 2 Paare, dazu je 2 Blumen- und
 * Jahreszeiten-Paare = 72 Paare). Kleine Bretter bekommen viele verschiedene Arten,
 * etwa ein Drittel der Arten kommt doppelt (4 gleiche Steine) – das macht es spannend.
 */
export function pickFacePairs(numPairs, rng) {
  if (numPairs > 72) throw new Error('Höchstens 72 Paare');
  const kinds = [];
  for (let k = 0; k < NORMAL_KINDS; k++) kinds.push(k);
  kinds.push('F', 'S');
  rng.shuffle(kinds);
  const doubles = Math.max(numPairs - 36, Math.round(numPairs * 0.3));
  const distinct = numPairs - doubles;
  const chosen = kinds.slice(0, distinct);
  const doubled = rng.shuffle(chosen.slice()).slice(0, doubles);
  const pairs = [];
  const bonusUsed = { F: 0, S: 0 };
  const mk = (k) => {
    if (k === 'F' || k === 'S') {
      const base = k === 'F' ? FLOWER : SEASON;
      const n = bonusUsed[k]++;
      // Erstes Bonus-Paar: zwei zufällige der vier; zweites Paar: die übrigen zwei.
      return n === 0 ? [base, base + 1] : [base + 2, base + 3];
    }
    return [k, k];
  };
  for (const k of chosen) pairs.push(mk(k));
  for (const k of doubled) pairs.push(mk(k));
  // Bonus-Bilder innerhalb der Gruppe mischen (welche Blume wohin)
  for (const key of ['F', 'S']) {
    const base = key === 'F' ? FLOWER : SEASON;
    const perm = rng.shuffle([0, 1, 2, 3]);
    for (const p of pairs) {
      for (let s = 0; s < 2; s++) if (p[s] >= base && p[s] < base + 4) p[s] = base + perm[p[s] - base];
    }
  }
  return rng.shuffle(pairs);
}

/**
 * Erzeugt eine garantiert lösbare Verteilung für ein Brett.
 * Rückgabe: { faces: number[], solution: [[a,b],…] }
 */
export function generateDeal(board, seed, { attempts = 600 } = {}) {
  const rng = makeRng(typeof seed === 'number' ? seed : String(seed));
  const all = new Uint8Array(board.n).fill(1);
  for (let a = 0; a < attempts; a++) {
    const order = pairOrder(board, all, rng);
    if (!order) continue;
    const facePairs = pickFacePairs(order.length, rng);
    const faces = new Array(board.n).fill(0);
    order.forEach(([p, q], k) => {
      const [f1, f2] = facePairs[k];
      if (rng.chance(0.5)) { faces[p] = f1; faces[q] = f2; } else { faces[p] = f2; faces[q] = f1; }
    });
    return { faces, solution: order };
  }
  throw new Error('Für dieses Layout liess sich keine lösbare Verteilung finden.');
}

/** Prüft, ob eine Zugfolge vom gegebenen Zustand aus regelkonform alles abräumt. */
export function verifySolution(board, faces, present0, order) {
  const present = Uint8Array.from(present0);
  for (const [a, b] of order) {
    if (a === b) return false;
    if (!isFree(board, present, a) || !isFree(board, present, b)) return false;
    if (!facesMatch(faces[a], faces[b])) return false;
    present[a] = 0; present[b] = 0;
  }
  return countPresent(present) === 0;
}

/**
 * Mischt die verbleibenden Steine neu – garantiert wieder lösbar.
 * Gibt ein neues faces-Array zurück oder null, wenn die Stellung grundsätzlich
 * nicht mehr abräumbar ist (z.B. nur noch ein Turm aus zwei Steinen).
 */
export function reshuffle(board, faces, present, seed, opts) {
  const r = reshuffleWithOrder(board, faces, present, seed, opts);
  return r ? r.faces : null;
}

/** Wie reshuffle, liefert aber zusätzlich eine Lösungsfolge: { faces, order } oder null. */
export function reshuffleWithOrder(board, faces, present, seed, { attempts = 300 } = {}) {
  const rng = makeRng(typeof seed === 'number' ? seed : String(seed));
  const idx = [];
  for (let i = 0; i < board.n; i++) if (present[i]) idx.push(i);
  if (!idx.length) return null;
  // Bilder der verbleibenden Steine zu passenden Paaren gruppieren
  const groups = new Map();
  for (const i of idx) {
    const k = matchKey(faces[i]);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(faces[i]);
  }
  const facePairs = [];
  for (const list of groups.values()) {
    if (list.length % 2) return null; // sollte nie vorkommen
    for (let k = 0; k < list.length; k += 2) facePairs.push([list[k], list[k + 1]]);
  }
  let best = null;
  for (let a = 0; a < attempts; a++) {
    const order = pairOrder(board, present, rng);
    if (!order) continue;
    rng.shuffle(facePairs);
    const next = faces.slice();
    order.forEach(([p, q], k) => {
      const [f1, f2] = facePairs[k];
      if (rng.chance(0.5)) { next[p] = f1; next[q] = f2; } else { next[p] = f2; next[q] = f1; }
    });
    // Möglichst eine sichtbar andere Verteilung liefern
    let changed = 0;
    for (const i of idx) if (next[i] !== faces[i]) changed++;
    if (changed > 0 || idx.length <= 2) return { faces: next, order };
    best = best || { faces: next, order };
  }
  return best;
}

/**
 * Führt eine bekannte Lösung nach, nachdem der Spieler das Paar (a, b) genommen hat.
 * present = Stellung NACH dem Zug. Gibt eine weiterhin gültige Lösungsfolge zurück oder null.
 * Idee: Steine wegnehmen macht andere nur freier – ein Paar aus der Lösung darf man also
 * jederzeit vorziehen. Bei «über Kreuz» genommenen Gleichen wird das Restpaar neu eingefügt.
 */
export function advanceSolution(board, faces, present, cert, a, b) {
  if (!cert) return null;
  const has = (pr, x) => pr[0] === x || pr[1] === x;
  const same = cert.findIndex((pr) => has(pr, a) && has(pr, b));
  if (same >= 0) return cert.filter((_, k) => k !== same);
  const i = cert.findIndex((pr) => has(pr, a));
  const j = cert.findIndex((pr) => has(pr, b));
  if (i < 0 || j < 0) return null;
  const c = cert[i][0] === a ? cert[i][1] : cert[i][0];
  const d = cert[j][0] === b ? cert[j][1] : cert[j][0];
  if (!facesMatch(faces[c], faces[d])) return null;
  const rest = cert.filter((_, k) => k !== i && k !== j);
  const start = Math.min(rest.length, Math.max(i, j) - 1);
  // zuerst nahe der ursprünglichen Stelle probieren, dann alle anderen
  const order = [start];
  for (let k = 1; k <= rest.length; k++) { if (start + k <= rest.length) order.push(start + k); if (start - k >= 0) order.push(start - k); }
  for (const pos of order) {
    const next = [...rest.slice(0, pos), [c, d], ...rest.slice(pos)];
    if (verifySolution(board, faces, present, next)) return next;
  }
  return null;
}

// ---------------------------------------------------------------- Löser

let ZOB = null;
function zobrist(n) {
  if (!ZOB || ZOB.a.length < n) {
    const r = makeRng(0x5eed);
    const size = Math.max(n, MAX_TILES * 2);
    ZOB = { a: new Uint32Array(size), b: new Uint32Array(size) };
    for (let i = 0; i < size; i++) {
      ZOB.a[i] = Math.floor(r.next() * 4294967296) >>> 0;
      ZOB.b[i] = Math.floor(r.next() * 4294967296) >>> 0;
    }
  }
  return ZOB;
}

/**
 * Tiefensuche mit Gedächtnis. Ergebnis:
 *   { result: 'solved' | 'unsolvable' | 'unknown', moves: [[a,b],…], nodes }
 * maxNodes begrenzt den Aufwand (für Tipps im Spiel), danach 'unknown'.
 */
export function solve(board, faces, present0, { maxNodes = 200000 } = {}) {
  const n = board.n;
  const present = Uint8Array.from(present0);
  const Z = zobrist(n);
  let h1 = 0, h2 = 0, remaining = 0;
  for (let i = 0; i < n; i++) if (present[i]) { h1 ^= Z.a[i]; h2 ^= Z.b[i]; remaining++; }
  const keys = faces.map(matchKey);
  // Restbestand pro Gruppe
  const left = new Map();
  for (let i = 0; i < n; i++) if (present[i]) left.set(keys[i], (left.get(keys[i]) || 0) + 1);
  const dead = new Set();
  const path = [];
  let nodes = 0;
  let aborted = false;

  const remove = (i) => { present[i] = 0; h1 ^= Z.a[i]; h2 ^= Z.b[i]; left.set(keys[i], left.get(keys[i]) - 1); };
  const restore = (i) => { present[i] = 1; h1 ^= Z.a[i]; h2 ^= Z.b[i]; left.set(keys[i], left.get(keys[i]) + 1); };

  function candidates() {
    const free = freeTiles(board, present);
    const byKey = new Map();
    for (const i of free) {
      const k = keys[i];
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k).push(i);
    }
    const moves = [];
    for (const [k, list] of byKey) {
      if (list.length < 2) continue;
      // Alle verbleibenden Steine dieser Gruppe sind frei → gefahrlos alle nehmen.
      if (list.length === left.get(k) && list.length % 2 === 0) {
        const pairs = [];
        for (let q = 0; q < list.length; q += 2) pairs.push([list[q], list[q + 1]]);
        return [{ pairs, score: Infinity }];
      }
      for (let a = 0; a < list.length; a++) {
        for (let b = a + 1; b < list.length; b++) {
          const i = list[a], j = list[b];
          const score = board.weight[i] + board.weight[j] + (board.tiles[i].z + board.tiles[j].z) * 0.7;
          moves.push({ pairs: [[i, j]], score });
        }
      }
    }
    moves.sort((m1, m2) => m2.score - m1.score);
    return moves;
  }

  function dfs() {
    if (remaining === 0) return true;
    if (++nodes > maxNodes) { aborted = true; return false; }
    const key = h1 + ':' + h2;
    if (dead.has(key)) return false;
    const moves = candidates();
    for (const m of moves) {
      for (const [a, b] of m.pairs) { remove(a); remove(b); remaining -= 2; path.push([a, b]); }
      if (dfs()) return true;
      for (let q = m.pairs.length - 1; q >= 0; q--) {
        const [a, b] = m.pairs[q];
        restore(a); restore(b); remaining += 2; path.pop();
      }
      if (aborted) return false;
    }
    dead.add(key);
    return false;
  }

  const ok = dfs();
  return { result: ok ? 'solved' : aborted ? 'unknown' : 'unsolvable', moves: ok ? path.slice() : [], nodes };
}

/**
 * Tipp: ein Paar, das (wenn möglich) zu einer Lösung führt.
 * { pair:[a,b], safe:boolean, unsolvable:boolean } oder null (keine Paare).
 */
export function findHint(board, faces, present, { maxNodes = 15000 } = {}) {
  const pairs = availablePairs(board, faces, present);
  if (!pairs.length) return null;
  const res = solve(board, faces, present, { maxNodes });
  if (res.result === 'solved' && res.moves.length) return { pair: res.moves[0], safe: true, unsolvable: false };
  // Kein sicherer Weg gefunden: das "nützlichste" Paar zeigen
  let best = pairs[0], bs = -1;
  for (const [a, b] of pairs) {
    const s = board.weight[a] + board.weight[b] + (board.tiles[a].z + board.tiles[b].z) * 0.7;
    if (s > bs) { bs = s; best = [a, b]; }
  }
  return { pair: best, safe: false, unsolvable: res.result === 'unsolvable' };
}

// ---------------------------------------------------------------- Sterne & Grössen

/** 3 Sterne ohne Tipp/Mischen, 2 Sterne mit höchstens 2 Hilfen, sonst 1. Rückgängig ist gratis. */
export function computeStars({ hints = 0, shuffles = 0 } = {}) {
  const helps = hints + shuffles;
  return helps === 0 ? 3 : helps <= 2 ? 2 : 1;
}

export function sizeClass(tileCount) {
  return tileCount <= 72 ? 'klein' : tileCount <= 108 ? 'mittel' : 'gross';
}

// ---------------------------------------------------------------- Prozedurale Layouts

const SIZE_TARGET = {
  klein: [40, 72],
  mittel: [80, 108],
  gross: [112, 144],
};

/**
 * Erzeugt ein symmetrisches Zufalls-Layout (für «Zufallsspiel» und Tagesrätsel).
 * Deterministisch: gleicher Seed → gleiches Layout. Gibt eine Layout-Definition zurück.
 */
export function generateLayoutDef(seed, size = 'mittel') {
  const rng = makeRng('layout-' + seed + '-' + size);
  const [lo, hi] = SIZE_TARGET[size] || SIZE_TARGET.mittel;
  for (let attempt = 0; attempt < 400; attempt++) {
    const W = size === 'klein' ? rng.int(6, 8) : rng.int(8, 10);
    const H = size === 'klein' ? rng.int(5, 8) : size === 'mittel' ? rng.int(7, 9) : rng.int(8, 10);
    const grid = () => Array.from({ length: H }, () => new Array(W).fill(0));
    const base = grid();
    const set = (g, x, y, v = 1) => {
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      g[y][x] = v; g[y][W - 1 - x] = v;
    };
    // Grundform aus gespiegelten Ellipsen/Rechtecken
    const blobs = rng.int(2, 4);
    for (let b = 0; b < blobs; b++) {
      const cx = rng.range(0, W / 2), cy = rng.range(0, H);
      const rx = rng.range(1.2, W / 2), ry = rng.range(1.2, H / 2 + 0.5);
      const rect = rng.chance(0.4);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const u = (x + 0.5 - cx) / rx, v = (y + 0.5 - cy) / ry;
          if (rect ? Math.abs(u) <= 1 && Math.abs(v) <= 1 : u * u + v * v <= 1) set(base, x, y);
        }
      }
    }
    // Gelegentlich gespiegelte Löcher
    if (rng.chance(0.35)) {
      const hx = rng.int(1, Math.floor(W / 2) - 1), hy = rng.int(1, H - 2);
      set(base, hx, hy, 0);
    }
    keepLargest(base, W, H);
    const layers = [base];
    // Obere Ebenen: nach innen schrumpfen (immer voll unterstützt)
    const style = rng.int(0, 2);
    for (let z = 1; z < 6; z++) {
      const prev = layers[z - 1];
      const g = grid();
      let any = 0;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < Math.ceil(W / 2); x++) {
          if (!prev[y][x]) continue;
          const l = x > 0 && prev[y][x - 1], r = x < W - 1 && prev[y][x + 1];
          const u = y > 0 && prev[y - 1][x], d = y < H - 1 && prev[y + 1][x];
          let keep;
          if (style === 0) keep = l && r && (u || d);
          else if (style === 1) keep = l && r && u && d;
          else keep = l && r && rng.chance(0.85);
          if (keep) { set(g, x, y); any++; }
        }
      }
      if (!any) break;
      layers.push(g);
    }
    let count = 0;
    for (const g of layers) for (const row of g) for (const v of row) count += v;
    // Ungerade Anzahl: einen Stein in der Mitte der obersten Ebene ergänzen/entfernen
    if (count % 2) {
      const mid = (W - 1) / 2;
      if (Number.isInteger(mid)) {
        const top = layers[layers.length - 1];
        let fixed = false;
        for (let y = 0; y < H && !fixed; y++) if (top[y][mid]) { top[y][mid] = 0; count--; fixed = true; }
        if (!fixed) continue;
      } else continue;
    }
    // Zu viele Steine: oberste Ebene(n) kappen
    while (count > hi && layers.length > 1) {
      const top = layers.pop();
      for (const row of top) for (const v of row) count -= v;
    }
    if (count < lo || count > hi || count % 2) continue;
    // Leere Ränder/Ebenen entfernen
    const def = {
      id: 'zufall-' + seed,
      name: 'Zufallsform',
      layers: layers.map((g) => g.map((row) => row.map((v) => (v ? 'X' : '.')).join(''))),
    };
    const parsed = parseLayout(def);
    if (validateLayout(parsed).length) continue;
    // Für Spielbarkeit mit Verteilungen prüfen
    return def;
  }
  // Rückfall: einfache Pyramide
  return { id: 'zufall-' + seed, name: 'Zufallsform', layers: [['XXXXXX', 'XXXXXX', 'XXXXXX', 'XXXXXX'], ['.XXXX.', '.XXXX.']] };
}

function keepLargest(g, W, H) {
  const seen = g.map((r) => r.map(() => 0));
  let best = null;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!g[y][x] || seen[y][x]) continue;
      const comp = [];
      const st = [[x, y]];
      seen[y][x] = 1;
      while (st.length) {
        const [cx, cy] = st.pop();
        comp.push([cx, cy]);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx, ny = cy + dy;
          if (nx >= 0 && ny >= 0 && nx < W && ny < H && g[ny][nx] && !seen[ny][nx]) { seen[ny][nx] = 1; st.push([nx, ny]); }
        }
      }
      if (!best || comp.length > best.length) best = comp;
    }
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) g[y][x] = 0;
  if (best) for (const [x, y] of best) g[y][x] = 1;
}

// ---------------------------------------------------------------- Bildschirm-Geometrie

/** Proportionen eines Steins relativ zur Breite w. */
export const TILE = { ratio: 1.32, depth: 0.13, shift: 0.12 };

/** Ausdehnung eines Layouts in Steinbreiten (w = 1), inkl. Kanten und Ebenen-Versatz. */
export function layoutExtent(tiles) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const t of tiles) {
    const x = t.x / 2 - t.z * TILE.shift;
    const y = (t.y / 2) * TILE.ratio - t.z * TILE.shift;
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + 1 + TILE.depth); maxY = Math.max(maxY, y + TILE.ratio + TILE.depth);
  }
  if (!tiles.length) return { minX: 0, minY: 0, w: 1, h: 1 };
  return { minX, minY, w: maxX - minX, h: maxY - minY };
}

/** Steinbreite in px, damit das Layout in eine Fläche viewW × viewH passt. */
export function fitTileWidth(tiles, viewW, viewH, pad = 8, maxW = 62) {
  const e = layoutExtent(tiles);
  return Math.min(maxW, (viewW - pad * 2) / e.w, (viewH - pad * 2) / e.h);
}
