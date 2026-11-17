// Abenteuer-Level: handgemachte (data/levels.js) + unendlich viele erzeugte.
// Jedes erzeugte Level wird vom Computer-Spieler durchgespielt: nur lösbare Level werden genommen,
// und seine Zugzahl bestimmt die Sterne-Grenzen. Rein logisch, deterministisch.

import { handcrafted, cycle, curve } from '../data/levels.js';
import { worlds, LEVELS_PER_WORLD } from '../data/worlds.js';
import { pictures } from '../data/pictures.js';
import { GEM_KEYS } from '../data/skins.js';
import { Board, GEM_BLOCK_COLOR } from './board.js';
import { Rng } from './rng.js';
import { catalog } from './shapes.js';
import { Game } from './game.js';
import { simulate } from './bot.js';

export const HANDCRAFTED = handcrafted.length;
export const BASE_LEVELS = worlds.length * LEVELS_PER_WORLD; // 240 – danach geht es endlos weiter
const MAX_BOT_MOVES = 170;

const ROMAN = ['', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X'];

/** Welt zu Level n: { index, cycle, data, title, first, last } */
export function worldOf(n) {
  const index = Math.floor((n - 1) / LEVELS_PER_WORLD);
  const data = worlds[index % worlds.length];
  const round = Math.floor(index / worlds.length);
  return {
    index,
    data,
    title: data.title + (ROMAN[round] ?? ` ${round + 1}`),
    first: index * LEVELS_PER_WORLD + 1,
    last: (index + 1) * LEVELS_PER_WORLD,
  };
}

function primaryType(goals) {
  if (goals.picture) return 'picture';
  if (goals.gems) return 'gems';
  if (goals.lines) return 'lines';
  return 'score';
}

/** Haupt-Ziel eines Levels (schnell, ohne das Level zu erzeugen). */
export function goalTypeOf(n) {
  if (n <= HANDCRAFTED) return primaryType(handcrafted[n - 1].goals);
  return cycle[(n - 1) % cycle.length];
}

const usedByHandcrafted = new Set(handcrafted.map((l) => l.goals.picture).filter(Boolean));
const proceduralPictures = pictures.filter((p) => !usedByHandcrafted.has(p.id));

/** Bild für ein Bild-Level (erzeugte Level bekommen die Bilder der Reihe nach). */
export function pictureOf(n) {
  if (n <= HANDCRAFTED) return handcrafted[n - 1].goals.picture || null;
  if (goalTypeOf(n) !== 'picture') return null;
  let k = 0;
  for (let i = HANDCRAFTED + 1; i < n; i++) if (goalTypeOf(i) === 'picture') k++;
  return proceduralPictures[k % proceduralPictures.length].id;
}

/** Schwierigkeit 0..1 eines erzeugten Levels. */
export function difficultyOf(n) {
  const t = Math.max(0, Math.min(1, (n - HANDCRAFTED - 1) / (curve.endLevel - HANDCRAFTED - 1)));
  const k = (n - 1) % LEVELS_PER_WORLD;
  const wave = curve.wave * (k / (LEVELS_PER_WORLD - 1) - 0.5);
  return Math.max(0, Math.min(1, curve.start + (curve.end - curve.start) * t + wave));
}

export function sizeOf(n) {
  if (n <= HANDCRAFTED) return handcrafted[n - 1].size || 8;
  return n >= curve.bigBoardFrom && n % 5 === 0 ? 10 : 8;
}

// ---------- Erzeugung ----------

function emptyGrid(n) { return Array.from({ length: n }, () => new Array(n).fill('.')); }

function colorPicker(rng) {
  const cols = rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8]).slice(0, rng.int(2, 3));
  const mode = rng.int(0, 2); // 0: pro Zeile, 1: pro Spalte, 2: gemischt
  return (r, c) => String(mode === 0 ? cols[r % cols.length] : mode === 1 ? cols[c % cols.length] : rng.pick(cols));
}

