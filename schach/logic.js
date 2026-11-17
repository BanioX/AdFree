// Schach. Weiss ist 1, Schwarz ist -1. Felder 0 = a1 … 63 = h8.
// Züge sind Objekte. apply und undo sind gepaart. Die KI sucht nur wenige Züge tief.

export const WK = 1, WQ = 2, BK = 4, BQ = 8;
const KNIGHT = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
const BISHOP = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const ROOK = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const KING = ROOK.concat(BISHOP);
const START = [
  4, 2, 3, 5, 6, 3, 2, 4,
  1, 1, 1, 1, 1, 1, 1, 1,
  0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0,
  -1, -1, -1, -1, -1, -1, -1, -1,
  -4, -2, -3, -5, -6, -3, -2, -4,
];

export function newGame() {
  return {
    board: START.slice(),
    turn: 1,
    rights: WK | WQ | BK | BQ,
    ep: -1,
    half: 0,
    full: 1,
    over: false,
    result: null,
    reason: '',
  };
}

const rf = (i) => [i >> 3, i & 7];
const sq = (r, f) => r * 8 + f;
const on = (r, f) => r >= 0 && r < 8 && f >= 0 && f < 8;

export function kingSquare(board, side) {
  const k = side * 6;
  for (let i = 0; i < 64; i++) if (board[i] === k) return i;
  return -1;
}

export function attacked(board, target, by) {
  const r0 = target >> 3;
  const f0 = target & 7;
  for (const [dr, df] of KNIGHT) {
    const r = r0 + dr;
    const f = f0 + df;
    if (on(r, f) && board[sq(r, f)] === by * 2) return true;
  }
  for (const [dr, df] of KING) {
    const r = r0 + dr;
    const f = f0 + df;
    if (on(r, f) && board[sq(r, f)] === by * 6) return true;
  }
  const pr = r0 - by;
  if (pr >= 0 && pr < 8) {
    if (f0 > 0 && board[sq(pr, f0 - 1)] === by) return true;
    if (f0 < 7 && board[sq(pr, f0 + 1)] === by) return true;
  }
  for (const [dr, df] of BISHOP) {
    let r = r0 + dr;
    let f = f0 + df;
    while (on(r, f)) {
      const p = board[sq(r, f)];
      if (p) { if (p === by * 3 || p === by * 5) return true; break; }
      r += dr; f += df;
    }
  }
  for (const [dr, df] of ROOK) {
    let r = r0 + dr;
    let f = f0 + df;
    while (on(r, f)) {
      const p = board[sq(r, f)];
      if (p) { if (p === by * 4 || p === by * 5) return true; break; }
      r += dr; f += df;
    }
  }
  return false;
}

export function inCheck(state, side) {
  const k = kingSquare(state.board, side);
  return k >= 0 && attacked(state.board, k, -side);
}

function rightsAfter(rights, from, to) {
  let r = rights;
  if (from === 4 || to === 4) r &= ~(WK | WQ);
  if (from === 60 || to === 60) r &= ~(BK | BQ);
  if (from === 7 || to === 7) r &= ~WK;
  if (from === 0 || to === 0) r &= ~WQ;
  if (from === 63 || to === 63) r &= ~BK;
  if (from === 56 || to === 56) r &= ~BQ;
  return r;
}

function push(state, list, from, to, extra) {
  const piece = state.board[from];
  const captured = extra && extra.epCapture != null ? state.board[extra.epCapture] : state.board[to];
  const promoRank = (to >> 3) === 0 || (to >> 3) === 7;
  const promos = Math.abs(piece) === 1 && promoRank ? [5, 4, 3, 2] : [0];
  for (const promo of promos) {
    list.push({
      from, to, piece,
      promo: promo ? state.turn * promo : 0,
      captured,
      epCapture: extra && extra.epCapture != null ? extra.epCapture : -1,
      rookFrom: extra && extra.rookFrom != null ? extra.rookFrom : -1,
      rookTo: extra && extra.rookTo != null ? extra.rookTo : -1,
      rights: rightsAfter(state.rights, from, to),
      ep: extra && extra.ep != null ? extra.ep : -1,
      half: (Math.abs(piece) === 1 || captured) ? 0 : state.half + 1,
    });
  }
}

