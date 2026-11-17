export function newTower(diff) {
  return {
    x: 0,
    dir: 1,
    speed: 0.42,
    width: 0.5,
    stack: [{ x: 0.25, w: 0.5 }],
    goal: diff === 'leicht' ? 6 : diff === 'schwer' ? 12 : 8,
    over: false,
    perfect: 0,
  };
}

export function slide(state, dt) {
  if (state.over) return state;
  let x = state.x + state.dir * state.speed * Math.min(dt, 32) / 1000;
  let dir = state.dir;
  const max = Math.max(0, 1 - state.width);
  if (x < 0) { x = 0; dir = 1; }
  if (x > max) { x = max; dir = -1; }
  return { ...state, x, dir };
}

export function land(state) {
  if (state.over) return state;
  const prev = state.stack[state.stack.length - 1];
  const left = Math.max(state.x, prev.x);
  const right = Math.min(state.x + state.width, prev.x + prev.w);
  const overlap = right - left;
  if (overlap < 0.04) return { ...state, over: true };
  const perfect = Math.abs(state.x - prev.x) < 0.025;
  const piece = perfect ? { x: prev.x, w: prev.w } : { x: left, w: overlap };
  return {
    ...state,
    stack: state.stack.concat(piece),
    width: piece.w,
    x: 0,
    dir: 1,
    speed: Math.min(0.95, state.speed + 0.035),
    perfect: state.perfect + (perfect ? 1 : 0),
  };
}

export function built(state) {
  return state.stack.length >= state.goal;
}
