// Perlenbild – reine Spiellogik (kein DOM, in Node testbar).
//
// Begriffe
//   Muster (pattern)  { id, title, category, palette: { ch: '#hex' }, rows: ['..ab..', …] }
//   Level  (L)        geparstes Muster: Zellen, Farben, Füllreihenfolge
//   Zustand (st)      Vorrat (Spalten), Ablage-Plätze, gelegte Perlen je Farbe
//
// Füllreihenfolge: Zeilen von unten nach oben, in jeder Zeile von links nach rechts.
// Eine Farbe füllt immer ihre nächste freie Zelle in dieser Reihenfolge – darum ist
// der Bildzustand vollständig durch «gelegte Perlen je Farbe» (counts) beschrieben.
// Aktive Zone: die untersten R Zeilen, die noch leere Zellen haben.

import { makeRng, hashString } from '../shared/rng.js';
import { normalizeHex, hexToOklab, labDist } from './colors.js';

export const MAX_SLOTS = 8;
export const DEFAULT_SLOTS = 4;
export const MAGNET_COUNT = 8;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------------------------------------------------------------------------
// Muster parsen
// ---------------------------------------------------------------------------

export function isValidPattern(p) {
  if (!p || typeof p !== 'object') return false;
  if (!Array.isArray(p.rows) || p.rows.length < 1 || p.rows.length > 96) return false;
  if (!p.palette || typeof p.palette !== 'object') return false;
  if (!p.rows.every((r) => typeof r === 'string' && r.length > 0 && r.length <= 96)) return false;
  const chars = new Set(Object.keys(p.palette));
  let any = false;
  for (const r of p.rows) for (const ch of r) if (ch !== '.' && chars.has(ch) && normalizeHex(p.palette[ch])) any = true;
  return any;
}

/** Wandelt ein Muster in die interne Level-Struktur um. */
export function parsePattern(p) {
  if (!isValidPattern(p)) throw new Error('Ungültiges Muster');
  const rows = p.rows.map(String);
  const H = rows.length;
  const W = Math.max(...rows.map((r) => r.length));

  // Palettenzeichen -> Farbslot (fast gleiche Farben werden zusammengelegt,
  // sonst sähen zwei «verschiedene» Steine gleich aus)
  const hexes = [];
  const labs = [];
  const charSlot = new Map();
  for (const [ch, hex] of Object.entries(p.palette)) {
    if (ch === '.' || ch.length !== 1) continue;
    const norm = normalizeHex(hex);
    if (!norm) continue;
    const lab = hexToOklab(norm);
    let idx = -1;
    for (let i = 0; i < labs.length; i++) if (labDist(labs[i], lab) < 0.02) { idx = i; break; }
    if (idx < 0) { idx = hexes.length; hexes.push(norm); labs.push(lab); }
    charSlot.set(ch, idx);
  }

  const raw = new Int16Array(W * H).fill(-1);
  for (let y = 0; y < H; y++) {
    const r = rows[y];
    for (let x = 0; x < r.length; x++) {
      const s = charSlot.get(r[x]);
      if (s !== undefined) raw[y * W + x] = s;
    }
  }

  // Füllreihenfolge + Farben nach erstem Auftreten neu nummerieren
  const order = [];
  const remap = new Map();
  const colors = [];
  for (let rb = 0; rb < H; rb++) {
    const y = H - 1 - rb;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (raw[i] < 0) continue;
      order.push(i);
      if (!remap.has(raw[i])) { remap.set(raw[i], colors.length); colors.push(hexes[raw[i]]); }
    }
  }
  const cells = new Int16Array(W * H).fill(-1);
  for (let i = 0; i < raw.length; i++) if (raw[i] >= 0) cells[i] = remap.get(raw[i]);

  const K = colors.length;
  const colorCellsArr = colors.map(() => []);
  const idxInColor = new Int32Array(W * H).fill(-1);
  const rbOf = new Int16Array(W * H);
  const rowTotal = new Int32Array(H);
  for (let i = 0; i < W * H; i++) rbOf[i] = H - 1 - Math.floor(i / W);
  for (const i of order) {
    const k = cells[i];
    idxInColor[i] = colorCellsArr[k].length;
    colorCellsArr[k].push(i);
    rowTotal[rbOf[i]]++;
  }
  return {
    id: String(p.id || 'muster'),
    title: String(p.title || 'Bild'),
    category: String(p.category || ''),
    W, H, K, colors, cells,
    order: Int32Array.from(order),
    colorCells: colorCellsArr.map((a) => Int32Array.from(a)),
    colorTotals: Int32Array.from(colorCellsArr.map((a) => a.length)),
    idxInColor, rbOf, rowTotal,
    total: order.length,
  };
}