function pseudo(state) {
  const list = [];
  const b = state.board;
  const me = state.turn;
  for (let i = 0; i < 64; i++) {
    const p = b[i];
    if (p * me <= 0) continue;
    const kind = Math.abs(p);
    const [r, f] = rf(i);
    if (kind === 1) {
      const dir = me;
      const r1 = r + dir;
      if (on(r1, f) && !b[sq(r1, f)]) {
        push(state, list, i, sq(r1, f));
        const start = me === 1 ? 1 : 6;
        const r2 = r + dir * 2;
        if (r === start && !b[sq(r2, f)]) push(state, list, i, sq(r2, f), { ep: sq(r1, f) });
      }
      for (const df of [-1, 1]) {
        if (!on(r1, f + df)) continue;
        const t = sq(r1, f + df);
        if (b[t] * me < 0) push(state, list, i, t);
        else if (t === state.ep) push(state, list, i, t, { epCapture: t - dir * 8 });
      }
    } else if (kind === 2) {
      for (const [dr, df] of KNIGHT) {
        if (!on(r + dr, f + df)) continue;
        const t = sq(r + dr, f + df);
        if (b[t] * me <= 0) push(state, list, i, t);
      }
    } else if (kind === 6) {
      for (const [dr, df] of KING) {
        if (!on(r + dr, f + df)) continue;
        const t = sq(r + dr, f + df);
        if (b[t] * me <= 0) push(state, list, i, t);
      }
      const home = me === 1 ? 4 : 60;
      if (i === home && !inCheck(state, me)) {
        const kingSide = me === 1 ? WK : BK;
        const queenSide = me === 1 ? WQ : BQ;
        if ((state.rights & kingSide) && !b[home + 1] && !b[home + 2] && b[home + 3] === me * 4
          && !attacked(b, home + 1, -me) && !attacked(b, home + 2, -me)) {
          push(state, list, i, home + 2, { rookFrom: home + 3, rookTo: home + 1 });
        }
        if ((state.rights & queenSide) && !b[home - 1] && !b[home - 2] && !b[home - 3] && b[home - 4] === me * 4
          && !attacked(b, home - 1, -me) && !attacked(b, home - 2, -me)) {
          push(state, list, i, home - 2, { rookFrom: home - 4, rookTo: home - 1 });
        }
      }
    } else {
      const dirs = kind === 3 ? BISHOP : kind === 4 ? ROOK : KING;
      for (const [dr, df] of dirs) {
        let rr = r + dr;
        let ff = f + df;
        while (on(rr, ff)) {
          const t = sq(rr, ff);
          if (b[t] * me > 0) break;
          push(state, list, i, t);
          if (b[t]) break;
          rr += dr; ff += df;
        }
      }
    }
  }
  return list;
}

export function apply(state, m) {
  const b = state.board;
  b[m.from] = 0;
  if (m.epCapture >= 0) b[m.epCapture] = 0;
  b[m.to] = m.promo || m.piece;
  if (m.rookFrom >= 0) {
    b[m.rookTo] = b[m.rookFrom];
    b[m.rookFrom] = 0;
  }
  m._prev = { rights: state.rights, ep: state.ep, half: state.half, full: state.full };
  state.rights = m.rights;
  state.ep = m.ep;
  state.half = m.half;
  if (state.turn === -1) state.full += 1;
  state.turn = -state.turn;
}

export function undo(state, m) {
  const b = state.board;
  state.turn = -state.turn;
  if (m.rookFrom >= 0) {
    b[m.rookFrom] = b[m.rookTo];
    b[m.rookTo] = 0;
  }
  b[m.from] = m.piece;
  b[m.to] = m.epCapture >= 0 ? 0 : m.captured;
  if (m.epCapture >= 0) b[m.epCapture] = m.captured;
  const p = m._prev;
  state.rights = p.rights;
  state.ep = p.ep;
  state.half = p.half;
  state.full = p.full;
}

export function legal(state) {
  if (state.over) return [];
  const out = [];
  for (const m of pseudo(state)) {
    apply(state, m);
    const bad = inCheck(state, -state.turn);
    undo(state, m);
    if (!bad) out.push(m);
  }
  return out;
}

export function key(state) {
  return state.board.join(',') + '|' + state.turn + '|' + state.rights + '|' + state.ep;
}

const VAL = { 1: 100, 2: 320, 3: 330, 4: 500, 5: 900, 6: 0 };

export function evaluate(state) {
  let score = 0;
  const b = state.board;
  for (let i = 0; i < 64; i++) {
    const p = b[i];
    if (!p) continue;
    const v = VAL[Math.abs(p)];
    const f = i & 7;
    const r = i >> 3;
    const center = (f >= 2 && f <= 5 && r >= 2 && r <= 5) ? 4 : 0;
    score += Math.sign(p) * (v + center);
  }
  return score * state.turn;
}

