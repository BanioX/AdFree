// Bilderrätsel – Spielzustand (ohne DOM, testbar mit node --test).
// Zellen: 0 = offen, 1 = gefüllt, 2 = Kreuz (sicher leer).

import { runsOf, findHint } from './solver.js';

export const OPEN = 0;
export const FILL = 1;
export const CROSS = 2;

const UNDO_LIMIT = 80;

export class Game {
  /**
   * @param {object} puzzle  Ergebnis von parsePuzzle()
   * @param {object} [saved] { c: '0120…', u: [[[i, from, to], …], …], t, h, m, k }
   */
  constructor(puzzle, saved = null) {
    this.p = puzzle;
    this.w = puzzle.w;
    this.h = puzzle.h;
    this.n = this.w * this.h;
    this.cells = new Uint8Array(this.n);
    this.undoStack = [];
    this.elapsed = 0;     // ms
    this.hints = 0;
    this.mistakes = 0;
    this.checks = 0;
    this.solved = false;
    if (saved && typeof saved.c === 'string' && saved.c.length === this.n) {
      for (let i = 0; i < this.n; i++) {
        const v = saved.c.charCodeAt(i) - 48;
        this.cells[i] = v === 1 || v === 2 ? v : 0;
      }
      if (Array.isArray(saved.u)) {
        this.undoStack = saved.u.filter((e) => Array.isArray(e) && e.every((x) => Array.isArray(x) && x.length === 3
          && Number.isInteger(x[0]) && x[0] >= 0 && x[0] < this.n)).slice(-UNDO_LIMIT);
      }
      this.elapsed = Number.isFinite(saved.t) ? Math.max(0, saved.t) : 0;
      this.hints = saved.h | 0;
      this.mistakes = saved.m | 0;
      this.checks = saved.k | 0;
      this.solved = this.checkSolved();
    }
  }

  idx(r, c) { return r * this.w + c; }

  serialize() {
    let c = '';
    for (let i = 0; i < this.n; i++) c += String(this.cells[i]);
    return { c, u: this.undoStack.slice(-UNDO_LIMIT), t: Math.round(this.elapsed), h: this.hints, m: this.mistakes, k: this.checks };
  }

  /** Anzahl gefüllter Zellen / Soll-Anzahl (für Fortschritt) */
  progress() {
    let filled = 0, target = 0;
    for (let i = 0; i < this.n; i++) {
      if (this.cells[i] === FILL) filled++;
      if (this.p.mask[i]) target++;
    }
    return { filled, target, ratio: target ? Math.min(1, filled / target) : 0 };
  }

  isEmpty() {
    for (let i = 0; i < this.n; i++) if (this.cells[i]) return false;
    return true;
  }

  /** Zellen einer Linie (axis 0 = Zeile, 1 = Spalte) als Array */
  line(axis, k) {
    const out = [];
    if (axis === 0) for (let c = 0; c < this.w; c++) out.push(this.cells[k * this.w + c]);
    else for (let r = 0; r < this.h; r++) out.push(this.cells[r * this.w + k]);
    return out;
  }

  lineIndices(axis, k) {
    const out = [];
    if (axis === 0) for (let c = 0; c < this.w; c++) out.push(k * this.w + c);
    else for (let r = 0; r < this.h; r++) out.push(r * this.w + k);
    return out;
  }

  clue(axis, k) { return axis === 0 ? this.p.rowClues[k] : this.p.colClues[k]; }

  /**
   * Status einer Linie für die Anzeige:
   *   done  – gefüllte Blöcke entsprechen genau dem Hinweis
   *   marks – je Zahl: abgehakt (grau)
   *   over  – sicher zu viel gefüllt (mehr Felder als die Summe oder ein zu langer Block)
   */
  lineStatus(axis, k) {
    return lineStatus(this.clue(axis, k), this.line(axis, k));
  }

  /**
   * Wendet Änderungen als ein Rückgängig-Schritt an.
   * changes: [[index, neuerWert], …] – unveränderte werden ignoriert.
   * Gibt die tatsächlich geänderten Einträge [[i, from, to]] zurück.
   */
  apply(changes, { record = true } = {}) {
    const done = [];
    for (const [i, to] of changes) {
      const from = this.cells[i];
      if (from === to) continue;
      this.cells[i] = to;
      done.push([i, from, to]);
    }
    if (done.length && record) {
      this.undoStack.push(done);
      if (this.undoStack.length > UNDO_LIMIT) this.undoStack.shift();
    }
    this.solved = this.checkSolved();
    return done;
  }

  /** Hängt weitere Änderungen an den letzten Rückgängig-Schritt an (z.B. Auto-Kreuze). */
  applyToLast(changes) {
    const done = this.apply(changes, { record: false });
    if (done.length) {
      if (this.undoStack.length) this.undoStack[this.undoStack.length - 1].push(...done);
      else this.undoStack.push(done);
    }
    return done;
  }

  canUndo() { return this.undoStack.length > 0; }

  /** Macht den letzten Schritt rückgängig. Gibt die betroffenen Indizes zurück. */
  undo() {
    const step = this.undoStack.pop();
    if (!step) return [];
    for (let j = step.length - 1; j >= 0; j--) this.cells[step[j][0]] = step[j][1];
    this.solved = this.checkSolved();
    return step.map((x) => x[0]);
  }