// ---------------------------------------------------------------------------
// Zustand
// ---------------------------------------------------------------------------

export function makeState(L, cols, S = DEFAULT_SLOTS, R = 2, pri = null) {
  const st = {
    cols: cols.map((c) => Array.from(c)),
    pri: pri ? pri.map((c) => Array.from(c)) : null, // Priorität je Stein (Index in der Soll-Reihenfolge)
    ptr: new Int32Array(cols.length),
    counts: new Int32Array(L.K),
    rowRem: Int32Array.from(L.rowTotal),
    low: 0,
    zoneTop: 0,
    slotK: new Int16Array(MAX_SLOTS).fill(-1),
    slotN: new Int32Array(MAX_SLOTS),
    S: clamp(S | 0, 1, MAX_SLOTS),
    R: Math.max(1, R | 0),
    placed: 0,
  };
  updateZone(L, st);
  return st;
}

/** Flache Kopie: Spalten-Arrays werden geteilt (Züge verändern nur ptr). */
export function cloneState(st) {
  return {
    cols: st.cols,
    pri: st.pri,
    ptr: st.ptr.slice(),
    counts: st.counts.slice(),
    rowRem: st.rowRem.slice(),
    low: st.low,
    zoneTop: st.zoneTop,
    slotK: st.slotK.slice(),
    slotN: st.slotN.slice(),
    S: st.S,
    R: st.R,
    placed: st.placed,
  };
}

export function updateZone(L, st) {
  let rb = st.low;
  while (rb < L.H && st.rowRem[rb] === 0) rb++;
  st.low = rb;
  let n = 0;
  let top = L.H;
  for (let r = rb; r < L.H; r++) {
    if (st.rowRem[r] > 0 && ++n === st.R) { top = r; break; }
  }
  st.zoneTop = top; // Zeilen mit rb <= zoneTop gehören zur Zone
}

/** Kann eine Perle der Farbe k jetzt ins Bild? */
export function canPlace(L, st, k) {
  const n = st.counts[k];
  const cc = L.colorCells[k];
  return n < cc.length && L.rbOf[cc[n]] <= st.zoneTop;
}

function placeOne(L, st, k) {
  const cell = L.colorCells[k][st.counts[k]++];
  st.placed++;
  if (--st.rowRem[L.rbOf[cell]] === 0) updateZone(L, st);
  return cell;
}

/** Abgelegte Perlen, die jetzt passen, fliegen ins Bild (Kettenreaktion). */
function autoFlow(L, st, moves) {
  let changed = true;
  while (changed) {
    changed = false;
    for (let s = 0; s < st.S; s++) {
      const k = st.slotK[s];
      if (k < 0) continue;
      while (st.slotN[s] > 0 && canPlace(L, st, k)) {
        const cell = placeOne(L, st, k);
        st.slotN[s]--;
        if (moves) moves.push({ t: 'unpark', k, slot: s, cell });
        changed = true;
      }
      if (st.slotN[s] === 0) st.slotK[s] = -1;
    }
  }
}

export function frontRun(st, c) {
  const col = st.cols[c];
  const p = st.ptr[c];
  if (!col || p >= col.length) return null;
  const k = col[p];
  let m = 1;
  while (p + m < col.length && col[p + m] === k) m++;
  return { k, m };
}

/**
 * Nimmt die vorderste Gruppe gleichfarbiger Steine aus Spalte c.
 * Verändert st! Bei 'refused' ist st teilweise verändert – darum immer auf einer Kopie aufrufen.
 * noPark: true -> abbrechen, sobald etwas abgelegt werden müsste.
 * Rückgabe: 'ok' | 'empty' | 'refused'
 */