function order(state, list) {
  return list.slice().sort((a, c) => (c.captured ? VAL[Math.abs(c.captured)] : 0) - (a.captured ? VAL[Math.abs(a.captured)] : 0));
}

function search(state, depth, alpha, beta, q) {
  if (depth === 0) return q ? quiesce(state, alpha, beta, q) : evaluate(state);
  const list = order(state, legal(state));
  if (!list.length) {
    if (inCheck(state, state.turn)) return -100000 + (8 - depth);
    return 0;
  }
  let best = -1e9;
  for (const m of list) {
    apply(state, m);
    const score = -search(state, depth - 1, -beta, -alpha, q);
    undo(state, m);
    if (score > best) best = score;
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }
  return best;
}

function quiesce(state, alpha, beta, left) {
  const stand = evaluate(state);
  if (stand >= beta) return beta;
  if (stand > alpha) alpha = stand;
  if (left <= 0) return stand;
  for (const m of order(state, legal(state))) {
    if (!m.captured && !m.promo) continue;
    apply(state, m);
    const score = -quiesce(state, -beta, -alpha, left - 1);
    undo(state, m);
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

export function aiMove(state, diff, rng = Math.random) {
  const list = legal(state);
  if (!list.length) return null;
  if (diff === 'leicht') {
    let best = null;
    let bestScore = -1e9;
    for (const m of list) {
      apply(state, m);
      const score = -evaluate(state) + (rng() - 0.5) * 80;
      undo(state, m);
      if (score > bestScore) { bestScore = score; best = m; }
    }
    return best;
  }
  const depth = diff === 'schwer' ? 3 : 2;
  const q = diff === 'schwer' ? 2 : 0;
  let best = list[0];
  let bestScore = -1e9;
  for (const m of order(state, list)) {
    apply(state, m);
    const score = -search(state, depth - 1, -1e9, 1e9, q);
    undo(state, m);
    if (score > bestScore) { bestScore = score; best = m; }
  }
  return best;
}

export function perft(state, depth) {
  if (depth === 0) return 1;
  let n = 0;
  for (const m of legal(state)) {
    apply(state, m);
    n += perft(state, depth - 1);
    undo(state, m);
  }
  return n;
}

function materialLeft(board) {
  const kinds = [];
  for (const p of board) if (p && Math.abs(p) !== 6) kinds.push(p);
  return kinds;
}

export function insufficient(board) {
  const left = materialLeft(board);
  if (!left.length) return true;
  if (left.length === 1 && (Math.abs(left[0]) === 2 || Math.abs(left[0]) === 3)) return true;
  if (left.length === 2 && Math.abs(left[0]) === 3 && Math.abs(left[1]) === 3 && left[0] * left[1] < 0) {
    const squares = [];
    for (let i = 0; i < 64; i++) if (Math.abs(board[i]) === 3) squares.push(i);
    const color = (i) => ((i >> 3) + (i & 7)) & 1;
    return color(squares[0]) === color(squares[1]);
  }
  return false;
}

/** Nach einem ausgeführten Zug: Matt, Patt, Material, 50 Züge, dreifache Stellung. */
export function finishIf(state, seen) {
  const list = legal(state);
  if (!list.length) {
    state.over = true;
    if (inCheck(state, state.turn)) {
      state.result = -state.turn;
      state.reason = 'mate';
    } else {
      state.result = 0;
      state.reason = 'stalemate';
    }
    return;
  }
  if (state.half >= 100) {
    state.over = true; state.result = 0; state.reason = 'fifty'; return;
  }
  if (insufficient(state.board)) {
    state.over = true; state.result = 0; state.reason = 'material'; return;
  }
  if (seen) {
    const k = key(state);
    seen[k] = (seen[k] || 0) + 1;
    if (seen[k] >= 3) {
      state.over = true; state.result = 0; state.reason = 'repeat';
    }
  }
}

export function clone(state) {
  return {
    board: state.board.slice(),
    turn: state.turn,
    rights: state.rights,
    ep: state.ep,
    half: state.half,
    full: state.full,
    over: state.over,
    result: state.result,
    reason: state.reason,
  };
}

export function sameMove(a, b) {
  return a && b && a.from === b.from && a.to === b.to && a.promo === b.promo;
}
