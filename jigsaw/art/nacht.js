// Sternennächte: Milchstrasse, Mond, Polarlicht, Sternschnuppe, Hügel mit Tannen und einer Hütte.
import {
  mix, lighten, darken, rgba, vgrad, hills, ridge, yAt, pathBelow, glow, pine, sparkleStar,
  grain, vignette, brushStrokes, TAU,
} from './kit.js';

function cabin(ctx, x, base, s, wall, roof, light) {
  // warmes Fensterlicht
  glow(ctx, x, base - s * 0.45, s * 2.6, light, 0.35);
  ctx.fillStyle = wall;
  ctx.fillRect(x - s * 0.6, base - s * 0.75, s * 1.2, s * 0.75);
  ctx.fillStyle = roof;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.8, base - s * 0.7);
  ctx.lineTo(x, base - s * 1.35);
  ctx.lineTo(x + s * 0.8, base - s * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(x + s * 0.3, base - s * 1.3, s * 0.16, s * 0.4); // Kamin
  ctx.fillStyle = light;
  ctx.fillRect(x - s * 0.38, base - s * 0.55, s * 0.26, s * 0.24);
  ctx.fillRect(x + s * 0.12, base - s * 0.55, s * 0.26, s * 0.24);
  ctx.fillStyle = lighten(light, 0.4);
  ctx.fillRect(x - s * 0.36, base - s * 0.53, s * 0.1, s * 0.09);
}

