// Ballonfahrt: bunte Heissluftballone über einer Hügellandschaft mit Feldern.
import {
  mix, lighten, darken, rgba, ramp, vgrad, hills, yAt, pathBelow, glow, disc, cloud,
  mist, paintSky, brushStrokes, grain, vignette, leafTree, TAU,
} from './kit.js';

function envelopePath(ctx, x, y, r) {
  // Ballonhülle: oben rund, unten zur Öffnung hin schmal
  ctx.beginPath();
  ctx.moveTo(x - r * 0.28, y + r * 1.25);
  ctx.bezierCurveTo(x - r * 0.75, y + r * 0.85, x - r * 1.02, y + r * 0.35, x - r, y - r * 0.05);
  ctx.bezierCurveTo(x - r * 0.98, y - r * 0.62, x - r * 0.55, y - r, x, y - r);
  ctx.bezierCurveTo(x + r * 0.55, y - r, x + r * 0.98, y - r * 0.62, x + r, y - r * 0.05);
  ctx.bezierCurveTo(x + r * 1.02, y + r * 0.35, x + r * 0.75, y + r * 0.85, x + r * 0.28, y + r * 1.25);
  ctx.closePath();
}

function balloon(ctx, rng, x, y, r, colors, light) {
  const c1 = colors[0], c2 = colors[1], c3 = colors[2];
  const pattern = rng.int(0, 2);
  envelopePath(ctx, x, y, r);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = c1;
  ctx.fillRect(x - r * 1.1, y - r * 1.1, r * 2.2, r * 2.5);
  // Bahnen (Gores), die der Rundung folgen
  const gores = 8;
  for (let k = 0; k < gores; k++) {
    if (k % 2) continue;
    const a0 = -Math.PI / 2 + (k / gores) * Math.PI, a1 = -Math.PI / 2 + ((k + 1) / gores) * Math.PI;
    const x0 = x + Math.sin(a0) * r * 1.02, x1 = x + Math.sin(a1) * r * 1.02;
    ctx.fillStyle = c2;
    ctx.beginPath();
    ctx.moveTo(x, y - r * 1.05);
    ctx.quadraticCurveTo(x0 - (x - x0) * 0.08, y, x + (x0 - x) * 0.3, y + r * 1.3);
    ctx.lineTo(x + (x1 - x) * 0.3, y + r * 1.3);
    ctx.quadraticCurveTo(x1 - (x - x1) * 0.08, y, x, y - r * 1.05);
    ctx.fill();
  }
  if (pattern === 1) {
    // Querband
    ctx.fillStyle = c3;
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.15, r * 1.2, r * 0.18, 0, 0, TAU);
    ctx.fill();
  } else if (pattern === 2) {
    // Zickzack-Band
    ctx.fillStyle = c3;
    ctx.beginPath();
    ctx.moveTo(x - r * 1.1, y - r * 0.1);
    for (let k = 0; k <= 10; k++) ctx.lineTo(x - r * 1.1 + k * r * 0.22, y - r * 0.1 + (k % 2 ? r * 0.2 : 0));
    ctx.lineTo(x + r * 1.1, y + r * 0.25);
    for (let k = 10; k >= 0; k--) ctx.lineTo(x - r * 1.1 + k * r * 0.22, y + r * 0.25 + (k % 2 ? r * 0.2 : 0));
    ctx.closePath();
    ctx.fill();
  }
  // Licht und Schatten für Rundung
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.05, x, y, r * 1.35);
  g.addColorStop(0, rgba(light, 0.5));
  g.addColorStop(0.45, rgba(light, 0.05));
  g.addColorStop(1, rgba('#1a1030', 0.4));
  ctx.fillStyle = g;
  ctx.fillRect(x - r * 1.1, y - r * 1.1, r * 2.2, r * 2.5);
  ctx.restore();
  // Seile und Korb
  ctx.strokeStyle = rgba('#3a2a20', 0.8);
  ctx.lineWidth = Math.max(0.8, r * 0.025);
  ctx.beginPath();
  ctx.moveTo(x - r * 0.26, y + r * 1.24); ctx.lineTo(x - r * 0.15, y + r * 1.55);
  ctx.moveTo(x + r * 0.26, y + r * 1.24); ctx.lineTo(x + r * 0.15, y + r * 1.55);
  ctx.stroke();
  ctx.fillStyle = '#8a5a32';
  ctx.fillRect(x - r * 0.18, y + r * 1.53, r * 0.36, r * 0.24);
  ctx.fillStyle = '#6a4224';
  ctx.fillRect(x - r * 0.18, y + r * 1.53, r * 0.36, r * 0.05);
}

