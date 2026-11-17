// Spielregeln von Dreierlei (ohne DOM, testbar mit node --test).
//
// - Nur freie Steine (nicht verdeckt) können genommen werden.
// - Ein genommener Stein wandert in die Ablage (7 Plätze); gleiche Steine liegen nebeneinander.
// - Drei gleiche in der Ablage verschwinden.
// - Alle Steine weg = gewonnen. Ablage mit 7 Steinen ohne Drilling = verloren.
// - Hilfen (je 1× pro Level gratis): Zurück, Auslagern, Mischen, Tipp.

import { coverGraph } from './board.js';
import { solve, findHint, WHERE } from './solver.js';

export const TRAY_SIZE = 7;
export const SHELF_SIZE = 7;
export const STASH_COUNT = 3;
export const HELPER_KEYS = ['undo', 'stash', 'shuffle', 'hint'];

const { BOARD, TRAY, SHELF, GONE } = WHERE;
const W_CHARS = 'btsg';

/** Sterne nach Anzahl benutzter Hilfen. */
export function starsFor(used) {
  if (used <= 0) return 3;
  if (used <= 2) return 2;
  return 1;
}

export class Game {
  /**
   * @param {object} level  Ergebnis von generateLevel()/generate()
   * @param {object} [saved] Ergebnis von game.toJSON()
   */
  constructor(level, saved = null) {
    this.level = level;
    this.n = level.tiles.length;
    const { above, below } = coverGraph(level.tiles);
    this.above = above;
    this.below = below;
    this.types = level.tiles.map((t) => t.t);
    this.where = new Uint8Array(this.n);
    this.block = new Int16Array(this.n);
    for (let i = 0; i < this.n; i++) this.block[i] = above[i].length;
    this.tray = [];
    this.shelf = [];
    this.helpers = { undo: 1, stash: 1, shuffle: 1, hint: 1 };
    this.used = 0;
    this.extraUsed = false;
    this.last = null;
    this.moves = 0;
    this.triples = 0;
    this.elapsed = 0;
    this.status = 'play';
    if (saved) this._restore(saved);
  }

  // ---------- Abfragen ----------

  isFree(i) {
    const w = this.where[i];
    return (w === BOARD && this.block[i] === 0) || w === SHELF;
  }

  /** Freie Steine auf dem Brett (ohne Auslage). */
  freeTiles() {
    const out = [];
    for (let i = 0; i < this.n; i++) if (this.where[i] === BOARD && this.block[i] === 0) out.push(i);
    return out;
  }

  get remaining() {
    let r = 0;
    for (let i = 0; i < this.n; i++) if (this.where[i] !== GONE) r++;
    return r;
  }

  get cleared() { return this.n - this.remaining; }
  get stars() { return starsFor(this.used); }

  trayCount(t) {
    let c = 0;
    for (const id of this.tray) if (this.types[id] === t) c++;
    return c;
  }

  // ---------- Züge ----------

  /**
   * Nimmt Stein i. Gibt ein Ereignis zurück oder null (nicht erlaubt).
   * { id, from:'b'|'s', shelfIndex, at, matched:[ids]|null, freed:[ids], status }
   */
  pick(i) {
    if (this.status !== 'play' || i < 0 || i >= this.n || !this.isFree(i)) return null;
    const from = this.where[i] === SHELF ? 's' : 'b';
    let shelfIndex = -1;
    const freed = [];
    if (from === 'b') {
      for (const j of this.below[i]) {
        this.block[j]--;
        if (this.block[j] === 0 && this.where[j] === BOARD) freed.push(j);
      }
    } else {
      shelfIndex = this.shelf.indexOf(i);
      this.shelf.splice(shelfIndex, 1);
    }
    this.where[i] = TRAY;
    const t = this.types[i];
    let lastSame = -1;
    for (let k = 0; k < this.tray.length; k++) if (this.types[this.tray[k]] === t) lastSame = k;
    const at = lastSame >= 0 ? lastSame + 1 : this.tray.length;
    this.tray.splice(at, 0, i);
    this.moves++;

    let matched = null;
    const same = this.tray.filter((id) => this.types[id] === t);
    if (same.length >= 3) {
      matched = same.slice(0, 3);
      for (const id of matched) this.where[id] = GONE;
      this.tray = this.tray.filter((id) => !matched.includes(id));
      this.triples++;
    }
    this.last = matched ? null : { id: i, from, shelfIndex };
    this._updateStatus();
    return { id: i, from, shelfIndex, at, matched, freed, status: this.status };
  }