export function applyTap(L, st, c, moves, noPark = false) {
  const run = frontRun(st, c);
  if (!run) return 'empty';
  const { k, m } = run;
  for (let i = 0; i < m; i++) {
    if (canPlace(L, st, k)) {
      const cell = placeOne(L, st, k);
      if (moves) moves.push({ t: 'place', k, from: 'tray', col: c, depth: 0, cell });
      autoFlow(L, st, moves);
    } else {
      if (noPark) return 'refused';
      let s = -1;
      for (let j = 0; j < st.S; j++) if (st.slotK[j] === k) { s = j; break; }
      if (s < 0) for (let j = 0; j < st.S; j++) if (st.slotK[j] < 0) { s = j; break; }
      if (s < 0) return 'refused';
      st.slotK[s] = k;
      st.slotN[s]++;
      if (moves) moves.push({ t: 'park', k, from: 'tray', col: c, depth: 0, slot: s });
    }
  }
  st.ptr[c] += m;
  return 'ok';
}

export function legalColumns(L, st) {
  const out = [];
  for (let c = 0; c < st.cols.length; c++) {
    if (st.ptr[c] >= st.cols[c].length) continue;
    if (applyTap(L, cloneState(st), c, null) === 'ok') out.push(c);
  }
  return out;
}

/** Zellen der aktiven Zone, die noch leer sind (in Füllreihenfolge). */
export function zoneCells(L, st) {
  const out = [];
  for (let rb = st.low; rb < L.H && rb <= st.zoneTop; rb++) {
    if (st.rowRem[rb] === 0) continue;
    const y = L.H - 1 - rb;
    for (let x = 0; x < L.W; x++) {
      const i = y * L.W + x;
      const k = L.cells[i];
      if (k >= 0 && L.idxInColor[i] >= st.counts[k]) out.push(i);
    }
  }
  return out;
}

export function filledMask(L, st) {
  const m = new Uint8Array(L.W * L.H);
  for (let k = 0; k < L.K; k++) {
    const cc = L.colorCells[k];
    for (let j = 0; j < st.counts[k]; j++) m[cc[j]] = 1;
  }
  return m;
}

// ---------------------------------------------------------------------------
// Löser: Tiefensuche mit Memo. «Sichere» Züge (alle Steine passen direkt ins
// Bild) sind nie schlechter als Warten und werden ohne Verzweigung ausgeführt.
// ---------------------------------------------------------------------------

function stateKey(st) {
  let s = '';
  for (let c = 0; c < st.ptr.length; c++) s += st.ptr[c] + ',';
  const parts = [];
  for (let j = 0; j < st.S; j++) if (st.slotK[j] >= 0) parts.push(st.slotK[j] * 4096 + st.slotN[j]);
  parts.sort((a, b) => a - b);
  return s + '|' + parts.join(',');
}

function usedSlots(st) {
  let n = 0;
  for (let j = 0; j < st.S; j++) if (st.slotK[j] >= 0) n++;
  return n;
}

function parkedTotal(st) {
  let n = 0;
  for (let j = 0; j < st.S; j++) if (st.slotK[j] >= 0) n += st.slotN[j];
  return n;
}

/**
 * Spielt den Vorrat mit einer einfachen «gierigen» Strategie durch (immer der Zug, der am
 * meisten ins Bild legt und am wenigsten ablegt) – so spielen die meisten Menschen.
 * true, wenn das Bild ohne Helfer fertig wird.
 */
export function greedyClears(L, st0, { noise = 0, seed = 'g' } = {}) {
  const rng = noise > 0 ? makeRng(hashString(seed)) : null;
  let st = cloneState(st0);
  const C = st.cols.length;
  for (let guard = 0; guard < 100000 && st.placed < L.total; guard++) {
    let best = null;
    let bestScore = -Infinity;
    const legal = [];
    const parked0 = parkedTotal(st);
    for (let c = 0; c < C; c++) {
      if (st.ptr[c] >= st.cols[c].length) continue;
      const t = cloneState(st);
      if (applyTap(L, t, c, null) !== 'ok') continue;
      legal.push(t);
      const score = 2 * (t.placed - st.placed) - Math.max(0, parkedTotal(t) - parked0) - 0.5 * usedSlots(t);
      if (score > bestScore) { bestScore = score; best = t; }
    }
    if (!best) return false;
    // ab und zu ein unbedachter Tipp (wie im echten Spiel)
    st = rng && rng.next() < noise ? legal[Math.floor(rng.next() * legal.length)] : best;
  }
  return st.placed === L.total;
}

