// Blütenzweige: Äste voller Blüten vor einem weichen Himmel mit Bergsilhouette und Bokeh.
import { mix, lighten, darken, rgba, vgrad, ridge, pathBelow, glow, mist, brushStrokes, grain, vignette, dab, TAU } from './kit.js';

function blossom(ctx, rng, x, y, r, color) {
  const rot = rng.range(0, TAU);
  for (let k = 0; k < 5; k++) {
    const a = rot + (k / 5) * TAU;
    const px = x + Math.cos(a) * r * 0.55, py = y + Math.sin(a) * r * 0.55;
    ctx.fillStyle = k % 2 ? color : lighten(color, 0.18);
    ctx.beginPath();
    ctx.ellipse(px, py, r * 0.55, r * 0.42, a, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = rgba(darken(color, 0.3), 0.8);
  ctx.beginPath(); ctx.arc(x, y, r * 0.22, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffe28a';
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU + rot;
    ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * 0.3, y + Math.sin(a) * r * 0.3, r * 0.06, 0, TAU); ctx.fill();
  }
}

export default {
  id: 'bluete',
  title: 'Blüten',
  paint(ctx, P) {
    const { w, h, rng, pal } = P;
    let accents = (pal.accents || []).filter((c) => c !== '#ffffff');
    if (accents.length < 2) accents = ['#ffc2d4', '#ff9ebb', '#f27598'];
    const bark = mix(darken(pal.near, 0.2), '#4a3022', 0.7);

    ctx.fillStyle = vgrad(ctx, 0, h, pal.sky);
    ctx.fillRect(0, 0, w, h);
    brushStrokes(ctx, rng, { y0: 0, y1: h, count: 140, alpha: 0.15, len: [100, 300], thick: [6, 16], colorAt: (y) => mix(pal.sky[0], pal.sky[pal.sky.length - 1], y / h) });
    glow(ctx, rng.range(0.2, 0.8) * w, h * 0.3, w * 0.6, pal.sun, 0.5);
    // Berg in der Ferne
    const peak = rng.range(0.3, 0.7);
    const pts = ridge(rng, { w, base: h * 0.9, amp: h * 0.24, rough: 0.5, detail: 6, peaks: [[peak, 0.8, 0.22]] });
    pathBelow(ctx, pts, h);
    ctx.fillStyle = vgrad(ctx, h * 0.5, h, [rgba(pal.far, 0.85), rgba(mix(pal.far, pal.haze || '#ffffff', 0.6), 0.6)]);
    ctx.fill();
    mist(ctx, P, h * 0.82, h * 0.12, pal.haze || '#ffffff', 0.7);
    // Bokeh-Lichter
    for (let k = 0; k < 30; k++) {
      const col = accents[k % accents.length];
      ctx.fillStyle = rgba(lighten(col, 0.3), rng.range(0.12, 0.3));
      ctx.beginPath(); ctx.arc(rng.range(0, w), rng.range(0, h), rng.range(10, 50), 0, TAU); ctx.fill();
    }

    // Äste rekursiv, mit Blütenbüscheln
    const flowers = [];
    const branch = (x, y, len, angle, width, depth) => {
      const segs = 6;
      let px = x, py = y, a = angle;
      ctx.strokeStyle = bark;
      ctx.lineCap = 'round';
      for (let s = 0; s < segs; s++) {
        a += rng.range(-0.22, 0.22);
        const nx = px + Math.cos(a) * len / segs, ny = py + Math.sin(a) * len / segs;
        ctx.lineWidth = width * (1 - (s / segs) * 0.55);
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(nx, ny); ctx.stroke();
        // Glanzkante
        ctx.strokeStyle = rgba(lighten(bark, 0.35), 0.35);
        ctx.lineWidth = Math.max(1, width * 0.18);
        ctx.beginPath(); ctx.moveTo(px, py - width * 0.25); ctx.lineTo(nx, ny - width * 0.25); ctx.stroke();
        ctx.strokeStyle = bark;
        if (depth > 0 && s > 0 && rng.chance(0.5)) {
          branch(nx, ny, len * rng.range(0.45, 0.7), a + rng.range(0.4, 0.9) * (rng.chance(0.5) ? 1 : -1), width * 0.55, depth - 1);
        }
        if (depth <= 2 || s > 1) {
          const n = rng.int(3, 6);
          for (let k = 0; k < n; k++) flowers.push([nx + rng.range(-40, 40), ny + rng.range(-36, 36), rng.range(14, 28)]);
        }
        px = nx; py = ny;
      }
      for (let k = 0; k < 7; k++) flowers.push([px + rng.range(-34, 34), py + rng.range(-34, 34), rng.range(12, 24)]);
    };
    const fromLeft = rng.chance(0.5);
    const sx = fromLeft ? -20 : w + 20, sy = rng.range(0.1, 0.4) * h;
    const dir = fromLeft ? 0 : Math.PI;
    branch(sx, sy, w * 1.0, dir + (fromLeft ? 1 : -1) * rng.range(0.15, 0.45), 40, 3);
    branch(fromLeft ? w + 20 : -20, rng.range(0.55, 0.8) * h, w * 0.75, (fromLeft ? Math.PI : 0) - (fromLeft ? 1 : -1) * rng.range(0.1, 0.4), 30, 3);
    // Blüten (Knospen dunkler)
    for (const [x, y, r] of flowers) {
      const col = accents[Math.min(accents.length - 1, Math.floor(rng.next() ** 1.6 * accents.length))];
      if (rng.chance(0.15)) dab(ctx, x, y, r * 0.3, r * 0.4, rng.range(0, TAU), darken(col, 0.15));
      else blossom(ctx, rng, x, y, r, mix(col, '#ffffff', rng.range(0, 0.15)));
    }
    // fallende Blütenblätter
    for (let k = 0; k < 40; k++) {
      dab(ctx, rng.range(0, w), rng.range(0, h), rng.range(4, 9), rng.range(2.5, 5), rng.range(0, TAU), rgba(accents[k % accents.length], 0.85));
    }

    grain(ctx, rng, P, 0.07);
    vignette(ctx, P, 0.12);
  },
};
