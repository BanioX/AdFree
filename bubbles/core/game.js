// Spielregeln von Blasenzauber (reine Logik, ohne DOM – mit node --test testbar).
//
// Ein Game-Objekt enthält den kompletten Zustand eines Levels oder einer «Entspannt»-Runde.
// shoot(winkel) löst einen Schuss sofort vollständig auf und liefert ein Ereignis-Objekt,
// das die Darstellung anschliessend in Ruhe animiert. Der Zustand ist damit jederzeit
// speicherbar (toJSON / Game.fromJSON) – auch mitten in einer Animation.

import { Board, isColor, petOf, STONE, BOMB, RAINBOW } from './board.js';
import { traceShot } from './trace.js';
import { ROWS, hexDistance } from './hex.js';
import { Rng } from './rng.js';

export const SPECIALS = ['rainbow', 'bomb', 'fire'];
export const SPECIAL_NAMES = { rainbow: 'Regenbogen', bomb: 'Bombe', fire: 'Feuerkugel' };
export const MAX_SPECIALS = 3;
/** Alle COMBO_STEP Treffer in Folge gibt es eine Spezialkugel. */
export const COMBO_STEP = 4;
/** Ein einzelner Schuss, der so viele Blasen entfernt, bringt ebenfalls eine Spezialkugel. */
export const BIG_SHOT = 15;
export const BOMB_RADIUS = 2;
export const WIN_BONUS_PER_SHOT = 100;
export const EXTRA_SHOTS = 5;

/** Entspannt-Modus: Anzahl Farben und erlaubte Fehlschüsse je nach Punktestand. */
export function endlessColorCount(score) { return score < 2500 ? 4 : score < 9000 ? 5 : 6; }
export function endlessMissLimit(score) { return score < 4000 ? 6 : score < 15000 ? 5 : 4; }
const ENDLESS_START_ROWS = 7;
const ENDLESS_MIN_BUBBLES = 28;

const key = (r, c) => r * 16 + c;

export class Game {
  constructor() {
    this.mode = 'level';
    this.levelNo = 0;
    this.goal = 'clear';
    this.board = new Board();
    this.colors = [1, 2, 3];
    this.pets = [];
    this.petsTotal = 0;
    this.petsFreed = 0;
    this.shotsMax = 0;
    this.shotsLeft = 0;
    this.shotsUsed = 0;
    this.extraShots = 0;
    this.stars = [1, 2];
    this.score = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.specials = [];
    this.armed = -1;
    this.earnedCount = 0;
    this.current = 1;
    this.next = 1;
    this.rng = new Rng(1);
    this.status = 'play';      // 'play' | 'won' | 'lost'
    this.lostReason = null;    // 'shots' | 'overflow'
    this.popped = 0;
    this.dropped = 0;
    this.misses = 0;
    this.rowsAdded = 0;
    /** true: schnelle Simulation für den Computer-Spieler (keine neuen Farben ziehen) */
    this.simulate = false;
  }

  // ---------- Erzeugen ----------

  /** Neues Level aus einer Level-Definition (siehe levels.js). */
  static newLevel(def) {
    const g = new Game();
    g.mode = 'level';
    g.levelNo = def.n;
    g.goal = def.goal;
    g.board = new Board(def.rows, def.shift || 0);
    g.board.trim();
    g.colors = def.colors.slice();
    g.pets = (def.pets || []).slice();
    g.petsTotal = g.board.petCount();
    g.shotsMax = def.shots;
    g.shotsLeft = def.shots;
    g.stars = def.stars.slice();
    g.rng = new Rng(`bubbles-play-${def.n}-${def.seed || 0}`);
    g.current = g.pickColor();
    g.next = g.pickColor();
    return g;
  }

  /** Neue «Entspannt»-Runde (endlos, die Decke sinkt nach Fehlschüssen). */
  static newEndless(seed) {
    const g = new Game();
    g.mode = 'endless';
    g.goal = 'endless';
    g.rng = new Rng(seed >>> 0);
    g.colors = g.rng.shuffle([1, 2, 3, 4, 5, 6]);
    for (let i = 0; i < ENDLESS_START_ROWS; i++) g.addEndlessRow();
    g.rowsAdded = 0;
    g.current = g.pickColor();
    g.next = g.pickColor();
    return g;
  }

