// Spielzustand (Klassisch und Abenteuer). Rein logisch, ohne DOM – mit node --test prüfbar.
// Ein Spiel lässt sich jederzeit serialisieren und exakt wiederherstellen (inkl. Zufallszustand).

import { Board } from './board.js';
import { Rng } from './rng.js';
import { catalog } from './shapes.js';
import { nextTriple, rescueTriple } from './generator.js';
import { scoreMove, praiseLevel } from './scoring.js';
import { GEM_KEYS } from '../data/skins.js';

export const SAVE_VERSION = 1;

export class Game {
  constructor() {
    this.cat = catalog();
    this.mode = 'classic';
    this.size = 8;
    this.board = new Board(8);
    this.rng = new Rng(1);
    this.tray = [null, null, null];
    this.score = 0;
    this.streak = 0;
    this.sinceClear = 0;
    this.moves = 0;
    this.lines = 0;
    this.bestCombo = 0;
    this.bestStreak = 0;
    this.perfects = 0;
    this.rescues = 0;
    this.triples = 0;
    this.over = false;
    this.won = false;
    // Abenteuer
    this.level = 0;
    this.gen = null;
    this.goals = null;
    this.totals = { gems: {}, cover: 0 };
    this.collected = {};
    this.revealed = 0;
    this.par = null;
    this.start = null;
    this.picMask = null; // ursprünglich verdeckte Felder (Bild-Level), z.B. 'xx..x…'
  }

  /** Neues klassisches Spiel (endlos, mit Punkten). */
  static classic(size = 8, seed = Date.now()) {
    const g = new Game();
    g.mode = 'classic';
    g.size = size;
    g.board = new Board(size);
    g.seed = String(seed);
    g.rng = new Rng(`classic-${size}-${seed}`);
    g.refill();
    return g;
  }

  /** Neues Abenteuer-Level aus einem Level-Objekt (siehe levels.js). */
  static fromLevel(level) {
    const g = new Game();
    g.mode = 'adventure';
    g.level = level.n;
    g.size = level.size;
    g.board = Board.deserialize(level.board);
    g.seed = level.seed;
    g.rng = new Rng(level.seed);
    g.gen = { ...level.gen };
    g.goals = JSON.parse(JSON.stringify(level.goals));
    g.totals = { gems: g.board.countGems(), cover: g.board.countCover() };
    g.collected = Object.fromEntries(Object.keys(g.totals.gems).map((k) => [k, 0]));
    g.par = level.par ? { ...level.par } : null;
    g.start = level.start || null;
    g.picMask = g.goals.picture ? level.board.cover : null;
    g.refill();
    return g;
  }

  /** Schwierigkeit des Generators. Klassisch: steigt langsam mit den Punkten. */
  genCfg() {
    if (this.gen) return this.gen;
    const d = Math.min(1, this.score / 6000);
    return { d, fair: 1 - 0.12 * d, assist: 0.3 - 0.15 * d };
  }

  refill() {
    let triple = null;
    if (this.triples === 0 && this.start && this.start.length) {
      triple = this.start.map((k) => this.cat.get(k)).filter(Boolean);
      while (triple.length < 3) triple.push(this.cat.find('#'));
    } else {
      triple = nextTriple(this.board, this.rng, this.cat, this.genCfg());
    }
    this.tray = triple.slice(0, 3);
    this.triples += 1;
    return this.tray;
  }

  get remainingPieces() { return this.tray.filter(Boolean); }

  canPlace(slot, r, c) {
    const v = this.tray[slot];
    return !!v && !this.over && !this.won && this.board.canPlace(v, r, c);
  }

  /** Für jedes Fach: passt das Teil irgendwo? */
  fitMap() { return this.tray.map((v) => !!v && this.board.fits(v)); }

  hasMoves() { return this.tray.some((v) => v && this.board.fits(v)); }

  /**
   * Setzt das Teil aus Fach `slot` an (r, c). Gibt ein Ergebnis-Objekt für die Darstellung zurück
   * oder null, wenn der Zug nicht erlaubt ist.
   */
  place(slot, r, c) {
    if (!this.canPlace(slot, r, c)) return null;
    const v = this.tray[slot];
    const res = this.board.place(v, r, c, v.color);
    const perfect = res.lines > 0 && this.board.isEmpty;
    const sc = scoreMove(this, v.n, res.lines, perfect);
    this.streak = sc.streak;
    this.sinceClear = sc.sinceClear;
    this.score += sc.total;
    this.moves += 1;
    this.lines += res.lines;
    if (res.lines > this.bestCombo) this.bestCombo = res.lines;
    if (this.streak > this.bestStreak) this.bestStreak = this.streak;
    if (perfect) this.perfects += 1;

    const gems = {};
    let revealed = 0;
    for (const cl of res.cleared) {
      if (cl.gem) {
        const k = GEM_KEYS[cl.gem - 1];
        gems[k] = (gems[k] || 0) + 1;
        this.collected[k] = (this.collected[k] || 0) + 1;
      }
      if (cl.cover) revealed += 1;
    }
    this.revealed += revealed;

    this.tray[slot] = null;
    let refill = null;
    if (!this.tray.some(Boolean)) refill = this.refill().slice();

    if (this.mode === 'adventure' && this.goalsDone()) this.won = true;
    if (!this.won) this.over = !this.hasMoves();

    return {
      slot, variant: v, r, c, color: v.color,
      placed: res.placed, rows: res.rows, cols: res.cols, lines: res.lines, cleared: res.cleared,
      points: sc, streak: this.streak, perfect, praise: praiseLevel(res.lines, perfect),
      gems, revealed, refill, won: this.won, over: this.over,
    };
  }