export function solve(L, st0, opts = {}) {
  const maxNodes = opts.maxNodes ?? 20000;
  const C = st0.cols.length;
  const seen = new Set();
  const path = [];
  let nodes = 0;
  let exceeded = false;

  const prio = (st, c) => (st.pri ? st.pri[c][st.ptr[c]] : st.ptr[c] * 64 + c);

  // Sichere Züge (alles passt direkt ins Bild) in Prioritäts-Reihenfolge ausführen.
  function closure(st) {
    for (;;) {
      let best = -1;
      let bestP = Infinity;
      let bestT = null;
      for (let c = 0; c < C; c++) {
        const col = st.cols[c];
        const p = st.ptr[c];
        if (p >= col.length || !canPlace(L, st, col[p])) continue;
        const pr = prio(st, c);
        if (pr >= bestP) continue;
        const t = cloneState(st);
        if (applyTap(L, t, c, null, true) === 'ok') { best = c; bestP = pr; bestT = t; }
      }
      if (best < 0) return;
      Object.assign(st, bestT);
      path.push(best);
    }
  }

  function dfs(st) {
    const mark = path.length;
    closure(st);
    if (st.placed === L.total) return true;
    if (++nodes > maxNodes) { exceeded = true; path.length = mark; return false; }
    const key = stateKey(st);
    if (seen.has(key)) { path.length = mark; return false; }
    seen.add(key);
    const mark2 = path.length;
    const cands = [];
    for (let c = 0; c < C; c++) {
      if (st.ptr[c] >= st.cols[c].length) continue;
      const t = cloneState(st);
      if (applyTap(L, t, c, null) !== 'ok') continue;
      cands.push({ c, t, score: usedSlots(t) * 100 + parkedTotal(t) * 3 - (t.placed - st.placed), pr: prio(st, c) });
    }
    cands.sort((a, b) => a.score - b.score || a.pr - b.pr);
    for (const cd of cands) {
      path.length = mark2;
      path.push(cd.c);
      if (dfs(cd.t)) return true;
      if (exceeded) break;
    }
    path.length = mark;
    return false;
  }

  const ok = dfs(cloneState(st0));
  return { solvable: ok, exceeded: !ok && exceeded, nodes, path: ok ? path.slice() : null };
}

// ---------------------------------------------------------------------------
// Vorrat erzeugen (deterministisch, lösbar)
// ---------------------------------------------------------------------------

export function fillSequence(L, R = 0) {
  return bandGroup(L, L.order, R).map((i) => L.cells[i]);
}

/**
 * Ordnet Zellen (in Füllreihenfolge) in Bändern zu je R Zeilen (von unten) nach Farbe:
 * Innerhalb eines Bandes ist die Reihenfolge egal (alle Zellen liegen gemeinsam in der
 * aktiven Zone, sobald die Bänder darunter fertig sind) – so entstehen längere
 * gleichfarbige Läufe und weniger, dafür grössere Züge.
 */
export function bandGroup(L, cells, R = 0) {
  const list = Array.from(cells);
  if (!(R > 0)) return list;
  const out = [];
  let i = 0;
  while (i < list.length) {
    const band = Math.floor(L.rbOf[list[i]] / R);
    const byColor = new Map();
    while (i < list.length && Math.floor(L.rbOf[list[i]] / R) === band) {
      const k = L.cells[list[i]];
      if (!byColor.has(k)) byColor.set(k, []);
      byColor.get(k).push(list[i]);
      i++;
    }
    for (const arr of byColor.values()) out.push(...arr);
  }
  return out;
}

/** Grösste Gruppe (Steine pro Zug) – wächst mit der Bildgrösse, damit grosse Bilder nicht ewig dauern. */
export function chunkMax(L) {
  return clamp(Math.round(4 + L.total / 160), 5, 9);
}

