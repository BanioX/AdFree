// Bilderrätsel – reine Logik (ohne DOM): Hinweise (Clues), Zeilen-Löser, Gesamt-Löser, Tipp.
//
// Zellzustände im Löser:  0 = unbekannt, 1 = gefüllt, 2 = leer
// Ein Rätsel gilt als gut, wenn der Zeilen-Löser es ohne Raten vollständig löst
// (daraus folgt auch: es gibt genau eine Lösung).

export const UNKNOWN = 0;
export const FILLED = 1;
export const EMPTY = 2;

/** Blocklängen einer Linie (Array aus 0/1 oder Booleans). Leere Linie => []. */
export function runsOf(line) {
  const out = [];
  let run = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === 1 || line[i] === true) run++;
    else if (run) { out.push(run); run = 0; }
  }
  if (run) out.push(run);
  return out;
}

/** Zeilen- und Spalten-Hinweise einer Maske (Uint8Array, 1 = gefüllt). */
export function cluesFor(mask, w, h) {
  const rows = [];
  const cols = [];
  const line = new Uint8Array(Math.max(w, h));
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) line[c] = mask[r * w + c];
    rows.push(runsOf(line.subarray(0, w)));
  }
  for (let c = 0; c < w; c++) {
    for (let r = 0; r < h; r++) line[r] = mask[r * w + c];
    cols.push(runsOf(line.subarray(0, h)));
  }
  return { rows, cols };
}

/**
 * Löst eine einzelne Linie so weit wie möglich.
 * @param {number[]} clue   Blocklängen
 * @param {ArrayLike<number>} cells  aktueller Stand (0/1/2)
 * @returns {Uint8Array|null}  neuer Stand (alle in jeder gültigen Belegung gleichen Zellen festgelegt)
 *                             oder null, wenn kein gültige Belegung existiert.
 */
export function solveLine(clue, cells) {
  const n = cells.length;
  const k = clue.length;
  const N1 = n + 1;
  // Präfixsumme der sicher leeren Zellen => "passt ein Block auf [s, e)?" in O(1)
  const emptyPS = new Int32Array(N1);
  for (let i = 0; i < n; i++) emptyPS[i + 1] = emptyPS[i] + (cells[i] === EMPTY ? 1 : 0);
  const fits = (s, e) => e <= n && emptyPS[e] - emptyPS[s] === 0;

  // P[j*N1 + i]: Zellen [0, i) lassen sich mit den Blöcken 0..j-1 belegen
  const P = new Uint8Array((k + 1) * N1);
  P[0] = 1;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= k; j++) {
      if (!P[j * N1 + i]) continue;
      if (cells[i] !== FILLED) P[j * N1 + i + 1] = 1;
      if (j < k) {
        const e = i + clue[j];
        if (fits(i, e)) {
          if (e === n) P[(j + 1) * N1 + n] = 1;
          else if (cells[e] !== FILLED) P[(j + 1) * N1 + e + 1] = 1;
        }
      }
    }
  }
  if (!P[k * N1 + n]) return null;

  // S[j*N1 + i]: Zellen [i, n) lassen sich mit den Blöcken j..k-1 belegen
  const S = new Uint8Array((k + 1) * N1);
  S[k * N1 + n] = 1;
  for (let i = n - 1; i >= 0; i--) {
    for (let j = k; j >= 0; j--) {
      let v = 0;
      if (cells[i] !== FILLED && S[j * N1 + i + 1]) v = 1;
      if (!v && j < k) {
        const e = i + clue[j];
        if (fits(i, e)) {
          if (e === n) v = j + 1 === k ? 1 : 0;
          else if (cells[e] !== FILLED && S[(j + 1) * N1 + e + 1]) v = 1;
        }
      }
      S[j * N1 + i] = v;
    }
  }

  const canEmpty = new Uint8Array(n);
  const fillDiff = new Int32Array(n + 1);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= k; j++) {
      if (!P[j * N1 + i]) continue;
      // Zelle i frei leer
      if (cells[i] !== FILLED && S[j * N1 + i + 1]) canEmpty[i] = 1;
      // Block j beginnt bei i
      if (j < k) {
        const e = i + clue[j];
        if (!fits(i, e)) continue;
        let ok;
        if (e === n) ok = j + 1 === k;
        else ok = cells[e] !== FILLED && S[(j + 1) * N1 + e + 1] === 1;
        if (ok) {
          fillDiff[i]++;
          fillDiff[e]--;
          if (e < n) canEmpty[e] = 1;
        }
      }
    }
  }
  const out = new Uint8Array(n);
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += fillDiff[i];
    const cf = acc > 0;
    const ce = canEmpty[i] === 1;
    if (!cf && !ce) return null;
    out[i] = cf && ce ? UNKNOWN : cf ? FILLED : EMPTY;
  }
  return out;
}

function getLine(grid, w, h, axis, idx) {
  if (axis === 0) return grid.subarray(idx * w, idx * w + w);
  const out = new Uint8Array(h);
  for (let r = 0; r < h; r++) out[r] = grid[r * w + idx];
  return out;
}

/**
 * Zeilen-Löser für das ganze Rätsel.
 * @returns {{ grid: Uint8Array, solved: boolean, contradiction: boolean, unknown: number, passes: number }}
 */
