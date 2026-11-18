// Schiffe versenken. Flotte 5, 4, 3, 3, 2. Schiffe dürfen sich nicht berühren.
// Ein Treffer gibt einen weiteren Schuss. Wer alle gegnerischen Schiffe versenkt, gewinnt.

export const N = 10;
export const FLEET = [5, 4, 3, 3, 2];

function blank() {
  return Array(N * N).fill(0);
}

export function newGame() {
  return {
    phase: 'place',
    dir: 'h',
    next: 0,
    me: blank(),
    meShips: [],
    foe: blank(),
    foeShips: [],
    seen: blank(),
    echo: blank(),
    turn: 1,
    over: false,
    winner: 0,
    last: null,
    extra: false,
  };
}

export function cellsFor(len, r, c, dir) {
  const cells = [];
  for (let k = 0; k < len; k++) {
    const rr = r + (dir === 'v' ? k : 0);
    const cc = c + (dir === 'h' ? k : 0);
    if (rr < 0 || cc < 0 || rr >= N || cc >= N) return null;
    cells.push(rr * N + cc);
  }
  return cells;
}

export function canPlace(grid, len, r, c, dir) {
  const cells = cellsFor(len, r, c, dir);
  if (!cells) return null;
  const own = new Set(cells);
  for (const i of cells) {
    if (grid[i]) return null;
    const r0 = Math.floor(i / N);
    const c0 = i % N;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const rr = r0 + dr;
        const cc = c0 + dc;
        if (rr < 0 || cc < 0 || rr >= N || cc >= N) continue;
        const j = rr * N + cc;
        if (grid[j] && !own.has(j)) return null;
      }
    }
  }
  return cells;
}

export function placeShip(grid, ships, len, r, c, dir) {
  const cells = canPlace(grid, len, r, c, dir);
  if (!cells) return false;
  const id = ships.length + 1;
  for (const i of cells) grid[i] = id;
  ships.push({ id, len, cells, hits: 0 });
  return true;
}

export function placeFleet(rng) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const grid = blank();
    const ships = [];
    let ok = true;
    for (const len of FLEET) {
      let done = false;
      for (let t = 0; t < 300 && !done; t++) {
        const dir = rng() < 0.5 ? 'h' : 'v';
        const r = Math.floor(rng() * N);
        const c = Math.floor(rng() * N);
        done = placeShip(grid, ships, len, r, c, dir);
      }
      if (!done) { ok = false; break; }
    }
    if (ok) return { grid, ships };
  }
  return null;
}

export function begin(state, foe) {
  state.foe = foe.grid;
  state.foeShips = foe.ships;
  state.phase = 'fight';
  state.turn = 1;
  state.extra = false;
}

/** Schuss auf das gegnerische Wasser. side 1 schiesst auf foe, side 2 auf me. */
export function shoot(state, i) {
  const side = state.turn;
  const seen = side === 1 ? state.seen : state.echo;
  const grid = side === 1 ? state.foe : state.me;
  const ships = side === 1 ? state.foeShips : state.meShips;
  if (state.over || state.phase !== 'fight' || seen[i]) return null;
  const id = grid[i];
  state.last = { side, i, hit: !!id };
  if (!id) {
    seen[i] = 1;
    state.turn = side === 1 ? 2 : 1;
    state.extra = false;
    return { hit: false, sunk: false };
  }
  seen[i] = 2;
  const ship = ships[id - 1];
  ship.hits += 1;
  const sunk = ship.hits === ship.len;
  if (sunk) for (const c of ship.cells) seen[c] = 3;
  const all = ships.every((s) => s.hits === s.len);
  if (all) {
    state.over = true;
    state.winner = side;
    state.extra = false;
  } else {
    state.extra = true;
  }
  return { hit: true, sunk, all };
}

function unknownHits(seen) {
  const hits = [];
  for (let i = 0; i < seen.length; i++) if (seen[i] === 2) hits.push(i);
  return hits;
}

function neighbors(i) {
  const r = Math.floor(i / N);
  const c = i % N;
  const out = [];
  if (r > 0) out.push(i - N);
  if (r < N - 1) out.push(i + N);
  if (c > 0) out.push(i - 1);
  if (c < N - 1) out.push(i + 1);
  return out;
}

function remainingLengths(ships) {
  return ships.filter((s) => s.hits < s.len).map((s) => s.len);
}

function heat(seen, ships) {
  const score = Array(N * N).fill(0);
  const hits = unknownHits(seen);
  const lens = remainingLengths(ships);
  for (const len of lens) {
    for (const dir of ['h', 'v']) {
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          const cells = cellsFor(len, r, c, dir);
          if (!cells) continue;
          let bad = false;
          let covers = 0;
          for (const i of cells) {
            if (seen[i] === 1 || seen[i] === 3) { bad = true; break; }
            if (seen[i] === 2) covers += 1;
          }
          if (bad) continue;
          if (hits.length && !covers) continue;
          for (const i of cells) if (!seen[i]) score[i] += 1 + covers * 4;
        }
      }
    }
  }
  return score;
}

export function aiShot(state, diff, rng = Math.random, who = 2) {
  const seen = who === 2 ? state.echo : state.seen;
  const ships = who === 2 ? state.meShips : state.foeShips;
  const hits = unknownHits(seen);
  const open = [];
  for (let i = 0; i < seen.length; i++) if (!seen[i]) open.push(i);
  if (!open.length) return null;
  if (diff === 'schwer') {
    const score = heat(seen, ships);
    let best = -1;
    const pool = [];
    for (const i of open) {
      if (score[i] > best) { best = score[i]; pool.length = 0; }
      if (score[i] === best) pool.push(i);
    }
    return pool[Math.floor(rng() * pool.length)];
  }
  if (hits.length) {
    const around = [];
    for (const h of hits) for (const n of neighbors(h)) if (!seen[n]) around.push(n);
    const line = [];
    for (const h of hits) {
      const r = Math.floor(h / N);
      const c = h % N;
      if (c > 0 && seen[h - 1] === 2 && c < N - 1 && !seen[h + 1]) line.push(h + 1);
      if (c < N - 1 && seen[h + 1] === 2 && c > 0 && !seen[h - 1]) line.push(h - 1);
      if (r > 0 && seen[h - N] === 2 && r < N - 1 && !seen[h + N]) line.push(h + N);
      if (r < N - 1 && seen[h + N] === 2 && r > 0 && !seen[h - N]) line.push(h - N);
    }
    const pool = (diff !== 'leicht' && line.length) ? line : (around.length ? around : open);
    return pool[Math.floor(rng() * pool.length)];
  }
  if (diff === 'mittel') {
    const parity = open.filter((i) => (Math.floor(i / N) + (i % N)) % 2 === 0);
    const pool = parity.length ? parity : open;
    return pool[Math.floor(rng() * pool.length)];
  }
  return open[Math.floor(rng() * open.length)];
}

export function clone(state) {
  const copyShips = (list) => list.map((s) => ({ ...s, cells: s.cells.slice() }));
  return {
    ...state,
    me: state.me.slice(),
    foe: state.foe.slice(),
    seen: state.seen.slice(),
    echo: state.echo.slice(),
    meShips: copyShips(state.meShips),
    foeShips: copyShips(state.foeShips),
    last: state.last ? { ...state.last } : null,
  };
}