  reset() {
    this.cells.fill(0);
    this.undoStack = [];
    this.elapsed = 0;
    this.hints = 0;
    this.mistakes = 0;
    this.checks = 0;
    this.solved = false;
  }

  checkSolved() {
    const m = this.p.mask;
    for (let i = 0; i < this.n; i++) {
      if ((this.cells[i] === FILL) !== (m[i] === 1)) return false;
    }
    return true;
  }

  /** Falsch gesetzte Zellen (gefüllt statt leer, oder Kreuz auf einem Bildfeld). */
  mistakesList() {
    const out = [];
    for (let i = 0; i < this.n; i++) {
      if (this.cells[i] === FILL && !this.p.mask[i]) out.push(i);
      else if (this.cells[i] === CROSS && this.p.mask[i]) out.push(i);
    }
    return out;
  }

  /** Auto-Kreuze: in fertigen Linien alle offenen Felder ankreuzen. Gibt [[i, CROSS]] zurück. */
  autoCrossChanges(lines) {
    const out = [];
    const seen = new Set();
    for (const [axis, k] of lines) {
      if (!this.lineStatus(axis, k).done) continue;
      for (const i of this.lineIndices(axis, k)) {
        if (this.cells[i] === OPEN && !seen.has(i)) { seen.add(i); out.push([i, CROSS]); }
      }
    }
    return out;
  }

  /** Tipp aus dem aktuellen Stand (siehe solver.findHint). */
  hint() { return findHint(this.p, this.cells); }

  /** Zeilen/Spalten, die eine Liste von Indizes berührt. */
  linesOf(indices) {
    const rows = new Set(), cols = new Set();
    for (const i of indices) { rows.add(Math.floor(i / this.w)); cols.add(i % this.w); }
    return [...[...rows].map((r) => [0, r]), ...[...cols].map((c) => [1, c])];
  }
}

/** Welche Aktion ein Strich hat, abhängig vom Modus und der Startzelle. */
export function strokeAction(mode, startValue) {
  if (mode === 'cross') return startValue === CROSS ? 'erase' : startValue === FILL ? 'erase' : 'cross';
  return startValue === FILL ? 'erase' : startValue === CROSS ? 'erase' : 'fill';
}

/** Neuer Wert einer Zelle für eine Aktion – oder null, wenn die Zelle unberührt bleibt. */
export function actionValue(action, startValue, current) {
  if (action === 'fill') return current === OPEN ? FILL : null;
  if (action === 'cross') return current === OPEN ? CROSS : null;
  if (action === 'erase') return current === startValue ? OPEN : null;
  return null;
}

/**
 * Zellen eines geraden Strichs von (r0,c0) nach (r1,c1).
 * axis: 0 = waagrecht, 1 = senkrecht, null = automatisch (grössere Richtung).
 * @returns {{ axis, cells: [r, c][] }}
 */
export function strokeLine(r0, c0, r1, c1, axis = null) {
  const dr = r1 - r0, dc = c1 - c0;
  const ax = axis ?? (dr === 0 && dc === 0 ? null : Math.abs(dc) >= Math.abs(dr) ? 0 : 1);
  const cells = [];
  if (ax === null) cells.push([r0, c0]);
  else if (ax === 0) { const s = Math.sign(dc) || 1; for (let c = c0; c !== c1 + s; c += s) cells.push([r0, c]); }
  else { const s = Math.sign(dr) || 1; for (let r = r0; r !== r1 + s; r += s) cells.push([r, c0]); }
  return { axis: ax, cells };
}

/** Status einer Linie, siehe Game.lineStatus. */
export function lineStatus(clue, line) {
  const n = line.length;
  const runs = runsOf(line.map((v) => (v === FILL ? 1 : 0)));
  const marks = clue.map(() => false);
  const sum = clue.reduce((a, b) => a + b, 0);
  const filledCount = line.reduce((a, v) => a + (v === FILL ? 1 : 0), 0);
  const maxClue = clue.length ? Math.max(...clue) : 0;
  const over = filledCount > sum || runs.some((r) => r > maxClue) || (clue.length === 0 && filledCount > 0);
  const done = runs.length === clue.length && runs.every((r, i) => r === clue[i]);
  if (done) return { done: true, marks: clue.map(() => true), over: false };
  // Von links: geschlossene Blöcke der Reihe nach abhaken
  let j = 0, i = 0;
  while (i < n && j < clue.length) {
    if (line[i] === CROSS) { i++; continue; }
    if (line[i] === OPEN) break;
    let e = i;
    while (e < n && line[e] === FILL) e++;
    if (e < n && line[e] !== CROSS) break;
    if (e - i !== clue[j]) break;
    marks[j] = true;
    j++;
    i = e;
  }
  const leftCount = j;
  // Von rechts
  j = clue.length - 1; i = n - 1;
  while (i >= 0 && j >= leftCount) {
    if (line[i] === CROSS) { i--; continue; }
    if (line[i] === OPEN) break;
    let s = i;
    while (s >= 0 && line[s] === FILL) s--;
    if (s >= 0 && line[s] !== CROSS) break;
    if (i - s !== clue[j]) break;
    marks[j] = true;
    j--;
    i = s;
  }
  return { done: false, marks, over };
}
