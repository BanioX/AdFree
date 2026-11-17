// Vier in einer Reihe – Regeln. Mensch = 1, Computer = 2.
// Zustand: cells[42] zeilenweise von unten (Zeile 0 = unten), h[7] Füllhöhen.

export const COLS = 7;
export const ROWS = 6;

const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];

export function newGame() {
  return {
    cells: Array(ROWS * COLS).fill(0),
    h: Array(COLS).fill(0),
    turn: 1,
    n: 0,
    over: false,
    winner: 0,
    last: null,
    line: null,
    _u: [],
  };
}

export function clone(state) {
  return {
    cells: state.cells.slice(),
    h: state.h.slice(),
    turn: state.turn,
    n: state.n,
    over: state.over,
    winner: state.winner,
    last: state.last ? { r: state.last.r, c: state.last.c } : null,
    line: state.line ? state.line.map((p) => p.slice()) : null,
    _u: state._u.slice(),
  };
}

function at(state, r, c) {
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return 0;
  return state.cells[r * COLS + c];
}

/** Gewinnlinie durch den Stein bei (r, c), sonst null. */
export function winningLine(state, r, c) {
  const p = at(state, r, c);
  if (!p) return null;
  for (const [dr, dc] of DIRS) {
    const line = [[r, c]];
    for (const s of [1, -1]) {
      let rr = r + dr * s;
      let cc = c + dc * s;
      while (at(state, rr, cc) === p) {
        line.push([rr, cc]);
        rr += dr * s;
        cc += dc * s;
      }
    }
    if (line.length >= 4) return line;
  }
  return null;
}

export function moves(state) {
  if (state.over) return [];
  const out = [];
  for (let c = 0; c < COLS; c++) if (state.h[c] < ROWS) out.push(c);
  return out;
}

export function apply(state, col) {
  const r = state.h[col]++;
  const who = state.turn;
  state.cells[r * COLS + col] = who;
  state.n++;
  state._u.push({
    c: col, r, last: state.last, over: state.over, winner: state.winner, line: state.line,
  });
  state.last = { r, c: col };
  state.turn = who === 1 ? 2 : 1;
  const line = winningLine(state, r, col);
  if (line) {
    state.over = true;
    state.winner = who;
    state.line = line;
  } else if (state.n >= ROWS * COLS) {
    state.over = true;
    state.winner = 0;
    state.line = null;
  } else {
    state.over = false;
    state.winner = 0;
    state.line = null;
  }
}

export function undo(state) {
  const u = state._u.pop();
  if (!u) return;
  state.cells[u.r * COLS + u.c] = 0;
  state.h[u.c]--;
  state.n--;
  state.turn = state.turn === 1 ? 2 : 1;
  state.last = u.last;
  state.over = u.over;
  state.winner = u.winner;
  state.line = u.line;
}

export function outcome(state) {
  if (!state.over) return null;
  return state.winner || 0;
}

function windowScore(mine) {
  if (mine === 1) return 1;
  if (mine === 2) return 8;
  if (mine === 3) return 40;
  if (mine >= 4) return 400;
  return 0;
}

function scoreSide(state, p) {
  let s = 0;
  const opp = p === 1 ? 2 : 1;
  const take = (r, c, dr, dc) => {
    let mine = 0;
    let other = 0;
    for (let k = 0; k < 4; k++) {
      const v = at(state, r + dr * k, c + dc * k);
      if (v === p) mine++;
      else if (v === opp) other++;
    }
    if (!other) s += windowScore(mine);
  };
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (c <= 3) take(r, c, 0, 1);
      if (r <= 2) take(r, c, 1, 0);
      if (r <= 2 && c <= 3) take(r, c, 1, 1);
      if (r <= 2 && c >= 3) take(r, c, 1, -1);
    }
  }
  for (let r = 0; r < ROWS; r++) if (at(state, r, 3) === p) s += 4;
  return s;
}

/** Bewertung aus Sicht der Seite, die am Zug ist. */
export function evaluate(state) {
  const me = state.turn;
  const opp = me === 1 ? 2 : 1;
  return scoreSide(state, me) - scoreSide(state, opp);
}

const CENTER = [0, 2, 4, 7, 4, 2, 0];

export function rank(state, col) {
  let bonus = 0;
  const r = state.h[col];
  const who = state.turn;
  state.cells[r * COLS + col] = who;
  if (winningLine(state, r, col)) bonus = 200;
  else {
    state.cells[r * COLS + col] = who === 1 ? 2 : 1;
    if (winningLine(state, r, col)) bonus = 90;
  }
  state.cells[r * COLS + col] = 0;
  return CENTER[col] + bonus;
}

export function aiOptions(difficulty) {
  return {
    clone, moves, apply, undo, evaluate, outcome, rank,
    difficulty,
    depth: { leicht: 2, mittel: 5, schwer: 8 },
    noise: { leicht: 0.55, mittel: 0.05, schwer: 0 },
    time: { leicht: 40, mittel: 160, schwer: 360 },
  };
}