/** Teilt die Farbfolge in Gruppen (1..maxChunk gleichfarbige Steine). */
export function chunkify(seq, rng, maxChunk = 5, minChunk = 2) {
  const chunks = [];
  let i = 0;
  while (i < seq.length) {
    let j = i;
    while (j < seq.length && seq[j] === seq[i]) j++;
    let len = j - i;
    while (len > 0) {
      let take = len;
      if (len > maxChunk) {
        take = rng.int(Math.min(minChunk, maxChunk), maxChunk);
        if (len - take < minChunk) take = len - minChunk;
      }
      chunks.push({ k: seq[i], n: take, at: j - len });
      len -= take;
    }
    i = j;
  }
  return chunks;
}

/** Lokale Unordnung: jede Gruppe darf um bis zu D Plätze wandern. */
export function perturb(chunks, rng, D) {
  if (!(D > 0)) return chunks.slice();
  return chunks
    .map((ch, i) => ({ ch, key: i + rng.next() * D }))
    .sort((a, b) => a.key - b.key)
    .map((o) => o.ch);
}

/**
 * Verteilt Gruppen auf C Spalten (vorne = zuerst gebraucht), möglichst ausgeglichen.
 * bury (0..1): Wahrscheinlichkeit, dass eine Gruppe in ihrer Spalte hinter die
 * nächste rutscht – so liegen gebrauchte Farben manchmal verdeckt.
 * Rückgabe: { cols, pri } – pri[c][i] = Position des Steins in der Soll-Reihenfolge.
 */
export function deal(chunks, rng, C, bury = 0) {
  const lists = Array.from({ length: C }, () => []);
  const last = new Int32Array(C).fill(-1);
  const size = new Int32Array(C);
  for (const ch of chunks) {
    let min = Infinity;
    for (let c = 0; c < C; c++) min = Math.min(min, size[c]);
    let cand = [];
    for (let c = 0; c < C; c++) if (size[c] <= min + 3 && last[c] !== ch.k) cand.push(c);
    if (!cand.length) for (let c = 0; c < C; c++) if (last[c] !== ch.k) cand.push(c);
    if (!cand.length) for (let c = 0; c < C; c++) cand.push(c);
    const c = cand[Math.floor(rng.next() * cand.length)];
    lists[c].push(ch);
    size[c] += ch.n;
    last[c] = ch.k;
  }
  if (bury > 0) {
    for (const list of lists) {
      for (let i = 0; i + 1 < list.length; i++) {
        if (!rng.chance(bury)) continue;
        const j = i + (i + 2 < list.length && rng.chance(0.3) ? 2 : 1);
        const t = list[i]; list[i] = list[j]; list[j] = t;
        i = j; // nicht dieselbe Gruppe gleich weiterschieben
      }
    }
  }
  const cols = lists.map(() => []);
  const pri = lists.map(() => []);
  lists.forEach((list, c) => {
    for (const ch of list) for (let n = 0; n < ch.n; n++) { cols[c].push(ch.k); pri[c].push((ch.at ?? 0) + n); }
  });
  return { cols, pri };
}

/**
 * Schwierigkeits-Parameter für Level n (1-basiert).
 *   C  Spalten im Vorrat (mehr Farben/Steine -> mehr Spalten)
 *   R  Zeilen der aktiven Zone (2; bei sehr schmalen Bildern 3)
 *   S  Ablageplätze
 *   disorder  globale Unordnung (Gruppen wandern um bis zu D Plätze)
 *   bury      Anteil verdeckter Gruppen in den Spalten (Hauptregler)
 *   slack     so viele Ablageplätze weniger muss der Löser auskommen (Puffer für Anfänger)
 */
