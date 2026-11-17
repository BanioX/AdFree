// Eile mit Weile: kurze Runde (zwei Figuren), vier Farben.
// Eine 6 bringt aus dem Haus. Danach geht es 40 Felder im Kreis und
// mit genau passender Zahl ins Haus (vier Felder). Das eigene Startfeld
// ist sicher. Schlagen schickt die Figur nach Hause. Eine 6 gibt einen
// neuen Wurf, höchstens dreimal – der dritte Sechser wird noch gezogen.

export const PLAYERS = 4;
export const PIECES = 2;
export const TRACK = 40;
export const HOME = 4;
export const NAMES = ['Du', 'Blau', 'Gelb', 'Grün'];

export function newGame() {
  return {
    p: Array.from({ length: PLAYERS }, () => Array(PIECES).fill(-1)),
    turn: 0,
    dice: 0,
    face: 0,
    phase: 'roll',
    sixes: 0,
    over: false,
    winner: -1,
    last: null,
  };
}

export function trackIndex(player, steps) {
  return (player * 10 + steps) % TRACK;
}

function spot(player, steps) {
  if (steps < 0) return null;
  if (steps >= TRACK) return { kind: 'home', player, i: steps - TRACK };
  return { kind: 'track', i: trackIndex(player, steps) };
}

function sameSpot(a, b) {
  if (!a || !b || a.kind !== b.kind) return false;
  if (a.kind === 'track') return a.i === b.i;
  return a.player === b.player && a.i === b.i;
}

function findAt(state, where, skip) {
  if (!where) return null;
  for (let pl = 0; pl < PLAYERS; pl++) {
    for (let i = 0; i < PIECES; i++) {
      if (skip && skip.player === pl && skip.piece === i) continue;
      if (sameSpot(spot(pl, state.p[pl][i]), where)) return { player: pl, piece: i };
    }
  }
  return null;
}

function homeClear(state, player, fromSteps, toSteps, self) {
  const start = Math.max(fromSteps + 1, TRACK);
  for (let s = start; s <= toSteps; s++) {
    if (findAt(state, { kind: 'home', player, i: s - TRACK }, self)) return false;
  }
  return true;
}

/** Züge der Figur, die jetzt am Zug ist. Gibt die Figurnummern zurück. */
export function legal(state) {
  if (state.over || state.phase !== 'move' || !state.dice) return [];
  const pl = state.turn;
  const dice = state.dice;
  const out = [];
  for (let i = 0; i < PIECES; i++) {
    const steps = state.p[pl][i];
    const self = { player: pl, piece: i };
    if (steps < 0) {
      if (dice !== 6) continue;
      const occ = findAt(state, { kind: 'track', i: trackIndex(pl, 0) }, self);
      if (occ && occ.player === pl) continue;
      out.push(i);
      continue;
    }
    const target = steps + dice;
    if (target > TRACK + HOME - 1) continue;
    if (steps < TRACK && target >= TRACK) {
      if (!homeClear(state, pl, steps, target, self)) continue;
      out.push(i);
      continue;
    }
    if (steps >= TRACK) {
      if (!homeClear(state, pl, steps, target, self)) continue;
      out.push(i);
      continue;
    }
    const dest = { kind: 'track', i: trackIndex(pl, target) };
    const occ = findAt(state, dest, self);
    if (occ && occ.player === pl) continue;
    if (occ && state.p[occ.player][occ.piece] === 0) continue;
    out.push(i);
  }
  return out;
}

export function roll(state, value) {
  if (state.over || state.phase !== 'roll') return 'wait';
  state.dice = value;
  state.face = value;
  state.phase = 'move';
  if (!legal(state).length) {
    pass(state);
    return 'pass';
  }
  return 'move';
}

function pass(state) {
  state.turn = (state.turn + 1) % PLAYERS;
  state.sixes = 0;
  state.dice = 0;
  state.phase = 'roll';
}

export function move(state, piece) {
  if (!legal(state).includes(piece)) return false;
  const pl = state.turn;
  const steps = state.p[pl][piece];
  const dice = state.dice;
  let capture = null;
  if (steps < 0) {
    capture = findAt(state, { kind: 'track', i: trackIndex(pl, 0) }, { player: pl, piece });
    state.p[pl][piece] = 0;
  } else {
    const target = steps + dice;
    if (target < TRACK) {
      capture = findAt(state, { kind: 'track', i: trackIndex(pl, target) }, { player: pl, piece });
    }
    state.p[pl][piece] = target;
  }
  if (capture) state.p[capture.player][capture.piece] = -1;
  state.last = { player: pl, piece };
  if (state.p[pl].every((s) => s >= TRACK)) {
    state.over = true;
    state.winner = pl;
    state.phase = 'roll';
    state.dice = 0;
    return true;
  }
  const again = dice === 6 && state.sixes < 2;
  if (again) {
    state.sixes += 1;
    state.dice = 0;
    state.phase = 'roll';
  } else pass(state);
  return true;
}

function progress(steps) {
  if (steps < 0) return 0;
  return steps + 1;
}

export function aiPick(state, diff, rng = Math.random) {
  const list = legal(state);
  if (!list.length) return null;
  if (diff === 'leicht') return list[Math.floor(rng() * list.length)];
  const scored = list.map((piece) => {
    const pl = state.turn;
    const steps = state.p[pl][piece];
    const dice = state.dice;
    let s = 0;
    if (steps < 0) s += 28;
    else {
      const target = steps + dice;
      const dest = target < TRACK ? findAt(state, { kind: 'track', i: trackIndex(pl, target) }, { player: pl, piece }) : null;
      if (dest && dest.player !== pl) s += 46;
      if (target >= TRACK) s += 36;
      s += progress(target) - progress(steps);
      if (diff === 'schwer' && target < TRACK && target !== 0) {
        for (let o = 0; o < PLAYERS; o++) {
          if (o === pl) continue;
          const idx = trackIndex(pl, target);
          const own = (idx - o * 10 + TRACK) % TRACK;
          if (own >= 1 && own <= 6) s -= 8;
        }
      }
    }
    return { piece, s };
  });
  scored.sort((a, b) => b.s - a.s);
  if (diff === 'schwer') return scored[0].piece;
  const pool = scored.filter((x) => scored[0].s - x.s <= 12);
  return pool[Math.floor(rng() * pool.length)].piece;
}

export function clone(state) {
  return {
    p: state.p.map((row) => row.slice()),
    turn: state.turn,
    dice: state.dice,
    face: state.face || 0,
    phase: state.phase,
    sixes: state.sixes,
    over: state.over,
    winner: state.winner,
    last: state.last ? { ...state.last } : null,
  };
}