const PATTERNS = {
  scatter(g, n, rng, dens, col) {
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (rng.chance(dens)) g[r][c] = col(r, c);
  },
  mirror(g, n, rng, dens, col) {
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n / 2; c++) {
        if (rng.chance(dens)) { const ch = col(r, c); g[r][c] = ch; g[r][n - 1 - c] = ch; }
      }
    }
  },
  garbage(g, n, rng, dens, col) {
    const k = Math.max(2, Math.round(n * dens * 1.3));
    for (let r = n - k; r < n; r++) {
      const holes = new Set([rng.int(0, n - 1), rng.int(0, n - 1)]);
      for (let c = 0; c < n; c++) if (!holes.has(c)) g[r][c] = col(r, c);
    }
  },
  pillars(g, n, rng, dens, col) {
    const step = rng.int(2, 3);
    const off = rng.int(0, step - 1);
    for (let c = off; c < n; c += step) {
      const hgt = rng.int(2, Math.max(2, Math.round(n * dens * 1.8)));
      for (let r = n - hgt; r < n; r++) g[r][c] = col(r, c);
    }
  },
  frame(g, n, rng, dens, col) {
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const edge = r === 0 || c === 0 || r === n - 1 || c === n - 1;
        if (edge && rng.chance(0.35 + dens)) g[r][c] = col(r, c);
      }
    }
  },
  diamond(g, n, rng, dens, col) {
    const k = Math.max(1, Math.round(n * dens * 0.9));
    const m = (n - 1) / 2;
    const hollow = rng.chance(0.5);
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const d = Math.abs(r - m) + Math.abs(c - m);
        if (d <= k + 0.5 && !(hollow && d < k - 0.5)) g[r][c] = col(r, c);
      }
    }
  },
  stairs(g, n, rng, dens, col) {
    const flip = rng.chance(0.5);
    const k = Math.round(n * (1 - dens * 1.2));
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const cc = flip ? n - 1 - c : c;
        if (r - cc >= k - 2 && rng.chance(0.85)) g[r][c] = col(r, c);
      }
    }
  },
  islands(g, n, rng, dens, col) {
    const count = Math.max(2, Math.round(dens * 10));
    for (let i = 0; i < count; i++) {
      const r = rng.int(0, n - 2), c = rng.int(0, n - 2);
      const ch = col(r, c);
      g[r][c] = ch; g[r + 1][c] = ch; g[r][c + 1] = ch;
      if (rng.chance(0.5)) g[r + 1][c + 1] = ch;
    }
  },
  checker(g, n, rng, dens, col) {
    const s = Math.max(2, Math.round(n * dens));
    const r0 = rng.int(0, n - s), c0 = rng.int(0, n - s);
    for (let r = r0; r < r0 + s; r++) for (let c = c0; c < c0 + s; c++) if ((r + c) % 2 === 0) g[r][c] = col(r, c);
  },
};

const COVER_MASKS = {
  all: () => true,
  bottom: (r, c, n) => r >= n / 2,
  top: (r, c, n) => r < n / 2,
  center: (r, c, n) => r >= 1 && c >= 1 && r < n - 1 && c < n - 1,
  circle: (r, c, n) => Math.hypot(r - (n - 1) / 2, c - (n - 1) / 2) <= n / 2 - 0.3,
  diamond: (r, c, n) => Math.abs(r - (n - 1) / 2) + Math.abs(c - (n - 1) / 2) <= n / 2 + 0.5,
  heart: (r, c, n) => {
    const x = (c - (n - 1) / 2) / (n / 2.1), y = -(r - (n - 1) / 2) / (n / 2.1) + 0.15;
    const a = x * x + y * y - 1;
    return a * a * a - x * x * y * y * y <= 0.02;
  },
};