export function levelConfig(L, n = 1, { custom = false, round = 0 } = {}) {
  // mindestens so viele Spalten wie Farben (bis 8): sonst wird die kleine Ablage zum Nadelöhr
  const C = clamp(Math.max(Math.round(3.4 + L.K * 0.45 + L.total / 420), L.K), 5, 8);
  // ab der zweiten Runde durch die Bibliothek: schmalere Zone bei mittleren Bildern
  const R = L.W <= 7 ? 3 : round >= 1 && L.W >= 10 && L.W <= 22 ? 1 : 2;
  const S = DEFAULT_SLOTS;
  if (custom) return { C, R, S, disorder: 1.5, bury: 0.2, slack: 1, greedy: 1, maxChunk: Math.min(9, chunkMax(L) + 1) };
  const d = Math.max(0, n - 1);
  return {
    C, R, S,
    disorder: Math.min(2.5, 0.3 * d),
    bury: n <= 1 ? 0 : Math.min(0.45, 0.06 + 0.035 * d),
    slack: n <= 3 ? 2 : n <= 10 ? 1 : 0,
    greedy: n <= 24 ? 2 : 1, // siehe generateTray: auch gierig spielend ohne Helfer machbar
    maxChunk: n <= 5 ? 6 : chunkMax(L),
  };
}

/**
 * Wie gut kommt ein einfacher «gieriger» Spielstil ohne Helfer durch? Zählt die bestandenen
 * Prüfungen (0–4): mit allen Ablageplätzen; mit einem Platz weniger; zweimal mit gelegentlichen
 * Fehltipps (5 %). Bricht beim ersten Fehlschlag ab.
 */
function playability(L, cols, pri, S, R, seed) {
  let n = 0;
  if (!greedyClears(L, makeState(L, cols, S, R, pri))) return n;
  n++;
  if (S > 1 && !greedyClears(L, makeState(L, cols, S - 1, R, pri))) return n;
  n++;
  for (let r = 0; r < 2; r++) {
    if (!greedyClears(L, makeState(L, cols, S, R, pri), { noise: 0.05, seed: `${seed}|n${r}` })) return n;
    n++;
  }
  return n;
}

/**
 * Erzeugt einen lösbaren Vorrat. Die Unordnung wird so lange verringert, bis der
 * Löser mit (S - slack) Ablageplätzen eine Lösung findet und – je nach `greedy` – auch ein
 * einfacher gieriger Spielstil durchkommt:
 *   greedy = 0  keine Prüfung
 *   greedy = 1  gierig mit allen Ablageplätzen
 *   greedy = 2  zusätzlich mit einem Platz weniger und mit gelegentlichen Fehltipps
 * Schafft das kein Versuch, gewinnt der lösbare Versuch mit den meisten bestandenen Prüfungen.
 */
export function generateTray(L, cfg) {
  const { seed = 'beads', C = 6, S = DEFAULT_SLOTS, R = 2, slack = 0, disorder = 0, bury = 0, maxChunk = 5, greedy = 0 } = cfg;
  const maxNodes = cfg.maxNodes ?? 5000;
  const seq = fillSequence(L, R);
  const verifyS = Math.max(1, S - slack);
  const need = greedy >= 2 ? 4 : greedy >= 1 ? 1 : 0;
  const attempts = 6;
  let last = null;
  let best = null;
  for (let a = 0; a <= attempts; a++) {
    const f = a === attempts ? 0 : Math.pow(0.68, a);
    const D = disorder * f;
    const B = bury * f;
    const rng = makeRng(hashString(`${seed}|${a}`));
    const chunks = chunkify(seq, rng, maxChunk);
    const { cols, pri } = deal(perturb(chunks, rng, D), rng, C, B);
    last = { cols, pri, disorder: D, bury: B, attempt: a, solvable: false };
    const res = solve(L, makeState(L, cols, verifyS, R, pri), { maxNodes });
    if (!res.solvable) continue;
    const score = need ? playability(L, cols, pri, S, R, `${seed}|${a}`) : 0;
    const out = { ...last, solvable: true, nodes: res.nodes, playability: score };
    if (score >= need) return out;
    if (!best || score > best.playability) best = out;
  }
  return best || last;
}

// ---------------------------------------------------------------------------
// Helfer
// ---------------------------------------------------------------------------