  _updateStatus() {
    if (this.remaining === 0) this.status = 'won';
    else if (this.tray.length >= TRAY_SIZE) this.status = 'lost';
    else this.status = 'play';
  }

  // ---------- Hilfen ----------

  canUndo() {
    return this.helpers.undo > 0 && !!this.last && this.where[this.last.id] === TRAY && this.status !== 'won';
  }

  /** Letzten Stein zurücklegen. → { id, to:'b'|'s', shelfIndex, covered:[ids] } */
  undo() {
    if (!this.canUndo()) return null;
    const { id, from, shelfIndex } = this.last;
    this.tray.splice(this.tray.indexOf(id), 1);
    const covered = [];
    if (from === 'b') {
      this.where[id] = BOARD;
      for (const j of this.below[id]) {
        if (this.block[j] === 0 && this.where[j] === BOARD) covered.push(j);
        this.block[j]++;
      }
    } else {
      this.where[id] = SHELF;
      const at = Math.max(0, Math.min(this.shelf.length, shelfIndex));
      this.shelf.splice(at, 0, id);
    }
    this.last = null;
    this.helpers.undo--;
    this.used++;
    this._updateStatus();
    return { id, to: from, shelfIndex, covered, status: this.status };
  }

  canStash(extra = false) {
    if (this.status === 'won' || this.tray.length === 0) return false;
    if (extra ? this.extraUsed : this.helpers.stash <= 0) return false;
    return this.shelf.length + Math.min(STASH_COUNT, this.tray.length) <= SHELF_SIZE;
  }

  /** Bis zu 3 Steine (von links) aus der Ablage in die Auslage. extra = «Zweite Chance». */
  stash(extra = false) {
    if (!this.canStash(extra)) return null;
    const moved = this.tray.splice(0, Math.min(STASH_COUNT, this.tray.length));
    for (const id of moved) { this.where[id] = SHELF; this.shelf.push(id); }
    if (extra) this.extraUsed = true;
    else this.helpers.stash--;
    this.used++;
    this.last = null;
    this._updateStatus();
    return { moved, status: this.status };
  }

  canShuffle() {
    return this.helpers.shuffle > 0 && this.status === 'play' && this.boardIds().length > 1;
  }

  boardIds() {
    const ids = [];
    for (let i = 0; i < this.n; i++) if (this.where[i] === BOARD) ids.push(i);
    return ids;
  }

  /**
   * Mischt die Bilder der Steine auf dem Brett. Sucht eine Verteilung, die lösbar bleibt.
   * rng: { shuffle(arr) }  → { changed:[ids], solvable }
   */
  shuffle(rng, opts = {}) {
    if (!this.canShuffle()) return null;
    const ids = this.boardIds();
    const orig = ids.map((i) => this.types[i]);
    const tries = opts.tries ?? 14;
    const budget = opts.timeLimit ?? 300;
    const t0 = Date.now();
    let chosen = null;
    let solvable = false;
    for (let k = 0; k < tries; k++) {
      const perm = rng.shuffle(orig.slice());
      // Möglichst viele Steine sollen wirklich ein anderes Bild bekommen
      if (k < tries - 1 && ids.length > 3) {
        let same = 0;
        for (let q = 0; q < ids.length; q++) if (perm[q] === orig[q]) same++;
        if (same > ids.length * 0.5) continue;
      }
      chosen = perm;
      ids.forEach((id, q) => { this.types[id] = perm[q]; });
      const left = Math.max(20, budget - (Date.now() - t0));
      const r = solve(this.position(), { nodeLimit: opts.nodeLimit ?? 25000, timeLimit: left });
      if (r.ok) { solvable = true; break; }
      if (Date.now() - t0 > budget) break;
    }
    if (!chosen) chosen = orig.slice();
    ids.forEach((id, q) => { this.types[id] = chosen[q]; });
    const changed = ids.filter((id, q) => chosen[q] !== orig[q]);
    this.helpers.shuffle--;
    this.used++;
    return { changed, solvable };
  }