  // ---------- Abfragen ----------

  get armedType() { return this.armed >= 0 ? this.specials[this.armed] || null : null; }
  get comboDots() { return this.combo % COMBO_STEP; }
  get missLimit() { return endlessMissLimit(this.score); }
  get activeColors() {
    return this.mode === 'endless' ? this.colors.slice(0, endlessColorCount(this.score)) : this.colors;
  }
  /** Sterne, die man bei aktuellem Stand (noch) erreichen kann. */
  get starsNow() {
    if (this.mode !== 'level') return 0;
    if (this.extraShots > 0) return 1;
    return this.shotsLeft >= this.stars[1] ? 3 : this.shotsLeft >= this.stars[0] ? 2 : 1;
  }
  /** Fortschritt fürs Ziel: { done, total } */
  get progress() {
    if (this.goal === 'pets') return { done: this.petsFreed, total: this.petsTotal };
    return { done: 0, total: this.board.count() };
  }

  /** Flugbahn für die Zielhilfe (ohne den Zustand zu ändern). */
  aim(angle) {
    return traceShot(this.board, angle, { pierce: this.armedType === 'fire' });
  }

  // ---------- Bedienung ----------

  /** Aktuelle und nächste Blase tauschen (oder Spezialkugel wieder ablegen). */
  swap() {
    if (this.status !== 'play') return false;
    if (this.armed >= 0) { this.armed = -1; return 'disarm'; }
    const t = this.current; this.current = this.next; this.next = t;
    return true;
  }

  /** Spezialkugel i auf den Werfer legen (nochmals = ablegen). */
  arm(i) {
    if (this.status !== 'play' || i < 0 || i >= this.specials.length) return false;
    this.armed = this.armed === i ? -1 : i;
    return true;
  }

  // ---------- Schuss ----------

