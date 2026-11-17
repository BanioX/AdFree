// Unterwasserwelt: Lichtstrahlen, Blasen, Korallen, Seegras und bunte Fische.
import { mix, lighten, darken, rgba, vgrad, hills, yAt, pathBelow, glow, brushStrokes, grain, vignette, dab, TAU } from './kit.js';

function fish(ctx, rng, x, y, s, color, dir) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  // Schwanz
  ctx.fillStyle = darken(color, 0.12);
  ctx.beginPath();
  ctx.moveTo(-s * 0.8, 0);
  ctx.lineTo(-s * 1.35, -s * 0.45);
  ctx.quadraticCurveTo(-s * 1.15, 0, -s * 1.35, s * 0.45);
  ctx.closePath();
  ctx.fill();
  // Körper
  const g = ctx.createLinearGradient(0, -s * 0.5, 0, s * 0.5);
  g.addColorStop(0, lighten(color, 0.2));
  g.addColorStop(1, darken(color, 0.15));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, s, s * 0.52, 0, 0, TAU);
  ctx.fill();
  // Streifen
  if (rng.chance(0.6)) {
    ctx.save();
    ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.52, 0, 0, TAU); ctx.clip();
    ctx.fillStyle = rgba('#ffffff', 0.75);
    for (const sx of [-0.35, 0.15]) ctx.fillRect(sx * s, -s, s * 0.16, s * 2);
    ctx.restore();
  }
  // Flosse, Auge
  ctx.fillStyle = darken(color, 0.1);
  ctx.beginPath();
  ctx.moveTo(-s * 0.1, -s * 0.45);
  ctx.quadraticCurveTo(s * 0.1, -s * 0.85, s * 0.35, -s * 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(s * 0.55, -s * 0.1, s * 0.14, 0, TAU); ctx.fill();
  ctx.fillStyle = '#1a1a2a';
  ctx.beginPath(); ctx.arc(s * 0.58, -s * 0.1, s * 0.07, 0, TAU); ctx.fill();
  ctx.restore();
}

function coralBranch(ctx, rng, x, y, len, angle, width, color, depth) {
  const ex = x + Math.cos(angle) * len, ey = y + Math.sin(angle) * len;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + Math.cos(angle + 0.3) * len * 0.5, y + Math.sin(angle + 0.3) * len * 0.5, ex, ey);
  ctx.stroke();
  if (depth <= 0) {
    dab(ctx, ex, ey, width * 0.7, width * 0.7, 0, lighten(color, 0.25));
    return;
  }
  const k = rng.int(2, 3);
  for (let i = 0; i < k; i++) {
    coralBranch(ctx, rng, ex, ey, len * rng.range(0.6, 0.8), angle + rng.range(-0.7, 0.7), width * 0.72, color, depth - 1);
  }
}

function seaweed(ctx, rng, x, base, height, color) {
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  const ph = rng.range(0, TAU), amp = rng.range(10, 26);
  let px = x, py = base;
  for (let k = 1; k <= 16; k++) {
    const t = k / 16;
    const nx = x + Math.sin(t * 6 + ph) * amp * t, ny = base - height * t;
    ctx.lineWidth = 12 * (1 - t * 0.8);
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(nx, ny); ctx.stroke();
    px = nx; py = ny;
  }
}