  /** Rettung, wenn nichts mehr passt: drei neue, kleinere Teile. */
  rescue() {
    this.tray = rescueTriple(this.board, this.rng, this.cat).slice(0, 3);
    this.rescues += 1;
    this.over = !this.hasMoves();
    return this.tray;
  }

  // ---------- Ziele (Abenteuer) ----------

  /** Liste der Ziele mit Fortschritt: [{ type, key?, have, need, done }] */
  goalStatus() {
    const out = [];
    const g = this.goals;
    if (!g) return out;
    if (g.gems) {
      for (const k of GEM_KEYS) {
        const need = this.totals.gems[k] || 0;
        if (!need) continue;
        const have = Math.min(need, this.collected[k] || 0);
        out.push({ type: 'gems', key: k, have, need, done: have >= need });
      }
    }
    if (g.picture) {
      const need = this.totals.cover;
      out.push({ type: 'picture', key: g.picture, have: Math.min(need, this.revealed), need, done: this.revealed >= need });
    }
    if (g.lines) out.push({ type: 'lines', have: Math.min(g.lines, this.lines), need: g.lines, done: this.lines >= g.lines });
    if (g.score) out.push({ type: 'score', have: Math.min(g.score, this.score), need: g.score, done: this.score >= g.score });
    return out;
  }

  goalsDone() {
    const st = this.goalStatus();
    return st.length > 0 && st.every((s) => s.done);
  }

  /** Sterne für das aktuelle Ergebnis (1–3) anhand der benötigten Teile. */
  stars() {
    if (!this.par) return 3;
    if (this.moves <= this.par.three) return 3;
    if (this.moves <= this.par.two) return 2;
    return 1;
  }

  // ---------- Speichern ----------

  serialize() {
    return {
      v: SAVE_VERSION,
      mode: this.mode, size: this.size, seed: this.seed,
      board: this.board.serialize(),
      tray: this.tray.map((v) => (v ? v.key : null)),
      rng: this.rng.state,
      score: this.score, streak: this.streak, sinceClear: this.sinceClear,
      moves: this.moves, lines: this.lines, bestCombo: this.bestCombo, bestStreak: this.bestStreak,
      perfects: this.perfects, rescues: this.rescues, triples: this.triples,
      over: this.over, won: this.won,
      level: this.level, gen: this.gen, goals: this.goals, totals: this.totals,
      collected: this.collected, revealed: this.revealed, par: this.par, start: this.start,
      picMask: this.picMask,
    };
  }

  static deserialize(d) {
    if (!d || d.v !== SAVE_VERSION || !d.board) return null;
    const g = new Game();
    try {
      g.mode = d.mode === 'adventure' ? 'adventure' : 'classic';
      g.size = d.size;
      g.seed = d.seed;
      g.board = Board.deserialize(d.board);
      if (g.board.n !== g.size) return null;
      g.tray = (d.tray || []).slice(0, 3).map((k) => (k ? g.cat.get(k) : null));
      while (g.tray.length < 3) g.tray.push(null);
      g.rng = new Rng(1);
      g.rng.state = d.rng;
      for (const k of ['score', 'streak', 'sinceClear', 'moves', 'lines', 'bestCombo', 'bestStreak', 'perfects', 'rescues', 'triples', 'revealed', 'level']) {
        g[k] = Number.isFinite(d[k]) ? d[k] : 0;
      }
      g.over = !!d.over;
      g.won = !!d.won;
      g.gen = d.gen || null;
      g.goals = d.goals || null;
      g.totals = d.totals || { gems: {}, cover: 0 };
      g.collected = d.collected || {};
      g.par = d.par || null;
      g.start = d.start || null;
      g.picMask = typeof d.picMask === 'string' && d.picMask.length === g.size * g.size ? d.picMask : null;
      if (!g.tray.some(Boolean) && !g.won) g.refill();
      if (!g.won) g.over = !g.hasMoves();
      return g;
    } catch {
      return null;
    }
  }
}
