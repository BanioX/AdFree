import { makeRng } from '../shared/rng.js';

export const N = 7;

function empties(balls) {
  const out = [];
  balls.forEach((v, i) => { if (v < 0) out.push(i); });
  return out;
}

export function route(balls, from, to) {
  if (from === to || balls[from] < 0 || balls[to] >= 0) return null;
  const prev = Array(balls.length).fill(-2);
  prev[from] = -1;
  const queue = [from];
  while (queue.length) {
    const i = queue.shift();
    const c = i % N;
    const r = Math.floor(i / N);
    const next = [];
    if (c > 0) next.push(i - 1);
    if (c + 1 < N) next.push(i + 1);
    if (r > 0) next.push(i - N);
    if (r + 1 < N) next.push(i + N);
    for (const j of next) {
      if (prev[j] !== -2) continue;
      if (j !== to && balls[j] >= 0) continue;
      prev[j] = i;
      if (j === to) {
        const path = [];
        let p = to;
        while (p !== -1) { path.push(p); p = prev[p]; }
        return path.reverse();
      }
      queue.push(j);
    }
  }
  return null;
}

function collect(cells, balls, mark) {
  let run = [];
  let color = -2;
  const flush = () => {
    if (run.length >= 5) for (const i of run) mark.add(i);
    run = [];
  };
  for (const i of cells) {
    const v = i == null ? -1 : balls[i];
    if (v >= 0 && v === color) run.push(i);
    else {
      flush();
      color = v;
      run = v >= 0 ? [i] : [];
    }
  }
  flush();
}

export function clearLines(balls) {
  const mark = new Set();
  for (let r = 0; r < N; r++) collect(Array.from({ length: N }, (_, c) => r * N + c), balls, mark);
  for (let c = 0; c < N; c++) collect(Array.from({ length: N }, (_, r) => r * N + c), balls, mark);
  for (let s = 0; s < N * 2; s++) {
    const diag = [];
    const diag2 = [];
    for (let r = 0; r < N; r++) {
      const c = s - r;
      if (c >= 0 && c < N) diag.push(r * N + c);
      const c2 = r - s + N - 1;
      if (c2 >= 0 && c2 < N) diag2.push(r * N + c2);
    }
    collect(diag, balls, mark);
    collect(diag2, balls, mark);
  }
  for (const i of mark) balls[i] = -1;
  return mark.size;
}

function spawn(state, balls) {
  const rng = makeRng(state.rng);
  const spots = empties(balls);
  rng.shuffle(spots);
  const born = Math.min(3, spots.length);
  for (let k = 0; k < born; k++) balls[spots[k]] = state.upcoming[k] ?? rng.int(0, state.colors - 1);
  const upcoming = [rng.int(0, state.colors - 1), rng.int(0, state.colors - 1), rng.int(0, state.colors - 1)];
  return { upcoming, rng: (state.rng + 1) >>> 0 };
}

export function newBoard(diff, seed = 1) {
  const rng = makeRng(seed);
  const colors = 5;
  const balls = Array(N * N).fill(-1);
  const count = diff === 'schwer' ? 9 : 6;
  const spots = rng.shuffle(Array.from({ length: N * N }, (_, i) => i));
  for (let k = 0; k < count; k++) balls[spots[k]] = rng.int(0, colors - 1);
  clearLines(balls);
  return {
    balls,
    colors,
    upcoming: [rng.int(0, colors - 1), rng.int(0, colors - 1), rng.int(0, colors - 1)],
    lines: 0,
    need: diff === 'leicht' ? 1 : diff === 'schwer' ? 3 : 2,
    score: 0,
    rng: (seed + 1) >>> 0,
  };
}

export function move(state, from, to) {
  if (!route(state.balls, from, to)) return state;
  const balls = state.balls.slice();
  balls[to] = balls[from];
  balls[from] = -1;
  let removed = clearLines(balls);
  let upcoming = state.upcoming;
  let rng = state.rng;
  if (!removed && empties(balls).length) {
    const spawned = spawn({ ...state, rng }, balls);
    upcoming = spawned.upcoming;
    rng = spawned.rng;
    removed += clearLines(balls);
  }
  const lines = state.lines + (removed ? 1 : 0);
  return { ...state, balls, upcoming, rng, lines, score: state.score + removed * 5 };
}

export function won(state) {
  return state.lines >= state.need;
}

export function stuck(state) {
  return empties(state.balls).length === 0;
}