export default {
  id: 'ballone',
  title: 'Ballone',
  paint(ctx, P) {
    const { w, h, rng, pal } = P;
    const horizon = h * rng.range(0.66, 0.72);
    const accents = (pal.accents || ['#ff6b6b', '#ffd166', '#06d6a0']).filter((c) => c !== '#ffffff');
    const haze = pal.haze || pal.sky[pal.sky.length - 1];
    const ground = pal.ground || mix(pal.near, '#79a85a', 0.6);

    paintSky(ctx, P, horizon);
    const sunX = rng.range(0.1, 0.9) * w, sunY = rng.range(0.1, 0.3) * h;
    glow(ctx, sunX, sunY, w * 0.6, pal.sun, 0.4);
    disc(ctx, sunX, sunY, w * 0.045, '#ffffff', pal.sun);
    for (let i = 0, n = rng.int(3, 5); i < n; i++) {
      const cy = rng.range(0.1, 0.65) * horizon;
      cloud(ctx, rng, {
        x: rng.range(0, w), y: cy, w: rng.range(160, 320), h: rng.range(45, 80),
        light: mix(pal.sun, '#ffffff', 0.6), shade: mix(ramp(pal.sky, cy / horizon), pal.far, 0.25), alpha: 0.9,
      });
    }

    // Landschaft mit Feldern
    for (let i = 0; i < 4; i++) {
      const t = i / 3;
      const base = horizon + i * (h - horizon) * 0.24;
      const pts = hills(rng, { w, base, amp: 24 + i * 14, waves: 3 });
      const col = mix(mix(pal.far, haze, 0.3), ground, 0.35 + t * 0.65);
      pathBelow(ctx, pts, h, true);
      ctx.fillStyle = vgrad(ctx, base - 40, h, [lighten(col, 0.08), darken(col, 0.12)]);
      ctx.fill();
      if (i > 0) {
        ctx.save();
        pathBelow(ctx, pts, h, true);
        ctx.clip();
        // Feldstreifen
        let x = rng.range(-200, 0);
        while (x < w) {
          const fw = rng.range(60, 160) * (0.6 + t);
          const fc = rng.pick([lighten(col, 0.15), darken(col, 0.1), mix(col, '#e8c76a', 0.45), mix(col, '#c9a0d8', 0.25), mix(col, '#9fcf6a', 0.4)]);
          ctx.fillStyle = rgba(fc, 0.85);
          ctx.beginPath();
          ctx.moveTo(x, base - 60);
          ctx.lineTo(x + fw, base - 60);
          ctx.lineTo(x + fw * 1.6, h);
          ctx.lineTo(x + fw * 0.4, h);
          ctx.closePath();
          ctx.fill();
          x += fw;
        }
        brushStrokes(ctx, rng, { y0: base - 40, y1: h, count: 80, alpha: 0.25, len: [20, 80], thick: [2, 5], colorAt: () => col });
        ctx.restore();
        for (let x2 = rng.range(0, 80); x2 < w; x2 += rng.range(40, 160)) {
          leafTree(ctx, rng, x2, yAt(pts, x2) + 6, 18 + i * 14, darken(col, 0.3), darken(col, 0.5), lighten(col, 0.05));
        }
      }
      if (i === 0) mist(ctx, P, base + 6, 14, haze, 0.3);
    }

    // Ballone: hinten klein, vorne gross
    const n = rng.int(5, 8);
    const list = [];
    for (let i = 0; i < n; i++) {
      const d = rng.next();
      list.push({ d, x: rng.range(0.08, 0.92) * w, y: rng.range(0.1, 0.85) * horizon * (0.6 + d * 0.4) });
    }
    list.sort((a, b) => a.d - b.d);
    for (const b of list) {
      const r = 34 + b.d * b.d * 150;
      const cols = rng.shuffle(accents.slice());
      ctx.save();
      ctx.globalAlpha = 0.75 + b.d * 0.25;
      balloon(ctx, rng, b.x, b.y, r, [cols[0], cols[1] || '#ffffff', cols[2] || '#ffffff'], pal.sun);
      ctx.restore();
    }

    grain(ctx, rng, P, 0.07);
    vignette(ctx, P, 0.14);
  },
};