  /** Schiesst im Winkel angle (Grad). pre: optional bereits berechnete Flugbahn (gleicher Zustand!). */
  shoot(angle, pre = null) {
    if (this.status !== 'play') return null;
    const special = this.armedType;
    const tr = pre || traceShot(this.board, angle, { pierce: special === 'fire' });
    const b = this.board;
    const ev = {
      kind: special || 'normal',
      color: special ? 0 : this.current,
      path: tr.points,
      length: tr.length,
      target: tr.target ? { ...tr.target, x: b.x(tr.target.r, tr.target.c), y: b.y(tr.target.r) } : null,
      hit: tr.hit,
      placed: false,
      placedValue: 0,
      removed: [],
      freed: [],
      score: 0,
      combo: 0,
      earned: null,
      specialBonus: 0,
      inserted: 0,
      descended: false,
      refilled: false,
      winBonus: 0,
      status: 'play',
      lostReason: null,
    };

    if (special) {
      this.specials.splice(this.armed, 1);
      this.armed = -1;
    } else if (this.mode === 'level') {
      this.shotsLeft--;
    }
    this.shotsUsed++;

    const removeCell = (r, c, how, d = 0) => {
      const v = b.get(r, c);
      if (!v) return;
      const x = b.x(r, c), y = b.y(r);
      ev.removed.push({ r, c, v, x, y, how, d });
      if (petOf(v)) ev.freed.push({ pet: petOf(v), x, y, d, how });
      b.rows[r][c] = 0;
    };

    if (special === 'fire') {
      for (const p of tr.pierced) removeCell(p.r, p.c, 'fire', p.s);
    } else if (tr.target) {
      const t = tr.target;
      if (special === 'bomb') {
        b.set(t.r, t.c, BOMB);
        const cells = [];
        for (const o of b.occupied()) {
          const d = hexDistance(t, o, b.shift);
          if (d <= BOMB_RADIUS) cells.push([o.r, o.c, d]);
        }
        cells.sort((p, q) => p[2] - q[2]);
        for (const [r, c, d] of cells) removeCell(r, c, 'boom', d);
        // Die Bombe selbst ist kein «Opfer»
        ev.removed = ev.removed.filter((o) => o.v !== BOMB);
      } else if (special === 'rainbow') {
        b.set(t.r, t.c, RAINBOW);
        const byColor = new Map();
        const used = new Set();
        for (const [nr, nc] of b.neighbors(t.r, t.c)) {
          const v = b.get(nr, nc);
          if (!isColor(v) || used.has(key(nr, nc))) continue;
          const grp = b.group(nr, nc);
          for (const [gr, gc] of grp) used.add(key(gr, gc));
          const k = v & 15;
          if (!byColor.has(k)) byColor.set(k, []);
          byColor.get(k).push(...grp);
        }
        const popCells = [];
        for (const grp of byColor.values()) if (grp.length >= 2) popCells.push(...grp);
        if (popCells.length) {
          b.rows[t.r][t.c] = 0;
          ev.removed.push({ r: t.r, c: t.c, v: RAINBOW, x: b.x(t.r, t.c), y: b.y(t.r), how: 'pop', d: 0 });
          popCells.sort((p, q) => hexDistance(t, { r: p[0], c: p[1] }, b.shift) - hexDistance(t, { r: q[0], c: q[1] }, b.shift));
          for (const [r, c] of popCells) removeCell(r, c, 'pop', hexDistance(t, { r, c }, b.shift));
        } else {
          // Nichts passt: der Regenbogen nimmt die Farbe der getroffenen Blase an.
          let k = tr.hit ? b.get(tr.hit.r, tr.hit.c) & 15 : 0;
          if (!(k >= 1 && k <= 8)) {
            const counts = new Map();
            for (const [nr, nc] of b.neighbors(t.r, t.c)) {
              const v = b.get(nr, nc);
              if (isColor(v)) counts.set(v & 15, (counts.get(v & 15) || 0) + 1);
            }
            k = [...counts.entries()].sort((p, q) => q[1] - p[1])[0]?.[0] || this.current;
          }
          b.rows[t.r][t.c] = k;
          ev.placed = true;
          ev.placedValue = k;
        }
      } else {
        b.set(t.r, t.c, this.current);
        const grp = b.group(t.r, t.c);
        if (grp.length >= 3) {
          const withD = grp.map(([r, c]) => [r, c, hexDistance(t, { r, c }, b.shift)]).sort((p, q) => p[2] - q[2]);
          for (const [r, c, d] of withD) removeCell(r, c, 'pop', d);
        } else {
          ev.placed = true;
          ev.placedValue = this.current;
        }
      }
    }

    // Lose Blasen fallen herunter
    const popCount = ev.removed.length;
    const fl = b.floating();
    fl.sort((p, q) => q[0] - p[0] || p[1] - q[1]);
    fl.forEach(([r, c], i) => removeCell(r, c, 'drop', i));
    const dropCount = ev.removed.length - popCount;
    b.trim();

    // Combo & Spezialkugeln
    const removedAny = ev.removed.length > 0;
    if (removedAny) {
      this.combo++;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      if (this.combo % COMBO_STEP === 0 || ev.removed.length >= BIG_SHOT) this.earnSpecial(ev);
    } else {
      this.combo = 0;
    }
    ev.combo = this.combo;

    // Punkte
    this.petsFreed += ev.freed.length;
    this.popped += popCount;
    this.dropped += dropCount;
    const base = popCount * 10 + dropCount * 20 + (dropCount >= 6 ? dropCount * 10 : 0) + ev.freed.length * 100;
    const mult = this.combo >= 2 ? 1 + 0.1 * Math.min(this.combo - 1, 10) : 1;
    ev.score = Math.round(base * mult) + ev.specialBonus;
    this.score += ev.score;

    // Nächste Blase vorbereiten
    if (!special && !this.simulate) {
      this.current = this.next;
      this.next = this.pickColor();
    }

    if (this.mode === 'endless') this.afterEndlessShot(ev, removedAny);
    else this.afterLevelShot(ev);

    if (!this.simulate) this.refreshShooter();
    ev.status = this.status;
    ev.lostReason = this.lostReason;
    return ev;
  }

