// Eine laufende Partie (ohne DOM): Brett, Bilder, Verlauf, Hilfen, Speichern/Laden.

import {
  buildBoard, normalizeTiles, tilesToString, tilesFromString, isFree, facesMatch, freeTiles,
  hasMoves, countPresent, reshuffle, findHint, generateDeal, blockersOf, computeStars,
} from './engine.js';

const B36 = '0123456789abcdefghijklmnopqrstuvwxyz';
const facesToStr = (f) => f.map((x) => (x < 36 ? B36[x] : String.fromCharCode(65 + x - 36))).join('');
const facesFromStr = (s) => [...s].map((c) => (c >= 'A' && c <= 'Z' ? 36 + c.charCodeAt(0) - 65 : B36.indexOf(c)));

export class Session {
  /**
   * meta: { kind: 'level'|'daily'|'endless', ref, name, seed, date? }
   * layout: geparstes Layout ({ tiles, w, h, depth, … })
   */
  constructor(layout, faces, meta = {}) {
    this.layout = layout;
    this.board = buildBoard(layout);
    this.faces = faces.slice();
    this.meta = { ...meta };
    this.present = new Uint8Array(this.board.n).fill(1);
    this.history = []; // { t:'m', a, b } | { t:'s', prev: string }
    this.elapsed = 0;
    this.hints = 0;
    this.shuffles = 0;
    this.undos = 0;
    this.won = false;
    this.shuffleCounter = 0;
  }

  static create(layout, meta) {
    const board = buildBoard(layout);
    const deal = generateDeal(board, meta.seed);
    const s = new Session(layout, deal.faces, meta);
    s.solution = deal.solution;
    return s;
  }

  get n() { return this.board.n; }
  get remaining() { return countPresent(this.present); }
  get pairsLeft() { return this.remaining / 2; }
  get progress() { return 1 - this.remaining / this.n; }
  get stars() { return computeStars({ hints: this.hints, shuffles: this.shuffles }); }

  isFree(i) { return isFree(this.board, this.present, i); }
  blockers(i) { return blockersOf(this.board, this.present, i); }
  freeList() { return freeTiles(this.board, this.present); }
  hasMoves() { return hasMoves(this.board, this.faces, this.present); }

  canMatch(a, b) {
    return a !== b && this.present[a] && this.present[b] && this.isFree(a) && this.isFree(b)
      && facesMatch(this.faces[a], this.faces[b]);
  }

  match(a, b) {
    if (!this.canMatch(a, b)) return false;
    this.present[a] = 0;
    this.present[b] = 0;
    this.history.push({ t: 'm', a, b });
    if (this.remaining === 0) this.won = true;
    return true;
  }

  /** Macht den letzten Schritt rückgängig. Gibt den Eintrag zurück (oder null). */
  undo() {
    const h = this.history.pop();
    if (!h) return null;
    if (h.t === 'm') {
      this.present[h.a] = 1;
      this.present[h.b] = 1;
      this.won = false;
    } else if (h.t === 's') {
      this.faces = facesFromStr(h.prev);
    }
    this.undos++;
    return h;
  }

  /** Mischt die verbleibenden Steine (lösbar). Gibt { prev, next } oder null zurück. */
  shuffle() {
    const seed = `${this.meta.seed}-mischen-${this.shuffleCounter++}-${this.remaining}`;
    const next = reshuffle(this.board, this.faces, this.present, seed);
    if (!next) return null;
    const prev = this.faces.slice();
    this.history.push({ t: 's', prev: facesToStr(prev) });
    this.faces = next;
    this.shuffles++;
    return { prev, next };
  }

  /** Alles zurück auf Anfang (gleiche Verteilung). */
  restart() {
    while (this.history.length) this.undo();
    this.hints = 0;
    this.shuffles = 0;
    this.undos = 0;
    this.elapsed = 0;
    this.won = false;
  }

  hint(opts) {
    return findHint(this.board, this.faces, this.present, opts);
  }

  serialize() {
    return {
      v: 1,
      meta: this.meta,
      tiles: tilesToString(this.layout.tiles),
      name: this.layout.name,
      id: this.layout.id,
      faces: facesToStr(this.faces),
      hist: this.history.map((h) => (h.t === 'm' ? [h.a, h.b] : h.prev)),
      elapsed: Math.round(this.elapsed),
      hints: this.hints,
      shuffles: this.shuffles,
      undos: this.undos,
      sc: this.shuffleCounter,
      won: this.won,
    };
  }

  /** Stellt eine Partie aus serialize() wieder her. Gibt null bei kaputten Daten zurück. */
  static fromSave(data) {
    try {
      if (!data || data.v !== 1) return null;
      const layout = normalizeTiles(tilesFromString(data.tiles), { id: data.id, name: data.name });
      if (!layout.tiles.length) return null;
      const faces = facesFromStr(data.faces);
      if (faces.length !== layout.tiles.length || faces.some((f) => !(f >= 0 && f < 42))) return null;
      const s = new Session(layout, faces, data.meta || {});
      for (const h of data.hist || []) {
        if (Array.isArray(h)) {
          const [a, b] = h;
          if (!(a >= 0 && a < s.n && b >= 0 && b < s.n)) return null;
          s.present[a] = 0; s.present[b] = 0;
          s.history.push({ t: 'm', a, b });
        } else if (typeof h === 'string') {
          s.history.push({ t: 's', prev: h });
        }
      }
      s.elapsed = data.elapsed || 0;
      s.hints = data.hints || 0;
      s.shuffles = data.shuffles || 0;
      s.undos = data.undos || 0;
      s.shuffleCounter = data.sc || 0;
      s.won = !!data.won || s.remaining === 0;
      return s;
    } catch {
      return null;
    }
  }
}

export { facesToStr, facesFromStr };
