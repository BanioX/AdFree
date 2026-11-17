// Sonnenuntergang am Meer: Sonne, leuchtende Schleierwolken, Glitzerpfad, Inseln, Boote, Palmen.
import {
  mix, lighten, darken, rgba, ramp, vgrad, hills, ridge, pathBelow, glow, disc, streak,
  paintSky, brushStrokes, grain, vignette, TAU,
} from './kit.js';

function palm(ctx, rng, x, base, height, color, lean) {
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  const topX = x + lean * height * 0.35, topY = base - height;
  // Stamm in Segmenten
  for (let k = 0; k < 12; k++) {
    const t0 = k / 12, t1 = (k + 1) / 12;
    const bx = (t) => x + lean * height * 0.35 * t * t, by = (t) => base - height * t;
    ctx.lineWidth = height * 0.045 * (1 - t0 * 0.45);
    ctx.beginPath();
    ctx.moveTo(bx(t0), by(t0));
    ctx.lineTo(bx(t1), by(t1));
    ctx.stroke();
  }
  // Wedel: geschwungene Mittelrippe mit vielen Fiederblättchen
  ctx.lineCap = 'round';
  for (let f = 0; f < 9; f++) {
    const a = -Math.PI / 2 + (f / 8 - 0.5) * 3.6 + rng.range(-0.12, 0.12);
    const len = height * rng.range(0.36, 0.5);
    const droop = len * (0.25 + Math.abs(Math.cos(a)) * 0.35);
    const ex = topX + Math.cos(a) * len, ey = topY + Math.sin(a) * len * 0.55 + droop;
    const cx = topX + Math.cos(a) * len * 0.55, cy = topY + Math.sin(a) * len * 0.55 - len * 0.12;
    const pt = (t) => {
      const u = 1 - t;
      return [u * u * topX + 2 * u * t * cx + t * t * ex, u * u * topY + 2 * u * t * cy + t * t * ey];
    };
    ctx.lineWidth = height * 0.012;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(cx, cy, ex, ey);
    ctx.stroke();
    ctx.lineWidth = height * 0.008;
    for (let k = 2; k <= 16; k++) {
      const t = k / 17;
      const [px, py] = pt(t);
      const [qx, qy] = pt(Math.min(1, t + 0.05));
      const dx = qx - px, dy = qy - py, dl = Math.hypot(dx, dy) || 1;
      const nx = -dy / dl, ny = dx / dl;
      const ll = len * 0.2 * Math.sin(t * Math.PI) + len * 0.03;
      for (const sgn of [1, -1]) {
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + (nx * sgn + dx / dl * 0.6) * ll, py + (ny * sgn + dy / dl * 0.6) * ll + ll * 0.35);
        ctx.stroke();
      }
    }
  }
}

function sailboat(ctx, x, y, s, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - s, y);
  ctx.lineTo(x + s, y);
  ctx.lineTo(x + s * 0.7, y + s * 0.28);
  ctx.lineTo(x - s * 0.75, y + s * 0.28);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - s * 0.05, y - s * 0.08);
  ctx.lineTo(x - s * 0.05, y - s * 1.9);
  ctx.lineTo(x - s * 0.95, y - s * 0.12);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + s * 0.08, y - s * 0.12);
  ctx.lineTo(x + s * 0.08, y - s * 1.55);
  ctx.lineTo(x + s * 0.75, y - s * 0.15);
  ctx.closePath();
  ctx.fill();
}

function bird(ctx, x, y, s, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.2, s * 0.14);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - s, y - s * 0.2);
  ctx.quadraticCurveTo(x - s * 0.45, y - s * 0.55, x, y);
  ctx.quadraticCurveTo(x + s * 0.45, y - s * 0.55, x + s, y - s * 0.2);
  ctx.stroke();
}