  earnSpecial(ev) {
    const type = SPECIALS[this.earnedCount % SPECIALS.length];
    this.earnedCount++;
    if (this.specials.length < MAX_SPECIALS) {
      this.specials.push(type);
      ev.earned = type;
    } else {
      ev.specialBonus = 250;
    }
  }

  afterLevelShot(ev) {
    const b = this.board;
    let won = false;
    if (this.goal === 'pets') won = this.petsFreed >= this.petsTotal;
    else won = b.colorsPresent().length === 0;
    if (won) {
      // Alles, was noch hängt, fällt als Belohnung herunter.
      const rest = b.occupied().sort((p, q) => q.r - p.r || p.c - q.c);
      rest.forEach((o, i) => {
        ev.removed.push({ r: o.r, c: o.c, v: o.v, x: o.x, y: o.y, how: 'finale', d: i });
        if (petOf(o.v)) ev.freed.push({ pet: petOf(o.v), x: o.x, y: o.y, d: i, how: 'finale' });
        b.rows[o.r][o.c] = 0;
      });
      const extraPets = rest.filter((o) => petOf(o.v)).length;
      this.petsFreed += extraPets;
      const finaleScore = rest.length * 20 + extraPets * 100;
      ev.winBonus = this.shotsLeft * WIN_BONUS_PER_SHOT;
      this.score += finaleScore + ev.winBonus;
      ev.score += finaleScore;
      b.trim();
      this.status = 'won';
      return;
    }
    if (b.maxRow() >= ROWS) { this.status = 'lost'; this.lostReason = 'overflow'; return; }
    if (this.shotsLeft <= 0) { this.status = 'lost'; this.lostReason = 'shots'; }
  }

  afterEndlessShot(ev, removedAny) {
    const b = this.board;
    if (!removedAny) {
      this.misses++;
      if (this.misses >= this.missLimit) {
        this.misses = 0;
        this.addEndlessRow();
        ev.inserted++;
        ev.descended = true;
      }
    }
    if (b.count() < ENDLESS_MIN_BUBBLES) {
      let k = 0;
      while ((b.count() < ENDLESS_MIN_BUBBLES + 12 || b.maxRow() < 4) && k < 5) {
        this.addEndlessRow();
        k++;
      }
      ev.inserted += k;
      ev.refilled = k > 0;
    }
    if (b.maxRow() >= ROWS) { this.status = 'lost'; this.lostReason = 'overflow'; }
  }

  /** Neue Zeile oben – Farben hängen gern an gleichfarbigen Nachbarn (bildet Gruppen). */
  addEndlessRow() {
    const b = this.board;
    b.insertTop(null);
    const cols = this.activeColors;
    const len = b.rowLen(0);
    for (let c = 0; c < len; c++) {
      let v = 0;
      const below = b.neighbors(0, c).filter(([r]) => r === 1).map(([r, cc]) => b.get(r, cc)).filter(isColor);
      const roll = this.rng.next();
      if (below.length && roll < 0.4) v = this.rng.pick(below) & 15;
      else if (c > 0 && roll < 0.68) v = b.get(0, c - 1) & 15;
      if (!(v >= 1 && v <= 8) || !cols.includes(v)) v = this.rng.pick(cols);
      b.rows[0][c] = v;
    }
    this.rowsAdded++;
  }

  // ---------- Hilfen bei Niederlage (gratis, keine Sackgassen) ----------

  /** +5 Schüsse, wenn sie ausgegangen sind. Danach gibt es höchstens 1 Stern. */
  continueWithShots(n = EXTRA_SHOTS) {
    if (this.status !== 'lost' || this.lostReason !== 'shots') return false;
    this.shotsLeft += n;
    this.extraShots++;
    this.status = 'play';
    this.lostReason = null;
    return true;
  }

