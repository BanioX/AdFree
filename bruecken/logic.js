import { makeRng } from '../shared/rng.js';

function between(islands, a, b) {
  const A = islands[a];
  const B = islands[b];
  const cells = [];
  if (A.r === B.r && A.c !== B.c) {
    for (let c = Math.min(A.c, B.c) + 1; c < Math.max(A.c, B.c); c++) cells.push(A.r * 100 + c);
  } else if (A.c === B.c && A.r !== B.r) {
    for (let r = Math.min(A.r, B.r) + 1; r < Math.max(A.r, B.r); r++) cells.push(r * 100 + A.c);
  }
  return cells;
}

function blocked(islands, a, b) {
  const cells = between(islands, a, b);
  if (!cells.length) return true;
  const taken = new Set(islands.map((o) => o.r * 100 + o.c));
  return cells.some((id) => taken.has(id));
}

function crosses(islands, bridges, a, b) {
  const A = islands[a];
  const B = islands[b];
  const horiz = A.r === B.r;
  for (const br of bridges) {
    const C = islands[br.a];
    const D = islands[br.b];
    const h2 = C.r === D.r;
    if (horiz === h2) continue;
    const hA = horiz ? A : C;
    const hB = horiz ? B : D;
    const vA = horiz ? C : A;
    const vB = horiz ? D : B;
    const c1 = Math.min(hA.c, hB.c);
    const c2 = Math.max(hA.c, hB.c);
    const r1 = Math.min(vA.r, vB.r);
    const r2 = Math.max(vA.r, vB.r);
    if (vA.c > c1 && vA.c < c2 && hA.r > r1 && hA.r < r2) return true;
  }
  return false;
}

function pairsOf(islands) {
  const pairs = [];
  for (let i = 0; i < islands.length; i++) {
    for (let j = i + 1; j < islands.length; j++) {
      if ((islands[i].r === islands[j].r || islands[i].c === islands[j].c) && !blocked(islands, i, j)) pairs.push([i, j]);
    }
  }
  return pairs;
}

function degree(bridges, i) {
  return bridges.reduce((sum, br) => sum + ((br.a === i || br.b === i) ? br.n : 0), 0);
}

function connected(count, bridges) {
  const parent = Array.from({ length: count }, (_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (const br of bridges) if (br.n) parent[find(br.a)] = find(br.b);
  const root = find(0);
  for (let i = 1; i < count; i++) if (find(i) !== root) return false;
  return count > 1;
}

function build(size, seed) {
  const rng = makeRng(seed);
  const target = size <= 5 ? 5 : size >= 7 ? 8 : 6;
  const islands = [{ c: rng.int(0, size - 1), r: rng.int(0, size - 1), n: 0 }];
  const bridges = [];
  let guard = 0;
  while (islands.length < target && guard < 120) {
    guard += 1;
    const from = rng.int(0, islands.length - 1);
    const sign = rng.chance(0.5) ? 1 : -1;
    const gap = rng.int(2, size - 1);
    let c = islands[from].c;
    let r = islands[from].r;
    if (rng.chance(0.5)) c += sign * gap;
    else r += sign * gap;
    if (c < 0 || r < 0 || c >= size || r >= size) continue;
    if (islands.some((o) => o.c === c && o.r === r)) continue;
    if (bridges.some((br) => between(islands, br.a, br.b).includes(r * 100 + c))) continue;
    const b = islands.length;
    islands.push({ c, r, n: 0 });
    if (blocked(islands, from, b) || crosses(islands, bridges, from, b)) {
      islands.pop();
      continue;
    }
    bridges.push({ a: Math.min(from, b), b: Math.max(from, b), n: 1 });
  }
  if (islands.length < 4 || !connected(islands.length, bridges)) return null;
  const pairs = pairsOf(islands);
  rng.shuffle(pairs);
  for (const [a, b] of pairs) {
    const have = bridges.find((br) => br.a === a && br.b === b);
    if (have) {
      if (have.n === 1 && degree(bridges, a) < 4 && degree(bridges, b) < 4 && rng.chance(0.55)) have.n = 2;
    } else if (degree(bridges, a) < 3 && degree(bridges, b) < 3 && rng.chance(0.35) && !crosses(islands, bridges, a, b)) {
      bridges.push({ a, b, n: 1 });
    }
  }
  islands.forEach((isle, i) => { isle.n = degree(bridges, i); });
  if (islands.some((isle) => isle.n < 1)) return null;
  return { w: size, h: size, islands, solution: bridges, built: {} };
}

export function newPuzzle(diff, seed = 1) {
  const size = diff === 'leicht' ? 5 : diff === 'schwer' ? 7 : 6;
  for (let k = 0; k < 40; k++) {
    const puzzle = build(size, (seed + k * 17) >>> 0);
    if (puzzle) return puzzle;
  }
  return build(5, 1) || { w: 5, h: 5, islands: [{ c: 0, r: 0, n: 1 }, { c: 2, r: 0, n: 1 }], solution: [{ a: 0, b: 1, n: 1 }], built: {} };
}

export function builtList(state) {
  return Object.entries(state.built).filter(([, n]) => n).map(([key, n]) => {
    const [a, b] = key.split(',').map(Number);
    return { a, b, n };
  });
}

export function cycle(state, a, b) {
  if (a === b || a < 0 || b < 0) return state;
  if (a > b) [a, b] = [b, a];
  if (blocked(state.islands, a, b)) return state;
  const key = a + ',' + b;
  const cur = state.built[key] || 0;
  const next = (cur + 1) % 3;
  const others = builtList(state).filter((br) => !(br.a === a && br.b === b));
  if (next && crosses(state.islands, others, a, b)) return state;
  const built = { ...state.built };
  if (next) built[key] = next;
  else delete built[key];
  return { ...state, built };
}

export function solved(state) {
  const list = builtList(state);
  if (!connected(state.islands.length, list)) return false;
  return state.islands.every((isle, i) => degree(list, i) === isle.n);
}

export function hintPair(state) {
  for (const br of state.solution) {
    const key = br.a + ',' + br.b;
    if ((state.built[key] || 0) < br.n) return [br.a, br.b];
  }
  return null;
}
