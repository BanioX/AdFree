// Fünf in einer Reihe. Mensch = 1 (schwarz), Computer = 2 (weiss).

export const N = 13;

const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];

export function newGame() {
  return {
    cells: Array(N * N).fill(0), turn: 1, n: 0, over: false, winner: 0, last: null, line: null, _u: [],
  };
}

export function clone(state) {
  return {
    cells: state.cells.slice(), turn: state.turn, n: state.n, over: state.over, winner: state.winner,
    last: state.last, line: state.line ? state.line.slice() : null, _u: state._u.slice(),
  };
}

function ray(cells, i, who, dr, dc) {
  const r0 = (i / N) | 0;
  const c0 = i % N;
  let n = 0;
  let open = false;
  let rr = r0 + dr;
  let cc = c0 + dc;
  while (rr >= 0 && rr < N && cc >= 0 && cc < N && cells[rr * N + cc] === who) {
    n++; rr += dr; cc += dc;
  }
  if (rr >= 0 && rr < N && cc >= 0 && cc < N && cells[rr * N + cc] === 0) open = true;
  return { n, open };
}

export function winLine(cells, i, who) {
  for (const [dr, dc] of DIRS) {
    const a = ray(cells, i, who, dr, dc);
    const b = ray(cells, i, who, -dr, -dc);
    if (1 + a.n + b.n >= 5) {
      const line = [i];
      const r0 = (i / N) | 0;
      const c0 = i % N;
      for (const s of [1, -1]) {
        let rr = r0 + dr * s;
        let cc = c0 + dc * s;
        while (rr >= 0 && rr < N && cc >= 0 && cc < N && cells[rr * N + cc] === who) {
          line.push(rr * N + cc);
          rr += dr * s; cc += dc * s;
        }
      }
      return line;
    }
  }
  return null;
}

function candidates(state) {
  const set = new Set();
  let any = false;
  for (let i = 0; i < state.cells.length; i++) {
    if (!state.cells[i]) continue;
    any = true;
    const r = (i / N) | 0;
    const c = i % N;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      const rr = r + dr; const cc = c + dc;
      if (rr < 0 || cc < 0 || rr >= N || cc >= N) continue;
      const j = rr * N + cc;
      if (!state.cells[j]) set.add(j);
    }
  }
  if (!any) return [((N / 2) | 0) * N + ((N / 2) | 0)];
  return [...set];
}

function threat(cells, i, who) {
  let s = 0;
  cells[i] = who;
  for (const [dr, dc] of DIRS) {
    const a = ray(cells, i, who, dr, dc);
    const b = ray(cells, i, who, -dr, -dc);
    const n = 1 + a.n + b.n;
    const open = (a.open ? 1 : 0) + (b.open ? 1 : 0);
    if (n >= 5) s += 50000;
    else if (n === 4 && open === 2) s += 8000;
    else if (n === 4 && open === 1) s += 1200;
    else if (n === 3 && open === 2) s += 400;
    else if (n === 3 && open === 1) s += 60;
    else if (n === 2 && open === 2) s += 30;
    else if (n === 2) s += 8;
  }
  cells[i] = 0;
  return s;
}

function quick(state, i) {
  const who = state.turn;
  const opp = who === 1 ? 2 : 1;
  state.cells[i] = who;
  const win = winLine(state.cells, i, who);
  state.cells[i] = opp;
  const block = winLine(state.cells, i, opp);
  state.cells[i] = 0;
  if (win) return 1e9;
  if (block) return 1e8;
  return threat(state.cells, i, who) + threat(state.cells, i, opp) * 1.15;
}

export function moves(state) {
  if (state.over) return [];
  const scored = candidates(state).map((i) => ({ i, s: quick(state, i) }));
  scored.sort((a, b) => b.s - a.s);
  const must = scored.filter((x) => x.s >= 1e8).map((x) => x.i);
  const top = scored.slice(0, 8).map((x) => x.i);
  return [...new Set([...must, ...top])];
}

export function apply(state, i) {
  const who = state.turn;
  state._u.push({ i, turn: who, n: state.n, over: state.over, winner: state.winner, last: state.last, line: state.line });
  state.cells[i] = who;
  state.n++;
  state.last = i;
  const line = winLine(state.cells, i, who);
  state.turn = who === 1 ? 2 : 1;
  if (line) { state.over = true; state.winner = who; state.line = line; }
  else if (state.n >= N * N) { state.over = true; state.winner = 0; state.line = null; }
  else state.line = null;
}

export function undo(state) {
  const u = state._u.pop();
  if (!u) return;
  state.cells[u.i] = 0;
  state.turn = u.turn;
  state.n = u.n;
  state.over = u.over;
  state.winner = u.winner;
  state.last = u.last;
  state.line = u.line;
}

export function outcome(state) {
  if (!state.over) return null;
  return state.winner || 0;
}

export function evaluate(state) {
  const me = state.turn;
  const opp = me === 1 ? 2 : 1;
  let s = 0;
  for (const i of candidates(state)) {
    s += threat(state.cells, i, me);
    s -= threat(state.cells, i, opp) * 1.1;
  }
  if (s > 20000) return 20000;
  if (s < -20000) return -20000;
  return s;
}

export function rank(state, i) {
  return quick(state, i);
}

export function aiOptions(difficulty) {
  return {
    clone, moves, apply, undo, evaluate, outcome, rank, difficulty,
    depth: { leicht: 2, mittel: 2, schwer: 3 },
    noise: { leicht: 0.4, mittel: 0.05, schwer: 0 },
    time: { leicht: 40, mittel: 160, schwer: 380 },
  };
}
