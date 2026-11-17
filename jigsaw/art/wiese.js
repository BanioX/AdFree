// Blumenwiesen: Wildblumen, Mohn, Lavendelreihen, Tulpenfelder, Sonnenblumen.
import {
  mix, lighten, darken, rgba, ramp, vgrad, hills, yAt, pathBelow, glow, disc, cloud,
  mist, paintSky, brushStrokes, grain, vignette, flower, dab, leafTree, TAU,
} from './kit.js';

const KINDS = ['wild', 'mohn', 'lavendel', 'tulpen', 'sonnen'];

function stem(ctx, x, y, len, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y + len);
  ctx.quadraticCurveTo(x + len * 0.08, y + len * 0.5, x, y);
  ctx.stroke();
}

function tulip(ctx, x, y, r, color) {
  ctx.fillStyle = darken(color, 0.12);
  ctx.beginPath();
  ctx.moveTo(x - r * 0.75, y - r * 0.6);
  ctx.quadraticCurveTo(x - r * 0.85, y + r * 0.7, x, y + r * 0.75);
  ctx.quadraticCurveTo(x + r * 0.85, y + r * 0.7, x + r * 0.75, y - r * 0.6);
  ctx.lineTo(x + r * 0.35, y - r * 0.15);
  ctx.lineTo(x, y - r * 0.75);
  ctx.lineTo(x - r * 0.35, y - r * 0.15);
  ctx.closePath();
  ctx.fill();
  dab(ctx, x, y + r * 0.1, r * 0.32, r * 0.6, 0, lighten(color, 0.12));
  dab(ctx, x - r * 0.3, y, r * 0.12, r * 0.4, 0.2, rgba('#ffffff', 0.35));
}

function sunflower(ctx, rng, x, y, r, petal, center) {
  const n = 16;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * TAU + rng.range(-0.05, 0.05);
    dab(ctx, x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.42, r * 0.13, a, k % 2 ? petal : darken(petal, 0.1));
  }
  const g = ctx.createRadialGradient(x - r * 0.1, y - r * 0.1, 0, x, y, r * 0.42);
  g.addColorStop(0, lighten(center, 0.2));
  g.addColorStop(1, darken(center, 0.35));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.4, 0, TAU);
  ctx.fill();
}