/** Entfernt volle Linien, indem zufällig Steine herausgenommen werden. */
function breakFullLines(g, n, rng) {
  for (let guard = 0; guard < 100; guard++) {
    let changed = false;
    for (let r = 0; r < n; r++) {
      if (g[r].every((ch) => ch !== '.')) { g[r][rng.int(0, n - 1)] = '.'; changed = true; }
    }
    for (let c = 0; c < n; c++) {
      let full = true;
      for (let r = 0; r < n; r++) if (g[r][c] === '.') { full = false; break; }
      if (full) { g[rng.int(0, n - 1)][c] = '.'; changed = true; }
    }
    if (!changed) return;
  }
}

function round50(x) { return Math.max(50, Math.round(x / 50) * 50); }

/** Erzeugt einen Level-Kandidaten (ohne Prüfung). */
function makeCandidate(n, attempt) {
  const rng = new Rng(`blocks-level-${n}-${attempt}`);
  const size = sizeOf(n);
  const type = goalTypeOf(n);
  const ease = Math.min(0.75, attempt * 0.13); // spätere Versuche werden leichter
  const d = difficultyOf(n) * (1 - ease);
  const g = emptyGrid(size);
  const col = colorPicker(rng);

  // Muster der vorgegebenen Steine
  const patternNames = type === 'picture'
    ? ['none', 'none', 'islands', 'frame', 'mirror', 'pillars']
    : ['scatter', 'mirror', 'garbage', 'pillars', 'frame', 'diamond', 'stairs', 'islands', ...(d > 0.5 ? ['checker'] : [])];
  const pattern = rng.pick(patternNames);
  const dens = (type === 'picture' ? 0.06 : 0.1) + d * (type === 'picture' ? 0.14 : 0.24);
  if (pattern !== 'none') PATTERNS[pattern](g, size, rng, dens, col);
  breakFullLines(g, size, rng);

  const goals = {};
  let coverRows = null;

  if (type === 'gems' || (type === 'picture' && d > 0.45 && rng.chance(0.3))) {
    const count = Math.round((type === 'gems' ? 3 + d * 9 : 2 + d * 3) * (size === 10 ? 1.3 : 1));
    const kinds = rng.shuffle(GEM_KEYS.slice()).slice(0, Math.min(4, 1 + (d > 0.2) + (d > 0.5) + (d > 0.8)));
    const filled = [];
    const empty = [];
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) (g[r][c] === '.' ? empty : filled).push([r, c]);
    rng.shuffle(filled);
    rng.shuffle(empty);
    const spots = [...filled.slice(0, Math.ceil(count * 0.6)), ...empty].slice(0, count);
    spots.forEach(([r, c], i) => { g[r][c] = kinds[i % kinds.length]; });
    breakFullLines(g, size, rng);
    goals.gems = true;
  }
  if (type === 'picture') {
    const masks = d < 0.25 ? ['bottom', 'top', 'center', 'circle', 'heart', 'diamond'] : ['all', 'all', 'center', 'circle', 'heart', 'diamond'];
    const m = size === 10 && d > 0.3 ? 'all' : rng.pick(masks);
    coverRows = [];
    for (let r = 0; r < size; r++) {
      let line = '';
      for (let c = 0; c < size; c++) line += COVER_MASKS[m](r, c, size) ? 'x' : '.';
      coverRows.push(line);
    }
    goals.picture = pictureOf(n);
  }
  if (type === 'lines') goals.lines = Math.round((4 + d * 14) * (size === 10 ? 0.9 : 1));
  if (type === 'score') goals.score = round50((220 + d * 1100) * (size === 10 ? 1.2 : 1));
  if (type === 'gems' && d > 0.35 && rng.chance(0.35)) goals.score = round50((150 + d * 700));
  if (type === 'lines' && d > 0.4 && rng.chance(0.3)) goals.score = round50((200 + d * 600));

  const rows = g.map((line) => line.join(''));
  const board = Board.fromLayout(size, rows, coverRows);
  // Edelsteine nur auf Steinen – fromLayout setzt sie automatisch auf einen passenden Stein.
  return {
    n,
    size,
    seed: `blocks-L${n}-${attempt}`,
    title: null,
    type,
    pattern,
    board: board.serialize(),
    goals,
    gen: { d: Math.min(1, 0.12 + d * 0.85), fair: 1 - d * 0.12, assist: Math.max(0.12, 0.35 - d * 0.2) },
    start: null,
  };
}

