const SHAPES = {
  I: [[[0, 1], [1, 1], [2, 1], [3, 1]], [[2, 0], [2, 1], [2, 2], [2, 3]]],
  O: [[[1, 0], [2, 0], [1, 1], [2, 1]]],
  T: [[[1, 0], [0, 1], [1, 1], [2, 1]], [[1, 0], [1, 1], [2, 1], [1, 2]], [[0, 1], [1, 1], [2, 1], [1, 2]], [[1, 0], [0, 1], [1, 1], [1, 2]]],
  L: [[[2, 0], [0, 1], [1, 1], [2, 1]], [[1, 0], [1, 1], [1, 2], [2, 2]], [[0, 1], [1, 1], [2, 1], [0, 2]], [[0, 0], [1, 0], [1, 1], [1, 2]]],
  J: [[[0, 0], [0, 1], [1, 1], [2, 1]], [[1, 0], [2, 0], [1, 1], [1, 2]], [[0, 1], [1, 1], [2, 1], [2, 2]], [[1, 0], [1, 1], [0, 2], [1, 2]]],
  S: [[[1, 0], [2, 0], [0, 1], [1, 1]], [[1, 0], [1, 1], [2, 1], [2, 2]]],
  Z: [[[0, 0], [1, 0], [1, 1], [2, 1]], [[2, 0], [1, 1], [2, 1], [1, 2]]],
};
const KINDS = Object.keys(SHAPES);

export function cellsOf(piece) {
  return SHAPES[piece.k][piece.rot % SHAPES[piece.k].length].map(([c, r]) => [piece.x + c, piece.y + r]);
}

function fits(state, piece) {
  for (const [c, r] of cellsOf(piece)) {
    if (c < 0 || c >= state.w || r >= state.h) return false;
    if (r >= 0 && state.cells[r * state.w + c]) return false;
  }
  return true;
}

function spawn(n) {
  const k = KINDS[n % KINDS.length];
  return { k, rot: 0, x: 2, y: 0 };
}

export function newWell(diff, seed = 1) {
  const h = 14;
  const w = 8;
  return {
    w, h, seed,
    cells: Array(w * h).fill(0),
    piece: spawn(seed),
    lines: 0,
    score: 0,
    over: false,
    need: diff === 'leicht' ? 2 : diff === 'schwer' ? 6 : 4,
  };
}

export function shift(state, dc) {
  if (state.over) return state;
  const piece = { ...state.piece, x: state.piece.x + dc };
  return fits(state, piece) ? { ...state, piece } : state;
}

export function rotate(state) {
  if (state.over) return state;
  const len = SHAPES[state.piece.k].length;
  for (const kick of [0, -1, 1, -2, 2]) {
    const piece = { ...state.piece, rot: (state.piece.rot + 1) % len, x: state.piece.x + kick };
    if (fits(state, piece)) return { ...state, piece };
  }
  return state;
}

function lock(state) {
  const cells = state.cells.slice();
  for (const [c, r] of cellsOf(state.piece)) {
    if (r < 0) return { ...state, over: true };
    cells[r * state.w + c] = state.piece.k;
  }
  const kept = [];
  let lines = 0;
  for (let r = 0; r < state.h; r++) {
    const row = cells.slice(r * state.w, (r + 1) * state.w);
    if (row.every(Boolean)) lines += 1;
    else kept.push(row);
  }
  while (kept.length < state.h) kept.unshift(Array(state.w).fill(0));
  const flat = kept.flat();
  const piece = spawn(state.seed + state.lines + lines + 3);
  const over = !fits({ ...state, cells: flat }, piece);
  return {
    ...state,
    cells: flat,
    piece,
    lines: state.lines + lines,
    score: state.score + 10 + lines * lines * 50,
    over,
  };
}

export function fall(state) {
  if (state.over) return state;
  const piece = { ...state.piece, y: state.piece.y + 1 };
  if (fits(state, piece)) return { ...state, piece };
  return lock(state);
}

export function drop(state) {
  let next = state;
  for (let n = 0; n < state.h + 2; n++) {
    const down = fall(next);
    if (down.cells !== next.cells || down.over) return down;
    next = down;
  }
  return next;
}

export function done(state) {
  return state.lines >= state.need;
}