/** Magnet: zieht die nächsten gebrauchten Steine von irgendwo im Vorrat ins Bild. */
export function magnetPull(L, st, count = MAGNET_COUNT) {
  const moves = [];
  for (let n = 0; n < count && st.placed < L.total; n++) {
    let cell = -1;
    for (let rb = st.low; rb < L.H && cell < 0; rb++) {
      if (st.rowRem[rb] === 0) continue;
      const y = L.H - 1 - rb;
      for (let x = 0; x < L.W; x++) {
        const i = y * L.W + x;
        const k = L.cells[i];
        if (k >= 0 && L.idxInColor[i] >= st.counts[k]) { cell = i; break; }
      }
    }
    if (cell < 0) break;
    const k = L.cells[cell];
    let bc = -1;
    let bd = Infinity;
    for (let c = 0; c < st.cols.length; c++) {
      const col = st.cols[c];
      for (let d = st.ptr[c]; d < col.length; d++) {
        if (col[d] === k) {
          if (d - st.ptr[c] < bd) { bd = d - st.ptr[c]; bc = c; }
          break;
        }
      }
    }
    if (bc < 0) break;
    // eigene Kopie der Spalte, damit geteilte Arrays (Löser, alte Zustände) unverändert bleiben
    const col = st.cols[bc].slice();
    col.splice(st.ptr[bc] + bd, 1);
    st.cols = st.cols.slice();
    st.cols[bc] = col;
    if (st.pri) {
      const pc = st.pri[bc].slice();
      pc.splice(st.ptr[bc] + bd, 1);
      st.pri = st.pri.slice();
      st.pri[bc] = pc;
    }
    const placed = placeOne(L, st, k);
    moves.push({ t: 'place', k, from: 'tray', col: bc, depth: bd, cell: placed });
    autoFlow(L, st, moves);
  }
  return moves;
}

/** Restliche Farbfolge des Vorrats (ohne Zellen, die abgelegte Steine füllen werden). */
export function remainingTraySequence(L, st) {
  const reserved = new Int32Array(L.K);
  for (let s = 0; s < st.S; s++) if (st.slotK[s] >= 0) reserved[st.slotK[s]] += st.slotN[s];
  const rest = [];
  for (const cell of L.order) {
    const k = L.cells[cell];
    if (L.idxInColor[cell] < st.counts[k]) continue;
    if (reserved[k] > 0) { reserved[k]--; continue; }
    rest.push(cell);
  }
  return bandGroup(L, rest, st.R).map((i) => L.cells[i]);
}

/** Mischen: ordnet den Vorrat neu, sodass gebrauchte Farben vorne liegen. */
export function reshuffle(L, st, seed, disorder = 1.2) {
  const seq = remainingTraySequence(L, st);
  const C = st.cols.length;
  let last = null;
  for (let a = 0; a < 4; a++) {
    const D = a === 3 ? 0 : disorder * Math.pow(0.5, a);
    const rng = makeRng(hashString(`${seed}|mix|${a}`));
    const res = deal(perturb(chunkify(seq, rng, chunkMax(L)), rng, D), rng, C);
    last = res;
    const t = cloneState(st);
    t.cols = res.cols;
    t.pri = res.pri;
    t.ptr = new Int32Array(C);
    if (solve(L, t, { maxNodes: 2500 }).solvable) return res;
  }
  return last;
}

// ---------------------------------------------------------------------------
// Spiel-Objekt (UI-Schnittstelle)
// ---------------------------------------------------------------------------

export class Game {
  constructor(L, st, meta = {}) {
    this.L = L;
    this.st = st;
    this.meta = {
      seed: 'beads',
      helpers: { magnet: 0, shuffle: 0, slot: 0 },
      taps: 0,
      ...meta,
    };
  }

  static create(L, cfg) {
    const gen = generateTray(L, cfg);
    const st = makeState(L, gen.cols, cfg.S, cfg.R, gen.pri);
    return new Game(L, st, { seed: String(cfg.seed), disorder: gen.disorder });
  }