  /** Blasen zu tief: die untersten Reihen platzen, dann geht es weiter. */
  rescue() {
    if (this.status !== 'lost' || this.lostReason !== 'overflow') return null;
    const b = this.board;
    const removed = [];
    const limit = ROWS - 5;
    for (const o of b.occupied()) {
      if (o.r >= limit) {
        removed.push({ ...o, how: 'pop', d: o.r - limit });
        if (petOf(o.v)) this.petsFreed++;
        b.rows[o.r][o.c] = 0;
      }
    }
    for (const [r, c] of b.floating()) {
      const v = b.get(r, c);
      removed.push({ r, c, v, x: b.x(r, c), y: b.y(r), how: 'drop', d: 0 });
      if (petOf(v)) this.petsFreed++;
      b.rows[r][c] = 0;
    }
    b.trim();
    this.status = 'play';
    this.lostReason = null;
    const ev = { removed, freed: [], score: 0, winBonus: 0, status: 'play' };
    if (this.mode === 'level') {
      this.extraShots++;
      if (this.shotsLeft < 3) this.shotsLeft = 3;
      this.afterLevelShot(ev);
    }
    this.refreshShooter();
    ev.status = this.status;
    return ev;
  }

  // ---------- Farben ----------

  /** Wählt eine Farbe, die noch im Feld vorkommt – bevorzugt erreichbare «Rand»-Blasen. */
  pickColor() {
    const present = this.board.colorsPresent();
    if (!present.length) return this.activeColors[0] || 1;
    if (present.length === 1) { this.rng.next(); return present[0]; }
    if (this.rng.next() < 0.45) {
      const front = this.frontierColors();
      if (front.length) return this.rng.pick(front);
    }
    return this.rng.pick(present);
  }

  /** Farben von Blasen, die einen freien Nachbarn auf gleicher Höhe oder darunter haben. */
  frontierColors() {
    const b = this.board;
    const out = [];
    for (const o of b.occupied()) {
      if (!isColor(o.v)) continue;
      const free = b.neighbors(o.r, o.c).some(([r, c]) => r >= o.r && !b.get(r, c));
      if (free) out.push(o.v & 15);
    }
    return out;
  }

  /** Sorgt dafür, dass der Werfer nur Farben anbietet, die noch im Feld sind. */
  refreshShooter() {
    const present = this.board.colorsPresent();
    if (!present.length) return;
    if (!present.includes(this.current)) this.current = this.pickColor();
    if (!present.includes(this.next)) this.next = this.pickColor();
  }

  // ---------- Speichern ----------

  toJSON() {
    return {
      v: 1,
      mode: this.mode, levelNo: this.levelNo, goal: this.goal,
      board: this.board.toJSON(),
      colors: this.colors.slice(), pets: this.pets.slice(),
      petsTotal: this.petsTotal, petsFreed: this.petsFreed,
      shotsMax: this.shotsMax, shotsLeft: this.shotsLeft, shotsUsed: this.shotsUsed, extraShots: this.extraShots,
      stars: this.stars.slice(), score: this.score, combo: this.combo, bestCombo: this.bestCombo,
      specials: this.specials.slice(), armed: this.armed, earnedCount: this.earnedCount,
      current: this.current, next: this.next, rng: this.rng.state,
      status: this.status, lostReason: this.lostReason,
      popped: this.popped, dropped: this.dropped, misses: this.misses, rowsAdded: this.rowsAdded,
    };
  }

  static fromJSON(o) {
    if (!o || o.v !== 1 || !o.board) return null;
    const g = new Game();
    for (const k of Object.keys(g)) {
      if (k === 'board' || k === 'rng') continue;
      if (o[k] !== undefined) g[k] = Array.isArray(o[k]) ? o[k].slice() : o[k];
    }
    g.board = Board.fromJSON(o.board);
    g.rng = Rng.from(o.rng >>> 0);
    g.specials = g.specials.filter((s) => SPECIALS.includes(s)).slice(0, MAX_SPECIALS);
    if (g.armed >= g.specials.length) g.armed = -1;
    return g;
  }

  clone() {
    const g = Object.assign(new Game(), this);
    g.board = this.board.clone();
    g.rng = this.rng.clone();
    g.colors = this.colors.slice();
    g.pets = this.pets.slice();
    g.stars = this.stars.slice();
    g.specials = this.specials.slice();
    return g;
  }

  /** Erreichte Sterne (nur sinnvoll nach dem Sieg). */
  starsEarned() { return this.status === 'won' ? this.starsNow : 0; }
}

export { STONE };
