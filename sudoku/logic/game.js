// Spielzustand einer Sudoku-Partie: Eingaben, Notizen, Rückgängig, Fehler, Fortschritt.
// Reine Logik – kein DOM. Serialisierbar mit toJSON() / Game.fromJSON().

import { parse, stringify, PEERS, UNITS, CELL_UNITS, bit, candidatesFromValues, findConflicts } from './board.js';

const MAX_HISTORY = 3000;

export class Game {
  /**
   * @param {object} data { puzzle, solution, values?, notes?, history?, mistakes?, hints?, elapsed?, elims?, meta?, done?, ... }
   */
  constructor(data) {
    this.puzzle = data.puzzle;
    this.solution = data.solution;
    this.sol = parse(data.solution);
    const giv = parse(data.puzzle);
    this.given = giv.map((v) => v > 0);
    this.values = data.values ? parse(data.values) : giv.slice();
    // Vorgaben können nicht überschrieben werden
    for (let i = 0; i < 81; i++) if (this.given[i]) this.values[i] = giv[i];
    this.notes = Array.isArray(data.notes) && data.notes.length === 81 ? data.notes.map((n) => n & 0x1ff) : new Array(81).fill(0);
    this.elims = Array.isArray(data.elims) && data.elims.length === 81 ? data.elims.map((n) => n & 0x1ff) : new Array(81).fill(0);
    this.history = Array.isArray(data.history) ? data.history.slice(-MAX_HISTORY) : [];
    this.mistakes = data.mistakes | 0;
    this.hints = data.hints | 0;
    this.extraLives = data.extraLives | 0;
    this.elapsed = +data.elapsed || 0;
    this.meta = { ...(data.meta || {}) };
    this.done = !!data.done;
    this.paused = !!data.paused;
    this.moves = data.moves | 0;
    this.counted = !!data.counted; // Statistik schon verbucht?
  }

  static create(puzzle, solution, meta = {}) {
    return new Game({ puzzle, solution, meta: { created: Date.now(), ...meta } });
  }

  static fromJSON(obj) {
    if (!obj || typeof obj.puzzle !== 'string' || typeof obj.solution !== 'string') return null;
    try { return new Game(obj); } catch { return null; }
  }

  toJSON() {
    return {
      v: 1,
      puzzle: this.puzzle,
      solution: this.solution,
      values: stringify(this.values),
      notes: this.notes,
      elims: this.elims,
      history: this.history,
      mistakes: this.mistakes,
      hints: this.hints,
      extraLives: this.extraLives,
      elapsed: Math.round(this.elapsed),
      meta: this.meta,
      done: this.done,
      paused: this.paused,
      moves: this.moves,
      counted: this.counted,
    };
  }

  // ---------- Abfragen ----------

  isGiven(i) { return this.given[i]; }
  isWrong(i) { return !this.given[i] && this.values[i] !== 0 && this.values[i] !== this.sol[i]; }
  get emptyCount() { let n = 0; for (let i = 0; i < 81; i++) if (!this.values[i]) n++; return n; }

  /** Wie oft jede Ziffer (Index 1..9) auf dem Brett steht. */
  counts() {
    const c = new Array(10).fill(0);
    for (let i = 0; i < 81; i++) if (this.values[i]) c[this.values[i]]++;
    return c;
  }

  conflicts() { return findConflicts(this.values); }

  wrongCells() {
    const out = [];
    for (let i = 0; i < 81; i++) if (this.isWrong(i)) out.push(i);
    return out;
  }

  isSolved() {
    for (let i = 0; i < 81; i++) if (this.values[i] !== this.sol[i]) return false;
    return true;
  }

  /** Anteil richtig gefüllter Felder (ohne Vorgaben), 0..1 */
  progress() {
    let open = 0, ok = 0;
    for (let i = 0; i < 81; i++) {
      if (this.given[i]) continue;
      open++;
      if (this.values[i] === this.sol[i]) ok++;
    }
    return open ? ok / open : 1;
  }

  unitComplete(u) {
    for (const i of UNITS[u]) if (this.values[i] !== this.sol[i]) return false;
    return true;
  }

  digitComplete(d) {
    let n = 0;
    for (let i = 0; i < 81; i++) if (this.values[i] === d && this.sol[i] === d) n++;
    return n === 9;
  }

  get mistakeLimit() { return 3 + this.extraLives; }

  // ---------- Änderungen ----------

  /** changes: [[i, newValue, newNotes], ...] – speichert alte Werte im Verlauf. */
  _commit(kind, changes) {
    const rec = [];
    for (const [i, nv, nn] of changes) {
      const pv = this.values[i], pn = this.notes[i];
      if (pv === nv && pn === nn) continue;
      rec.push([i, pv, pn, nv, nn]);
      this.values[i] = nv;
      this.notes[i] = nn;
    }
    if (!rec.length) return null;
    this.history.push({ k: kind, ch: rec });
    if (this.history.length > MAX_HISTORY) this.history.splice(0, this.history.length - MAX_HISTORY);
    this.moves++;
    return rec;
  }