  /** Stellt einen gespeicherten Zustand wieder her (oder null, wenn er nicht passt). */
  static restore(L, d) {
    try {
      if (!d || d.v !== 1 || !Array.isArray(d.cols) || !Array.isArray(d.counts)) return null;
      if (d.counts.length !== L.K) return null;
      const cols = d.cols.map((col) => col.map((k) => k | 0));
      for (const col of cols) for (const k of col) if (k < 0 || k >= L.K) return null;
      let pri = null;
      if (Array.isArray(d.pri) && d.pri.length === cols.length &&
          d.pri.every((p, c) => Array.isArray(p) && p.length === cols[c].length)) pri = d.pri;
      const st = makeState(L, cols, d.S, d.R, pri);
      const have = new Int32Array(L.K);
      for (let k = 0; k < L.K; k++) {
        const n = d.counts[k] | 0;
        if (n < 0 || n > L.colorTotals[k]) return null;
        st.counts[k] = n;
        have[k] += n;
        st.placed += n;
        const cc = L.colorCells[k];
        for (let j = 0; j < n; j++) st.rowRem[L.rbOf[cc[j]]]--;
      }
      const slots = Array.isArray(d.slots) ? d.slots : [];
      for (let s = 0; s < Math.min(slots.length, st.S); s++) {
        const [k, n] = slots[s] || [-1, 0];
        if (k >= 0 && k < L.K && n > 0) { st.slotK[s] = k; st.slotN[s] = n; have[k] += n; }
      }
      for (const col of cols) for (const k of col) have[k]++;
      for (let k = 0; k < L.K; k++) if (have[k] !== L.colorTotals[k]) return null;
      st.low = 0;
      updateZone(L, st);
      autoFlow(L, st, null);
      return new Game(L, st, { ...(d.meta || {}) });
    } catch {
      return null;
    }
  }

  serialize() {
    const st = this.st;
    const slots = [];
    for (let s = 0; s < st.S; s++) slots.push([st.slotK[s], st.slotN[s]]);
    return {
      v: 1,
      cols: st.cols.map((col, c) => col.slice(st.ptr[c])),
      pri: st.pri ? st.pri.map((p, c) => p.slice(st.ptr[c])) : null,
      counts: Array.from(st.counts),
      slots,
      S: st.S,
      R: st.R,
      meta: this.meta,
    };
  }

  get complete() { return this.st.placed === this.L.total; }
  get progress() { return this.L.total ? this.st.placed / this.L.total : 1; }

  tap(c) {
    if (this.complete) return { status: 'done', moves: [] };
    const t = cloneState(this.st);
    const moves = [];
    const run = frontRun(t, c);
    const r = applyTap(this.L, t, c, moves);
    if (r !== 'ok') return { status: r, moves: [], run };
    this.st = t;
    this.meta.taps++;
    return { status: 'ok', moves, run };
  }

  magnet(n = MAGNET_COUNT) {
    if (this.complete) return [];
    const moves = magnetPull(this.L, this.st, n);
    if (moves.length) this.meta.helpers.magnet++;
    return moves;
  }

  shuffle() {
    if (this.complete) return null;
    const n = this.meta.helpers.shuffle;
    const { cols, pri } = reshuffle(this.L, this.st, `${this.meta.seed}:${n}`);
    this.st.cols = cols;
    this.st.pri = pri;
    this.st.ptr = new Int32Array(cols.length);
    this.meta.helpers.shuffle++;
    return cols;
  }

  addSlot() {
    if (this.st.S >= MAX_SLOTS) return false;
    this.st.S++;
    this.meta.helpers.slot++;
    return true;
  }

  legalColumns() { return legalColumns(this.L, this.st); }
  isStuck() { return !this.complete && this.legalColumns().length === 0; }
  zoneCells() { return zoneCells(this.L, this.st); }
  filledMask() { return filledMask(this.L, this.st); }
  traySize() {
    let n = 0;
    this.st.cols.forEach((col, c) => { n += col.length - this.st.ptr[c]; });
    return n;
  }
  /** Spalten als Arrays (vorne = Index 0) */
  trayColumns() { return this.st.cols.map((col, c) => col.slice(this.st.ptr[c])); }

  helpersUsed() {
    const h = this.meta.helpers;
    return (h.magnet | 0) + (h.shuffle | 0) + (h.slot | 0);
  }

  stars() {
    const n = this.helpersUsed();
    return n === 0 ? 3 : n <= 2 ? 2 : 1;
  }

  /** Nächster Zug laut Löser (für Tests/Debug); -1 wenn keiner gefunden. */
  solverMove(maxNodes = 20000) {
    const res = solve(this.L, this.st, { maxNodes });
    return res.solvable && res.path.length ? res.path[0] : -1;
  }
}