  canHint() {
    return this.helpers.hint > 0 && this.status === 'play';
  }

  /** → { ids:[...], sure } */
  hint(opts = {}) {
    if (!this.canHint()) return null;
    const r = findHint(this.position(), { nodeLimit: opts.nodeLimit ?? 40000, timeLimit: opts.timeLimit ?? 250 });
    if (!r.ids.length) return null;
    this.helpers.hint--;
    this.used++;
    return r;
  }

  /** Momentaufnahme für den Löser. */
  position() {
    return {
      types: this.types,
      where: this.where,
      block: this.block,
      below: this.below,
      tray: this.tray.slice(),
      trayLimit: TRAY_SIZE,
    };
  }

  // ---------- Speichern ----------

  toJSON() {
    let w = '';
    for (let i = 0; i < this.n; i++) w += W_CHARS[this.where[i]];
    return {
      v: 1,
      n: this.n,
      types: Array.from(this.types),
      where: w,
      tray: this.tray.slice(),
      shelf: this.shelf.slice(),
      helpers: { ...this.helpers },
      used: this.used,
      extraUsed: this.extraUsed,
      last: this.last,
      moves: this.moves,
      triples: this.triples,
      elapsed: Math.round(this.elapsed),
    };
  }

  _restore(s) {
    const n = this.n;
    if (!s || s.v !== 1 || s.n !== n || !Array.isArray(s.types) || s.types.length !== n
      || typeof s.where !== 'string' || s.where.length !== n) throw new Error('Spielstand passt nicht');
    // Bilder-Multimenge muss gleich bleiben (nur Mischen verändert die Verteilung)
    const a = Array.from(this.types).sort((x, y) => x - y).join(',');
    const b = s.types.slice().sort((x, y) => x - y).join(',');
    if (a !== b) throw new Error('Spielstand passt nicht');
    for (let i = 0; i < n; i++) {
      const w = W_CHARS.indexOf(s.where[i]);
      if (w < 0) throw new Error('Spielstand passt nicht');
      this.where[i] = w;
      this.types[i] = s.types[i] | 0;
    }
    const tray = (s.tray || []).filter((id) => this.where[id] === TRAY);
    const shelf = (s.shelf || []).filter((id) => this.where[id] === SHELF);
    let inTray = 0, inShelf = 0;
    for (let i = 0; i < n; i++) { if (this.where[i] === TRAY) inTray++; if (this.where[i] === SHELF) inShelf++; }
    if (tray.length !== inTray || shelf.length !== inShelf) throw new Error('Spielstand passt nicht');
    this.tray = tray;
    this.shelf = shelf;
    for (let i = 0; i < n; i++) {
      let c = 0;
      for (const j of this.above[i]) if (this.where[j] === BOARD) c++;
      this.block[i] = c;
    }
    for (const k of HELPER_KEYS) this.helpers[k] = Math.max(0, Math.min(1, (s.helpers && s.helpers[k]) | 0));
    this.used = Math.max(0, s.used | 0);
    this.extraUsed = !!s.extraUsed;
    this.last = s.last && Number.isInteger(s.last.id) && this.where[s.last.id] === TRAY ? s.last : null;
    this.moves = Math.max(0, s.moves | 0);
    this.triples = Math.max(0, s.triples | 0);
    this.elapsed = Math.max(0, +s.elapsed || 0);
    this._updateStatus();
  }
}

/** Spielt eine Reihenfolge durch und meldet, ob sie gewinnt (Prüfung der Generator-Lösung). */
export function simulate(level, order) {
  const g = new Game(level);
  for (const id of order) {
    if (!g.pick(id)) return { won: false, at: id, game: g };
    if (g.status === 'lost') return { won: false, at: id, game: g };
  }
  return { won: g.status === 'won', game: g };
}