export default {
  id: 'nacht',
  title: 'Nacht',
  paint(ctx, P) {
    const { w, h, rng, pal } = P;
    const o = P.opts || {};
    const horizon = h * rng.range(0.66, 0.74);
    const accents = pal.accents || ['#ffffff'];

    ctx.fillStyle = vgrad(ctx, 0, horizon, pal.sky);
    ctx.fillRect(0, 0, w, h);
    brushStrokes(ctx, rng, { y0: 0, y1: horizon, count: 120, alpha: 0.12, len: [100, 320], thick: [6, 16], colorAt: (y) => mix(pal.sky[0], pal.sky[pal.sky.length - 1], y / horizon) });

    // Milchstrasse: diagonales Band mit farbigem Nebel und dichten Sternen
    const mw = o.milkyway ?? rng.chance(0.75);
    const ax = rng.range(-0.1, 0.4) * w, ay = 0, bx = rng.range(0.6, 1.1) * w, by = horizon;
    if (mw) {
      for (let k = 0; k < 46; k++) {
        const t = rng.next();
        const off = (rng.next() - 0.5) * 140;
        const x = ax + (bx - ax) * t + off, y = ay + (by - ay) * t - off * 0.3;
        glow(ctx, x, y, rng.range(60, 170), k % 3 ? lighten(pal.sky[pal.sky.length - 1], 0.25) : accents[k % accents.length], rng.range(0.06, 0.14));
      }
      for (let k = 0; k < 900; k++) {
        const t = rng.next();
        const off = (rng.next() + rng.next() + rng.next() - 1.5) * 130;
        const x = ax + (bx - ax) * t + off, y = ay + (by - ay) * t - off * 0.3;
        ctx.fillStyle = rgba('#ffffff', rng.range(0.2, 0.8));
        ctx.fillRect(x, y, rng.range(0.8, 2), rng.range(0.8, 2));
      }
      // dunkle Staubwolken im Band
      for (let k = 0; k < 14; k++) {
        const t = rng.next();
        const x = ax + (bx - ax) * t + rng.range(-20, 20), y = ay + (by - ay) * t;
        glow(ctx, x, y, rng.range(30, 70), pal.sky[0], 0.35);
      }
    }

    // Sterne
    for (let k = 0; k < 520; k++) {
      const x = rng.range(0, w), y = rng.range(0, horizon) ** 1 * (rng.chance(0.7) ? 1 : 0.6);
      const r = rng.next() ** 3 * 2.4 + 0.6;
      ctx.fillStyle = rgba(rng.chance(0.15) ? accents[k % accents.length] : '#ffffff', rng.range(0.35, 1));
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }
    for (let k = 0; k < 9; k++) sparkleStar(ctx, rng.range(0.05, 0.95) * w, rng.range(0.03, 0.6) * horizon, rng.range(1.6, 3.4), '#ffffff', 0.9);

    // Polarlicht
    if (o.aurora ?? rng.chance(0.45)) {
      const bands = rng.int(2, 3);
      for (let b = 0; b < bands; b++) {
        const col = accents[b % accents.length];
        const baseY = horizon * rng.range(0.35, 0.6);
        const amp = rng.range(30, 80), f = rng.range(1.2, 2.6), ph = rng.range(0, TAU);
        for (let x = -20; x < w + 20; x += 5) {
          const y = baseY + Math.sin((x / w) * Math.PI * f + ph) * amp;
          const hgt = rng.range(120, 260) * (0.6 + 0.4 * Math.sin(x * 0.01 + b));
          const g = ctx.createLinearGradient(0, y - hgt, 0, y + 30);
          g.addColorStop(0, rgba(col, 0));
          g.addColorStop(0.7, rgba(col, 0.15));
          g.addColorStop(0.86, rgba(lighten(col, 0.4), 0.3));
          g.addColorStop(1, rgba(col, 0));
          ctx.fillStyle = g;
          ctx.fillRect(x, y - hgt, 6, hgt + 30);
        }
      }
    }

    // Mond
    const mx = rng.range(0.15, 0.85) * w, my = rng.range(0.1, 0.3) * horizon, mr = rng.range(38, 62);
    glow(ctx, mx, my, mr * 7, pal.sun, 0.28);
    const crescent = o.crescent ?? rng.chance(0.5);
    ctx.fillStyle = pal.sun;
    ctx.beginPath();
    if (crescent) {
      const d = mr * 0.55;
      ctx.arc(mx, my, mr, 0.95 * Math.PI, 2.05 * Math.PI, true);
      ctx.arc(mx + d * 0.35, my - d * 0.45, mr * 0.88, 2.0 * Math.PI, 0.95 * Math.PI, false);
    } else {
      ctx.arc(mx, my, mr, 0, TAU);
    }
    ctx.fill();
    if (!crescent) {
      for (let k = 0; k < 6; k++) {
        ctx.fillStyle = rgba(darken(pal.sun, 0.15), 0.35);
        ctx.beginPath();
        ctx.arc(mx + rng.range(-0.6, 0.6) * mr, my + rng.range(-0.6, 0.6) * mr, rng.range(0.08, 0.2) * mr, 0, TAU);
        ctx.fill();
      }
    }

    // Sternschnuppe
    if (o.meteor ?? rng.chance(0.6)) {
      const sx = rng.range(0.2, 0.9) * w, sy = rng.range(0.05, 0.35) * horizon, len = rng.range(140, 260);
      const g = ctx.createLinearGradient(sx, sy, sx - len, sy - len * 0.45);
      g.addColorStop(0, rgba('#ffffff', 0.95));
      g.addColorStop(1, rgba('#ffffff', 0));
      ctx.strokeStyle = g;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx - len, sy - len * 0.45);
      ctx.stroke();
      sparkleStar(ctx, sx, sy, 2.5, '#ffffff');
    }

    // Hügel
    const layers = 3;
    let front = null;
    for (let i = 0; i < layers; i++) {
      const color = mix(pal.far, pal.near, i / (layers - 1));
      const pts = i === 0
        ? ridge(rng, { w, base: horizon + 10, amp: h * 0.12, rough: 0.5, detail: 6 })
        : hills(rng, { w, base: horizon + 30 + i * h * 0.07, amp: 30 + i * 12, waves: 3 });
      pathBelow(ctx, pts, h, i > 0);
      ctx.fillStyle = vgrad(ctx, horizon - 80, h, [lighten(color, 0.06), color]);
      ctx.fill();
      // Mondlicht-Kante
      ctx.strokeStyle = rgba(pal.sun, 0.12);
      ctx.lineWidth = 2;
      ctx.beginPath();
      pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y + 1) : ctx.moveTo(x, y + 1)));
      ctx.stroke();
      const size = 12 + i * 14;
      for (let x = rng.range(0, 30); x < w; x += rng.range(size * 0.5, size * 2.2)) {
        if (rng.chance(0.25)) continue;
        pine(ctx, x, yAt(pts, x) + 6 + rng.range(0, 10), size * rng.range(1.6, 2.6), size, darken(color, 0.15));
      }
      front = pts;
    }
    // Hütte mit Licht
    if (o.cabin ?? rng.chance(0.7)) {
      const cx = rng.range(0.25, 0.75) * w;
      cabin(ctx, cx, yAt(front, cx) + 22, 46, darken(pal.near, 0.1), darken(pal.near, 0.4), '#ffcf6e');
    }
    // Glühwürmchen / Lichter im Gras
    for (let k = 0; k < 24; k++) {
      const x = rng.range(0, w), y = rng.range(yAt(front, x) + 20, h - 10);
      glow(ctx, x, y, 12, '#fff3a0', 0.5);
      ctx.fillStyle = rgba('#fffbe0', 0.9);
      ctx.fillRect(x - 1, y - 1, 2.4, 2.4);
    }

    grain(ctx, rng, P, 0.06);
    vignette(ctx, P, 0.22, '#000010');
  },
};