export default {
  id: 'unterwasser',
  title: 'Unterwasser',
  paint(ctx, P) {
    const { w, h, rng, pal } = P;
    const accents = pal.accents || ['#ff7f6a', '#ffd166'];
    const sand = pal.ground || '#e4cf9c';

    ctx.fillStyle = vgrad(ctx, 0, h, pal.sky);
    ctx.fillRect(0, 0, w, h);
    brushStrokes(ctx, rng, { y0: 0, y1: h, count: 160, alpha: 0.12, len: [80, 260], thick: [6, 18], colorAt: (y) => mix(pal.sky[0], pal.sky[pal.sky.length - 1], y / h) });
    // Wasseroberfläche schimmert
    glow(ctx, w * rng.range(0.3, 0.7), -40, w * 0.8, pal.sun, 0.5);
    // Lichtstrahlen
    const sx = rng.range(0.2, 0.8) * w;
    for (let k = 0; k < 9; k++) {
      const x0 = sx + rng.range(-300, 300), spread = rng.range(40, 120);
      const g = ctx.createLinearGradient(0, 0, 0, h * 0.85);
      g.addColorStop(0, rgba(pal.sun, rng.range(0.12, 0.25)));
      g.addColorStop(1, rgba(pal.sun, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x0 - spread * 0.2, 0);
      ctx.lineTo(x0 + spread * 0.2, 0);
      ctx.lineTo(x0 + spread + (x0 - sx) * 0.6, h * 0.85);
      ctx.lineTo(x0 - spread + (x0 - sx) * 0.6, h * 0.85);
      ctx.closePath();
      ctx.fill();
    }
    // Ferne Felsen
    const far = hills(rng, { w, base: h * 0.74, amp: 50, waves: 3 });
    pathBelow(ctx, far, h, true);
    ctx.fillStyle = rgba(mix(pal.far, pal.sky[1], 0.4), 0.8);
    ctx.fill();
    // Sandboden
    const floor = hills(rng, { w, base: h * 0.86, amp: 30, waves: 2 });
    pathBelow(ctx, floor, h, true);
    ctx.fillStyle = vgrad(ctx, h * 0.8, h, [mix(sand, pal.sky[1], 0.35), sand, darken(sand, 0.15)]);
    ctx.fill();
    ctx.save();
    pathBelow(ctx, floor, h, true);
    ctx.clip();
    brushStrokes(ctx, rng, { y0: h * 0.8, y1: h, count: 160, alpha: 0.3, len: [20, 80], thick: [2, 5], colorAt: () => sand });
    for (let k = 0; k < 40; k++) dab(ctx, rng.range(0, w), rng.range(h * 0.88, h), rng.range(3, 9), rng.range(2, 5), 0, rgba(lighten(sand, 0.3), 0.7));
    ctx.restore();

    // Seegras hinten
    for (let k = 0; k < 10; k++) {
      const x = rng.range(0, w);
      seaweed(ctx, rng, x, yAt(floor, x) + 10, rng.range(160, 360), rgba(mix('#2e8b57', pal.far, 0.4), 0.85));
    }
    // Korallen
    for (let k = 0; k < 7; k++) {
      const x = rng.range(0.03, 0.97) * w, y = yAt(floor, x) + rng.range(10, 40);
      const col = accents[k % accents.length];
      if (rng.chance(0.65)) {
        for (let b = 0; b < 3; b++) coralBranch(ctx, rng, x, y, rng.range(40, 70), -Math.PI / 2 + rng.range(-0.6, 0.6), 14, col, 3);
      } else {
        // Hirnkoralle
        const r = rng.range(40, 70);
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.7, 0, Math.PI, TAU); ctx.fill();
        ctx.strokeStyle = rgba(darken(col, 0.25), 0.6);
        ctx.lineWidth = 3;
        for (let j = 1; j < 4; j++) { ctx.beginPath(); ctx.ellipse(x, y, r * j / 4, r * 0.7 * j / 4, 0, Math.PI, TAU); ctx.stroke(); }
      }
    }
    // Seesterne und Muscheln
    for (let k = 0; k < 4; k++) {
      const x = rng.range(0.05, 0.95) * w, y = rng.range(h * 0.9, h * 0.98), r = rng.range(14, 24);
      ctx.fillStyle = k % 2 ? '#ff8a5c' : '#ffb24a';
      ctx.beginPath();
      for (let j = 0; j < 10; j++) {
        const a = -Math.PI / 2 + (j / 10) * TAU, rr = j % 2 ? r * 0.42 : r;
        j ? ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
    }
    // Fische: ein Schwarm und einige grosse
    const sxm = rng.range(0.2, 0.8) * w, sym = rng.range(0.2, 0.45) * h, dirS = rng.chance(0.5) ? 1 : -1;
    for (let k = 0; k < 18; k++) {
      fish(ctx, rng, sxm + rng.range(-160, 160), sym + rng.range(-90, 90), rng.range(10, 16), lighten(pal.far, 0.55), dirS);
    }
    for (let k = 0; k < 6; k++) {
      fish(ctx, rng, rng.range(0.08, 0.92) * w, rng.range(0.15, 0.78) * h, rng.range(26, 54), accents[(k + 1) % accents.length], rng.chance(0.5) ? 1 : -1);
    }
    // Blasen
    for (let k = 0; k < 40; k++) {
      const x = rng.range(0, w), y = rng.range(0, h * 0.85), r = rng.next() ** 2 * 14 + 2;
      ctx.strokeStyle = rgba('#ffffff', 0.55);
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
      ctx.fillStyle = rgba('#ffffff', 0.5);
      ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.25, 0, TAU); ctx.fill();
    }

    grain(ctx, rng, P, 0.06);
    vignette(ctx, P, 0.25, '#001020');
  },
};
