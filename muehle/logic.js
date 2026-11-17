// Mühle: 24 Punkte, neun Steine, drei Phasen.
// Setzen, dann Ziehen entlang der Linien. Bei drei Steinen darf man fliegen.
// Wer eine Mühle schliesst, nimmt einen gegnerischen Stein weg
// (nicht aus einer Mühle, ausser alle stehen in einer).

export const PTS = [
  [0, 0], [3, 0], [6, 0],
  [1, 1], [3, 1], [5, 1],
  [2, 2], [3, 2], [4, 2],
  [0, 3], [1, 3], [2, 3], [4, 3], [5, 3], [6, 3],
  [2, 4], [3, 4], [4, 4],
  [1, 5], [3, 5], [5, 5],
  [0, 6], [3, 6], [6, 6],
];

function build() {
  const by = new Map();
  const add = (key, i) => {
    if (!by.has(key)) by.set(key, []);
    by.get(key).push(i);
  };
  PTS.forEach(([x, y], i) => { add('x' + x, i); add('y' + y, i); });
  const mills = [];
  const nei = PTS.map(() => []);
  for (const group of by.values()) {
    const line = group.slice().sort((a, b) => (PTS[a][0] + PTS[a][1]) - (PTS[b][0] + PTS[b][1]));
    for (let i = 0; i + 2 < line.length; i++) {
      const [a, b, c] = [line[i], line[i + 1], line[i + 2]];
      const g1 = Math.abs(PTS[a][0] - PTS[b][0] + PTS[a][1] - PTS[b][1]);
      const g2 = Math.abs(PTS[b][0] - PTS[c][0] + PTS[b][1] - PTS[c][1]);
      if (g1 !== g2) continue;
      mills.push([a, b, c]);
      for (const [p, q] of [[a, b], [b, c]]) {
        if (!nei[p].includes(q)) nei[p].push(q);
        if (!nei[q].includes(p)) nei[q].push(p);
      }
    }
  }
  return { mills, nei };
}

const built = build();
export const MILLS = built.mills;
export const NEI = built.nei;

export function count(s, side) {
  let n = 0;
  for (const c of s.cells) if (c === side) n++;
  return n;
}

function inMill(cells, i, side) {
  return MILLS.some((m) => m.includes(i) && m.every((p) => cells[p] === side));
}

function closed(cells, to, from, side) {
  return MILLS.some((m) => m.includes(to) && !m.includes(from) && m.every((p) => cells[p] === side));
}

function targets(cells, victim) {
  const all = [];
  const open = [];
  for (let i = 0; i < 24; i++) {
    if (cells[i] !== victim) continue;
    all.push(i);
    if (!inMill(cells, i, victim)) open.push(i);
  }
  return open.length ? open : all;
}

export function newGame() {
  return {
    cells: new Array(24).fill(0),
    left: [0, 9, 9],
    turn: 1, over: false, winner: 0, last: null, _u: [],
  };
}

export function moves(s) {
  if (s.over) return [];
  const me = s.turn;
  const raw = [];
  if (s.left[me] > 0) {
    for (let i = 0; i < 24; i++) if (!s.cells[i]) raw.push({ place: i });
  } else {
    const mine = [];
    for (let i = 0; i < 24; i++) if (s.cells[i] === me) mine.push(i);
    const fly = mine.length <= 3;
    for (const from of mine) {
      for (let to = 0; to < 24; to++) {
        if (s.cells[to]) continue;
        if (!fly && !NEI[from].includes(to)) continue;
        raw.push({ from, to });
      }
    }
  }
  const out = [];
  for (const m of raw) {
    const cells = s.cells.slice();
    if (m.place != null) cells[m.place] = me;
    else { cells[m.from] = 0; cells[m.to] = me; }
    const to = m.place != null ? m.place : m.to;
    const from = m.from != null ? m.from : -1;
    if (closed(cells, to, from, me)) {
      const tg = targets(cells, 3 - me);
      if (!tg.length) out.push(m);
      else for (const remove of tg) out.push({ ...m, remove });
    } else out.push(m);
  }
  return out;
}

function decide(s) {
  if (s.left[1] > 0 || s.left[2] > 0) return null;
  const me = count(s, s.turn);
  const opp = count(s, 3 - s.turn);
  if (me < 3 && opp < 3) return 0;
  if (me < 3) return 3 - s.turn;
  if (opp < 3) return s.turn;
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
    cells: s.cells.slice(), left: s.left.slice(), turn: s.turn,
    over: s.over, winner: s.winner, last: s.last,
  });
  if (m.place != null) {
    s.cells[m.place] = s.turn;
    s.left[s.turn]--;
    s.last = m.place;
  } else {
    s.cells[m.from] = 0;
    s.cells[m.to] = s.turn;
    s.last = m.to;
  }
  if (m.remove != null) s.cells[m.remove] = 0;
  s.turn = 3 - s.turn;
  s.over = false;
  s.winner = 0;
  judge(s);
}

export function undo(s) {
  const u = s._u.pop();
  if (!u) return;
  s.cells = u.cells;
  s.left = u.left;
  s.turn = u.turn;
  s.over = u.over;
  s.winner = u.winner;
  s.last = u.last;
}

export function clone(s) {
  return {
    cells: s.cells.slice(), left: s.left.slice(), turn: s.turn,
    over: s.over, winner: s.winner, last: s.last, _u: [],
  };
}

function threats(cells, side) {
  let n = 0;
  for (const m of MILLS) {
    let mine = 0;
    let empty = 0;
    for (const p of m) {
      if (cells[p] === side) mine++;
      else if (!cells[p]) empty++;
    }
    if (mine === 2 && empty === 1) n++;
  }
  return n;
}

export function evaluate(s) {
  const me = s.turn;
  const opp = 3 - me;
  let score = (count(s, me) - count(s, opp)) * 80;
  score += (s.left[me] - s.left[opp]) * 20;
  let mm = 0;
  let om = 0;
  for (const m of MILLS) {
    if (m.every((p) => s.cells[p] === me)) mm++;
    if (m.every((p) => s.cells[p] === opp)) om++;
  }
  score += (mm - om) * 36;
  score += (threats(s.cells, me) - threats(s.cells, opp)) * 14;
  return Math.max(-20000, Math.min(20000, score));
}

export function rank(s, m) {
  let v = m.remove != null ? 80 : 0;
  const to = m.place != null ? m.place : m.to;
  v -= Math.abs(PTS[to][0] - 3) + Math.abs(PTS[to][1] - 3);
  return v;
}

export function aiOptions(state) {
  return {
    state, clone, moves, apply, undo, evaluate, outcome, rank,
    key: (m) => `${m.place ?? '-'}:${m.from ?? '-'}:${m.to ?? '-'}:${m.remove ?? '-'}`,
    difficulty: state.diff || 'mittel',
    depth: { leicht: 1, mittel: 2, schwer: 3 },
    noise: { leicht: 0.55, mittel: 0.08, schwer: 0 },
    time: { leicht: 30, mittel: 120, schwer: 280 },
  };
}
