// Juwelen – reine Spiellogik (kein DOM, mit node --test testbar).
//
// Das Brett ist ein Raster w×h. Jede Zelle ist spielbar (mask=1) oder ein Loch (mask=0).
// Auf einer Zelle liegt höchstens ein Stück:
//   { id, t:'g', c:Farbe 0..5, sp:Spezial }   Juwel
//   { id, t:'i' }                             Eichel (fällt, muss nach unten gebracht werden)
//   { id, t:'s', hp:1|2 }                     Stein (fest, wird durch Treffer zerstört)
// Unter einem Juwel kann Eis liegen (ice[i] = 0..2 Schichten).
//
// Jede Aktion (swap, hammer, shuffleBooster, finale) verändert den Zustand sofort vollständig
// und liefert eine Liste von Ereignissen, die die Oberfläche danach Schritt für Schritt animiert.

import { hashString } from '../shared/rng.js';

export const SP = Object.freeze({ NONE: 0, H: 1, V: 2, BOMB: 3, RAINBOW: 4 });
export const MAX_COLORS = 6;
export const POINTS = Object.freeze({
  gem: 20, blast: 30, ice: 40, stone: 50, item: 300,
  bonus: { [SP.H]: 40, [SP.V]: 40, [SP.BOMB]: 60, [SP.RAINBOW]: 120 },
  finaleMove: 120, finaleRest: 250,
});