export default {
  id: 'meer',
  title: 'Meer',
  paint(ctx, P) {
    const { w, h, rng, pal } = P;
    const o = P.opts || {};
    const horizon = h * (o.horizon ?? rng.range(0.5, 0.58));
    const haze = pal.haze || pal.sky[pal.sky.length - 1];

    paintSky(ctx, P, horizon, { strokes: 160, alpha: 0.2 });
    const sunX = (o.sunX ?? rng.range(0.3, 0.7)) * w;
    const sunR = w * rng.range(0.06, 0.09);
    const sunY = horizon - sunR * rng.range(0.2, 2.5);
    glow(ctx, sunX, sunY, w * 0.95, pal.sun, 0.5);
    glow(ctx, sunX, sunY, w * 0.3, '#ffffff', 0.35);

    // Schleierwolken, von unten angestrahlt
    const n = rng.int(5, 9);
    for (let i = 0; i < n; i++) {
      const y = rng.range(0.08, 0.85) * horizon;
      const t = y / horizon;
      const col = mix(mix(pal.sky[0], pal.far, 0.4), mix(pal.sun, haze, 0.3), t * 0.8 + 0.2);
      streak(ctx, rng, { x: rng.range(0, w), y, w: rng.range(300, 700), h: rng.range(14, 36), color: col, alpha: 0.7 });
      streak(ctx, rng, { x: rng.range(0, w), y: y + 8, w: rng.range(200, 500), h: rng.range(6, 14), color: lighten(pal.sun, 0.2), alpha: 0.45 * t });
    }

    // Sonne (hinter dem Horizont teilweise versunken)
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, horizon);
    ctx.clip();
    disc(ctx, sunX, sunY, sunR, '#ffffff', pal.sun);
    ctx.restore();

    // Inseln am Horizont
    if (o.islands ?? rng.chance(0.75)) {
      const ix = rng.range(-0.1, 0.7) * w, iw = rng.range(0.3, 0.6) * w;
      const pts = ridge(rng, { w: iw, base: horizon + 1, amp: rng.range(25, 70), rough: 0.5, detail: 5 }).map(([x, y]) => [x + ix, y]);
      pathBelow(ctx, pts, horizon + 2, true);
      ctx.fillStyle = mix(pal.far, haze, 0.35);
      ctx.fill();
    }

    // Meer
    const sea0 = mix(pal.far, haze, 0.25), sea1 = pal.near;
    ctx.fillStyle = vgrad(ctx, horizon, h, [sea0, mix(sea0, sea1, 0.6), darken(sea1, 0.12)]);
    ctx.fillRect(0, horizon, w, h - horizon);
    // Himmelsfarben spiegeln sich
    brushStrokes(ctx, rng, {
      y0: horizon, y1: h, count: 260, alpha: 0.3, len: [40, 220], thick: [2, 6], tilt: 0.005,
      colorAt: (y) => ramp([...pal.sky].reverse(), Math.min(1, (y - horizon) / (h - horizon) * 1.3)),
    });
    // Wellenkämme
    for (let k = 0; k < 260; k++) {
      const t = rng.next() ** 1.4;
      const y = horizon + 4 + t * (h - horizon);
      const x = rng.range(-50, w + 50);
      const len = 10 + t * 90;
      ctx.strokeStyle = rgba(rng.chance(0.5) ? darken(sea1, 0.25) : lighten(sea0, 0.25), 0.25 + t * 0.2);
      ctx.lineWidth = 1 + t * 3;
      ctx.beginPath();
      ctx.moveTo(x - len / 2, y);
      ctx.quadraticCurveTo(x, y - 2 - t * 6, x + len / 2, y);
      ctx.stroke();
    }
    // Glitzerpfad der Sonne
    for (let k = 0; k < 420; k++) {
      const t = rng.next();
      const y = horizon + 2 + t * t * (h - horizon);
      const spread = sunR * 0.8 + t * t * w * 0.35;
      const x = sunX + (rng.next() - 0.5) * 2 * spread * rng.next();
      const len = 6 + t * 70;
      ctx.fillStyle = rgba(rng.chance(0.4) ? '#ffffff' : lighten(pal.sun, 0.1), rng.range(0.35, 0.85) * (1 - t * 0.5));
      ctx.beginPath();
      ctx.ellipse(x, y, len / 2, 1 + t * 2.5, 0, 0, TAU);
      ctx.fill();
    }
    glow(ctx, sunX, horizon, w * 0.35, pal.sun, 0.35);

    // Boot und Vögel
    if (o.boat ?? rng.chance(0.6)) {
      const bx = rng.chance(0.5) ? rng.range(0.12, 0.35) * w : rng.range(0.65, 0.88) * w;
      const by = horizon + rng.range(20, 70);
      sailboat(ctx, bx, by, rng.range(16, 30), rgba(darken(pal.near, 0.45), 0.9));
    }
    const birds = rng.int(0, 6);
    const bx0 = rng.range(0.15, 0.85) * w, by0 = rng.range(0.15, 0.45) * horizon;
    for (let i = 0; i < birds; i++) {
      bird(ctx, bx0 + rng.range(-120, 120), by0 + rng.range(-60, 60), rng.range(7, 16), rgba(darken(pal.near, 0.5), 0.8));
    }

    // Vordergrund: Strand mit Palme, Felsen oder offenes Meer
    const fg = o.foreground || rng.pick(['strand', 'felsen', 'offen', 'strand']);
    if (fg === 'strand') {
      const sand = pal.ground || mix(pal.sun, '#c9a070', 0.5);
      const shore = hills(rng, { w, base: h * 0.93, amp: h * 0.035, waves: 2 });
      // Schaum
      ctx.save();
      ctx.translate(0, -14);
      pathBelow(ctx, shore, h, true);
      ctx.fillStyle = rgba('#ffffff', 0.55);
      ctx.fill();
      ctx.restore();
      pathBelow(ctx, shore, h, true);
      ctx.fillStyle = vgrad(ctx, h * 0.88, h, [mix(sand, pal.sun, 0.3), darken(sand, 0.25)]);
      ctx.fill();
      ctx.save();
      pathBelow(ctx, shore, h, true);
      ctx.clip();
      brushStrokes(ctx, rng, { y0: h * 0.88, y1: h, count: 140, alpha: 0.3, len: [20, 90], thick: [2, 5], tilt: 0.05, colorAt: () => sand });
      ctx.restore();
      const side = rng.chance(0.5) ? -1 : 1;
      const px = side < 0 ? rng.range(0.06, 0.2) * w : rng.range(0.8, 0.94) * w;
      const dark = rgba(darken(pal.near, 0.55), 0.95);
      palm(ctx, rng, px, h * 0.99, h * rng.range(0.42, 0.55), dark, -side * rng.range(0.4, 0.9));
      if (rng.chance(0.6)) palm(ctx, rng, px + side * 70, h * 1.0, h * rng.range(0.28, 0.36), dark, -side * rng.range(0.6, 1.1));
    } else if (fg === 'felsen') {
      for (let i = 0; i < 3; i++) {
        const side = i % 2 ? 1 : -1;
        const cx = side < 0 ? rng.range(-0.1, 0.25) * w : rng.range(0.75, 1.1) * w;
        const rw = rng.range(280, 480), rh = rng.range(150, 330);
        const pts = ridge(rng, { w: rw, base: h + 5, amp: rh, rough: 0.5, detail: 5 }).map(([x, y]) => [x + cx - rw / 2, y]);
        pathBelow(ctx, pts, h + 5);
        const rock = darken(pal.near, 0.35);
        ctx.fillStyle = vgrad(ctx, h - rh, h, [mix(rock, pal.sun, 0.25), rock]);
        ctx.fill();
        ctx.strokeStyle = rgba('#ffffff', 0.5);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(cx, h - 6, rw * 0.6, 10, 0, Math.PI, TAU);
        ctx.stroke();
      }
    }

    grain(ctx, rng, P, 0.08);
    vignette(ctx, P, 0.18);
  },
};