export function lineSolve(rowClues, colClues, initial = null) {
  const h = rowClues.length;
  const w = colClues.length;
  const grid = initial ? Uint8Array.from(initial) : new Uint8Array(w * h);
  // Warteschlange: 0..h-1 Zeilen, h..h+w-1 Spalten
  const inQ = new Uint8Array(h + w).fill(1);
  const queue = [];
  for (let i = 0; i < h + w; i++) queue.push(i);
  let passes = 0;
  while (queue.length) {
    const id = queue.shift();
    inQ[id] = 0;
    passes++;
    const axis = id < h ? 0 : 1;
    const idx = axis === 0 ? id : id - h;
    const clue = axis === 0 ? rowClues[idx] : colClues[idx];
    const cur = getLine(grid, w, h, axis, idx);
    const res = solveLine(clue, cur);
    if (!res) return { grid, solved: false, contradiction: true, unknown: countUnknown(grid), passes };
    for (let i = 0; i < res.length; i++) {
      if (res[i] !== UNKNOWN && cur[i] === UNKNOWN) {
        const r = axis === 0 ? idx : i;
        const c = axis === 0 ? i : idx;
        grid[r * w + c] = res[i];
        const other = axis === 0 ? h + c : r;
        if (!inQ[other]) { inQ[other] = 1; queue.push(other); }
      }
    }
  }
  const unknown = countUnknown(grid);
  return { grid, solved: unknown === 0, contradiction: false, unknown, passes };
}

function countUnknown(grid) {
  let n = 0;
  for (let i = 0; i < grid.length; i++) if (grid[i] === UNKNOWN) n++;
  return n;
}

/**
 * Prüft, ob eine Maske ein gutes Rätsel ergibt: Zeilen-Löser löst sie vollständig und eindeutig.
 * @returns {{ ok: boolean, unknown: number, grid: Uint8Array }}
 */
export function checkUnique(mask, w, h) {
  const { rows, cols } = cluesFor(mask, w, h);
  const res = lineSolve(rows, cols);
  if (res.contradiction) return { ok: false, unknown: w * h, grid: res.grid };
  let ok = res.solved;
  if (ok) {
    for (let i = 0; i < w * h; i++) {
      if ((res.grid[i] === FILLED) !== (mask[i] === 1)) { ok = false; break; }
    }
  }
  return { ok, unknown: res.unknown, grid: res.grid };
}

/**
 * Schwierigkeit grob schätzen: wie viele Durchgänge der Löser braucht (relativ zur Grösse).
 * Liefert 1..3.
 */
export function estimateDifficulty(mask, w, h) {
  const { rows, cols } = cluesFor(mask, w, h);
  const res = lineSolve(rows, cols);
  const ratio = res.passes / (w + h);
  return ratio < 2.2 ? 1 : ratio < 3.5 ? 2 : 3;
}

/**
 * Tipp: findet aus dem aktuellen Spielerstand eine logisch ableitbare Zelle.
 * Spielerzellen: 0 = offen, 1 = gefüllt, 2 = Kreuz.
 * Falsche Einträge werden zuerst gemeldet.
 * @returns {null | {type:'mistake', index} | {type:'cell', index, value, axis, line}}
 */
export function findHint(puzzle, cells) {
  const { w, h, mask, rowClues, colClues } = puzzle;
  // 1) Fehler zuerst
  for (let i = 0; i < w * h; i++) {
    if (cells[i] === FILLED && !mask[i]) return { type: 'mistake', index: i };
    if (cells[i] === EMPTY && mask[i]) return { type: 'mistake', index: i };
  }
  // 2) Linie suchen, aus der sich am meisten folgern lässt
  let best = null;
  const grid = Uint8Array.from(cells);
  for (let axis = 0; axis < 2; axis++) {
    const count = axis === 0 ? h : w;
    for (let idx = 0; idx < count; idx++) {
      const clue = axis === 0 ? rowClues[idx] : colClues[idx];
      const cur = getLine(grid, w, h, axis, idx);
      const res = solveLine(clue, cur);
      if (!res) continue;
      const fresh = [];
      for (let i = 0; i < res.length; i++) if (res[i] !== UNKNOWN && cur[i] === UNKNOWN) fresh.push(i);
      if (!fresh.length) continue;
      // Bevorzugt: viele neue Erkenntnisse und gefüllte Zellen
      const filledFirst = fresh.find((i) => res[i] === FILLED);
      const pick = filledFirst ?? fresh[0];
      const score = fresh.length + (filledFirst != null ? 0.5 : 0);
      if (!best || score > best.score) {
        const r = axis === 0 ? idx : pick;
        const c = axis === 0 ? pick : idx;
        best = { type: 'cell', index: r * w + c, value: res[pick], axis, line: idx, score };
      }
    }
  }
  if (best) { delete best.score; return best; }
  // 3) Sollte bei eindeutigen Rätseln nie vorkommen – dann irgendeine offene Zelle aufdecken
  for (let i = 0; i < w * h; i++) {
    if (cells[i] === UNKNOWN) return { type: 'cell', index: i, value: mask[i] ? FILLED : EMPTY, axis: 0, line: Math.floor(i / w) };
  }
  return null;
}
