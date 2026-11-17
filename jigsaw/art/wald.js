// Wälder im Nebel: gestaffelte Tannenreihen, Sonnenstrahlen, Waldboden mit Pilzen und Farnen.
import { mix, lighten, darken, rgba, vgrad, hills, yAt, pathBelow, glow, mist, pine, brushStrokes, grain, vignette, dab, TAU } from './kit.js';

function mushroom(ctx, x, y, s, cap) {
  ctx.fillStyle = '#f4ead8';
  ctx.beginPath();
  ctx.moveTo(x - s * 0.18, y);
  ctx.quadraticCurveTo(x - s * 0.22, y - s * 0.5, x - s * 0.12, y - s * 0.7);
  ctx.lineTo(x + s * 0.12, y - s * 0.7);
  ctx.quadraticCurveTo(x + s * 0.22, y - s * 0.5, x + s * 0.18, y);
  ctx.fill();
  ctx.fillStyle = cap;
  ctx.beginPath();
  ctx.ellipse(x, y - s * 0.7, s * 0.55, s * 0.4, 0, Math.PI, TAU);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  for (const [dx, dy, r] of [[-0.25, -0.88, 0.08], [0.1, -0.98, 0.07], [0.3, -0.8, 0.06], [-0.05, -0.78, 0.05]]) {
    ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, r * s, 0, TAU); ctx.fill();
  }
}

function fern(ctx, rng, x, y, s, color) {
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  for (let f = 0; f < 5; f++) {
    const a = -Math.PI / 2 + (f - 2) * 0.45 + rng.range(-0.1, 0.1);
    const ex = x + Math.cos(a) * s, ey = y + Math.sin(a) * s;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a) * s * 0.6, y + Math.sin(a) * s * 0.4, ex, ey + s * 0.25); ctx.stroke();
    for (let k = 1; k < 9; k++) {
      const t = k / 9;
      const px = x + (ex - x) * t, py = y + (ey + s * 0.25 - y) * t - Math.sin(t * Math.PI) * s * 0.12;
      const l = s * 0.18 * (1 - t * 0.7);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - l * 0.7, py - l * 0.5); ctx.moveTo(px, py); ctx.lineTo(px + l * 0.7, py - l * 0.5); ctx.stroke();
    }
  }
}

export default {
  id: 'wald',
  title: 'Wald',
  paint(ctx, P) {
    const { w, h, rng, pal } = P;
    const haze = pal.haze || pal.sky[pal.sky.length - 1];
    const ground = pal.ground || mix(pal.near, '#79a85a', 0.5);
    const accents = pal.accents || ['#e8453c'];

    ctx.fillStyle = vgrad(ctx, 0, h * 0.7, pal.sky);
    ctx.fillRect(0, 0, w, h);
    const sunX = rng.range(0.2, 0.8) * w, sunY = h * rng.range(0.08, 0.2);
    glow(ctx, sunX, sunY, w * 0.8, pal.sun, 0.55);

    const layers = 6;
    let last = null;
    for (let i = 0; i < layers; i++) {
      const t = i / (layers - 1);
      const color = mix(mix(pal.far, haze, 0.35), pal.near, t);
      const base = h * (0.42 + t * 0.4);
      const pts = hills(rng, { w, base, amp: 20 + t * 20, waves: 2 });
      // Baumreihe
      const size = 18 + t * 70;
      for (let x = rng.range(-20, 0); x < w + 20; x += rng.range(size * 0.25, size * 0.6)) {
        const th = size * rng.range(2.2, 4.2);
        pine(ctx, x, yAt(pts, x) + size * 0.2, th, size * rng.range(0.8, 1.1), color);
      }
      pathBelow(ctx, pts, h, true);
      ctx.fillStyle = color;
      ctx.fill();
      if (i < layers - 1) mist(ctx, P, base - size * 0.3, size * 0.9, haze, 0.55 - t * 0.25);
      last = pts;
    }
    // Sonnenstrahlen durch den Nebel
    for (let k = 0; k < 7; k++) {
      const a = Math.PI / 2 + rng.range(-0.5, 0.5);
      const len = h * 1.2, spread = rng.range(0.03, 0.07);
      const g = ctx.createLinearGradient(sunX, sunY, sunX + Math.cos(a) * len, sunY + Math.sin(a) * len);
      g.addColorStop(0, rgba(pal.sun, 0.28));
      g.addColorStop(1, rgba(pal.sun, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(sunX, sunY);
      ctx.lineTo(sunX + Math.cos(a - spread) * len, sunY + Math.sin(a - spread) * len);
      ctx.lineTo(sunX + Math.cos(a + spread) * len, sunY + Math.sin(a + spread) * len);
      ctx.closePath();
      ctx.fill();
    }
    // Waldboden
    const floor = hills(rng, { w, base: h * 0.9, amp: 18, waves: 2 });
    pathBelow(ctx, floor, h, true);
    ctx.fillStyle = vgrad(ctx, h * 0.86, h, [mix(ground, pal.sun, 0.15), darken(ground, 0.3)]);
    ctx.fill();
    ctx.save();
    pathBelow(ctx, floor, h, true);
    ctx.clip();
    brushStrokes(ctx, rng, { y0: h * 0.86, y1: h, count: 160, alpha: 0.4, len: [10, 50], thick: [2, 6], tilt: 0.5, colorAt: () => ground });
    ctx.restore();
    for (let k = 0; k < 6; k++) fern(ctx, rng, rng.range(0, w), yAt(floor, rng.range(0, w)) + rng.range(20, 60), rng.range(50, 90), rgba(lighten(ground, 0.1), 0.9));
    for (let k = 0; k < rng.int(2, 5); k++) {
      const x = rng.range(0.1, 0.9) * w;
      mushroom(ctx, x, yAt(floor, x) + rng.range(30, 70), rng.range(26, 46), accents[0]);
    }
    for (let k = 0; k < 30; k++) dab(ctx, rng.range(0, w), rng.range(h * 0.9, h), 3, 3, 0, rgba(accents[k % accents.length], 0.8));

    grain(ctx, rng, P, 0.07);
    vignette(ctx, P, 0.2);
  },
};