function fromHandcrafted(n) {
  const def = handcrafted[n - 1];
  const size = def.size || 8;
  const board = Board.fromLayout(size, def.board, def.cover || null);
  const cat = catalog();
  const start = def.start ? def.start.map((s) => { const v = cat.find(s); return v ? v.key : null; }).filter(Boolean) : null;
  const d = def.d ?? 0.2;
  return {
    n,
    size,
    seed: `blocks-L${n}`,
    title: def.title || null,
    type: primaryType(def.goals),
    pattern: 'hand',
    board: board.serialize(),
    goals: { ...def.goals },
    gen: { d, fair: 1, assist: 0.35 },
    start,
  };
}

/** Sterne-Grenzen aus der Zugzahl des Computer-Spielers. */
export function parFromBot(moves) {
  return { three: Math.ceil(moves * 1.15) + 1, two: Math.ceil(moves * 1.6) + 3 };
}

const cache = new Map();

/** Liefert Level n (geprüft, mit Sterne-Grenzen). Ergebnis wird zwischengespeichert. */
export function getLevel(n) {
  n = Math.max(1, Math.floor(n));
  if (cache.has(n)) return cache.get(n);
  let level = null;
  if (n <= HANDCRAFTED) {
    level = fromHandcrafted(n);
    const sim = simulate(Game.fromLevel(level), MAX_BOT_MOVES);
    level.bot = sim.won ? sim.moves : MAX_BOT_MOVES;
    level.verified = sim.won;
  } else {
    for (let attempt = 0; attempt < 7; attempt++) {
      const cand = makeCandidate(n, attempt);
      const sim = simulate(Game.fromLevel(cand), MAX_BOT_MOVES);
      if (sim.won && sim.moves >= 2) {
        level = cand;
        level.bot = sim.moves;
        level.verified = true;
        level.attempt = attempt;
        break;
      }
    }
    if (!level) {
      // Notfall: sehr leichte Variante
      const cand = makeCandidate(n, 6);
      cand.board = new Board(cand.size).serialize();
      if (cand.goals.gems || cand.goals.picture) {
        const rows = Array.from({ length: cand.size }, (_, r) => (r === cand.size - 1 ? 'r'.repeat(cand.size - 2) + '..' : '.'.repeat(cand.size)));
        cand.board = Board.fromLayout(cand.size, rows, cand.goals.picture ? 'all' : null).serialize();
        if (!cand.goals.gems && cand.board) cand.board = Board.fromLayout(cand.size, Array(cand.size).fill(''), 'all').serialize();
      }
      if (cand.goals.score) cand.goals.score = 200;
      if (cand.goals.lines) cand.goals.lines = 3;
      cand.gen = { d: 0.1, fair: 1, assist: 0.4 };
      const sim = simulate(Game.fromLevel(cand), MAX_BOT_MOVES);
      level = cand;
      level.bot = sim.won ? sim.moves : 60;
      level.verified = sim.won;
      level.attempt = 99;
    }
  }
  level.world = worldOf(n).index;
  level.par = parFromBot(level.bot);
  cache.set(n, level);
  return level;
}

/** Kurzbeschreibung des Ziels (für Karten, Überschriften). */
export function goalLabel(type) {
  return { gems: 'Edelsteine sammeln', picture: 'Bild aufdecken', lines: 'Linien abräumen', score: 'Punkte sammeln' }[type] || '';
}
