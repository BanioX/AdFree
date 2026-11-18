export function newWall(diff) {
  const cols = diff === 'schwer' ? 8 : diff === 'leicht' ? 5 : 6;
  const rows = diff === 'leicht' ? 3 : 4;
  const bricks = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) bricks.push({ c, r, on: true });
  }
  return {
    cols, rows, bricks, score: 0,
    ball: { x: 0.5, y: 0.75, vx: 0.22, vy: -0.38 },
    paddle: 0.5,
  };
}

export function stepBall(state, dt, paddle) {
  const sec = Math.min(dt, 32) / 1000;
  let { x, y, vx, vy } = state.ball;
  x += vx * sec;
  y += vy * sec;
  if (x < 0.03) { x = 0.03; vx = Math.abs(vx); }
  if (x > 0.97) { x = 0.97; vx = -Math.abs(vx); }
  if (y < 0.04) { y = 0.04; vy = Math.abs(vy); }
  if (y > 0.9 && y < 0.96 && vy > 0 && Math.abs(x - paddle) < 0.13) {
    y = 0.9;
    vy = -Math.abs(vy);
    vx = Math.max(-0.55, Math.min(0.55, vx + (x - paddle) * 1.1));
  }
  if (y > 1.05) {
    return { ...state, paddle, ball: { x: paddle, y: 0.75, vx: 0.22, vy: -0.38 }, dropped: true };
  }
  const bricks = state.bricks.map((b) => ({ ...b }));
  const bw = 1 / state.cols;
  const bh = 0.07;
  let score = state.score;
  for (const brick of bricks) {
    if (!brick.on) continue;
    const left = brick.c * bw;
    const top = 0.08 + brick.r * 0.08;
    if (x >= left && x <= left + bw * 0.96 && y >= top && y <= top + bh) {
      brick.on = false;
      vy = -vy;
      score += 10;
      break;
    }
  }
  return { ...state, bricks, score, paddle, ball: { x, y, vx, vy }, dropped: false };
}

export function cleared(state) {
  return state.bricks.every((b) => !b.on);
}