export default {
  id: 'wiese',
  title: 'Blumenwiese',
  paint(ctx, P) {
    const { w, h, rng, pal } = P;
    const o = P.opts || {};
    const kind = o.kind || KINDS[rng.int(0, KINDS.length - 1)];
    const horizon = h * rng.range(0.34, 0.4);
    const ground = pal.ground || mix(pal.near, '#79a85a', 0.6);
    const accents = pal.accents || ['#ffffff'];

    paintSky(ctx, P, horizon + 40);
    const sunX = rng.range(0.15, 0.85) * w, sunY = horizon * rng.range(0.25, 0.5);
    glow(ctx, sunX, sunY, w * 0.7, pal.sun, 0.45);
    disc(ctx, sunX, sunY, w * 0.05, '#ffffff', pal.sun);
    for (let i = 0, n = rng.int(2, 4); i < n; i++) {
      const cy = rng.range(0.1, 0.6) * horizon;
      cloud(ctx, rng, {
        x: rng.range(0, w), y: cy, w: rng.range(180, 340), h: rng.range(50, 85),
        light: mix(pal.sun, '#ffffff', 0.6), shade: mix(ramp(pal.sky, cy / horizon), pal.far, 0.25),
      });
    }

    // Ferne Hügel mit Bäumchen
    for (let i = 0; i < 3; i++) {
      const color = mix(mix(pal.far, haze(pal), 0.2), ground, i * 0.3);
      const pts = hills(rng, { w, base: horizon + i * 22 + 10, amp: 40 - i * 8, waves: 3 });
      pathBelow(ctx, pts, h, true);
      ctx.fillStyle = vgrad(ctx, horizon - 50, horizon + 120, [lighten(color, 0.08), color]);
      ctx.fill();
      if (i > 0) {
        for (let x = rng.range(0, 60); x < w; x += rng.range(30, 110)) {
          const y = yAt(pts, x) + 4;
          const s = 10 + i * 6;
          leafTree(ctx, rng, x, y, s * 2.2, darken(color, 0.25), darken(color, 0.4), lighten(color, 0.05));
        }
      }
      mist(ctx, P, horizon + i * 22 + 18, 14, haze(pal), 0.35);
    }

    // Wiese: sanft gewellte Bänder in verschiedenen Grüntönen
    const top = horizon + 60;
    ctx.fillStyle = vgrad(ctx, top - 20, h, [mix(ground, haze(pal), 0.25), ground, darken(ground, 0.35)]);
    ctx.fillRect(0, top - 6, w, h - top + 6);
    const depth = (y) => Math.max(0, (y - top) / (h - top)); // 0 fern, 1 nah
    const bands = [];
    for (let i = 0; i < 4; i++) {
      const t = (i + 1) / 5;
      const base = top + (h - top) * t * t * 0.9 + 10;
      const pts = hills(rng, { w, base, amp: 10 + 30 * t, waves: 2 });
      bands.push(pts);
      const col = mix(mix(ground, haze(pal), 0.2 - t * 0.2), darken(ground, 0.25), t * 0.6 + (i % 2 ? 0.08 : -0.04));
      pathBelow(ctx, pts, h, true);
      ctx.fillStyle = vgrad(ctx, base - 40, h, [lighten(col, 0.1), col, darken(col, 0.2)]);
      ctx.fill();
    }
    brushStrokes(ctx, rng, {
      y0: top, y1: h, count: 520, alpha: 0.3, len: [8, 60], thick: [2, 6], tilt: 0.3,
      colorAt: (y) => mix(lighten(ground, 0.25), darken(ground, 0.35), depth(y)),
    });
    // senkrechte Grashalme für Struktur
    for (let k = 0; k < 700; k++) {
      const y = rng.range(top, h);
      const d = depth(y);
      const x = rng.range(0, w), len = 4 + d * 26;
      ctx.strokeStyle = rgba(rng.chance(0.5) ? lighten(ground, 0.3) : darken(ground, 0.3), 0.35);
      ctx.lineWidth = 0.8 + d * 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + rng.range(-3, 3) * (1 + d * 3), y - len);
      ctx.stroke();
    }
    if (o.tree ?? rng.chance(0.5)) {
      const tx = rng.chance(0.5) ? rng.range(0.08, 0.25) * w : rng.range(0.75, 0.92) * w;
      const ty = yAt(bands[1], tx) + 20;
      leafTree(ctx, rng, tx, ty, h * rng.range(0.22, 0.3), darken(ground, 0.35), darken(pal.near, 0.3), lighten(ground, 0.15));
    }

    const vpX = rng.range(0.35, 0.65) * w;
    if (kind === 'lavendel' || kind === 'tulpen') {
      // Reihen, die zum Fluchtpunkt laufen: Erde dazwischen, Büsche als Band, darauf Blütentupfer
      const rows = kind === 'lavendel' ? 11 : 9;
      const colors = kind === 'tulpen' ? accents.filter((c) => c !== '#ffffff') : [accents[0], accents[1] || accents[0]];
      const soil = mix(darken(ground, 0.35), '#6b4a32', 0.35);
      const yB = h + 40;
      const xAt = (rI, t) => vpX + ((rI + 0.5) / rows - 0.5) * w * 3.4 * t;
      ctx.fillStyle = vgrad(ctx, top, h, [mix(soil, haze(pal), 0.4), soil]);
      ctx.fillRect(0, top, w, h - top);
      for (let rI = 0; rI < rows; rI++) {
        const col = colors[rI % colors.length];
        const half = (t) => w * 3.4 / rows * 0.36 * t;
        // Busch-Band
        ctx.beginPath();
        for (let k = 0; k <= 30; k++) { const t = k / 30; ctx.lineTo(xAt(rI, t) - half(t), top + t * (yB - top)); }
        for (let k = 30; k >= 0; k--) { const t = k / 30; ctx.lineTo(xAt(rI, t) + half(t), top + t * (yB - top)); }
        ctx.closePath();
        ctx.fillStyle = vgrad(ctx, top, h, [mix(kind === 'lavendel' ? col : ground, haze(pal), 0.45), darken(kind === 'lavendel' ? col : ground, 0.2)]);
        ctx.fill();
        const n = 260;
        for (let k = 0; k < n; k++) {
          const t = Math.sqrt(rng.next());
          const y = top + t * (yB - top);
          const x = xAt(rI, t) + rng.range(-1, 1) * half(t) * 0.95;
          if (x < -40 || x > w + 40) continue;
          const s = 1.5 + t * 22;
          if (kind === 'lavendel') {
            dab(ctx, x, y - s * 0.4, s * 0.16, s * 0.5, rng.range(-0.35, 0.35), k % 3 ? lighten(col, rng.range(0, 0.25)) : darken(col, 0.15));
          } else {
            if (s > 8) stem(ctx, x, y, s * 0.7, darken(ground, 0.1), Math.max(1, s * 0.08));
            tulip(ctx, x, y - s * 0.2, s * 0.4, mix(col, '#ffffff', rng.range(0, 0.12)));
          }
        }
      }
    } else {
      // Blumen in Büscheln, mit Perspektive
      const count = kind === 'sonnen' ? 300 : 900;
      const items = [];
      const clusters = [];
      for (let c = 0; c < 26; c++) clusters.push([rng.range(-0.1, 1.1) * w, rng.next() ** 0.9, accents[c % accents.length]]);
      for (let k = 0; k < count; k++) {
        const [cx, cv, ccol] = clusters[k % clusters.length];
        const v = Math.max(0, Math.min(1, cv + (rng.next() - 0.5) * 0.18));
        const x = cx + (rng.next() - 0.5) * (120 + v * 500);
        items.push([x, top + 4 + v * (h - top + 20), v, rng.chance(0.75) ? ccol : null]);
      }
      items.sort((a, b) => a[1] - b[1]);
      for (const [x, y, v, ccol] of items) {
        const r = 3 + v * v * (kind === 'sonnen' ? 46 : 19);
        if (kind === 'sonnen') {
          if (r > 10) stem(ctx, x, y, r * 2.5, darken(ground, 0.15), r * 0.14);
          if (r > 14) dab(ctx, x + r * 0.5, y + r * 1.4, r * 0.55, r * 0.25, -0.5, darken(ground, 0.05));
          sunflower(ctx, rng, x, y, r, rng.chance(0.85) ? '#ffc93c' : '#ffb02e', '#6b3e1f');
        } else {
          let col = ccol || accents[Math.floor(rng.next() * accents.length)];
          if (kind === 'mohn') col = rng.chance(0.82) ? '#e8322f' : rng.chance(0.5) ? '#4a7fd8' : '#ffffff';
          if (r > 8) stem(ctx, x, y, r * 2.2, darken(ground, 0.12), Math.max(1, r * 0.1));
          if (kind === 'mohn') {
            flower(ctx, rng, x, y, r, col, '#2a1a1a', 4);
          } else {
            flower(ctx, rng, x, y, r, col, rng.chance(0.6) ? '#ffd24a' : '#f2a03a', rng.chance(0.3) ? 6 : 5);
          }
        }
      }
    }

    // Gräser ganz vorne
    for (let k = 0; k < 90; k++) {
      const x = rng.range(0, w), y = h + 10;
      const len = rng.range(40, 140);
      ctx.strokeStyle = rgba(mix(darken(ground, 0.35), lighten(ground, 0.1), rng.next()), 0.7);
      ctx.lineWidth = rng.range(2, 5);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + rng.range(-20, 20), y - len * 0.6, x + rng.range(-40, 40), y - len);
      ctx.stroke();
    }

    grain(ctx, rng, P, 0.08);
    vignette(ctx, P, 0.14);
  },
};

function haze(pal) {
  return pal.haze || pal.sky[pal.sky.length - 1];
}
