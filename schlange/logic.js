export function newSnake(diff, seed = 1) {
  const w = 10;
  const h = 12;
  return {
    w, h, seed,
    snake: [w + 2, w + 1, w],
    dir: { c: 1, r: 0 },
    food: w + 7,
    score: 0,
    blocked: false,
    goal: diff === 'leicht' ? 8 : diff === 'schwer' ? 14 : 11,
  };
}

export function turn(state, c, r) {
  if (!c && !r) return state;
  if (c === -state.dir.c && r === -state.dir.r) return state;
  return { ...state, dir: { c, r }, blocked: false };
}

export function step(state) {
  const head = state.snake[0];
  let c = (head % state.w) + state.dir.c;
  let r = Math.floor(head / state.w) + state.dir.r;
  if (c < 0) c = state.w - 1;
  else if (c >= state.w) c = 0;
  if (r < 0) r = state.h - 1;
  else if (r >= state.h) r = 0;
  const next = r * state.w + c;
  const eating = next === state.food;
  const tail = eating ? state.snake : state.snake.slice(0, -1);
  if (tail.includes(next)) return { ...state, blocked: true };
  const snake = [next, ...tail];
  let food = state.food;
  let score = state.score;
  if (eating) {
    score += 1;
    const taken = new Set(snake);
    const free = [];
    for (let i = 0; i < state.w * state.h; i++) if (!taken.has(i)) free.push(i);
    food = free.length ? free[(state.seed + score * 13) % free.length] : -1;
  }
  return { ...state, snake, food, score, blocked: false };
}

export function reached(state) {
  return state.snake.length >= state.goal;
}
