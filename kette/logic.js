import { makeRng } from '../shared/rng.js';

export function newChain(diff, seed = 1) {
  const colors = diff === 'leicht' ? 3 : 4;
  const groups = diff === 'schwer' ? 6 : diff === 'leicht' ? 4 : 5;
  const rng = makeRng(seed);
  let balls = [];
  for (let g = 0; g < groups; g++) {
    const color = rng.int(0, colors - 1);
    const n = rng.int(3, 4);
    const at = balls.length ? rng.int(0, balls.length) : 0;
    balls = balls.slice(0, at).concat(Array(n).fill(color), balls.slice(at));
  }
  return { balls, colors, score: 0 };
}

export function groupAt(balls, index) {
  if (index < 0 || index >= balls.length) return null;
  const color = balls[index];
  let a = index;
  let b = index;
  while (a > 0 && balls[a - 1] === color) a -= 1;
  while (b + 1 < balls.length && balls[b + 1] === color) b += 1;
  return { a, b, color, n: b - a + 1 };
}

export function pop(state, index) {
  const group = groupAt(state.balls, index);
  if (!group || group.n < 3) return state;
  const balls = state.balls.slice(0, group.a).concat(state.balls.slice(group.b + 1));
  return { ...state, balls, score: state.score + group.n * 10 };
}

export function cleared(state) {
  return state.balls.length === 0;
}

export function hintIndex(state) {
  const seen = new Set();
  function search(balls) {
    const key = balls.join(',');
    if (seen.has(key)) return null;
    seen.add(key);
    if (!balls.length) return [];
    const tried = new Set();
    for (let i = 0; i < balls.length; i++) {
      const group = groupAt(balls, i);
      if (!group || group.n < 3 || tried.has(group.a)) continue;
      tried.add(group.a);
      const next = balls.slice(0, group.a).concat(balls.slice(group.b + 1));
      const path = search(next);
      if (path) return [group.a].concat(path);
    }
    return null;
  }
  const path = search(state.balls);
  return path ? path[0] : -1;
}