  /**
   * Ziffer setzen.
   * opts.cleanup      Notizen der Nachbarn automatisch entfernen
   * opts.mistakeMode  'solution' (mit Lösung vergleichen) | 'conflict' (nur Regelverstösse zählen)
   */
  setValue(i, d, { cleanup = true, mistakeMode = 'solution' } = {}) {
    if (this.done || this.given[i] || d < 1 || d > 9) return null;
    if (this.values[i] === d) return { changed: false };
    const wrong = d !== this.sol[i];
    const conflictWith = PEERS[i].filter((j) => this.values[j] === d);
    const changes = [[i, d, 0]];
    const cleared = [];
    if (cleanup && !(mistakeMode === 'solution' && wrong)) {
      const m = bit(d);
      for (const j of PEERS[i]) {
        if (!this.values[j] && (this.notes[j] & m)) {
          changes.push([j, 0, this.notes[j] & ~m]);
          cleared.push(j);
        }
      }
    }
    this._commit('set', changes);
    const mistake = mistakeMode === 'solution' ? wrong : conflictWith.length > 0;
    if (mistake) this.mistakes++;
    const units = wrong ? [] : CELL_UNITS[i].filter((u) => this.unitComplete(u));
    const digitDone = !wrong && this.digitComplete(d);
    const solved = !wrong && this.isSolved();
    if (solved) this.done = true;
    return { changed: true, wrong, mistake, conflictWith, units, digitDone, solved, cleared };
  }

  /** Notiz umschalten (bei gefülltem Feld wird die Ziffer durch die Notiz ersetzt). */
  toggleNote(i, d) {
    if (this.done || this.given[i] || d < 1 || d > 9) return null;
    const base = this.values[i] ? 0 : this.notes[i];
    const nn = base ^ bit(d);
    const rec = this._commit('note', [[i, 0, nn]]);
    return rec ? { changed: true, on: !!(nn & bit(d)) } : { changed: false };
  }

  erase(i) {
    if (this.done || this.given[i]) return null;
    if (!this.values[i] && !this.notes[i]) return { changed: false };
    this._commit('erase', [[i, 0, 0]]);
    return { changed: true };
  }

  /** Alle leeren Felder mit den möglichen Kandidaten füllen. */
  autoNotes() {
    if (this.done) return null;
    const cands = candidatesFromValues(this.values);
    const changes = [];
    for (let i = 0; i < 81; i++) {
      if (this.values[i]) continue;
      changes.push([i, 0, cands[i] & ~this.elims[i]]);
    }
    const rec = this._commit('auto', changes);
    return { changed: !!rec, cells: rec ? rec.map((r) => r[0]) : [] };
  }

  /**
   * Streicht Kandidaten (aus einem Tipp) in einem Schritt (ein Rückgängig-Eintrag).
   * Leere Notizen der betroffenen Felder und der Muster-Felder werden vorher mit Kandidaten gefüllt,
   * damit das Muster sichtbar ist.
   */
  applyEliminations(elims, patternCells = []) {
    if (this.done || !elims.length) return null;
    for (const { c, d } of elims) this.elims[c] |= bit(d);
    const cands = candidatesFromValues(this.values);
    const next = new Map();
    const base = (c) => (next.has(c) ? next.get(c) : (this.notes[c] || (cands[c] & ~this.elims[c])));
    for (const c of patternCells) if (!this.values[c]) next.set(c, base(c));
    for (const { c, d } of elims) if (!this.values[c]) next.set(c, base(c) & ~bit(d));
    const rec = this._commit('hint', [...next].map(([c, n]) => [c, 0, n]));
    return { changed: !!rec, cells: [...next.keys()] };
  }

  undo() {
    if (this.done) return null;
    const e = this.history.pop();
    if (!e) return { changed: false };
    for (let k = e.ch.length - 1; k >= 0; k--) {
      const [i, pv, pn] = e.ch[k];
      this.values[i] = pv;
      this.notes[i] = pn;
    }
    this.moves++;
    return { changed: true, kind: e.k, cells: e.ch.map((r) => r[0]) };
  }

  canUndo() { return !this.done && this.history.length > 0; }

  /** Spiel zurück auf Anfang (gleiches Rätsel). */
  restart() {
    const giv = parse(this.puzzle);
    this.values = giv.slice();
    this.notes = new Array(81).fill(0);
    this.elims = new Array(81).fill(0);
    this.history = [];
    this.mistakes = 0;
    this.hints = 0;
    this.extraLives = 0;
    this.elapsed = 0;
    this.done = false;
    this.paused = false;
    this.moves = 0;
  }
}
