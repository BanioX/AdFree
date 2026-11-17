// Reversi. Mensch = 1 (schwarz, beginnt), Computer = 2 (weiss).

export const N = 8;
const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

const WEIGHT = [
  120, -25, 20, 5, 5, 20, -25, 120,
  -25, -40, -5, -5, -5, -5, -40, -25,
  20, -5, 15, 3, 3, 15, -5, 20,
  5, -5, 3, 3, 3, 3, -5, 5,
  5, -5, 3, 3, 3, 3, -5, 5,
  20, -5, 15, 3, 3, 15, -5, 20,
  -25, -40, -5, -5, -5, -5, -40, -25,
  120, -25, 20, 5, 5, 20, -25, 120,
];

export function newGame() {
  const cells = Array(64).fill(0);
  cells[27] = 2; cells[28] = 1; cells[35] = 1; cells[36] = 2;
  return { cells, turn: 1, over: false, winner: 0, last: null, passed: false, _u: [] };
}

export function clone(state) {
  return {
    cells: state.cells.slice(), turn: state.turn, over: state.over, winner: state.winner,
    last: state.last, passed: state.passed, _u: state._u.slice(),
  };
}

export function flipsFor(cells, idx, who) {
  if (cells[idx]) return [];
  const opp = who === 1 ? 2 : 1;
  const r = (idx / N) | 0;
  const c = idx % N;
  const out = [];
  for (const [dr, dc] of DIRS) {
    const line = [];
    let rr = r + dr;
    let cc = c + dc;
    while (rr >= 0 && rr < N && cc >= 0 && cc < N && cells[rr * N + cc] === opp) {
      line.push(rr * N + cc);
      rr += dr; cc += dc;
    }
    if (line.length && rr >= 0 && rr < N && cc >= 0 && cc < N && cells[rr * N + cc] === who) out.push(...line);
  }
  return out;
}

function hasMove(cells, who) {
  for (let i = 0; i < 64; i++) if (flipsFor(cells, i, who).length) return true;
  return false;
}

export function moves(state) {
  if (state.over) return [];
  const out = [];
  for (let i = 0; i < 64; i++) if (flipsFor(state.cells, i, state.turn).length) out.push(i);
  return out;
}

export function counts(state) {
  let a = 0; let b = 0;
  for (const v of state.cells) { if (v === 1) a++; else if (v === 2) b++; }
  return [a, b];
}

export function apply(state, idx) {
  const who = state.turn;
  const flips = flipsFor(state.cells, idx, who);
  state._u.push({
    idx, flips, turn: who, over: state.over, winner: state.winner, last: state.last, passed: state.passed,
  });
  state.cells[idx] = who;
  for (const f of flips) state.cells[f] = who;
  state.last = idx;
  const opp = who === 1 ? 2 : 1;
  const oppCan = hasMove(state.cells, opp);
  const selfCan = hasMove(state.cells, who);
  state.passed = !oppCan && selfCan;
  if (oppCan) state.turn = opp;
  else if (selfCan) state.turn = who;
  else {
    state.over = true;
    state.turn = opp;
    const [a, b] = counts(state);
    state.winner = a === b ? 0 : a > b ? 1 : 2;
  }
}

export function undo(state) {
  const u = state._u.pop();
  if (!u) return;
  const opp = u.turn === 1 ? 2 : 1;
  state.cells[u.idx] = 0;
  for (const f of u.flips) state.cells[f] = opp;
  state.turn = u.turn;
  state.over = u.over;
  state.winner = u.winner;
  state.last = u.last;
  state.passed = u.passed;
}

export function outcome(state) {
  if (!state.over) return null;
  return state.winner || 0;
}

export function evaluate(state) {
  const me = state.turn;
  const opp = me === 1 ? 2 : 1;
  let pos = 0; let mine = 0; let theirs = 0;
  for (let i = 0; i < 64; i++) {
    if (state.cells[i] === me) { pos += WEIGHT[i]; mine++; }
    else if (state.cells[i] === opp) { pos -= WEIGHT[i]; theirs++; }
  }
  let mm = 0; let mo = 0;
  for (let i = 0; i < 64; i++) {
    if (flipsFor(state.cells, i, me).length) mm++;
    if (flipsFor(state.cells, i, opp).length) mo++;
  }
  const empty = 64 - mine - theirs;
  const disc = empty < 16 ? (mine - theirs) * 6 : 0;
  return pos + (mm - mo) * 8 + disc;
}

export function rank(state, idx) {
  const r = (idx / N) | 0;
  const c = idx % N;
  const corner = (r === 0 || r === 7) && (c === 0 || c === 7);
  const edge = r === 0 || r === 7 || c === 0 || c === 7;
  return (corner ? 80 : edge ? 12 : 0) + flipsFor(state.cells, idx, state.turn).length;
}

export function aiOptions(difficulty) {
  return {
    clone, moves, apply, undo, evaluate, outcome, rank, difficulty,
    depth: { leicht: 1, mittel: 3, schwer: 5 },
    noise: { leicht: 0.5, mittel: 0.04, schwer: 0 },
    time: { leicht: 30, mittel: 180, schwer: 420 },
  };
}