/** Kleiner deterministischer Zufallsgenerator (mulberry32) mit speicherbarem Zustand. */
export class Rng {
  constructor(seed) { this.s = (seed >>> 0) || 1; }
  next() {
    this.s = (this.s + 0x6D2B79F5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(n) { return Math.floor(this.next() * n); }
  shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
}

// ---------------------------------------------------------------------------
// Level-Format
// ---------------------------------------------------------------------------

/**
 * Wandelt eine Level-Beschreibung (siehe data/levels.js) in ein normalisiertes Level um.
 * Karten-Zeichen: '.' Zelle, '-' Loch, 'i' Eis, 'I' doppeltes Eis, 's' Stein, 'S' harter Stein, 'a' Eichel.
 */
export function parseLevel(def, n = def.n || 0) {
  const map = def.map;
  const h = map.length;
  const w = map[0].length;
  const mask = [], ice = [], stone = [], items = [];
  for (let r = 0; r < h; r++) {
    if (map[r].length !== w) throw new Error(`Level ${n}: Zeile ${r + 1} hat falsche Länge`);
    for (let c = 0; c < w; c++) {
      const ch = map[r][c];
      if (!'.-iIsSa'.includes(ch)) throw new Error(`Level ${n}: unbekanntes Zeichen «${ch}»`);
      mask.push(ch === '-' ? 0 : 1);
      ice.push(ch === 'i' ? 1 : ch === 'I' ? 2 : 0);
      stone.push(ch === 's' ? 1 : ch === 'S' ? 2 : 0);
      if (ch === 'a') items.push(r * w + c);
    }
  }
  const colors = Math.max(3, Math.min(MAX_COLORS, def.colors || 5));
  const goals = (def.goals || []).map((g) => ({ ...g }));
  if (!def.zen && !goals.length) goals.push({ type: 'score', n: 1000 });
  for (const g of goals) {
    if (!['score', 'color', 'ice', 'stone', 'item'].includes(g.type)) throw new Error(`Level ${n}: unbekanntes Ziel «${g.type}»`);
    if (g.type === 'color' && !(g.color >= 0 && g.color < colors)) throw new Error(`Level ${n}: Farbe ${g.color} kommt nicht vor (nur ${colors} Farben)`);
    if ((g.type === 'color' || g.type === 'item' || g.type === 'score') && !(g.n >= 0)) throw new Error(`Level ${n}: Ziel ohne Anzahl`);
  }
  return {
    n,
    w, h, mask, ice, stone, items,
    colors,
    moves: def.moves || 20,
    goals,
    stars: def.stars || [0, 0, 0],
    seed: (def.seed ?? hashString('juwelen-' + n)) >>> 0,
    itemsMax: def.itemsMax || 2,
    zen: !!def.zen,
    tip: def.tip || null,
    world: def.world ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Spiel
// ---------------------------------------------------------------------------

const isMovable = (p) => !!p && (p.t === 'g' || p.t === 'i');

export class Game {
  constructor(level, saved = null) {
    this.L = level;
    this.w = level.w;
    this.h = level.h;
    this.size = level.w * level.h;
    this.mask = Uint8Array.from(level.mask);
    this.colors = level.colors;
    this.zen = level.zen;
    this.goals = level.goals;
    this.record = true;      // Ereignisse aufzeichnen (für die Animation)
    this.ev = [];
    const itemGoal = this.goals.find((g) => g.type === 'item');
    this.itemsTotal = itemGoal ? itemGoal.n : 0;
    this.itemsMax = level.itemsMax;
    this.topRow = new Int8Array(this.w).fill(-1);
    this.exitRow = new Int8Array(this.w).fill(-1);
    for (let c = 0; c < this.w; c++) {
      for (let r = 0; r < this.h; r++) if (this.mask[r * this.w + c]) { this.topRow[c] = r; break; }
      for (let r = this.h - 1; r >= 0; r--) if (this.mask[r * this.w + c]) { this.exitRow[c] = r; break; }
    }
    if (saved) this._load(saved);
    else this._init();
  }

  // ---------- Aufbau ----------

  _init() {
    const L = this.L;
    this.rng = new Rng(L.seed);
    this.cells = new Array(this.size).fill(null);
    this.ice = Int8Array.from(L.ice);
    this.nextId = 1;
    for (let i = 0; i < this.size; i++) {
      if (!this.mask[i]) { this.ice[i] = 0; continue; }
      if (L.stone[i]) { this.cells[i] = { id: this.nextId++, t: 's', c: -1, sp: 0, hp: L.stone[i] }; this.ice[i] = 0; }
    }
    for (const i of L.items) if (this.mask[i] && !this.cells[i]) this.cells[i] = { id: this.nextId++, t: 'i', c: -1, sp: 0, hp: 0 };
    this.itemsSpawned = L.items.length;
    this._fillNoMatch();
    this.score = 0;
    this.movesLeft = L.zen ? 0 : L.moves;
    this.movesUsed = 0;
    this.collected = new Array(MAX_COLORS).fill(0);
    this.itemsCollected = 0;
    this.stonesBroken = 0;
    this.status = 'play';
    this.extraUsed = false;
    this.hammers = 3;
    this.shuffles = 1;
    this.maxCombo = 0;
    this.specialsMade = 0;
    this.gemsCleared = 0;
    this.finaleDone = false;
    this.iceStart = this.iceCount();
    this.stonesStart = this.stoneCount();
    this._itemThisMove = false;
  }

  /** Füllt alle leeren Zellen mit Juwelen, ohne fertige Dreier; garantiert einen möglichen Zug. */
  _fillNoMatch(only = null) {
    const targets = [];
    for (let i = 0; i < this.size; i++) if (this.mask[i] && !this.cells[i] && (!only || only.has(i))) targets.push(i);
    for (let attempt = 0; attempt < 80; attempt++) {
      for (const i of targets) {
        const order = this.rng.shuffle([...Array(this.colors).keys()]);
        let chosen = order[0];
        for (const col of order) {
          this.cells[i] = { id: 0, t: 'g', c: col, sp: 0, hp: 0 };
          if (!this._matchAt(i)) { chosen = col; break; }
        }
        this.cells[i] = { id: this.nextId++, t: 'g', c: chosen, sp: 0, hp: 0 };
      }
      if (!this._anyMatch() && this.hasMove()) return true;
      for (const i of targets) this.cells[i] = null;
    }
    // Notfall: einfach füllen
    for (const i of targets) if (!this.cells[i]) this.cells[i] = { id: this.nextId++, t: 'g', c: this.rng.int(this.colors), sp: 0, hp: 0 };
    return false;
  }

  // ---------- Speichern ----------

  save() {
    return {
      v: 1,
      cells: this.cells.map((p) => (p ? [p.id, p.t, p.c, p.sp, p.hp] : 0)),
      ice: Array.from(this.ice),
      rng: this.rng.s,
      nextId: this.nextId,
      score: this.score,
      movesLeft: this.movesLeft,
      movesUsed: this.movesUsed,
      collected: this.collected.slice(),
      itemsCollected: this.itemsCollected,
      itemsSpawned: this.itemsSpawned,
      stonesBroken: this.stonesBroken,
      status: this.status,
      extraUsed: this.extraUsed,
      hammers: this.hammers,
      shuffles: this.shuffles,
      maxCombo: this.maxCombo,
      specialsMade: this.specialsMade,
      gemsCleared: this.gemsCleared,
      finaleDone: this.finaleDone,
      iceStart: this.iceStart,
      stonesStart: this.stonesStart,
    };
  }

  _load(s) {
    if (!s || s.v !== 1 || !Array.isArray(s.cells) || s.cells.length !== this.size) throw new Error('Spielstand ungültig');
    this.cells = s.cells.map((a) => (a ? { id: a[0], t: a[1], c: a[2], sp: a[3], hp: a[4] } : null));
    this.ice = Int8Array.from(s.ice);
    this.rng = new Rng(s.rng);
    for (const k of ['nextId', 'score', 'movesLeft', 'movesUsed', 'itemsCollected', 'itemsSpawned', 'stonesBroken',
      'status', 'extraUsed', 'hammers', 'shuffles', 'maxCombo', 'specialsMade', 'gemsCleared', 'finaleDone',
      'iceStart', 'stonesStart']) this[k] = s[k];
    this.collected = s.collected.slice();
    this._itemThisMove = false;
  }

  /** Schnelle, unabhängige Kopie (für den Bot). Ereignisse werden nicht aufgezeichnet. */
  clone() {
    const g = Object.create(Game.prototype);
    Object.assign(g, this);
    g.cells = this.cells.map((p) => (p ? { id: p.id, t: p.t, c: p.c, sp: p.sp, hp: p.hp } : null));
    g.ice = this.ice.slice();
    g.collected = this.collected.slice();
    g.rng = new Rng(this.rng.s);
    g.ev = [];
    g.record = false;
    return g;
  }

  // ---------- Abfragen ----------

  rc(i) { return [(i / this.w) | 0, i % this.w]; }
  idx(r, c) { return r * this.w + c; }
  adjacent(a, b) {
    const [ra, ca] = this.rc(a), [rb, cb] = this.rc(b);
    return Math.abs(ra - rb) + Math.abs(ca - cb) === 1;
  }
  iceCount() { let n = 0; for (let i = 0; i < this.size; i++) if (this.ice[i] > 0) n++; return n; }
  iceLayers() { let n = 0; for (let i = 0; i < this.size; i++) n += this.ice[i]; return n; }
  stoneCount() { let n = 0; for (const p of this.cells) if (p && p.t === 's') n++; return n; }
  itemsOnBoard() { let n = 0; for (const p of this.cells) if (p && p.t === 'i') n++; return n; }

  /** Restmenge pro Ziel (0 = erfüllt). */
  goalRemaining() {
    return this.goals.map((g) => {
      switch (g.type) {
        case 'score': return Math.max(0, g.n - this.score);
        case 'color': return Math.max(0, g.n - this.collected[g.color]);
        case 'ice': return this.iceCount();
        case 'stone': return this.stoneCount();
        case 'item': return Math.max(0, g.n - this.itemsCollected);
        default: return 0;
      }
    });
  }

  goalsDone() { return !this.zen && this.goalRemaining().every((x) => x === 0); }

  stars() {
    if (this.status !== 'won') return 0;
    const s = this.L.stars;
    return 1 + (this.score >= s[1] ? 1 : 0) + (this.score >= s[2] ? 1 : 0);
  }

  hud() {
    return { score: this.score, moves: this.movesLeft, goals: this.goalRemaining(), hammers: this.hammers, shuffles: this.shuffles };
  }

  _colorAt(i) {
    const p = this.cells[i];
    return p && p.t === 'g' && p.sp !== SP.RAINBOW ? p.c : -1;
  }

  _runLen(i) {
    const col = this._colorAt(i);
    if (col < 0) return [0, 0];
    const w = this.w;
    const r = (i / w) | 0, c = i - r * w;
    let a = 1;
    for (let cc = c - 1; cc >= 0 && this._colorAt(r * w + cc) === col; cc--) a++;
    for (let cc = c + 1; cc < w && this._colorAt(r * w + cc) === col; cc++) a++;
    let b = 1;
    for (let rr = r - 1; rr >= 0 && this._colorAt(rr * w + c) === col; rr--) b++;
    for (let rr = r + 1; rr < this.h && this._colorAt(rr * w + c) === col; rr++) b++;
    return [a, b];
  }

  _matchAt(i) {
    const [a, b] = this._runLen(i);
    return a >= 3 || b >= 3;
  }

  _anyMatch() {
    for (let i = 0; i < this.size; i++) if (this._matchAt(i)) return true;
    return false;
  }

  _nbrs(i) {
    const w = this.w, r = (i / w) | 0, c = i - r * w, out = [];
    if (r > 0 && this.mask[i - w]) out.push(i - w);
    if (r < this.h - 1 && this.mask[i + w]) out.push(i + w);
    if (c > 0 && this.mask[i - 1]) out.push(i - 1);
    if (c < w - 1 && this.mask[i + 1]) out.push(i + 1);
    return out;
  }

  _swapCells(i, j) { const t = this.cells[i]; this.cells[i] = this.cells[j]; this.cells[j] = t; }

  /** 0 = kein Zug, 1 = normaler Zug (ergibt Dreier), 2 = Spezial-Kombination. */
  moveKind(i, j) {
    const a = this.cells[i], b = this.cells[j];
    if (!isMovable(a) || !isMovable(b)) return 0;
    if (a.t === 'i' && b.t === 'i') return 0;
    if (a.t === 'g' && b.t === 'g') {
      if (a.sp === SP.RAINBOW || b.sp === SP.RAINBOW) return 2;
      if (a.sp && b.sp) return 2;
    }
    this._swapCells(i, j);
    const ok = this._matchAt(i) || this._matchAt(j);
    this._swapCells(i, j);
    return ok ? 1 : 0;
  }

  _pairs(fn) {
    const { w, h } = this;
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        const i = r * w + c;
        if (!this.mask[i]) continue;
        if (c + 1 < w && this.mask[i + 1] && fn(i, i + 1)) return true;
        if (r + 1 < h && this.mask[i + w] && fn(i, i + w)) return true;
      }
    }
    return false;
  }

  hasMove() { return this._pairs((i, j) => this.moveKind(i, j) > 0); }

  /** Alle möglichen Züge mit grober Bewertung (für Tipp und Tests). */
  findMoves() {
    const out = [];
    this._pairs((i, j) => {
      const k = this.moveKind(i, j);
      if (!k) return false;
      let value;
      if (k === 2) {
        const a = this.cells[i], b = this.cells[j];
        value = 40 + (a.sp === SP.RAINBOW || b.sp === SP.RAINBOW ? 20 : 0) + (a.sp && b.sp ? 20 : 0);
      } else {
        this._swapCells(i, j);
        value = 0;
        for (const x of [i, j]) {
          const [a, b] = this._runLen(x);
          if (a >= 3) value += a + (a >= 4 ? 6 : 0) + (a >= 5 ? 20 : 0);
          if (b >= 3) value += b + (b >= 4 ? 6 : 0) + (b >= 5 ? 20 : 0);
          if (a >= 3 && b >= 3) value += 10;
        }
        this._swapCells(i, j);
      }
      out.push({ a: i, b: j, kind: k, value });
      return false;
    });
    return out.sort((x, y) => y.value - x.value || x.a - y.a);
  }

  /** Vorschlag für den Tipp-Leuchteffekt. */
  hint() {
    const m = this.findMoves();
    if (!m.length) return null;
    // Nicht immer den allerbesten zeigen – aber einen guten.
    const top = m.filter((x) => x.value >= m[0].value * 0.6);
    return top[(this.movesUsed * 7) % top.length];
  }

  // ---------- Treffer finden ----------

  findMatches(prefer = null) {
    const { w, h } = this;
    const runs = [];
    for (let r = 0; r < h; r++) {
      let c = 0;
      while (c < w) {
        const col = this._colorAt(r * w + c);
        let e = c + 1;
        if (col >= 0) while (e < w && this._colorAt(r * w + e) === col) e++;
        if (col >= 0 && e - c >= 3) {
          const cells = [];
          for (let k = c; k < e; k++) cells.push(r * w + k);
          runs.push({ dir: 'h', cells, color: col });
        }
        c = e;
      }
    }
    for (let c = 0; c < w; c++) {
      let r = 0;
      while (r < h) {
        const col = this._colorAt(r * w + c);
        let e = r + 1;
        if (col >= 0) while (e < h && this._colorAt(e * w + c) === col) e++;
        if (col >= 0 && e - r >= 3) {
          const cells = [];
          for (let k = r; k < e; k++) cells.push(k * w + c);
          runs.push({ dir: 'v', cells, color: col });
        }
        r = e;
      }
    }
    if (!runs.length) return [];
    // Läufe mit gemeinsamen Zellen zu Gruppen verbinden (Union-Find)
    const parent = runs.map((_, k) => k);
    const find = (k) => (parent[k] === k ? k : (parent[k] = find(parent[k])));
    const owner = new Map();
    runs.forEach((run, k) => {
      for (const i of run.cells) {
        if (owner.has(i)) parent[find(k)] = find(owner.get(i));
        else owner.set(i, k);
      }
    });
    const byRoot = new Map();
    runs.forEach((run, k) => {
      const root = find(k);
      if (!byRoot.has(root)) byRoot.set(root, []);
      byRoot.get(root).push(run);
    });
    const groups = [];
    for (const list of byRoot.values()) {
      const set = new Set();
      const count = new Map();
      for (const run of list) for (const i of run.cells) { set.add(i); count.set(i, (count.get(i) || 0) + 1); }
      const cells = [...set].sort((a, b) => a - b);
      const longest = list.reduce((m, run) => (run.cells.length > m.cells.length ? run : m), list[0]);
      const hasH = list.some((run) => run.dir === 'h');
      const hasV = list.some((run) => run.dir === 'v');
      let sp = SP.NONE, cand = null;
      if (longest.cells.length >= 5) { sp = SP.RAINBOW; cand = longest.cells; }
      else if (hasH && hasV) { sp = SP.BOMB; cand = cells.filter((i) => count.get(i) > 1); if (!cand.length) cand = cells; }
      else if (longest.cells.length === 4) { sp = longest.dir === 'h' ? SP.H : SP.V; cand = longest.cells; }
      const g = { cells, color: list[0].color, create: null, size: cells.length };
      if (sp) {
        let at = prefer ? cand.find((i) => prefer.includes(i)) : undefined;
        if (at === undefined) {
          const plain = cand.filter((i) => !this.cells[i].sp);
          const pool = plain.length ? plain : cand;
          at = pool[(pool.length - 1) >> 1];
        }
        g.create = { at, sp };
      }
      groups.push(g);
    }
    return groups;
  }

  // ---------- Aktionen ----------

  _begin() { this.ev = []; this._itemThisMove = false; return this.ev; }
  _push(e) { if (this.record) { e.hud = this.hud(); this.ev.push(e); } }

  /** Tauscht zwei Nachbarzellen. Rückgabe: null (nicht möglich) oder { ok, events }. */
  swap(a, b) {
    if (this.status !== 'play' || a === b || !this.adjacent(a, b)) return null;
    if (!isMovable(this.cells[a]) || !isMovable(this.cells[b])) return null;
    const kind = this.moveKind(a, b);
    const ev = this._begin();
    if (!kind) {
      this._push({ type: 'swap', a, b, ok: false });
      return { ok: false, events: ev };
    }
    this._swapCells(a, b);
    if (!this.zen) this.movesLeft--;
    this.movesUsed++;
    this._push({ type: 'swap', a, b, ok: true });
    const first = kind === 2 ? this._comboStep(b, a) : null;
    this._cascade(first, [a, b]);
    this._afterAction();
    return { ok: true, events: ev };
  }

  /** Hammer: zerschlägt ein Juwel oder trifft einen Stein. Kostet keinen Zug. */
  hammer(i) {
    if (this.status !== 'play' || (!this.zen && this.hammers <= 0)) return null;
    const p = this.cells[i];
    if (!p || p.t === 'i') return null;
    const ev = this._begin();
    if (!this.zen) this.hammers--;
    this._push({ type: 'hammer', i });
    this._cascade({ seeds: [{ i, d: 0 }], effects: [], consumed: [] }, null);
    this._afterAction();
    return { ok: true, events: ev };
  }

  /** Gratis-Mischen (Hilfe). */
  shuffleBooster() {
    if (this.status !== 'play' || (!this.zen && this.shuffles <= 0)) return null;
    const ev = this._begin();
    if (!this.zen) this.shuffles--;
    this._shuffle('booster');
    return { ok: true, events: ev };
  }

  /** Einmal pro Level: +5 Züge, wenn sie ausgegangen sind. */
  addMoves(n = 5) {
    if (this.status !== 'lost' || this.extraUsed) return null;
    const ev = this._begin();
    this.extraUsed = true;
    this.movesLeft += n;
    this.status = 'play';
    this._push({ type: 'moves', n });
    if (!this.hasMove()) this._shuffle('auto');
    return { ok: true, events: ev };
  }

  /** Bonus-Finale nach dem Sieg: übrige Züge werden zu Blitz-Juwelen, die alle losgehen. */
  finale() {
    if (this.status !== 'won' || this.finaleDone) return null;
    const ev = this._begin();
    this.finaleDone = true;
    const m = this.movesLeft;
    const cand = [];
    for (let i = 0; i < this.size; i++) { const p = this.cells[i]; if (p && p.t === 'g' && !p.sp) cand.push(i); }
    this.rng.shuffle(cand);
    const k = Math.min(m, 12, cand.length);
    const conv = [];
    for (let q = 0; q < k; q++) {
      const i = cand[q];
      const p = this.cells[i];
      p.sp = this.rng.next() < 0.5 ? SP.H : SP.V;
      conv.push({ i, id: p.id, sp: p.sp, c: p.c, d: q * 0.9 });
    }
    const rest = m - k;
    this.movesLeft = 0;
    this.score += k * POINTS.finaleMove + rest * POINTS.finaleRest;
    this._push({ type: 'convert', list: conv, finale: true, rest });
    if (conv.length) this._cascade({ seeds: conv.map((x) => ({ i: x.i, d: x.d })), effects: [], consumed: [] }, null);
    // Alle übrigen Sonderjuwelen zünden
    for (let round = 0; round < 4; round++) {
      const seeds = [];
      for (let i = 0; i < this.size; i++) { const p = this.cells[i]; if (p && p.t === 'g' && p.sp) seeds.push({ i, d: seeds.length * 0.6 }); }
      if (!seeds.length) break;
      this._cascade({ seeds, effects: [], consumed: [] }, null);
    }
    this._push({ type: 'finaleEnd' });
    return { ok: true, events: ev };
  }

  _afterAction() {
    if (this.zen) {
      if (!this.hasMove()) this._shuffle('auto');
      return;
    }
    if (this.goalsDone()) {
      this.status = 'won';
      this._push({ type: 'won' });
    } else if (this.movesLeft <= 0) {
      this.status = 'lost';
      this._push({ type: 'lost' });
    } else if (!this.hasMove()) {
      this._shuffle('auto');
    }
  }

  // ---------- Kaskade ----------

  _cascade(first, prefer) {
    let combo = 0;
    let step = first;
    for (let guard = 0; guard < 100; guard++) {
      let groups = [];
      if (!step) {
        groups = this.findMatches(guard === 0 ? prefer : null);
        if (!groups.length) break;
      }
      combo++;
      this._clearStep(groups, step, combo);
      step = null;
      this._gravity();
      while (this._collect()) this._gravity();
    }
    if (combo > this.maxCombo) this.maxCombo = combo;
    return combo;
  }

  /** Startschritt für Spezial-Kombinationen. at = Zielzelle des gezogenen Juwels. */
  _comboStep(at, other) {
    const { w, h, cells } = this;
    const P = cells[at], Q = cells[other];
    const [r, c] = this.rc(at);
    const seeds = [], effects = [];
    const consumed = [at, other];
    const dist = (i) => { const [rr, cc] = this.rc(i); return Math.max(Math.abs(rr - r), Math.abs(cc - c)); };
    if (P.sp === SP.RAINBOW || Q.sp === SP.RAINBOW) {
      const ri = P.sp === SP.RAINBOW ? at : other;
      const oi = ri === at ? other : at;
      const O = cells[oi];
      const [rr0, rc0] = this.rc(ri);
      if (O.sp === SP.RAINBOW) {
        effects.push({ k: 'nova', r, c, d: 0 });
        for (let i = 0; i < this.size; i++) if (this.mask[i]) seeds.push({ i, d: 0.5 + dist(i) * 0.35 });
      } else {
        const X = O.c;
        const targets = [];
        for (let i = 0; i < this.size; i++) {
          const p = cells[i];
          if (p && p.t === 'g' && p.c === X && i !== oi) targets.push(i);
        }
        effects.push({ k: 'rainbow', r: rr0, c: rc0, color: X, targets: targets.slice(), d: 0 });
        if (O.sp === SP.H || O.sp === SP.V || O.sp === SP.BOMB) {
          const list = [];
          targets.forEach((i, k) => {
            const p = cells[i];
            if (!p.sp) p.sp = O.sp === SP.BOMB ? SP.BOMB : (this.rng.next() < 0.5 ? SP.H : SP.V);
            list.push({ i, id: p.id, sp: p.sp, c: p.c, d: 0.3 + k * 0.12 });
          });
          this._push({ type: 'convert', list });
          consumed.length = 0;
          consumed.push(ri);
          seeds.push({ i: oi, d: 1.2 });
          list.forEach((x, k) => seeds.push({ i: x.i, d: 1.4 + k * 0.35 }));
        } else {
          targets.forEach((i, k) => seeds.push({ i, d: 0.4 + k * 0.08 }));
        }
      }
    } else {
      const lineP = P.sp === SP.H || P.sp === SP.V, lineQ = Q.sp === SP.H || Q.sp === SP.V;
      if (lineP && lineQ) {
        effects.push({ k: 'line', dir: 'h', r, c, d: 0, wide: 0 }, { k: 'line', dir: 'v', r, c, d: 0, wide: 0 });
        for (let cc = 0; cc < w; cc++) seeds.push({ i: r * w + cc, d: 0.4 + Math.abs(cc - c) * 0.1 });
        for (let rr = 0; rr < h; rr++) seeds.push({ i: rr * w + c, d: 0.4 + Math.abs(rr - r) * 0.1 });
      } else if (lineP || lineQ) {
        effects.push({ k: 'line', dir: 'h', r, c, d: 0, wide: 1 }, { k: 'line', dir: 'v', r, c, d: 0, wide: 1 });
        for (let i = 0; i < this.size; i++) {
          const [rr, cc] = this.rc(i);
          if (Math.abs(rr - r) <= 1 || Math.abs(cc - c) <= 1) seeds.push({ i, d: 0.4 + Math.max(Math.abs(rr - r), Math.abs(cc - c)) * 0.1 });
        }
      } else {
        effects.push({ k: 'bomb', r, c, rad: 2, d: 0 });
        for (let i = 0; i < this.size; i++) if (dist(i) <= 2) seeds.push({ i, d: 0.4 + dist(i) * 0.25 });
      }
    }
    return { seeds, effects, consumed };
  }

  _mostCommonColor() {
    const n = new Array(MAX_COLORS).fill(0);
    for (const p of this.cells) if (p && p.t === 'g' && p.c >= 0) n[p.c]++;
    let best = 0;
    for (let k = 1; k < MAX_COLORS; k++) if (n[k] > n[best]) best = k;
    return best;
  }

  _clearStep(groups, step, combo) {
    const { w, h, cells } = this;
    const clear = new Map();
    const activated = new Set();
    const queue = [];
    const effects = step ? step.effects.slice() : [];
    const creations = new Map();
    const matched = [];
    const mark = (i, d) => {
      if (i < 0 || i >= this.size || !this.mask[i]) return;
      const prev = clear.get(i);
      if (prev === undefined || d < prev) clear.set(i, d);
      const p = cells[i];
      if (p && p.t === 'g' && p.sp && !activated.has(i)) { activated.add(i); queue.push(i); }
    };
    if (step) {
      for (const i of step.consumed) { activated.add(i); clear.set(i, 0); }
      for (const s of step.seeds) mark(s.i, s.d);
    }
    let pts = 0;
    const popups = [];
    for (const g of groups) {
      if (g.create) creations.set(g.create.at, g);
      const gp = (g.cells.length * POINTS.gem + (g.create ? POINTS.bonus[g.create.sp] : 0)) * combo;
      pts += gp;
      popups.push({ i: g.create ? g.create.at : g.cells[g.cells.length >> 1], pts: gp, c: g.color });
    }
    for (const g of groups) {
      for (const i of g.cells) {
        matched.push(i);
        if (creations.has(i)) {
          const p = cells[i];
          if (p && p.sp && !activated.has(i)) { activated.add(i); queue.push(i); }
        } else mark(i, 0);
      }
    }
    // Spezialjuwelen auslösen (Kettenreaktion)
    while (queue.length) {
      const i = queue.shift();
      const p = cells[i];
      const d = clear.get(i) ?? 0;
      const r = (i / w) | 0, c = i - r * w;
      if (p.sp === SP.H) {
        effects.push({ k: 'line', dir: 'h', r, c, d });
        for (let cc = 0; cc < w; cc++) mark(r * w + cc, d + 0.6 + Math.abs(cc - c) * 0.1);
      } else if (p.sp === SP.V) {
        effects.push({ k: 'line', dir: 'v', r, c, d });
        for (let rr = 0; rr < h; rr++) mark(rr * w + c, d + 0.6 + Math.abs(rr - r) * 0.1);
      } else if (p.sp === SP.BOMB) {
        effects.push({ k: 'bomb', r, c, rad: 1, d });
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr, cc = c + dc;
          if (rr >= 0 && rr < h && cc >= 0 && cc < w) mark(rr * w + cc, d + 0.6 + (dr && dc ? 0.15 : 0.08));
        }
      } else if (p.sp === SP.RAINBOW) {
        const X = this._mostCommonColor();
        const targets = [];
        for (let k = 0; k < this.size; k++) { const q = cells[k]; if (q && q.t === 'g' && q.c === X && !clear.has(k)) targets.push(k); }
        effects.push({ k: 'rainbow', r, c, color: X, targets, d });
        targets.forEach((k, n) => mark(k, d + 0.6 + n * 0.07));
      }
    }
    // Anwenden
    const cleared = [], stoneHits = [], iceHits = [], created = [];
    const iceDone = new Set(), stoneDone = new Set();
    const matchedSet = new Set(matched);
    const hitIce = (i, d) => {
      if (this.ice[i] > 0 && !iceDone.has(i)) {
        iceDone.add(i);
        this.ice[i]--;
        iceHits.push({ i, left: this.ice[i], d });
        pts += POINTS.ice;
      }
    };
    const hitStone = (i, d) => {
      const p = cells[i];
      if (p && p.t === 's' && !stoneDone.has(i)) {
        stoneDone.add(i);
        p.hp--;
        stoneHits.push({ i, id: p.id, hp: p.hp, d });
        pts += POINTS.stone;
        if (p.hp <= 0) { cells[i] = null; this.stonesBroken++; }
      }
    };
    for (const [i, d] of clear) {
      if (creations.has(i)) continue;
      const p = cells[i];
      if (!p) continue;
      if (p.t === 'g') {
        cells[i] = null;
        cleared.push({ i, id: p.id, c: p.c, sp: p.sp, d, m: matchedSet.has(i) ? 1 : 0 });
        if (p.c >= 0) this.collected[p.c]++;
        this.gemsCleared++;
        if (!matchedSet.has(i)) pts += POINTS.blast;
        hitIce(i, d);
      } else if (p.t === 's') hitStone(i, d);
    }
    for (const i of matched) for (const nb of this._nbrs(i)) hitStone(nb, (clear.get(i) ?? 0) + 0.2);
    for (const [i, g] of creations) {
      hitIce(i, 0);
      const p = cells[i];
      p.sp = g.create.sp;
      p.c = p.sp === SP.RAINBOW ? -1 : g.color;
      created.push({ i, id: p.id, c: p.c, sp: p.sp, color: g.color, from: g.cells.filter((x) => x !== i) });
      this.specialsMade++;
    }
    this.score += pts;
    let maxD = 0;
    for (const x of cleared) if (x.d > maxD) maxD = x.d;
    for (const x of stoneHits) if (x.d > maxD) maxD = x.d;
    this._push({ type: 'clear', combo, cleared, effects, created, stoneHits, iceHits, popups, pts, maxD });
  }

  // ---------- Schwerkraft ----------

  _spawnPiece() {
    const id = this.nextId++;
    if (!this.zen && this.status === 'play' && this.itemsSpawned < this.itemsTotal && !this._itemThisMove &&
        this.itemsOnBoard() < this.itemsMax && this.rng.next() < 0.3) {
      this.itemsSpawned++;
      this._itemThisMove = true;
      return { id, t: 'i', c: -1, sp: 0, hp: 0 };
    }
    return { id, t: 'g', c: this.rng.int(this.colors), sp: 0, hp: 0 };
  }

  _gravity() {
    const { w, h, cells, mask } = this;
    const frames = [];
    for (let tick = 0; tick < 500; tick++) {
      const moves = [];
      const moved = new Set();
      for (let c = 0; c < w; c++) {
        for (let r = h - 1; r >= 0; r--) {
          const i = r * w + c;
          if (!mask[i] || cells[i]) continue;
          let rr = r - 1;
          while (rr >= 0 && !mask[rr * w + c]) rr--;
          if (rr < 0) {
            const p = this._spawnPiece();
            cells[i] = p;
            moved.add(p.id);
            moves.push({ id: p.id, fr: r - 1, fc: c, to: i, p: { t: p.t, c: p.c, sp: p.sp, hp: p.hp } });
          } else {
            const j = rr * w + c;
            const p = cells[j];
            if (p && p.t !== 's' && !moved.has(p.id)) {
              cells[i] = p; cells[j] = null;
              moved.add(p.id);
              moves.push({ id: p.id, fr: rr, fc: c, to: i });
            }
          }
        }
      }
      if (!moves.length) {
        // Diagonal nachrutschen in Zellen, die von oben blockiert sind
        for (let r = h - 1; r >= 1; r--) {
          for (let c = 0; c < w; c++) {
            const i = r * w + c;
            if (!mask[i] || cells[i]) continue;
            const order = (r + c + tick) % 2 ? [-1, 1] : [1, -1];
            for (const dc of order) {
              const cc = c + dc;
              if (cc < 0 || cc >= w) continue;
              const j = (r - 1) * w + cc;
              if (!mask[j]) continue;
              const p = cells[j];
              if (!p || p.t === 's' || moved.has(p.id)) continue;
              cells[i] = p; cells[j] = null;
              moved.add(p.id);
              moves.push({ id: p.id, fr: r - 1, fc: cc, to: i });
              break;
            }
          }
        }
      }
      if (!moves.length) break;
      frames.push(moves);
    }
    if (frames.length) this._push({ type: 'fall', frames });
  }

  _collect() {
    const got = [];
    for (let c = 0; c < this.w; c++) {
      const r = this.exitRow[c];
      if (r < 0) continue;
      const i = r * this.w + c;
      const p = this.cells[i];
      if (p && p.t === 'i') {
        this.cells[i] = null;
        got.push({ i, id: p.id });
        this.itemsCollected++;
      }
    }
    if (!got.length) return false;
    this.score += POINTS.item * got.length;
    this._push({ type: 'collect', items: got });
    return true;
  }

  // ---------- Mischen ----------

  _shuffle(reason) {
    const pos = [], pieces = [];
    for (let i = 0; i < this.size; i++) {
      const p = this.cells[i];
      if (p && p.t === 'g') { pos.push(i); pieces.push(p); }
    }
    let ok = false;
    for (let attempt = 0; attempt < 200 && !ok; attempt++) {
      this.rng.shuffle(pieces);
      pos.forEach((i, k) => { this.cells[i] = pieces[k]; });
      ok = !this._anyMatch() && this.hasMove();
    }
    if (!ok) {
      const plain = new Set(pos.filter((i) => !this.cells[i].sp));
      for (const i of plain) this.cells[i] = null;
      this._fillNoMatch(plain);
    }
    const moves = [];
    for (let i = 0; i < this.size; i++) {
      const p = this.cells[i];
      if (p && p.t === 'g') moves.push({ id: p.id, to: i, c: p.c, sp: p.sp });
    }
    this._push({ type: 'shuffle', reason, moves });
  }
}

/** Ein Spielfeld für den Entspannt-Modus (ohne Ziele, ohne Zuglimit). */
export function zenLevel(seed) {
  const map = [];
  for (let r = 0; r < 8; r++) map.push('........');
  return parseLevel({ map, colors: 5, zen: true, seed, goals: [] }, 0);
}
