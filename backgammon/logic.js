// Backgammon ohne Verdopplungswürfel.
// Punkt 1 ist Index 0. Weiss (1) zieht nach unten und trägt über 0 ab.
// Schwarz (−1) zieht nach oben und trägt über 23 ab.

export function newGame() {
  const pts = Array(24).fill(0);
  pts[23] = 2; pts[12] = 5; pts[7] = 3; pts[5] = 5;
  pts[0] = -2; pts[11] = -5; pts[16] = -3; pts[18] = -5;
  return {
    pts, barW: 0, barB: 0, offW: 0, offB: 0,
    turn: 1, phase: 'roll', dice: [], face: [],
    over: false, winner: 0,
  };
}

function bar(state, side) {
  return side === 1 ? state.barW : state.barB;
}

export function canLand(pts, dest, side) {
  return pts[dest] * side >= -1;
}

export function allHome(state, side) {
  if (bar(state, side)) return false;
  for (let i = 0; i < 24; i++) {
    if (state.pts[i] * side <= 0) continue;
    if (side === 1 && i > 5) return false;
    if (side === -1 && i < 18) return false;
  }
  return true;
}

function bearOk(state, i, die, side) {
  const dist = side === 1 ? i + 1 : 24 - i;
  if (die === dist) return true;
  if (die < dist) return false;
  if (side === 1) {
    for (let k = i + 1; k <= 5; k++) if (state.pts[k] > 0) return false;
  } else {
    for (let k = 18; k < i; k++) if (state.pts[k] < 0) return false;
  }
  return true;
}

export function steps(state, die, side = state.turn) {
  const out = [];
  if (bar(state, side)) {
    const dest = side === 1 ? 24 - die : die - 1;
    if (canLand(state.pts, dest, side)) out.push({ from: 'bar', to: dest, die, side });
    return out;
  }
  const home = allHome(state, side);
  for (let i = 0; i < 24; i++) {
    if (state.pts[i] * side <= 0) continue;
    const dest = i - side * die;
    if (dest >= 0 && dest < 24) {
      if (canLand(state.pts, dest, side)) out.push({ from: i, to: dest, die, side });
    } else if (home && bearOk(state, i, die, side)) {
      out.push({ from: i, to: 'off', die, side });
    }
  }
  return out;
}

export function apply(state, m) {
  const side = m.side;
  if (m.from === 'bar') {
    if (side === 1) state.barW -= 1; else state.barB -= 1;
  } else state.pts[m.from] -= side;
  if (m.to === 'off') {
    if (side === 1) state.offW += 1; else state.offB += 1;
  } else {
    if (state.pts[m.to] === -side) {
      state.pts[m.to] = 0;
      if (side === 1) state.barB += 1; else state.barW += 1;
    }
    state.pts[m.to] += side;
  }
  if (state.offW === 15 || state.offB === 15) {
    state.over = true;
    state.winner = state.offW === 15 ? 1 : -1;
  }
}

export function clone(state) {
  return {
    pts: state.pts.slice(),
    barW: state.barW, barB: state.barB,
    offW: state.offW, offB: state.offB,
    turn: state.turn, phase: state.phase,
    dice: state.dice.slice(), face: state.face.slice(),
    over: state.over, winner: state.winner,
  };
}

export function plays(state, dice = state.dice, side = state.turn) {
  const found = [];
  function walk(s, left, path) {
    const tried = new Set();
    let moved = false;
    for (let n = 0; n < left.length; n++) {
      const die = left[n];
      if (tried.has(die)) continue;
      tried.add(die);
      const list = steps(s, die, side);
      if (!list.length) continue;
      moved = true;
      const rest = left.slice(0, n).concat(left.slice(n + 1));
      for (const m of list) {
        const next = clone(s);
        apply(next, m);
        if (next.over) found.push(path.concat(m));
        else walk(next, rest, path.concat(m));
      }
    }
    if (!moved) found.push(path);
  }
  walk(state, dice, []);
  let max = 0;
  for (const p of found) if (p.length > max) max = p.length;
  let list = found.filter((p) => p.length === max);
  if (max === 1 && dice.length >= 2 && dice[0] !== dice[1]) {
    const higher = Math.max(...dice);
    const prefer = list.filter((p) => p[0] && p[0].die === higher);
    if (prefer.length) list = prefer;
  }
  const seen = new Set();
  const unique = [];
  for (const p of list) {
    const id = p.map((m) => m.from + '>' + m.to + ':' + m.die).join('|');
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(p);
  }
  return unique;
}

export function roll(state, rng = Math.random) {
  const a = 1 + Math.floor(rng() * 6);
  const b = 1 + Math.floor(rng() * 6);
  state.face = [a, b];
  state.dice = a === b ? [a, a, a, a] : [a, b];
  state.phase = 'move';
  return state.dice;
}

function pip(state, side) {
  let n = bar(state, side) * 25;
  for (let i = 0; i < 24; i++) {
    const c = state.pts[i] * side;
    if (c > 0) n += c * (side === 1 ? i + 1 : 24 - i);
  }
  return n;
}

function score(state, side) {
  const off = side === 1 ? state.offW : state.offB;
  let blots = 0;
  for (let i = 0; i < 24; i++) if (state.pts[i] === side) blots += 1;
  return (pip(state, -side) - pip(state, side)) + off * 12 - bar(state, side) * 18 - blots * 2;
}

export function aiPlay(state, diff, rng = Math.random) {
  const list = plays(state);
  if (!list.length || !list[0].length) return [];
  if (diff === 'leicht') return list[Math.floor(rng() * list.length)];
  let best = list[0];
  let bestScore = -1e9;
  const pool = [];
  for (const play of list) {
    const next = clone(state);
    for (const m of play) apply(next, m);
    const s = score(next, state.turn);
    if (s > bestScore + 0.001) { bestScore = s; best = play; pool.length = 0; pool.push(play); }
    else if (Math.abs(s - bestScore) < 8) pool.push(play);
  }
  if (diff === 'mittel') return pool[Math.floor(rng() * pool.length)];
  return best;
}

export function pipCount(state, side) {
  return pip(state, side);
}
