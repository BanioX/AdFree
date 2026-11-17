// Dame auf 8×8, deutsche Regeln:
// Steine ziehen diagonal vorwärts. Geschlagen wird in alle Richtungen,
// genau ein Feld weit. Damen fliegen. Schlagen ist Pflicht, und zwar
// die längste Kette. Wer die letzte Reihe erreicht, wird sofort Dame
// und schlägt in derselben Kette weiter.

export const DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

export function sideOf(p) {
  return p === 1 || p === 3 ? 1 : p === 2 || p === 4 ? 2 : 0;
}

function promote(piece, row) {
  if (piece === 1 && row === 0) return 3;
  if (piece === 2 && row === 7) return 4;
  return piece;
}

function free(cells, i, taken) {
  return taken.has(i) || !cells[i];
}

function capturesOf(cells, index, piece) {
  const out = [];
  const side = sideOf(piece);
  const saved = cells[index];
  cells[index] = 0;
  const walk = (cr, cc, cur, path, taken) => {
    let extended = false;
    const king = cur >= 3;
    for (const [dr, dc] of DIRS) {
      if (!king) {
        const er = cr + dr;
        const ec = cc + dc;
        const lr = cr + dr * 2;
        const lc = cc + dc * 2;
        if (lr < 0 || lc < 0 || lr > 7 || lc > 7) continue;
        const mi = er * 8 + ec;
        const li = lr * 8 + lc;
        const mid = cells[mi];
        if (!mid || sideOf(mid) === side || taken.has(mi) || !free(cells, li, taken)) continue;
        extended = true;
        const next = new Set(taken);
        next.add(mi);
        walk(lr, lc, promote(cur, lr), path.concat(li), next);
      } else {
        let dist = 1;
        let victim = -1;
        for (;;) {
          const nr = cr + dr * dist;
          const nc = cc + dc * dist;
          if (nr < 0 || nc < 0 || nr > 7 || nc > 7) break;
          const ni = nr * 8 + nc;
          if (free(cells, ni, taken)) {
            if (victim >= 0) {
              extended = true;
              const next = new Set(taken);
              next.add(victim);
              walk(nr, nc, cur, path.concat(ni), next);
            }
            dist++;
            continue;
          }
          if (victim >= 0 || sideOf(cells[ni]) === side) break;
          victim = ni;
          dist++;
        }
      }
    }
    if (!extended && path.length) {
      out.push({ from: index, to: path[path.length - 1], path, taken: [...taken], piece: cur });
    }
  };
  const r = (index / 8) | 0;
  walk(r, index % 8, piece, [], new Set());
  cells[index] = saved;
  return out;
}

function quietsOf(cells, index, piece) {
  const out = [];
  const r = (index / 8) | 0;
  const c = index % 8;
  const king = piece >= 3;
  const dirs = king ? DIRS : sideOf(piece) === 1 ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
  for (const [dr, dc] of dirs) {
    let dist = 1;
    for (;;) {
      const nr = r + dr * dist;
      const nc = c + dc * dist;
      if (nr < 0 || nc < 0 || nr > 7 || nc > 7) break;
      const ni = nr * 8 + nc;
      if (cells[ni]) break;
      out.push({ from: index, to: ni, path: [ni], taken: [], piece: promote(piece, nr) });
      if (!king) break;
      dist++;
    }
  }
  return out;
}

export function newGame() {
  const cells = new Array(64).fill(0);
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 !== 1) continue;
      if (r <= 2) cells[r * 8 + c] = 2;
      else if (r >= 5) cells[r * 8 + c] = 1;
    }
  }
  return { cells, turn: 1, quiet: 0, over: false, winner: 0, last: null, _u: [] };
}

export function moves(s) {
  if (s.over || s.quiet >= 80) return [];
  const caps = [];
  for (let i = 0; i < 64; i++) {
    if (sideOf(s.cells[i]) !== s.turn) continue;
    caps.push(...capturesOf(s.cells, i, s.cells[i]));
  }
  if (caps.length) {
    let best = 1;
    for (const m of caps) if (m.taken.length > best) best = m.taken.length;
    return caps.filter((m) => m.taken.length === best);
  }
  const quiet = [];
  for (let i = 0; i < 64; i++) {
    if (sideOf(s.cells[i]) !== s.turn) continue;
    quiet.push(...quietsOf(s.cells, i, s.cells[i]));
  }
  return quiet;
}

function decide(s) {
  if (s.quiet >= 80) return 0;
  let me = 0;
  let opp = 0;
  for (let i = 0; i < 64; i++) {
    const p = s.cells[i];
    if (!p) continue;
    if (sideOf(p) === s.turn) me++;
    else opp++;
  }
  if (!me && !opp) return 0;
  if (!opp) return s.turn;
  if (!me) return 3 - s.turn;
  if (!moves(s).length) return 3 - s.turn;
  return null;
}

export function judge(s) {
  if (s.over) return s.winner;
  const o = decide(s);
  if (o == null) return null;
  s.over = true;
  s.winner = o;
  return o;
}

export function outcome(s) {
  judge(s);
  return s.over ? s.winner : null;
}

export function apply(s, m) {
  s._u.push({
    cells: s.cells.slice(), turn: s.turn, quiet: s.quiet,
    over: s.over, winner: s.winner, last: s.last,
  });
  s.cells[m.from] = 0;
  for (const t of m.taken) s.cells[t] = 0;
  s.cells[m.to] = m.piece;
  s.quiet = m.taken.length ? 0 : s.quiet + 1;
  s.turn = 3 - s.turn;
  s.last = m.to;
  s.over = false;
  s.winner = 0;
  judge(s);
}

export function undo(s) {
  const u = s._u.pop();
  if (!u) return;
  s.cells = u.cells;
  s.turn = u.turn;
  s.quiet = u.quiet;
  s.over = u.over;
  s.winner = u.winner;
  s.last = u.last;
}

export function clone(s) {
  return {
    cells: s.cells.slice(), turn: s.turn, quiet: s.quiet,
    over: s.over, winner: s.winner, last: s.last, _u: [],
  };
}

export function evaluate(s) {
  let score = 0;
  for (let i = 0; i < 64; i++) {
    const p = s.cells[i];
    if (!p) continue;
    const r = (i / 8) | 0;
    const c = i % 8;
    const mine = sideOf(p) === s.turn;
    const king = p >= 3;
    let v = king ? 170 : 100;
    if (!king) v += (sideOf(p) === 1 ? 7 - r : r) * 3;
    v += 4 - (Math.abs(c - 3) + Math.abs(r - 3));
    score += mine ? v : -v;
  }
  return Math.max(-20000, Math.min(20000, score));
}

export function rank(s, m) {
  const was = s.cells[m.from];
  let v = m.taken.length * 40;
  if (m.piece >= 3 && was < 3) v += 30;
  const r = (m.to / 8) | 0;
  const c = m.to % 8;
  v -= Math.abs(c - 3) + Math.abs(r - 3);
  return v;
}

export function aiOptions(state) {
  return {
    state, clone, moves, apply, undo, evaluate, outcome, rank,
    key: (m) => `${m.from}:${m.to}:${m.taken.join('.')}`,
    difficulty: state.diff || 'mittel',
    depth: { leicht: 2, mittel: 3, schwer: 4 },
    noise: { leicht: 0.5, mittel: 0.06, schwer: 0 },
    time: { leicht: 40, mittel: 140, schwer: 320 },
  };
}
