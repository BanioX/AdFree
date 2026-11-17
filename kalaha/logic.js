// Kalaha. Mensch = 1, Computer = 2.
// Mulden 0–5 und Vorrat 6 gehören dir, Mulden 7–12 und Vorrat 13 dem Computer.
// Gesät wird aufsteigend. Der gegnerische Vorrat wird übersprungen.

export function newGame() {
  const p = Array(14).fill(4);
  p[6] = 0; p[13] = 0;
  return { p, turn: 1, over: false, winner: 0, last: null, extra: false, _u: [] };
}

export function clone(state) {
  return {
    p: state.p.slice(), turn: state.turn, over: state.over, winner: state.winner,
    last: state.last, extra: state.extra, _u: state._u.map((u) => ({ ...u, p: u.p.slice() })),
  };
}

function emptySide(p, start) {
  for (let i = 0; i < 6; i++) if (p[start + i]) return false;
  return true;
}

function finish(state) {
  if (!(emptySide(state.p, 0) || emptySide(state.p, 7))) return false;
  for (let i = 0; i < 6; i++) {
    state.p[6] += state.p[i]; state.p[i] = 0;
    state.p[13] += state.p[7 + i]; state.p[7 + i] = 0;
  }
  state.over = true;
  state.winner = state.p[6] === state.p[13] ? 0 : state.p[6] > state.p[13] ? 1 : 2;
  return true;
}

export function moves(state) {
  if (state.over) return [];
  const start = state.turn === 1 ? 0 : 7;
  const out = [];
  for (let i = 0; i < 6; i++) if (state.p[start + i]) out.push(start + i);
  return out;
}

export function apply(state, pit) {
  const who = state.turn;
  state._u.push({
    p: state.p.slice(), turn: who, over: state.over, winner: state.winner, last: state.last, extra: state.extra,
  });
  let seeds = state.p[pit];
  state.p[pit] = 0;
  let i = pit;
  const skip = who === 1 ? 13 : 6;
  while (seeds > 0) {
    i = (i + 1) % 14;
    if (i === skip) continue;
    state.p[i]++;
    seeds--;
  }
  state.last = i;
  const store = who === 1 ? 6 : 13;
  const ownLo = who === 1 ? 0 : 7;
  const ownHi = who === 1 ? 5 : 12;
  state.extra = i === store;
  if (!state.extra && i >= ownLo && i <= ownHi && state.p[i] === 1) {
    const opp = 12 - i;
    if (state.p[opp] > 0) {
      state.p[store] += state.p[opp] + 1;
      state.p[opp] = 0;
      state.p[i] = 0;
    }
  }
  if (finish(state)) state.turn = who === 1 ? 2 : 1;
  else if (!state.extra) state.turn = who === 1 ? 2 : 1;
}

export function undo(state) {
  const u = state._u.pop();
  if (!u) return;
  state.p = u.p.slice();
  state.turn = u.turn;
  state.over = u.over;
  state.winner = u.winner;
  state.last = u.last;
  state.extra = u.extra;
}

export function outcome(state) {
  if (!state.over) return null;
  return state.winner || 0;
}

export function evaluate(state) {
  const meStore = state.turn === 1 ? 6 : 13;
  const opStore = state.turn === 1 ? 13 : 6;
  const meLo = state.turn === 1 ? 0 : 7;
  const opLo = state.turn === 1 ? 7 : 0;
  let mine = 0; let opp = 0;
  for (let i = 0; i < 6; i++) { mine += state.p[meLo + i]; opp += state.p[opLo + i]; }
  return (state.p[meStore] - state.p[opStore]) * 10 + (mine - opp);
}

export function rank(state, pit) {
  return state.p[pit];
}

export function aiOptions(difficulty) {
  return {
    clone, moves, apply, undo, evaluate, outcome, rank, difficulty,
    depth: { leicht: 2, mittel: 6, schwer: 10 },
    noise: { leicht: 0.45, mittel: 0.04, schwer: 0 },
    time: { leicht: 40, mittel: 160, schwer: 380 },
  };
}
